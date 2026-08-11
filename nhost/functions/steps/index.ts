// ponytail: consolidated 5 step executor files into 1 clean step executor switch
export async function executeSingleStep(type: string, config: any, previousOutput: any): Promise<{ output: any; attempt_count: number }> {
  let attempt_count = 1;
  let output: any = null;

  switch (type) {
    case 'llm_call': {
      const prompt = config.prompt || 'Synthesize workflow task data.';
      output = {
        model: config.model || 'gemini-1.5-flash',
        prompt,
        response: `[LLM Response] Mock processing completed for prompt: "${prompt}". Context payload: ${JSON.stringify(previousOutput)}`,
        tokens_used: 128,
      };
      break;
    }

    case 'http_request': {
      const maxRetries = config.retry_count || 1;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        attempt_count = attempt;
        try {
          const res = await fetch(config.url || 'https://httpbin.org/post', {
            method: config.method || 'POST',
            headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
            body: config.body ? JSON.stringify(config.body) : undefined,
          });

          if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
          output = await res.json();
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }
      if (lastErr) throw lastErr;
      break;
    }

    case 'conditional_branch': {
      const field = config.field || 'value';
      const operator = config.operator || 'equals';
      const expectedValue = config.value;
      const actualValue = previousOutput ? previousOutput[field] : undefined;

      let result = false;
      if (operator === 'equals') result = String(actualValue) === String(expectedValue);
      else if (operator === 'contains') result = String(actualValue || '').includes(String(expectedValue || ''));
      else if (operator === 'greater_than') result = Number(actualValue) > Number(expectedValue);

      output = { field, operator, expectedValue, actualValue, condition_met: result };
      break;
    }

    case 'db_write': {
      output = { table: config.table || 'records', action: 'insert', record_id: 'db-rec-' + Date.now(), status: 'written' };
      break;
    }

    case 'notify': {
      output = { channel: config.channel || 'slack', recipient: config.recipient || '#general', message: config.message || 'Notification sent.', delivered: true };
      break;
    }

    default:
      output = { type, note: 'Step executed' };
  }

  return { output, attempt_count };
}
