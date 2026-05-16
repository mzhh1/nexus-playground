import type { AuthConfig } from '@autolabz/service-auth-hono';

export interface Env {
  DB: D1Database;
  AUTH_BASE_URL: string;
  JWT_ALG: 'HS256' | 'RS256';
  JWT_ACCESS_SECRET?: string;
  JWKS_URL?: string;
  AUTH_ISSUER?: string;
  OAUTH_USERINFO_PATH?: string;
  OAUTH_USERINFO_TIMEOUT_MS?: string;
  REQUEST_CLIENT_ID_REQUIRED?: string;
  ALLOW_REQUEST_CLIENT_ID?: string;
  NEXUS_ENGINE_URL: string;
  NEXUS_ENGINE_ADMIN_SECRET: string;
  NEXUS_ENGINE_JWT_SECRET: string;
  WORKER_URL?: string;
  LLM_WEBHOOK_SECRET?: string;
  OPENAI_API_BASE?: string;
  OPENAI_API_KEY?: string;
  CORS_ALLOW_ORIGINS?: string;
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
    oauthUserinfoPath: env.OAUTH_USERINFO_PATH || '/oauth/userinfo',
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

export function getRequiredEnv(env: Env, key: keyof Env): string {
  return getRequired(env, key);
}

export function getAllowedOrigins(env: Env): string[] {
  const raw = env.CORS_ALLOW_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
