import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import crypto from 'crypto';

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
    query GetWorkflowForTrigger($workflow_id: uuid!) {
      workflows_by_pk(id: $workflow_id) {
        id
        org_id
        is_active
      }
    }
  `, { workflow_id: workflowId });

  const workflow = workflowRes.data?.workflows_by_pk;
  if (!workflow) {
    return res.status(400).json({ message: 'Workflow not found', code: 'NOT_FOUND' });
  }

  const orgId = workflow.org_id;

  // 2. Authorization Check (Layer 2 Owner-Only restriction for Webhook Triggers)
  const memberRes = await executeGraphQL(`
    query GetOrgMemberForWebhook($org_id: uuid!, $user_id: uuid!) {
      org_members(where: { org_id: { _eq: $org_id }, user_id: { _eq: $user_id } }) {
        id
        role
      }
    }
  `, { org_id: orgId, user_id: userId });

  const members = memberRes.data?.org_members || [];
  const memberRole = members[0]?.role;

  if (memberRole !== 'owner') {
    return res.status(400).json({
      message: 'UNAUTHORIZED: Only an organization owner can create webhook triggers',
      code: 'UNAUTHORIZED',
    });
  }

  // 3. Server-side Secret Generation (32-byte high-entropy hex string)
  const secret = crypto.randomBytes(32).toString('hex');

  // 4. Insert workflow_triggers row using Admin Client
  const createTriggerRes = await executeGraphQL(`
    mutation CreateWebhookTriggerRow($workflow_id: uuid!, $secret: String!) {
      insert_workflow_triggers_one(object: {
        workflow_id: $workflow_id,
        type: "webhook",
        config: { secret: $secret }
      }) {
        id
      }
    }
  `, { workflow_id: workflowId, secret });

  const triggerId = createTriggerRes.data?.insert_workflow_triggers_one?.id;
  if (!triggerId) {
    return res.status(500).json({ message: 'Failed to create webhook trigger row', code: 'INTERNAL_ERROR' });
  }

  const functionsUrl = process.env.NHOST_FUNCTIONS_URL || 'http://localhost:1337/v1/functions';
  const webhookUrl = `${functionsUrl}/webhook/inbound-trigger?trigger_id=${triggerId}`;

  return res.status(200).json({
    trigger_id: triggerId,
    webhook_url: webhookUrl,
    secret: secret,
  });
}
