import type { Hono } from 'hono';
import type { AppEnv } from '../middleware/auth.js';

export function registerHealth(app: Hono<AppEnv>) {
  app.get('/health', (c) => c.json({ status: 'ok' }));
}
