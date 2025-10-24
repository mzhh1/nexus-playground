# @autolabz/service-auth-middleware

可复用的服务端鉴权中间件集合，支持 SIMPLE（本地 JWT 验签）与 OAuth（不透明 Token，经可配置的 userinfo 接口回落校验，默认路径为 `/oauth/userinfo`）。

## 特性
- 统一 onRequest 鉴权链：优先 SIMPLE 验签，失败则回落 OAuth userinfo。
- OAuth 强校验：
  - X-Client-Id 与 azp（或 userinfo.client_id）一致；
  - 支持 requiredScopes 子集校验（空/单/多均可）。
- 兼容：iss/aud 仅在 JWT 声明存在时校验；userinfo 回落时跳过。

## 快速开始
最简接入（使用一站式插件）：
```ts
import { authPlugin } from '@autolabz/service-auth-middleware';

const authCfg = {
  jwtAlg: 'HS256',
  authBaseUrl: process.env.AUTH_BASE_URL!,
  oauthUserinfoPath: '/oauth/userinfo',
  oauthUserinfoTimeoutMs: Number(process.env.OAUTH_USERINFO_TIMEOUT_MS || 2000),
} as const;

app.register(authPlugin, {
  authConfig: authCfg,
  clientId: {},
  enforce: { requiredScopes: ['data'] },// scope 校验，比如开发一个data-service就对客户端要求data的scope，可为空。
});
```

## 安装与构建
在 monorepo 根目录：
```bash
npm --workspace shared/service-auth-middleware run build
```

或在 Docker 多阶段构建中先构建该包，再构建依赖它的服务。

## 使用（Fastify）
```ts
import { oauthOrSimpleAuth, clientIdMiddleware, oauthEnforceClientScope, authPlugin, makeAuthBridgeFromRequest } from '@shared/service-auth-middleware';
import { createPointsClient } from '@autolabz/points-sdk';

const authCfg = {
  // SIMPLE 模式（本地 JWT 验签）相关：
  jwtAlg: 'HS256',                       // SIMPLE 模式必须指定算法（HS256/RS256）
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET, // 当 jwtAlg=HS256 时用于本地验签
  jwksUrl: process.env.JWKS_URL,         // 当 jwtAlg=RS256 时用于远程公钥集
  authIssuer: process.env.AUTH_ISSUER,   // SIMPLE 模式下对 iss 的可选强校验

  // OAuth userinfo 回落相关：
  authBaseUrl: process.env.AUTH_BASE_URL!,           // 必填：OAuth 基础 URL
  oauthUserinfoPath: '/oauth/userinfo',              // 必填（如不自定义则使用默认路径）
  oauthUserinfoTimeoutMs: Number(process.env.OAUTH_USERINFO_TIMEOUT_MS || 2000), // 必填（可用默认 2000）

  // 预留：未来扩展 aud 校验（可选）
  oauthExpectedAudience: process.env.OAUTH_EXPECTED_AUDIENCE,
} as const;

app.register(authPlugin, {
  authConfig: authCfg,
  clientId: {},
  enforce: { requiredScopes: ['data'] },
});

// 在需要调用下游服务（如 points/data/llmapi）的路由中，构造 AuthBridge
app.get('/v1/points/my-balance', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req, {
    onUnauthorized: () => {
      // 可选：记录日志/打点
    },
  });
  // 传入到 SDK（示例：@autolabz/points-sdk）
  const points = createPointsClient({ baseURL: process.env.POINTS_BASE_URL!, auth });
  const result = await points.getMyBalance();
  return reply.send(result);
});
```

## 客户端访问（AuthBridge）

服务作为“客户端”访问下游服务时，可用 `makeAuthBridgeFromRequest` 从上游请求提取 `Authorization` 与 `X-Client-Id`，透明透传到下游，从而复用同一套鉴权链与 scope 约束。

- 对接 SDK（示例：`@autolabz/points-sdk`）
```ts
const auth = makeAuthBridgeFromRequest(req, {
  onUnauthorized: () => req.log.warn('downstream unauthorized'),
});

const points = createPointsClient({
  baseURL: process.env.POINTS_BASE_URL!,
  auth,
});

const balance = await points.getMyBalance();
```

- 搭配任意 HTTP 客户端（以 fetch 为例）
```ts
const auth = makeAuthBridgeFromRequest(req);

async function buildAuthHeaders(extra?: Record<string, string>) {
  const [token, clientId] = await Promise.all([
    Promise.resolve(auth.getAccessToken()),
    Promise.resolve(auth.getClientId()),
  ]);
  return {
    'Content-Type': 'application/json',
    ...(extra || {}),
    Authorization: token ? `Bearer ${token}` : '',
    'X-Client-Id': clientId ?? '',
  } as Record<string, string>;
}

// 模仿 SDK：注入头 + 401 刷新后重试一次
async function fetchWithAuth(url: string, init: RequestInit = {}) {
  const first = await fetch(url, {
    ...init,
    headers: await buildAuthHeaders(init.headers as any),
  });
  if (first.status !== 401) return first;

  try {
    const newAccessToken = await Promise.resolve(auth.refreshAccessToken());
    const retryHeaders = await buildAuthHeaders({
      ...(init.headers as any),
      Authorization: newAccessToken ? `Bearer ${newAccessToken}` : '',
    });
    return await fetch(url, { ...init, headers: retryHeaders });
  } catch (_e) {
    try { auth.onUnauthorized?.(); } catch {}
    return first;
  }
}

// 使用示例
const res = await fetchWithAuth(`${process.env.DATA_BASE_URL}/v1/data/items`);
const data = await res.json();
```

