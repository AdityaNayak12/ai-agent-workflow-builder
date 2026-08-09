import { executeGraphQL } from '../lib/graphql-client';

export interface DBWriteConfig {
  target_table?: string;
  values_from?: 'previous_output' | string;
  data?: any;
}

export async function executeDBWrite(
  workflowRunId: string,
  stepRunId: string,
  config: DBWriteConfig,
  previousStepOutput?: any
): Promise<{ output: any }> {
  // Hardcoded security rule: ALWAYS write into workflow_run_results
  let dataToWrite: any = {};
  if (config.values_from === 'previous_output' && previousStepOutput) {
    dataToWrite = previousStepOutput;
  } else if (config.data) {
    dataToWrite = config.data;
  } else if (previousStepOutput) {
    dataToWrite = previousStepOutput;
  } else {
    dataToWrite = { note: 'No payload provided' };
  }

  const res = await executeGraphQL(`
    mutation InsertRunResult($workflow_run_id: uuid!, $step_run_id: uuid!, $data: jsonb!) {
      insert_workflow_run_results_one(object: {
        workflow_run_id: $workflow_run_id,
        step_run_id: $step_run_id,
        data: $data
      }) {
        id
        created_at
      }
    }
  `, {
    workflow_run_id: workflowRunId,
    step_run_id: stepRunId,
    data: dataToWrite
  });

  const insertedId = res.data?.insert_workflow_run_results_one?.id;
  if (!insertedId && res.errors?.length) {
    throw new Error(`DB Write failed: ${res.errors[0].message}`);
  }

  return {
    output: {
      result: 'success',
      target_table: 'workflow_run_results',
      inserted_id: insertedId,
      written_data: dataToWrite
    }
  };
}
