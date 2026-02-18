import { Hono } from 'hono';
import type { AppEnv } from './middleware/auth.js';
import { registerAuthMiddleware } from './middleware/auth.js';
import { registerHealth } from './routes/health.js';
import { registerProtectedRoutes } from './routes/protected.js';

const app = new Hono<AppEnv>();

registerHealth(app);
registerAuthMiddleware(app);
registerProtectedRoutes(app);

export default {
  fetch: app.fetch,
};
