import type { Context } from 'hono';
import { allowRequestClientId, requestClientIdRequired } from '../config.js';
import type { AppEnv } from './auth.js';

export function ensureAuthenticated(c: Context<AppEnv>): { userId: string; displayName: string } | null {
  const authPayload = c.get('auth') as
    | { userId?: string; sub?: string; nickname?: string; name?: string }
    | undefined;

  const userId = authPayload?.userId || authPayload?.sub;
  if (!userId) {
    return null;
  }

  return {
    userId,
    displayName: authPayload?.nickname || authPayload?.name || userId,
  };
}

export function validateClientId(c: Context<AppEnv>): Response | null {
  if (requestClientIdRequired(c.env) && !c.get('clientId')) {
    return c.json({ message: 'client_id is required' }, 401);
  }

  const allowed = allowRequestClientId(c.env);
  if (allowed && c.get('clientId') !== allowed) {
    return c.json({ message: 'invalid client_id' }, 401);
  }

  return null;
}
