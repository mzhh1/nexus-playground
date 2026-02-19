import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';

export function registerV1HealthRoute(app: Hono<AppEnv>) {
  app.get('/api/v1/health', async (c) => {
    const now = new Date().toISOString();
    let dbStatus: 'healthy' | 'unhealthy' = 'healthy';
    let status: 'healthy' | 'degraded' = 'healthy';

    try {
      await c.env.DB.prepare('SELECT 1').first();
    } catch {
      dbStatus = 'unhealthy';
      status = 'degraded';
    }

    return c.json(
      {
        status,
        timestamp: now,
        services: {
          d1: dbStatus,
        },
      },
      status === 'healthy' ? 200 : 503
    );
  });
}
