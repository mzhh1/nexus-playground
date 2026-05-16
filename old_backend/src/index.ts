import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './middleware/auth.js';
import { getAllowedOrigins } from './config.js';
import { registerAuthMiddleware } from './middleware/auth.js';
import { registerV1HealthRoute } from './routes/v1/health.js';
import { registerV1GamesRoute } from './routes/v1/games.js';
import { registerV1MyNexusRoute } from './routes/v1/my-nexus.js';
import { registerV1RoomsRoute } from './routes/v1/rooms.js';
import { registerV1LLMWebhookRoute } from './routes/v1/llm-webhook.js';
import { registerMonitorBackendRoomRoute } from './routes/monitor/backendroom.js';

const app = new Hono<AppEnv>();

app.use('/api/*', async (c, next) => {
  const allowedOrigins = getAllowedOrigins(c.env);
  const origin = c.req.header('origin');

  if (allowedOrigins.length === 0) {
    return next();
  }

  const isMonitorApi = c.req.path.startsWith('/api/monitor');

  if (!isMonitorApi && origin && !allowedOrigins.includes(origin)) {
    return c.json({ error: 'CORS origin not allowed' }, 403);
  }

  const corsMiddleware = cors({
    origin: (requestOrigin) => {
      if (isMonitorApi && requestOrigin) return requestOrigin;
      if (!requestOrigin) return allowedOrigins[0];
      return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'x-client-id', 'x-guest-id'],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

registerAuthMiddleware(app);
registerV1HealthRoute(app);
registerV1GamesRoute(app);
registerV1MyNexusRoute(app);
registerV1RoomsRoute(app);
registerV1LLMWebhookRoute(app);
registerMonitorBackendRoomRoute(app);

export default {
  fetch: app.fetch,
};
