import type { Context, Hono } from 'hono';
import { makeAuthBridgeFromContext } from '@autolabz/service-auth-hono';
import { requestClientIdRequired, allowRequestClientId } from '../config.js';
import type { AppEnv } from '../middleware/auth.js';

function ensureClientId(c: Context<AppEnv>): Response | null {
  if (requestClientIdRequired(c.env) && !c.get('clientId')) {
    return c.json({ message: 'client_id is required' }, 401);
  }
  const allowed = allowRequestClientId(c.env);
  if (allowed && c.get('clientId') !== allowed) {
    return c.json({ message: 'invalid client_id' }, 401);
  }
  return null;
}

export function registerProtectedRoutes(app: Hono<AppEnv>) {
  app.get('/api/me', (c) => {
    const err = ensureClientId(c);
    if (err) return err;
    const auth = makeAuthBridgeFromContext(c, {
      onUnauthorized: () => {},
    });
    const authPayload = c.get('auth');
    return c.json({
      accessToken: auth.getAccessToken(),
      userId: authPayload?.userId ?? null,
      clientId: c.get('clientId') ?? null,
      scope: authPayload?.scope,
      tokenType: authPayload?.tokenType,
    });
  });
}
