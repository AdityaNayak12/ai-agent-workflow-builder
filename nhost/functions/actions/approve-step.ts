import { Request, Response } from 'express';

// orchestrates approveStep Action (stub)
export default async function handler(req: Request, res: Response) {
  const { step_run_id } = req.body?.input || {};

  return res.status(200).json({
    step_run_id: step_run_id || '00000000-0000-0000-0000-000000000002',
    status: 'running',
    resumed: true,
  });
}
