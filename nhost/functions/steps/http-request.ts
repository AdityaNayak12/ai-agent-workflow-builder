import { StepExecutionResult } from './llm-call';

export interface HTTPRequestConfig {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}

export async function executeHTTPRequest(config: HTTPRequestConfig): Promise<StepExecutionResult> {
  const method = (config.method || 'GET').toUpperCase();
  const url = config.url || '';

  if (!url) {
    const err = new Error('HTTP Request step failed: Missing URL in config');
    (err as any).attempt_count = 1;
    throw err;
  }

  // Scheme safeguard
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const err = new Error(`HTTP Request step failed: Invalid URL scheme "${url}". URL must start with http:// or https://`);
    (err as any).attempt_count = 1;
    throw err;
  }

  let attemptCount = 0;
  let lastErrorMessage = '';

  for (let i = 0; i < 2; i++) {
    attemptCount++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout safeguard

      const fetchOptions: RequestInit = {
        method,
        headers: config.headers || { 'Content-Type': 'application/json' },
        signal: controller.signal
      };

      if (config.body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        output: {
          status_code: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData
        },
        attempt_count: attemptCount
      };
    } catch (err: any) {
      const causeMsg = err?.cause?.message ? ` (${err.cause.message})` : err?.name === 'AbortError' ? ' (Timeout 10s exceeded)' : '';
      lastErrorMessage = `${err.message || 'Fetch failed'}${causeMsg}`;

      if (i === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const err = new Error(`HTTP Request failed: ${lastErrorMessage}`);
  (err as any).attempt_count = attemptCount;
  throw err;
}
