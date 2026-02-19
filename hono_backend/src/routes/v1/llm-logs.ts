import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';

function disabledResponse() {
  return {
    error: 'LLM logs temporarily disabled',
  };
}

export function registerV1LLMLogsRoutes(app: Hono<AppEnv>) {
  app.get('/api/v1/llm-logs', (c) => c.json(disabledResponse(), 501));
  app.get('/api/v1/llm-logs/groups/:groupId', (c) => c.json(disabledResponse(), 501));
  app.get('/api/v1/llm-logs/:interactionId', (c) => c.json(disabledResponse(), 501));
}
