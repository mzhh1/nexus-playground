import fp from 'fastify-plugin';
import { authPlugin } from '@autolabz/service-auth-fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId?: string;
      sub?: string;
      email?: string;
      iss?: string;
      aud?: string;
      azp?: string;
      scope?: string;
      tokenType?: string;
    };
    clientId?: string;
  }
}

/**
 * OAuth Authentication Plugin
 * Uses @autolabz/service-auth-middleware for OAuth userinfo validation
 */
export default fp(async function authPluginWrapper(fastify) {
  const authConfig = {
    // SIMPLE 模式占位（仅使用 OAuth userinfo 回落）
    jwtAlg: 'HS256' as const,

    // OAuth userinfo 回落配置
    authBaseUrl: process.env.AUTH_BASE_URL || 'https://auth.mzhh.xyz/api',
    oauthUserinfoPath: process.env.OAUTH_USERINFO_PATH || '/oauth/userinfo',
    oauthUserinfoTimeoutMs: Number(process.env.OAUTH_USERINFO_TIMEOUT_MS || 3000),
  };

  fastify.log.info({
    authBaseUrl: authConfig.authBaseUrl,
    oauthUserinfoPath: authConfig.oauthUserinfoPath,
    timeoutMs: authConfig.oauthUserinfoTimeoutMs,
  }, '[Auth Plugin] OAuth 配置已加载');

  // 注册 @autolabz/service-auth-middleware
  await fastify.register(authPlugin, {
    authConfig,
    clientId: {}, // 自动从 X-Client-Id header 或 client_id 查询参数提取
    enforce: {
      // 如果需要 scope 校验，可以在这里配置
      // requiredScopes: ['openid', 'profile']
    },
  });

  fastify.log.info('[Auth Plugin] OAuth 认证中间件已注册');
});