## 简化示例（仅使用 userinfo 回落）

当你只依赖 OAuth 的 userinfo 回落（不做本地 JWT 验签）时：
- **必填（OAuth userinfo）**：`authBaseUrl`、`oauthUserinfoPath`、`oauthUserinfoTimeoutMs`
- **占位必填（SIMPLE 关闭）**：`jwtAlg`（任选 `'HS256' | 'RS256'` 以满足类型）；无需提供 `jwtAccessSecret` / `jwksUrl`
- **可不填**：`jwtAccessSecret`、`jwksUrl`、`authIssuer`、`oauthExpectedAudience`（预留）
- **requiredScopes**：当为空或未传时，跳过 scope 校验；传入多个时要求子集关系（都必须包含）。
- **enforceForSimple**：如需对 SIMPLE 也校验 scope，可设置 true（通常不需要）。

## 配置项参考（AuthConfig）

| 键 | 说明 | 必填 | 默认值 |
| --- | --- | --- | --- |
| jwtAlg | SIMPLE 模式算法：'HS256' | 'RS256'。仅使用 userinfo 时作为占位满足类型 | 是（SIMPLE 或占位） | - |
| jwtAccessSecret | HS256 本地验签密钥 | 当 jwtAlg=HS256 时必填 | - |
| jwksUrl | RS256 JWK Set 地址 | 当 jwtAlg=RS256 时必填 | - |
| authIssuer | iss 强校验值（仅在 JWT 声明存在时校验） | 否 | - |
| authBaseUrl | OAuth 基础 URL（例如认证服务外部可达地址） | 是（使用 userinfo 时） | - |
| oauthUserinfoPath | userinfo 路径 | 是（使用 userinfo 时） | /oauth/userinfo |
| oauthUserinfoTimeoutMs | userinfo 请求超时（毫秒） | 是（使用 userinfo 时） | 2000 |
| oauthExpectedAudience | 预留：aud 期望值 | 否 | - |

## 环境变量与网关建议
- 建议在网关层剥离外部传入的 `X-Client-Id` 并由后端重建，避免伪造。
- `AUTH_BASE_URL` 应为认证服务外部可达地址（在 Docker 网络中可用服务名或网关暴露地址）。

常用环境变量映射：

| 变量 | 作用 | 示例 |
| --- | --- | --- |
| JWT_ALG | SIMPLE 模式算法 | HS256 |
| JWT_ACCESS_SECRET | HS256 本地验签密钥 | your-secret |
| JWKS_URL | RS256 JWK Set 地址 | http://auth/.well-known/jwks.json |
| AUTH_ISSUER | iss 校验值 | https://auth.example.com |
| AUTH_BASE_URL | OAuth 基础 URL | http://auth-service:4001 |
| OAUTH_USERINFO_PATH | userinfo 路径 | /oauth/userinfo |
| OAUTH_USERINFO_TIMEOUT_MS | userinfo 超时（ms） | 2000 |
| OAUTH_EXPECTED_AUDIENCE | 预期 aud | autolab-api |

## 返回字段
- req.auth: { userId, sub?, email?, iss?, aud?, azp?, scope?, tokenType? }
- req.clientId: 解析自 X-Client-Id 或查询参数 client_id。

## 迁移自定义校验
- 若不同路由需要不同 scopes，可在该路由的 preHandler 再挂一次 oauthEnforceClientScope(authCfg, { requiredScopes: ['xxx'] }).

## 常见问题与排查
- 401（userinfo 校验失败）：
  - 检查 `AUTH_BASE_URL` 与 `OAUTH_USERINFO_PATH` 是否正确；
  - 确认 Authorization 头使用 `Bearer <token>`；
  - 核对所需 scope 是否包含于 access token。
- X-Client-Id 与 azp 不一致：
  - 确认网关未将外部的 `X-Client-Id` 透传；由后端统一设置或重建此头。
- 请求超时：
  - 调整 `OAUTH_USERINFO_TIMEOUT_MS`；检查认证服务的 userinfo 性能与网络连通性。
- 本地 JWT 验签失败：
  - HS256：检查 `JWT_ACCESS_SECRET` 是否一致；RS256：检查 `JWKS_URL` 可访问且 kid 对应。

## 许可
MIT
