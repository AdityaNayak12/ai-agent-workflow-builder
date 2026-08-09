import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import { executeStepsFrom } from '../lib/execute-steps';

export default async function handler(req: Request, res: Response) {
  const input = req.body?.input || {};
  const sessionVariables = req.body?.session_variables || {};

  const stepRunId = input.step_run_id;
  const userId = sessionVariables['x-hasura-user-id'] || sessionVariables['x-hasura-User-Id'];

  if (!stepRunId) {
    return res.status(400).json({ message: 'step_run_id is required', code: 'INVALID_INPUT' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'Unauthorized: Missing x-hasura-user-id session variable', code: 'UNAUTHORIZED' });
  }

  // 1. Fetch step_run details along with workflow_step, workflow_run, and workflow
  const stepRunRes = await executeGraphQL(`
    query GetStepRunDetailsForApprove($step_run_id: uuid!) {
      step_runs_by_pk(id: $step_run_id) {
        id
        status
        workflow_run_id
        workflow_step {
          id
          step_order
        }
        workflow_run {
          id
          workflow_id
          status
          workflow {
            id
            org_id
          }
        }
      }
    }
  `, { step_run_id: stepRunId });

  const stepRun = stepRunRes.data?.step_runs_by_pk;
  if (!stepRun) {
    return res.status(400).json({ message: 'Step run not found', code: 'NOT_FOUND' });
  }

  // Check 1: Must be in paused status
  if (stepRun.status !== 'paused') {
    return res.status(400).json({
      message: `Cannot approve step: Step run is in status "${stepRun.status}", not "paused"`,
      code: 'INVALID_STATE'
    });
  }

  const workflowRun = stepRun.workflow_run;
  const workflow = workflowRun?.workflow;
  const orgId = workflow?.org_id;

  if (!orgId) {
    return res.status(500).json({ message: 'Failed to resolve organization for step run', code: 'INTERNAL_ERROR' });
  }

  // Check 2: Authorization Check (Layer 2)
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
      message: 'Unauthorized: Only owners or editors in this organization can approve step runs',
      code: 'UNAUTHORIZED'
    });
  }

  // 3. Mark step_run as completed with approved_by and approved_at
  await executeGraphQL(`
    mutation ApproveStepRun($step_run_id: uuid!, $user_id: uuid!) {
      update_step_runs_by_pk(
        pk_columns: { id: $step_run_id },
        _set: {
          status: "completed",
          approved_by: $user_id
        }
      ) {
        id
      }
    }
  `, { step_run_id: stepRunId, user_id: userId });

  // 4. Update workflow_run status back to running
  await executeGraphQL(`
    mutation ResumeWorkflowRun($run_id: uuid!) {
      update_workflow_runs_by_pk(
        pk_columns: { id: $run_id },
        _set: { status: "running" }
      ) {
        id
      }
    }
  `, { run_id: workflowRun.id });

  // 5. Resume step execution loop starting at step_order + 1
  const pausedStepOrder = stepRun.workflow_step.step_order;
  const resumeRes = await executeStepsFrom({
    workflow_run_id: workflowRun.id,
    workflow_id: workflowRun.workflow_id,
    org_id: orgId,
    start_step_order: pausedStepOrder + 1,
    initial_previous_output: { approved: true, approved_by: userId }
  });

  return res.status(200).json({
    step_run_id: stepRunId,
    status: resumeRes.status,
    resumed: true
  });
}
