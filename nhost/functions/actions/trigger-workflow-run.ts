import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import { executeStepsFrom } from '../lib/execute-steps';

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

  // 5. Execute steps starting at step_order = 1
  const executionRes = await executeStepsFrom({
    workflow_run_id: runId,
    workflow_id: workflowId,
    org_id: orgId,
    start_step_order: 1,
  });

  return res.status(200).json({
    run_id: runId,
    status: executionRes.status,
  });
}
