import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import { executeLLMCall } from '../steps/llm-call';
import { executeHTTPRequest } from '../steps/http-request';
import { executeConditionalBranch } from '../steps/conditional-branch';
import { executeDBWrite } from '../steps/db-write';
import { executeNotify } from '../steps/notify';

// orchestrates triggerWorkflowRun Action with full step execution engine
export default async function handler(req: Request, res: Response) {
  const input = req.body?.input || {};
  const sessionVariables = req.body?.session_variables || {};

  const workflowId = input.workflow_id;
  const userId = sessionVariables['x-hasura-user-id'] || sessionVariables['x-hasura-User-Id'];

  if (!workflowId) {
    return res.status(400).json({ message: 'workflow_id is required', code: 'INVALID_INPUT' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'Unauthorized: Missing x-hasura-user-id session variable', code: 'UNAUTHORIZED' });
  }

  // 1. Fetch workflow and organization details
  const workflowRes = await executeGraphQL(`
    query GetWorkflowDetails($workflow_id: uuid!) {
      workflows_by_pk(id: $workflow_id) {
        id
        org_id
        is_active
        organization {
          id
          calls_used
          max_calls
        }
      }
    }
  `, { workflow_id: workflowId });

  const workflow = workflowRes.data?.workflows_by_pk;
  if (!workflow || !workflow.is_active) {
    return res.status(400).json({ message: 'Workflow not found or is inactive', code: 'NOT_FOUND' });
  }

  const orgId = workflow.org_id;
  const org = workflow.organization;

  // 2. Authorization Check (Layer 2)
  const memberRes = await executeGraphQL(`
    query GetOrgMember($org_id: uuid!, $user_id: uuid!) {
      org_members(where: { org_id: { _eq: $org_id }, user_id: { _eq: $user_id } }) {
        id
        role
      }
    }
  `, { org_id: orgId, user_id: userId });

  const members = memberRes.data?.org_members || [];
  const memberRole = members[0]?.role;

  if (!memberRole || (memberRole !== 'owner' && memberRole !== 'editor')) {
    return res.status(400).json({
      message: 'Unauthorized: Only owners or editors in this organization can trigger workflow runs',
      code: 'UNAUTHORIZED',
    });
  }

  // 3. Quota Check
  if (org.calls_used >= org.max_calls) {
    return res.status(400).json({
      message: 'Quota exceeded: Monthly calls limit has been reached for this organization',
      code: 'QUOTA_EXCEEDED',
    });
  }

  // 4. Create workflow_run row (status: running)
  const createRunRes = await executeGraphQL(`
    mutation CreateWorkflowRun($workflow_id: uuid!, $triggered_by: uuid!) {
      insert_workflow_runs_one(object: {
        workflow_id: $workflow_id,
        status: "running",
        triggered_by: $triggered_by
      }) {
        id
      }
    }
  `, { workflow_id: workflowId, triggered_by: userId });

  const runId = createRunRes.data?.insert_workflow_runs_one?.id;
  if (!runId) {
    return res.status(500).json({ message: 'Failed to create workflow run', code: 'INTERNAL_ERROR' });
  }

  // 5. Fetch ordered steps
  const stepsRes = await executeGraphQL(`
    query GetWorkflowSteps($workflow_id: uuid!) {
      workflow_steps(
        where: { workflow_id: { _eq: $workflow_id } },
        order_by: { step_order: asc }
      ) {
        id
        step_order
        type
        name
        config
      }
    }
  `, { workflow_id: workflowId });

  const steps = stepsRes.data?.workflow_steps || [];
  let isPaused = false;
  let isFailed = false;
  let billableStepCount = 0;
  let previousOutput: any = null;

  // 6. Loop through steps in order
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const config = step.config || {};

    if (step.type === 'approval_gate') {
      // Create paused step_run
      await executeGraphQL(`
        mutation CreatePausedStepRun($workflow_run_id: uuid!, $step_id: uuid!) {
          insert_step_runs_one(object: {
            workflow_run_id: $workflow_run_id,
            step_id: $step_id,
            status: "paused",
            input: { stub: true, note: "Awaiting approval" }
          }) {
            id
          }
        }
      `, { workflow_run_id: runId, step_id: step.id });

      // Update workflow_run status to paused
      await executeGraphQL(`
        mutation PauseWorkflowRun($run_id: uuid!) {
          update_workflow_runs_by_pk(
            pk_columns: { id: $run_id },
            _set: { status: "paused" }
          ) {
            id
          }
        }
      `, { run_id: runId });

      isPaused = true;
      break; // STOP loop immediately
    }

    // Create running step_run for current step
    const createStepRunRes = await executeGraphQL(`
      mutation CreateStepRun($workflow_run_id: uuid!, $step_id: uuid!) {
        insert_step_runs_one(object: {
          workflow_run_id: $workflow_run_id,
          step_id: $step_id,
          status: "running",
          input: ${JSON.stringify(config)}
        }) {
          id
        }
      }
    `, { workflow_run_id: runId, step_id: step.id });

    const stepRunId = createStepRunRes.data?.insert_step_runs_one?.id;

    if (step.type === 'llm_call' || step.type === 'http_request') {
      billableStepCount++;
      try {
        let stepRes: { output: any; attempt_count: number };
        if (step.type === 'llm_call') {
          stepRes = await executeLLMCall(config, previousOutput);
        } else {
          stepRes = await executeHTTPRequest(config);
        }

        previousOutput = stepRes.output;

        if (stepRunId) {
          await executeGraphQL(`
            mutation CompleteStepRun($step_run_id: uuid!, $output: jsonb, $attempt_count: Int!) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "completed",
                  output: $output,
                  attempt_count: $attempt_count
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, output: stepRes.output, attempt_count: stepRes.attempt_count });
        }
      } catch (err: any) {
        const attemptCount = (err as any).attempt_count || 2;
        const errorMessage = err.message || 'Step execution failed';

        if (stepRunId) {
          await executeGraphQL(`
            mutation FailStepRun($step_run_id: uuid!, $error: String!, $attempt_count: Int!) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "failed",
                  error: $error,
                  attempt_count: $attempt_count
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, error: errorMessage, attempt_count: attemptCount });
        }

        await executeGraphQL(`
          mutation FailWorkflowRun($run_id: uuid!) {
            update_workflow_runs_by_pk(
              pk_columns: { id: $run_id },
              _set: { status: "failed" }
            ) {
              id
            }
          }
        `, { run_id: runId });

        isFailed = true;
        break; // STOP loop on failure
      }
    } else if (step.type === 'conditional_branch') {
      try {
        const branchRes = executeConditionalBranch(config, previousOutput);
        previousOutput = branchRes.output;

        if (stepRunId) {
          await executeGraphQL(`
            mutation CompleteBranchStepRun($step_run_id: uuid!, $output: jsonb) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "completed",
                  output: $output,
                  attempt_count: 1
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, output: branchRes.output });
        }

        // Handle skip-to control flow jump
        if (branchRes.skip_to_order !== null && branchRes.skip_to_order !== undefined) {
          const targetIndex = steps.findIndex((s: any) => s.step_order === branchRes.skip_to_order);
          if (targetIndex > i) {
            // Record step_runs for skipped intermediate steps
            for (let j = i + 1; j < targetIndex; j++) {
              const skippedStep = steps[j];
              await executeGraphQL(`
                mutation CreateSkippedStepRun($workflow_run_id: uuid!, $step_id: uuid!) {
                  insert_step_runs_one(object: {
                    workflow_run_id: $workflow_run_id,
                    step_id: $step_id,
                    status: "skipped",
                    input: { skipped: true, note: "Skipped by conditional branch" },
                    output: { skipped: true },
                    attempt_count: 0
                  }) {
                    id
                  }
                }
              `, { workflow_run_id: runId, step_id: skippedStep.id });
            }
            // Jump loop index to target step
            i = targetIndex - 1;
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Conditional branch evaluation failed';

        if (stepRunId) {
          await executeGraphQL(`
            mutation FailBranchStepRun($step_run_id: uuid!, $error: String!) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "failed",
                  error: $error,
                  attempt_count: 1
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, error: errorMessage });
        }

        await executeGraphQL(`
          mutation FailWorkflowRun($run_id: uuid!) {
            update_workflow_runs_by_pk(
              pk_columns: { id: $run_id },
              _set: { status: "failed" }
            ) {
              id
            }
          }
        `, { run_id: runId });

        isFailed = true;
        break;
      }
    } else if (step.type === 'db_write') {
      try {
        const dbRes = await executeDBWrite(runId, stepRunId, config, previousOutput);
        previousOutput = dbRes.output;

        if (stepRunId) {
          await executeGraphQL(`
            mutation CompleteDBWriteStepRun($step_run_id: uuid!, $output: jsonb) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "completed",
                  output: $output,
                  attempt_count: 1
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, output: dbRes.output });
        }
      } catch (err: any) {
        const errorMessage = err.message || 'DB Write failed';

        if (stepRunId) {
          await executeGraphQL(`
            mutation FailDBWriteStepRun($step_run_id: uuid!, $error: String!) {
              update_step_runs_by_pk(
                pk_columns: { id: $step_run_id },
                _set: {
                  status: "failed",
                  error: $error,
                  attempt_count: 1
                }
              ) {
                id
              }
            }
          `, { step_run_id: stepRunId, error: errorMessage });
        }

        await executeGraphQL(`
          mutation FailWorkflowRun($run_id: uuid!) {
            update_workflow_runs_by_pk(
              pk_columns: { id: $run_id },
              _set: { status: "failed" }
            ) {
              id
            }
          }
        `, { run_id: runId });

        isFailed = true;
        break;
      }
    } else if (step.type === 'notify') {
      const notifyRes = executeNotify(config, previousOutput);
      previousOutput = notifyRes.output;

      if (stepRunId) {
        await executeGraphQL(`
          mutation CompleteNotifyStepRun($step_run_id: uuid!, $output: jsonb) {
            update_step_runs_by_pk(
              pk_columns: { id: $step_run_id },
              _set: {
                status: "completed",
                output: $output,
                attempt_count: 1
              }
            ) {
              id
            }
          }
        `, { step_run_id: stepRunId, output: notifyRes.output });
      }
    }
  }

  // 7. Increment org quota for executed billable steps
  if (billableStepCount > 0) {
    await executeGraphQL(`
      mutation IncrementOrgUsage($org_id: uuid!, $inc: Int!) {
        update_organizations_by_pk(
          pk_columns: { id: $org_id },
          _inc: { calls_used: $inc }
        ) {
          id
          calls_used
        }
      }
    `, { org_id: orgId, inc: billableStepCount });
  }

  // 8. Complete workflow_run if not paused and not failed
  if (!isPaused && !isFailed) {
    await executeGraphQL(`
      mutation CompleteWorkflowRun($run_id: uuid!) {
        update_workflow_runs_by_pk(
          pk_columns: { id: $run_id },
          _set: { status: "completed" }
        ) {
          id
        }
      }
    `, { run_id: runId });
  }

  const finalStatus = isPaused ? 'paused' : isFailed ? 'failed' : 'completed';

  return res.status(200).json({
    run_id: runId,
    status: finalStatus,
  });
}
