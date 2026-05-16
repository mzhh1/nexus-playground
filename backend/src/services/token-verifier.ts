import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';
import { AuthenticationError, AuthorizationError, ServerError } from '../error';
import type { ParsedConfig } from '../config/env';
import { createLogger, logAuthSuccess, logAuthFailure } from '../logger';

export type UserTokenPayload = JWTPayload & {
  sub: string;
  scope?: string;
};

const openIdConfigSchema = z.object({
  jwks_uri: z.string(),
  issuer: z.string(),
});

const jwksCache = new Map<string, Promise<readonly [ReturnType<typeof createRemoteJWKSet>, string]>>();

async function getJwkSet(issuerEndpoint: string): Promise<readonly [ReturnType<typeof createRemoteJWKSet>, string]> {
  const cached = jwksCache.get(issuerEndpoint);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const discoveryUrl = new URL('/oidc/.well-known/openid-configuration', issuerEndpoint);
    const response = await fetch(discoveryUrl.toString(), {
      headers: { 'content-type': 'application/json' },
    });

    if (!response.ok) {
      throw new ServerError(`Failed to fetch OIDC configuration: ${response.status}`);
    }

    const json = await response.json();
    const { jwks_uri: jwksUri, issuer } = openIdConfigSchema.parse(json);

    return Object.freeze([createRemoteJWKSet(new URL(jwksUri)), issuer] as const);
  })().catch((err) => {
    jwksCache.delete(issuerEndpoint);
    throw err;
  });

  jwksCache.set(issuerEndpoint, promise);
  return promise;
}

export async function verifyUserToken(
  token: string,
  config: ParsedConfig,
  requiredScopes: string[] = []
): Promise<UserTokenPayload> {
  const logger = createLogger(config.debug);
  const [getKey, issuer] = await getJwkSet(config.issuerEndpoint);

  if (config.debug) {
    const [_header, rawPayload] = token.split('.');
    try {
      const decoded = JSON.parse(atob(rawPayload ?? ''));
      logger.debug('Token payload preview', {
        sub: decoded.sub,
        iss: decoded.iss,
        aud: decoded.aud,
        scope: decoded.scope,
      });
      logger.debug('Expected validation params', {
        issuer,
        audience: config.resourceIndicator,
      });
    } catch {
      logger.debug('Failed to decode token payload for preview');
    }
  }

  let payload: UserTokenPayload;
  try {
    const result = await jwtVerify(token, getKey, {
      issuer,
      audience: config.resourceIndicator,
    });
    payload = result.payload as UserTokenPayload;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logAuthFailure(logger, config.debug, reason, undefined, error);
    throw new AuthenticationError(`JWT 验证失败：${reason}`, error);
  }

  if (requiredScopes.length > 0) {
    const tokenScopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
    const missing = requiredScopes.filter((s) => !tokenScopes.includes(s));
    if (missing.length > 0) {
      const reason = `缺少所需权限：${missing.join(', ')}`;
      logAuthFailure(logger, config.debug, reason, { sub: payload.sub, iss: payload.iss });
      throw new AuthorizationError(reason);
    }
  }

  logAuthSuccess(logger, config.debug, { sub: payload.sub, iss: payload.iss });
  return payload;
}
