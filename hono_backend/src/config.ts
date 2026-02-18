import type { AuthConfig } from '@autolabz/service-auth-hono';

export interface Env {
  AUTH_BASE_URL: string;
  JWT_ALG: 'HS256' | 'RS256';
  JWT_ACCESS_SECRET?: string;
  JWKS_URL?: string;
  AUTH_ISSUER?: string;
  OAUTH_USERINFO_TIMEOUT_MS?: string;
  REQUEST_CLIENT_ID_REQUIRED?: string;
  ALLOW_REQUEST_CLIENT_ID?: string;
}

function getRequired(bindings: Env, key: keyof Env): string {
  const v = bindings[key];
  if (v === undefined || v === '') {
    throw new Error(`Missing required binding: ${key}`);
  }
  return String(v);
}

export function getAuthConfig(env: Env): AuthConfig {
  const jwtAlg = getRequired(env, 'JWT_ALG') as 'HS256' | 'RS256';
  if (jwtAlg !== 'HS256' && jwtAlg !== 'RS256') {
    throw new Error('JWT_ALG must be HS256 or RS256');
  }
  return {
    jwtAlg,
    jwtAccessSecret: jwtAlg === 'HS256' ? getRequired(env, 'JWT_ACCESS_SECRET') : undefined,
    jwksUrl: jwtAlg === 'RS256' ? getRequired(env, 'JWKS_URL') : undefined,
    authIssuer: env.AUTH_ISSUER || undefined,
    authBaseUrl: getRequired(env, 'AUTH_BASE_URL'),
    oauthUserinfoPath: '/oauth/userinfo',
    oauthUserinfoTimeoutMs: Number(env.OAUTH_USERINFO_TIMEOUT_MS ?? '2000'),
  };
}

export function requestClientIdRequired(env: Env): boolean {
  const v = env.REQUEST_CLIENT_ID_REQUIRED;
  if (v === undefined) return true;
  return v !== 'false';
}

export function allowRequestClientId(env: Env): string | undefined {
  const v = env.ALLOW_REQUEST_CLIENT_ID;
  return v && v.trim() ? v.trim() : undefined;
}
