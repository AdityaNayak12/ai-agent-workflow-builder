import { Request, Response } from 'express';

// orchestrates triggerWorkflowRun Action (stub)
export default async function handler(req: Request, res: Response) {
  const { workflow_id } = req.body?.input || {};

  return res.status(200).json({
    run_id: '00000000-0000-0000-0000-000000000001',
    status: 'pending',
  });
}
