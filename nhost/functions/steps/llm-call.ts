export interface LLMCallConfig {
  prompt?: string;
  model?: string;
  system_instruction?: string;
}

export interface StepExecutionResult {
  output: any;
  attempt_count: number;
}

export async function executeLLMCall(config: LLMCallConfig, previousStepOutput?: any): Promise<StepExecutionResult> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const model = config.model || 'llama-3.3-70b-versatile';
  let prompt = config.prompt || 'Summarize the input data.';

  if (previousStepOutput && typeof previousStepOutput === 'object') {
    prompt = `${prompt}\nContext: ${JSON.stringify(previousStepOutput)}`;
  }

  // Fallback path if no API key in environment
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      output: {
        stubbed: true,
        response: `[Stubbed LLM Response for prompt: "${prompt.slice(0, 60)}..."]`,
        model_used: model,
        note: 'No GROQ_API_KEY provided in environment. Executed via fallback path.'
      },
      attempt_count: 1
    };
  }

  let attemptCount = 0;
  let lastError: Error | null = null;

  for (let i = 0; i < 2; i++) {
    attemptCount++;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const textOutput = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};

      return {
        output: {
          response: textOutput,
          model,
          usage
        },
        attempt_count: attemptCount
      };
    } catch (err: any) {
      lastError = err;
      if (i === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const err = new Error(lastError?.message || 'LLM call failed after 2 attempts');
  (err as any).attempt_count = attemptCount;
  throw err;
}
