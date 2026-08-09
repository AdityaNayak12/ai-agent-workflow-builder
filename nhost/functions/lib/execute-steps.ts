import { executeGraphQL } from './graphql-client';
import { executeLLMCall } from '../steps/llm-call';
import { executeHTTPRequest } from '../steps/http-request';
import { executeConditionalBranch } from '../steps/conditional-branch';
import { executeDBWrite } from '../steps/db-write';
import { executeNotify } from '../steps/notify';

export interface ExecuteStepsParams {
  workflow_run_id: string;
  workflow_id: string;
  org_id: string;
  start_step_order?: number;
  initial_previous_output?: any;
}

export async function executeStepsFrom({
  workflow_run_id,
  workflow_id,
  org_id,
  start_step_order = 1,
  initial_previous_output = null,
}: ExecuteStepsParams): Promise<{ status: 'completed' | 'paused' | 'failed' }> {
  // Fetch ordered steps starting at or after start_step_order
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
  `, { workflow_id });

  const allSteps = stepsRes.data?.workflow_steps || [];
  const stepsToExecute = allSteps.filter((s: any) => s.step_order >= start_step_order);

  let isPaused = false;
  let isFailed = false;
  let billableStepCount = 0;
  let previousOutput: any = initial_previous_output;

  for (let i = 0; i < stepsToExecute.length; i++) {
    const step = stepsToExecute[i];
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
      `, { workflow_run_id, step_id: step.id });

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
      `, { run_id: workflow_run_id });

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
    `, { workflow_run_id, step_id: step.id });

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
        `, { run_id: workflow_run_id });

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

        if (branchRes.skip_to_order !== null && branchRes.skip_to_order !== undefined) {
          const targetIndex = stepsToExecute.findIndex((s: any) => s.step_order === branchRes.skip_to_order);
          if (targetIndex > i) {
            for (let j = i + 1; j < targetIndex; j++) {
              const skippedStep = stepsToExecute[j];
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
              `, { workflow_run_id, step_id: skippedStep.id });
            }
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
        `, { run_id: workflow_run_id });

        isFailed = true;
        break;
      }
    } else if (step.type === 'db_write') {
      try {
        const dbRes = await executeDBWrite(workflow_run_id, stepRunId, config, previousOutput);
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
        `, { run_id: workflow_run_id });

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

  // Increment org quota for executed billable steps
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
    `, { org_id, inc: billableStepCount });
  }

  // Complete workflow_run if not paused and not failed
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
    `, { run_id: workflow_run_id });
  }

  const finalStatus = isPaused ? 'paused' : isFailed ? 'failed' : 'completed';
  return { status: finalStatus };
}
