import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { parseConfig } from '../config/env';

interface LlmWebhookBody {
  roomId: string;
  roleId: string;
  gameId: string;
  perspective: unknown;
  statePrompt?: string;
  llmConfig: {
    modelName: string;
    systemPrompt: string;
    temperature: number;
    memory: string | null;
  };
  attempt?: number;
  maxAttempts?: number;
  previousError?: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post('/api/v1/webhook/llm', async (c) => {
  const config = parseConfig(c.env);

  if (!config.llmWebhookSecret) {
    return c.json({ error: 'LLM_WEBHOOK_SECRET not configured' }, 500);
  }
  const provided = c.req.header('x-engine-secret');
  if (!provided || provided !== config.llmWebhookSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: LlmWebhookBody;
  try {
    body = await c.req.json() as LlmWebhookBody;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (
    !body ||
    !body.llmConfig ||
    typeof body.llmConfig.modelName !== 'string' ||
    typeof body.llmConfig.systemPrompt !== 'string' ||
    typeof body.llmConfig.temperature !== 'number' ||
    typeof body.statePrompt !== 'string'
  ) {
    return c.json({ error: 'Invalid webhook payload: statePrompt and llmConfig are required' }, 400);
  }

  if (!config.openaiApiBase || !config.openaiApiKey) {
    return c.json({ error: 'OPENAI_API_BASE/OPENAI_API_KEY not configured' }, 500);
  }

  const apiUrl = `${config.openaiApiBase.replace(/\/+$/, '')}/chat/completions`;

  const llmResp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: body.llmConfig.modelName,
      temperature: body.llmConfig.temperature,
      messages: [
        { role: 'system', content: body.llmConfig.systemPrompt },
        { role: 'user', content: body.statePrompt },
      ],
    }),
  });

  if (!llmResp.ok) {
    const text = await llmResp.text();
    return c.json(
      {
        error: 'LLM provider request failed',
        status: llmResp.status,
        detail: text.slice(0, 1000),
      },
      502
    );
  }

  const llmData = await llmResp.json() as OpenAIChatCompletionResponse;
  const content = llmData.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    return c.json(
      {
        error: 'LLM response missing message content',
        detail: llmData.error?.message,
      },
      502
    );
  }

  return c.json({ content });
});

export default app;
