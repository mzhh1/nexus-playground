import type { Context, Hono, Next } from 'hono';
import { authMiddlewareChain, type HonoAuthEnv } from '@autolabz/service-auth-hono';
import { getAuthConfig } from '../config.js';

export type AppEnv = {
  Bindings: import('../config.js').Env;
  Variables: import('@autolabz/service-auth-hono').HonoAuthVariables & {
    guestId?: string;
  };
};

export function registerAuthMiddleware(app: Hono<AppEnv>) {
  app.use('/api/v1/my-nexus', async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const authConfig = getAuthConfig(c.env);
    const chain = authMiddlewareChain({
      authConfig,
      clientId: {},
      enforce: { requiredScopes: [] },
    });
    return chain(c as unknown as Context<HonoAuthEnv>, next);
  });

  app.use('/api/v1/rooms/*', async (c: Context<AppEnv>, next: Next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    // Always attempt to extract clientId from header for validateClientId guard
    const xClientId = c.req.header('x-client-id');
    if (xClientId) {
      c.set('clientId', xClientId);
    }

    const xGuestId = c.req.header('x-guest-id');
    if (xGuestId) {
      c.set('guestId', xGuestId);
    }

    if (c.req.path.endsWith('/hook')) {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      // Guest access: skip the strict auth chain to avoid 401
      return next();
    }

    const authConfig = getAuthConfig(c.env);
    const chain = authMiddlewareChain({
      authConfig,
      clientId: {},
    });
    return chain(c as unknown as Context<HonoAuthEnv>, next);
  });
}
