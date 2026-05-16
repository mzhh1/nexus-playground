import type { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { AuthenticationError } from '../error';
import { parseConfig } from '../config/env';
import { verifyUserToken } from '../services/token-verifier';
import type { Env, Variables } from '../types';

export interface AuthMiddlewareOptions {
  scopes?: string[];
}

/**
 * Logto 用户认证中间件
 * 从请求头提取 Bearer Token，验证后将用户信息存入 context
 */
export function requireAuth(options: AuthMiddlewareOptions = {}) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('未提供 Bearer Token，请先登录获取 access_token。');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AuthenticationError('Bearer Token 为空。');
    }

    const config = parseConfig(c.env);
    const payload = await verifyUserToken(token, config, options.scopes);

    c.set('user', {
      sub: payload.sub,
      scope: payload.scope,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
    });

    await next();
  };
}

/**
 * 可选认证中间件：有 token 则验证，无 token 则以访客身份通过
 */
export function withOptionalAuth() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const xGuestId = c.req.header('x-guest-id');
    if (xGuestId) {
      c.set('guestId', xGuestId);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    try {
      const config = parseConfig(c.env);
      const payload = await verifyUserToken(token, config);

      c.set('user', {
        sub: payload.sub,
        scope: payload.scope,
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
      });
    } catch {
      // token 无效时不阻断，降级为访客
    }

    await next();
  };
}

/**
 * Engine Hook JWT 验证中间件
 * 验证使用 NEXUS_ENGINE_JWT_SECRET 签名的 HS256 token
 */
export function requireEngineJwt() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('未提供 Engine Token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AuthenticationError('Engine Token 为空');
    }

    const roomId = c.req.param('roomId');
    const jwtSecretRaw = c.env.NEXUS_ENGINE_JWT_SECRET;
    if (!jwtSecretRaw) {
      throw new AuthenticationError('NEXUS_ENGINE_JWT_SECRET 未配置');
    }
    const secret = new TextEncoder().encode(jwtSecretRaw);

    try {
      const { payload } = await jwtVerify<{ roomId: string }>(token, secret);
      if (payload.roomId !== roomId) {
        throw new AuthenticationError('Token roomId 与请求不匹配');
      }
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(`Engine Token 验证失败：${error instanceof Error ? error.message : String(error)}`);
    }

    await next();
  };
}

/**
 * 从 context 中提取用户或访客身份
 */
export function getUserOrGuest(c: Context<{ Bindings: Env; Variables: Variables }>): { userId: string; displayName: string } {
  const user = c.get('user');
  if (user) {
    return {
      userId: user.sub,
      displayName: user.sub,
    };
  }

  const guestId = c.get('guestId') || `guest_${Math.random().toString(36).substring(2, 10)}`;
  return {
    userId: guestId,
    displayName: `Guest ${guestId.slice(-4).toUpperCase()}`,
  };
}
