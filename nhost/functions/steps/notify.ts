export interface NotifyConfig {
  channel?: string;
  message?: string;
  recipient?: string;
}

export function executeNotify(
  config: NotifyConfig,
  previousStepOutput?: any
): { output: any } {
  // Writes notification payload to step_runs output for Hasura Event Trigger to watch & deliver
  const messagePayload = config.message || (previousStepOutput ? JSON.stringify(previousStepOutput) : 'Notification alert');

  return {
    output: {
      notification_type: config.channel || 'slack',
      recipient: config.recipient || 'default-channel',
      payload: messagePayload,
      event_trigger_ready: true
    }
  };
}
