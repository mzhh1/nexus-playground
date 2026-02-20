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

interface ParsedLlmOutput {
  action: {
    actionId: string;
    params: Record<string, unknown>;
  };
  memoryUpdate?: {
    mode: 'append' | 'replace';
    content: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractJsonFromText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  return trimmed;
}

function parseLlmOutput(rawContent: string): ParsedLlmOutput {
  const jsonText = extractJsonFromText(rawContent);
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('LLM output must be a JSON object');
  }

  const rawActionId = parsed.action_id ?? parsed.actionId;
  if (typeof rawActionId !== 'string' || rawActionId.trim() === '') {
    throw new Error('LLM output missing action_id/actionId');
  }

  const rawParams = parsed.params;
  const params = isRecord(rawParams) ? rawParams : {};

  let memoryUpdate: ParsedLlmOutput['memoryUpdate'];
  const rawMemoryUpdate = parsed.memory_update ?? parsed.memoryUpdate;
  if (isRecord(rawMemoryUpdate)) {
    const mode = rawMemoryUpdate.mode;
    const content = rawMemoryUpdate.content;
    if ((mode === 'append' || mode === 'replace') && typeof content === 'string') {
      memoryUpdate = { mode, content };
    }
  }

  return {
    action: {
      actionId: rawActionId,
      params,
    },
    memoryUpdate,
  };
}

function buildUserPrompt(body: LlmWebhookBody): string {
  if (body.statePrompt && body.statePrompt.trim()) {
    return body.statePrompt;
  }
  return [
    `gameId: ${body.gameId}`,
    `roomId: ${body.roomId}`,
    `roleId: ${body.roleId}`,
    '',
    'perspective:',
    JSON.stringify(body.perspective ?? {}, null, 2),
    '',
    '请只返回 JSON 对象，结构如下：',
    '{"action_id":"<action-id>","params":{},"memory_update":{"mode":"append|replace","content":"optional"}}',
  ].join('\n');
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

    if (
      !body ||
      typeof body.roleId !== 'string' ||
      typeof body.roomId !== 'string' ||
      typeof body.gameId !== 'string' ||
      !body.llmConfig ||
      typeof body.llmConfig.modelName !== 'string' ||
      typeof body.llmConfig.systemPrompt !== 'string' ||
      typeof body.llmConfig.temperature !== 'number'
    ) {
      return c.json({ error: 'Invalid webhook payload' }, 400);
    }

    const envMap = c.env as unknown as Record<string, string | undefined>;
    const openAiBase = envMap.OPENAI_API_BASE?.trim();
    const openAiKey = envMap.OPENAI_API_KEY?.trim();
    if (!openAiBase || !openAiKey) {
      return c.json({ error: 'OPENAI_API_BASE/OPENAI_API_KEY not configured' }, 500);
    }

    const apiUrl = `${openAiBase.replace(/\/+$/, '')}/chat/completions`;
    const userPrompt = buildUserPrompt(body);

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
          { role: 'user', content: userPrompt },
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

    try {
      const parsed = parseLlmOutput(content);
      return c.json(parsed);
    } catch (err) {
      return c.json(
        {
          error: 'Failed to parse LLM response as action JSON',
          detail: err instanceof Error ? err.message : String(err),
          raw: content.slice(0, 1000),
        },
        422
      );
    }
  });
}
