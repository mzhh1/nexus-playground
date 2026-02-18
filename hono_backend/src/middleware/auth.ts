import type { Context, Hono, Next } from 'hono';
import { authMiddlewareChain, type HonoAuthEnv } from '@autolabz/service-auth-hono';
import { getAuthConfig } from '../config.js';

export type AppEnv = {
  Bindings: import('../config.js').Env;
  Variables: import('@autolabz/service-auth-hono').HonoAuthVariables;
};

export function registerAuthMiddleware(app: Hono<AppEnv>) {
  app.use('/api/*', async (c: Context<AppEnv>, next: Next) => {
    const authConfig = getAuthConfig(c.env);
    const chain = authMiddlewareChain({
      authConfig,
      clientId: {},
      enforce: { requiredScopes: [] },
    });
    return chain(c as unknown as Context<HonoAuthEnv>, next);
  });
}
