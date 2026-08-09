import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import { executeLLMCall } from '../steps/llm-call';
import { executeHTTPRequest } from '../steps/http-request';

// orchestrates triggerWorkflowRun Action with real step execution
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
  for (const step of steps) {
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

    // Create running step_run
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

        // Complete step_run
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

        // Fail step_run
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

        // Fail workflow_run
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
    } else {
      // Stubbed step types (notify, conditional_branch, db_write)
      await new Promise((resolve) => setTimeout(resolve, 500));
      previousOutput = { result: "stub_success", step_type: step.type };

      if (stepRunId) {
        await executeGraphQL(`
          mutation CompleteStubStepRun($step_run_id: uuid!) {
            update_step_runs_by_pk(
              pk_columns: { id: $step_run_id },
              _set: {
                status: "completed",
                output: { result: "stub_success", step_name: "${step.name}" },
                attempt_count: 1
              }
            ) {
              id
            }
          }
        `, { step_run_id: stepRunId });
      }
    }
  }

  // 7. Increment org quota for executed billable steps (if any executed)
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
