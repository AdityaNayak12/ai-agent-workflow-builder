import { Request, Response } from 'express';
import { executeGraphQL } from '../lib/graphql-client';
import { executeStepsFrom } from '../lib/execute-steps';
import crypto from 'crypto';

// Server-side helper to generate cryptographically random 32-byte hex secret
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req: Request, res: Response) {
  // Extract trigger_id from route params, query, or body
  const triggerId = req.params?.trigger_id || req.query?.trigger_id || req.body?.trigger_id;

  if (!triggerId) {
    return res.status(400).json({ message: 'trigger_id is required', code: 'INVALID_INPUT' });
  }

  // Extract secret from header, query, or body
  const providedSecret =
    req.headers['x-webhook-secret'] ||
    req.query?.secret ||
    req.body?.secret;

  // 1. Fetch workflow trigger and organization details
  const triggerRes = await executeGraphQL(`
    query GetWebhookTriggerDetails($trigger_id: uuid!) {
      workflow_triggers_by_pk(id: $trigger_id) {
        id
        type
        config
        workflow_id
        workflow {
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
    }
  `, { trigger_id: triggerId });

  const trigger = triggerRes.data?.workflow_triggers_by_pk;

  if (!trigger || trigger.type !== 'webhook') {
    return res.status(404).json({ message: 'Webhook trigger not found or invalid trigger type', code: 'NOT_FOUND' });
  }

  const workflow = trigger.workflow;
  if (!workflow || !workflow.is_active) {
    return res.status(400).json({ message: 'Workflow not found or is inactive', code: 'INACTIVE_WORKFLOW' });
  }

  const expectedSecret = trigger.config?.secret;
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or missing webhook secret', code: 'UNAUTHORIZED' });
  }

  // 2. Quota Check (Quota applies equally to inbound webhook triggers)
  const org = workflow.organization;
  if (org.calls_used >= org.max_calls) {
    return res.status(400).json({
      message: 'Quota exceeded: Monthly calls limit has been reached for this organization',
      code: 'QUOTA_EXCEEDED'
    });
  }

  // 3. Create workflow_run row with triggered_by = null (system / webhook trigger)
  const createRunRes = await executeGraphQL(`
    mutation CreateWebhookWorkflowRun($workflow_id: uuid!) {
      insert_workflow_runs_one(object: {
        workflow_id: $workflow_id,
        status: "running",
        triggered_by: null
      }) {
        id
      }
    }
  `, { workflow_id: workflow.id });

  const runId = createRunRes.data?.insert_workflow_runs_one?.id;
  if (!runId) {
    return res.status(500).json({ message: 'Failed to create workflow run', code: 'INTERNAL_ERROR' });
  }

  // 4. Call executeStepsFrom starting at step_order = 1
  const executionRes = await executeStepsFrom({
    workflow_run_id: runId,
    workflow_id: workflow.id,
    org_id: org.id,
    start_step_order: 1
  });

  return res.status(200).json({
    run_id: runId,
    status: executionRes.status
  });
}
