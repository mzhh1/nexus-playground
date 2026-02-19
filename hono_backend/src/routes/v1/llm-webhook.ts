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

export function registerV1LLMWebhookRoute(app: Hono<AppEnv>) {
  app.post('/api/v1/webhook/llm', async (c) => {
    const expectedSecret = c.env.LLM_WEBHOOK_SECRET || c.env.NEXUS_ENGINE_ADMIN_SECRET;
    const provided = c.req.header('x-engine-secret');
    if (!provided || provided !== expectedSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const _body = (await c.req.json()) as LlmWebhookBody;
    return c.json(
      {
        error: 'LLM webhook not migrated yet',
      },
      501
    );
  });
}
