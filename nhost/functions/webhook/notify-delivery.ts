import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  const eventPayload = req.body?.event;
  const op = eventPayload?.op;
  const newRow = eventPayload?.data?.new;

  if (op !== 'INSERT' || !newRow) {
    return res.status(200).json({ skipped: true, reason: 'Not an INSERT event' });
  }

  const output = newRow.output || {};
  const status = newRow.status;

  // Filter check: must be a notify step output with status completed
  if (status !== 'completed' || !output.event_trigger_ready) {
    return res.status(200).json({ skipped: true, reason: 'Not a completed notify step insert' });
  }

  const payload = output.payload || 'No message content';
  const recipient = output.recipient || '#general';
  const notificationType = output.notification_type || 'slack';
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log(`[NOTIFY EVENT TRIGGER FIRING] Delivery triggered for step_run ${newRow.id}`);

  if (slackWebhookUrl) {
    try {
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${notificationType.toUpperCase()} -> ${recipient}] ${payload}`
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned HTTP ${response.status}`);
      }

      console.log(`[NOTIFY DELIVERED] Sent message to Slack webhook for recipient ${recipient}`);
      return res.status(200).json({
        delivered: true,
        channel: 'slack',
        recipient,
        payload
      });
    } catch (err: any) {
      console.error(`[NOTIFY DELIVERY ERROR] Failed to post to Slack:`, err.message);
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Fallback stub path if no SLACK_WEBHOOK_URL environment variable is provided
    const stubMessage = `[STUB NOTIFY DELIVERY] Would send to ${recipient}: ${payload}`;
    console.log(stubMessage);
    return res.status(200).json({
      delivered: true,
      stubbed: true,
      recipient,
      payload,
      log: stubMessage,
      note: 'No SLACK_WEBHOOK_URL provided in environment. Executed via fallback stub path.'
    });
  }
}
