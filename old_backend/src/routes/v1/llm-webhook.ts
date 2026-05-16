import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';

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

export function registerV1LLMWebhookRoute(app: Hono<AppEnv>) {
  app.post('/api/v1/webhook/llm', async (c) => {
    const expectedSecret = c.env.LLM_WEBHOOK_SECRET;
    if (!expectedSecret || !expectedSecret.trim()) {
      return c.json({ error: 'LLM_WEBHOOK_SECRET not configured' }, 500);
    }
    const provided = c.req.header('x-engine-secret');
    if (!provided || provided !== expectedSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    let body: LlmWebhookBody;
    try {
      body = (await c.req.json()) as LlmWebhookBody;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // Basic validation — we only need llmConfig and statePrompt now
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

    const envMap = c.env as unknown as Record<string, string | undefined>;
    const openAiBase = envMap.OPENAI_API_BASE?.trim();
    const openAiKey = envMap.OPENAI_API_KEY?.trim();
    if (!openAiBase || !openAiKey) {
      return c.json({ error: 'OPENAI_API_BASE/OPENAI_API_KEY not configured' }, 500);
    }

    const apiUrl = `${openAiBase.replace(/\/+$/, '')}/chat/completions`;

    const llmResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
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

    const llmData = (await llmResp.json()) as OpenAIChatCompletionResponse;
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

    // Just return raw content to engine
    return c.json({ content });
  });
}
