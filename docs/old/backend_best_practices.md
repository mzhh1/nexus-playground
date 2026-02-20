## 面向 LLM 后端应用的集成最佳实践（AutoLab SDK 族）

本文面向后端服务（Node.js/Fastify 为主），给出基于 AutoLab SDK 族的端到端集成方案：服务端鉴权（service-auth-middleware）、应用身份认证（oauth-app-sdk）、数据读写（data-sdk）、积分消费（points-sdk）、以及 LLM 调用（llmapi-sdk）。

---

### 目标与设计要点

- **统一鉴权**：使用 `@autolabz/service-auth-middleware` 完成入站请求鉴权，支持 SIMPLE（本地 JWT 验签）与 OAuth（userinfo 回落）双模式。
- **双重身份**：后端可以"用户身份"（透传用户令牌）或"应用身份"（使用 client_credentials）访问下游服务。
- **AuthBridge 注入**：下游 `data-sdk`、`points-sdk`、`llmapi-sdk` 通过 AuthBridge 自动携带 `Authorization`/`X-Client-Id`，401 时自动刷新并重试。
- **稳健网络**：自动内置请求 `x-request-id`，对 429/503/504 做指数退避 + 抖动重试；SSE 流式时也保持鉴权与一次性刷新。
- **灵活架构**：BFF 层可透传用户令牌，后台任务/Cron 可使用应用令牌，按场景选择最合适的身份模式。

---

### 环境变量与配置

后端服务的典型环境变量配置：

```bash
# 认证服务配置（用于鉴权中间件与应用认证）
AUTH_BASE_URL=http://114.132.91.247/api
JWT_ALG=HS256                                    # 或 RS256（SIMPLE 模式）
JWT_ACCESS_SECRET=your-jwt-secret                # HS256 时必填
# JWKS_URL=http://114.132.91.247/api/.well-known/jwks.json  # RS256 时使用
AUTH_ISSUER=https://auth.example.com             # 可选：iss 校验
OAUTH_USERINFO_PATH=/oauth/userinfo              # OAuth userinfo 路径
OAUTH_USERINFO_TIMEOUT_MS=2000                   # userinfo 请求超时

# 应用身份凭证（client_credentials 模式，用于应用级调用）
OAUTH_APP_CLIENT_ID=your-app-client-id
OAUTH_APP_CLIENT_SECRET=cs_live_...              # 仅用于后端，勿泄露

# 下游服务地址
DATA_BASE_URL=http://114.132.91.247/data
POINTS_BASE_URL=http://114.132.91.247/points
LLMAPI_BASE_URL=http://114.132.91.247/llmapi
```

**安全建议**：
- `OAUTH_APP_CLIENT_SECRET` 必须通过环境变量或 Secrets 管理注入，**绝不**提交到版本控制。
- 生产与开发使用不同的 `clientId` 与 `clientSecret`。
- 定期轮换 `clientSecret`。

---

### 1) 服务端鉴权：统一入站请求校验

使用 `@autolabz/service-auth-middleware` 一站式插件完成入站请求的鉴权，支持 SIMPLE（本地 JWT）与 OAuth（userinfo 回落）双模式：

```typescript
import Fastify from 'fastify';
import { authPlugin } from '@autolabz/service-auth-middleware';

const app = Fastify({ logger: true });

// 鉴权配置
const authCfg = {
  // SIMPLE 模式（本地 JWT 验签）
  jwtAlg: 'HS256',                                     // 或 'RS256'
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,      // HS256 时必填
  // jwksUrl: process.env.JWKS_URL,                    // RS256 时使用
  authIssuer: process.env.AUTH_ISSUER,                 // 可选：iss 校验

  // OAuth userinfo 回落
  authBaseUrl: process.env.AUTH_BASE_URL!,
  oauthUserinfoPath: '/oauth/userinfo',
  oauthUserinfoTimeoutMs: Number(process.env.OAUTH_USERINFO_TIMEOUT_MS || 2000),
} as const;

// 注册鉴权插件（全局生效）
app.register(authPlugin, {
  authConfig: authCfg,
  clientId: {},                                        // 解析 X-Client-Id 或 client_id 查询参数
  enforce: { requiredScopes: ['data'] },               // 可选：要求客户端必须拥有的 scope
});

// 在路由中访问鉴权结果
app.get('/api/hello', async (req, reply) => {
  const userId = req.auth?.userId;                     // 用户 ID
  const clientId = req.clientId;                       // 客户端 ID
  return { message: `Hello, user ${userId} from client ${clientId}` };
});

app.listen({ port: 3000, host: '0.0.0.0' });
```

**关键要点**：
- `authPlugin` 会自动在所有路由上应用鉴权链：优先 SIMPLE 本地验签，失败则回落 OAuth userinfo。
- 鉴权成功后，`req.auth` 包含 `{ userId, sub?, email?, iss?, aud?, azp?, scope?, tokenType? }`。
- `req.clientId` 来自 `X-Client-Id` 头或 `client_id` 查询参数。
- `requiredScopes` 为空或未传时跳过 scope 校验；传入多个时要求客户端令牌包含所有指定 scope。

---

### 2) AuthBridge：两种获取方式

后端访问下游服务时，需要通过 **AuthBridge** 注入鉴权信息。根据业务场景，有两种获取 AuthBridge 的方式：

#### 方式 1：用户身份（透传用户令牌）

**适用场景**：BFF 层代理用户请求，需要以用户身份访问下游服务（如读取用户自己的数据、消费用户积分、调用 LLM）。

使用 `makeAuthBridgeFromRequest` 从上游请求提取 `Authorization` 与 `X-Client-Id`，透传到下游：

```typescript
import { makeAuthBridgeFromRequest } from '@autolabz/service-auth-middleware';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';

app.get('/api/user/data', async (req, reply) => {
  // 1. 从请求中提取鉴权信息（透传用户令牌）
  const auth = makeAuthBridgeFromRequest(req, {
    onUnauthorized: () => {
      req.log.warn('下游服务返回 401：用户未授权');
    },
  });

  // 2. 创建下游客户端并传入 AuthBridge
  const dataClient = createDataClient({
    baseURL: process.env.DATA_BASE_URL!,
    auth,
  });

  // 3. 调用下游服务（以用户身份）
  const result = await dataClient.get(`/v1/data/${encodeURIComponent('demo-key')}`);
  return reply.send(result);
});
```

**关键要点**：
- `makeAuthBridgeFromRequest` 会从 `req.headers.authorization` 提取 Bearer Token，并从 `req.clientId` 或 `req.headers['x-client-id']` 提取客户端 ID。
- 下游请求自动携带 `Authorization: Bearer <user-token>` 与 `X-Client-Id: <client-id>`。
- 若下游返回 401，SDK 会尝试刷新令牌（通过 `refreshAccessToken`，当前实现返回原令牌），并重试一次。
- `onUnauthorized` 回调在刷新失败后触发，可用于记录日志或返回错误。

---

#### 方式 2：应用身份（使用应用令牌）

**适用场景**：后台任务、定时 Cron、管理员操作等无用户上下文场景，需要以应用身份访问下游服务（如批量数据处理、系统级积分操作）。

使用 `@autolabz/oauth-app-sdk` 的 client_credentials 流程获取应用令牌，并通过 `createAuthBridge` 生成 AuthBridge：

```typescript
import { OAuthAppClient, createAuthBridge } from '@autolabz/oauth-app-sdk';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';

// 1. 创建应用客户端（建议全局单例）
const appClient = new OAuthAppClient({
  clientId: process.env.OAUTH_APP_CLIENT_ID!,
  clientSecret: process.env.OAUTH_APP_CLIENT_SECRET!,
  authServiceUrl: process.env.AUTH_BASE_URL!,
});

// 2. 创建应用 AuthBridge
const appAuthBridge = createAuthBridge(appClient, {
  onUnauthorized: () => {
    console.error('应用令牌鉴权失败，请检查 clientId/clientSecret');
  },
});

// 3. 创建下游客户端（以应用身份）
const appDataClient = createDataClient({
  baseURL: process.env.DATA_BASE_URL!,
  auth: appAuthBridge,
});

const appPointsClient = createPointsClient({
  baseURL: process.env.POINTS_BASE_URL!,
  auth: appAuthBridge,
});

const appLLMClient = createLLMClient({
  baseURL: process.env.LLMAPI_BASE_URL!,
  auth: appAuthBridge,
});

// 4. 在后台任务中使用（以应用身份）
async function syncDataJob() {
  const data = await appDataClient.get('/v1/data/system-config');
  console.log('系统配置已同步:', data);
}

// 定时任务
setInterval(syncDataJob, 60 * 60 * 1000); // 每小时执行一次
```

**关键要点**：
- `OAuthAppClient` 使用 OAuth2 `client_credentials` 流程，向 `/oauth/token` 请求应用令牌（grant_type=client_credentials）。
- 令牌自动缓存，并在即将过期时（10% 缓冲）自动刷新。
- 下游请求自动携带 `Authorization: Bearer <app-token>` 与 `X-Client-Id: <app-client-id>`。
- 应用令牌的权限范围由后端 OAuth 应用配置的 `scopes` 决定，通常包含 `data`、`points`、`llmapi` 等。

---

### 3) 数据读写（data-sdk）

#### 3.1 用户身份示例（BFF 代理）

```typescript
app.get('/api/user/settings/:key', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const dataClient = createDataClient({
    baseURL: process.env.DATA_BASE_URL!,
    auth,
  });

  const key = req.params.key;
  const result = await dataClient.get(`/v1/data/${encodeURIComponent(key)}`);
  return reply.send(result);
});

app.put('/api/user/settings/:key', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const dataClient = createDataClient({
    baseURL: process.env.DATA_BASE_URL!,
    auth,
  });

  const key = req.params.key;
  const { value } = req.body as { value: any };
  await dataClient.put(`/v1/data/${encodeURIComponent(key)}`, { value });
  return reply.send({ success: true });
});
```

#### 3.2 应用身份示例（后台任务）

```typescript
// 批量初始化用户默认配置
async function initDefaultUserConfigs(userIds: string[]) {
  const appDataClient = createDataClient({
    baseURL: process.env.DATA_BASE_URL!,
    auth: appAuthBridge,
  });

  for (const userId of userIds) {
    try {
      await appDataClient.put(`/v1/data/users/${userId}/default-config`, {
        value: { theme: 'light', language: 'zh-CN' },
      });
    } catch (error) {
      console.error(`初始化用户 ${userId} 配置失败:`, error);
    }
  }
}
```

---

### 4) 积分消费（points-sdk）

#### 4.1 用户身份示例（查询余额/扣费）

```typescript
app.get('/api/user/points/balance', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const pointsClient = createPointsClient({
    baseURL: process.env.POINTS_BASE_URL!,
    auth,
  });

  const balance = await pointsClient.getMyBalance();
  return reply.send(balance);
});

app.post('/api/user/points/consume', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const pointsClient = createPointsClient({
    baseURL: process.env.POINTS_BASE_URL!,
    auth,
  });

  const { amount, reason, requestId } = req.body as {
    amount: number;
    reason: string;
    requestId?: string;
  };

  const result = await pointsClient.consume({
    amount,
    reason,
    requestId: requestId || crypto.randomUUID(),
  });

  return reply.send(result);
});
```

#### 4.2 应用身份示例（管理员充值/系统级操作）

```typescript
// 系统级充值（需要应用具有 admin scope 或特殊权限）
async function grantPointsToUser(userId: string, amount: number, reason: string) {
  const appPointsClient = createPointsClient({
    baseURL: process.env.POINTS_BASE_URL!,
    auth: appAuthBridge,
  });

  // 注意：此接口需要下游 points-service 支持应用身份的充值操作
  await appPointsClient.post(`/v1/points/admin/grant`, {
    userId,
    amount,
    reason,
  });
}
```

---

### 5) LLM 调用（llmapi-sdk）

#### 5.1 用户身份示例（BFF 代理聊天）

```typescript
app.post('/api/chat/completions', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const llmClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth,
  });

  const { model, messages, stream } = req.body as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
  };

  if (stream) {
    // 流式响应
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    await llmClient.chatStream({ model, messages, stream: true }, {
      onEvent: (line) => {
        reply.raw.write(`${line}\n`);
      },
      onDone: () => {
        reply.raw.end();
      },
      onError: (err) => {
        req.log.error('LLM 流式调用失败:', err);
        reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        reply.raw.end();
      },
    });
  } else {
    // 非流式响应
    const result = await llmClient.chat({ model, messages });
    return reply.send(result);
  }
});
```

#### 5.2 应用身份示例（后台批量处理）

```typescript
// 批量摘要生成（系统级任务）
async function generateBatchSummaries(articles: Array<{ id: string; content: string }>) {
  const appLLMClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth: appAuthBridge,
  });

  const summaries = [];
  for (const article of articles) {
    try {
      const result = await appLLMClient.chat({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '请为以下文章生成简短摘要（不超过 100 字）。' },
          { role: 'user', content: article.content },
        ],
      });
      summaries.push({ id: article.id, summary: result.choices[0].message.content });
    } catch (error) {
      console.error(`生成文章 ${article.id} 摘要失败:`, error);
    }
  }
  return summaries;
}
```

#### 5.3 便捷方法：getChatContent（直接获取内容字符串）

`llmapi-sdk` 提供了 `getChatContent` 便捷方法，可以直接返回聊天内容字符串，无需手动从 `result.choices[0].message.content` 中提取，简化代码：

```typescript
// 使用 getChatContent 简化上述批量摘要生成
async function generateBatchSummariesSimple(articles: Array<{ id: string; content: string }>) {
  const appLLMClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth: appAuthBridge,
  });

  const summaries = [];
  for (const article of articles) {
    try {
      // 直接获取内容字符串，无需手动提取 result.choices[0].message.content
      const summary = await appLLMClient.getChatContent({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '请为以下文章生成简短摘要（不超过 100 字）。' },
          { role: 'user', content: article.content },
        ],
      });
      summaries.push({ id: article.id, summary });
    } catch (error) {
      console.error(`生成文章 ${article.id} 摘要失败:`, error);
    }
  }
  return summaries;
}

// 单次调用示例
app.post('/api/ask', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const llmClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth,
  });

  const { question } = req.body as { question: string };
  
  // 直接获取回答字符串
  const answer = await llmClient.getChatContent({
    model: 'gpt-4o-mini-2024-07-18',
    messages: [{ role: 'user', content: question }]
  });

  return reply.send({ answer });
});
```

**关键要点**：
- `getChatContent` 是对 `chat` 方法的封装，自动提取 `choices[0].message.content`。
- 适用于只需要文本内容、不关心完整响应结构的场景（如问答、摘要生成）。
- 内部仍保持完整的鉴权、重试与错误处理机制。
- 若需要访问 `usage`、`finish_reason` 等元信息，请使用 `chat` 方法获取完整响应。

---

### 6) 完整服务示例（Fastify）

以下是一个完整的后端服务示例，集成鉴权、用户身份与应用身份双模式：

```typescript
import Fastify from 'fastify';
import { authPlugin, makeAuthBridgeFromRequest } from '@autolabz/service-auth-middleware';
import { OAuthAppClient, createAuthBridge } from '@autolabz/oauth-app-sdk';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';

const app = Fastify({ logger: true });

// ========== 1. 鉴权配置 ==========
const authCfg = {
  jwtAlg: 'HS256',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  authBaseUrl: process.env.AUTH_BASE_URL!,
  oauthUserinfoPath: '/oauth/userinfo',
  oauthUserinfoTimeoutMs: 2000,
} as const;

app.register(authPlugin, {
  authConfig: authCfg,
  clientId: {},
  enforce: { requiredScopes: ['data'] },
});

// ========== 2. 应用身份客户端（全局单例） ==========
const appClient = new OAuthAppClient({
  clientId: process.env.OAUTH_APP_CLIENT_ID!,
  clientSecret: process.env.OAUTH_APP_CLIENT_SECRET!,
  authServiceUrl: process.env.AUTH_BASE_URL!,
});

const appAuthBridge = createAuthBridge(appClient, {
  onUnauthorized: () => console.error('应用令牌鉴权失败'),
});

// ========== 3. 用户身份路由（BFF 代理） ==========
app.get('/api/user/balance', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const pointsClient = createPointsClient({
    baseURL: process.env.POINTS_BASE_URL!,
    auth,
  });
  const balance = await pointsClient.getMyBalance();
  return reply.send(balance);
});

app.post('/api/user/chat', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const llmClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth,
  });
  const { model, messages } = req.body as any;
  const result = await llmClient.chat({ model, messages });
  return reply.send(result);
});

// ========== 4. 应用身份路由（管理员/系统级） ==========
app.post('/api/admin/batch-summarize', async (req, reply) => {
  const appLLMClient = createLLMClient({
    baseURL: process.env.LLMAPI_BASE_URL!,
    auth: appAuthBridge,
  });

  const { articles } = req.body as { articles: Array<{ id: string; content: string }> };
  const summaries = [];

  for (const article of articles) {
    const result = await appLLMClient.chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '生成简短摘要（不超过 100 字）。' },
        { role: 'user', content: article.content },
      ],
    });
    summaries.push({ id: article.id, summary: result.choices[0].message.content });
  }

  return reply.send({ summaries });
});

// ========== 5. 后台定时任务（应用身份） ==========
setInterval(async () => {
  const appDataClient = createDataClient({
    baseURL: process.env.DATA_BASE_URL!,
    auth: appAuthBridge,
  });
  const config = await appDataClient.get('/v1/data/system-config');
  console.log('系统配置已同步:', config);
}, 60 * 60 * 1000); // 每小时

// ========== 6. 启动服务 ==========
app.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
  console.log('服务已启动: http://localhost:3000');
});
```

---

### 7) 身份模式对比与选择

| 特性 | 用户身份（makeAuthBridgeFromRequest） | 应用身份（oauth-app-sdk + createAuthBridge） |
| --- | --- | --- |
| **适用场景** | BFF 代理用户请求、用户级操作 | 后台任务、定时 Cron、管理员操作 |
| **令牌来源** | 上游请求的 `Authorization` 头（用户令牌） | client_credentials 流程（应用令牌） |
| **权限范围** | 用户自己的数据（如自己的 KV、积分、LLM 调用） | 应用级数据（系统配置、批量操作、跨用户操作） |
| **用户上下文** | 有（`req.auth.userId`） | 无（以应用身份运行） |
| **刷新机制** | 依赖前端或上游刷新 | 自动刷新（10% 缓冲） |
| **典型依赖** | `@autolabz/service-auth-middleware` | `@autolabz/oauth-app-sdk` |

**选择原则**：
- 若请求由前端用户发起，且需要操作用户自己的资源，使用**用户身份**。
- 若为后台任务、系统级操作、无用户上下文，使用**应用身份**。
- 同一服务可同时支持两种模式（如上述完整示例）。

---

### 8) 安全与合规

- **令牌存储**：
  - 前端用户令牌由 `oauth-sdk` 存储于 `localStorage`（存在 XSS 风险），生产推荐迁移到 httpOnly Cookie。
  - 后端应用令牌由 `OAuthAppClient` 内存缓存，无需持久化；`clientSecret` 必须通过环境变量注入，**绝不**提交到代码仓库。

- **跨域与网关**：
  - 通过网关将认证/数据/积分/LLM 服务置于同源或同顶级域名路径下，或确保后端正确配置 CORS。
  - 建议在网关层剥离外部传入的 `X-Client-Id` 并由后端重建，避免伪造。

- **Scope 最小化**：
  - 用户令牌：仅请求业务所需的 scope，如 `openid profile email data points llmapi`。
  - 应用令牌：仅为应用分配必要的 scope，避免过宽权限（如非必要不给 `admin`）。

- **日志与审计**：
  - 记录关键操作的 `x-request-id`、`userId`、`clientId`，便于排查与审计。
  - 在 `onUnauthorized` 回调中记录鉴权失败事件。

---

### 9) 故障处理与观测性

- **鉴权失败（401）**：
  - 用户身份：SDK 会在 401 时尝试刷新（当前实现返回原令牌），多次失败触发 `onUnauthorized`；前端需确保令牌有效。
  - 应用身份：`OAuthAppClient` 自动缓存与刷新，若 401 仍发生，检查 `clientId`/`clientSecret` 与 scope 配置。

- **服务器限流/暂不可用（429/503/504）**：
  - SDK 内置指数退避策略自动重试；UI 或日志提示"稍后重试"与 `x-request-id`。

- **SSE 断流**：
  - 在 `onError` 中记录日志并提示用户重试；避免累积未释放的 reader。

- **Userinfo 超时**：
  - 调整 `OAUTH_USERINFO_TIMEOUT_MS`；检查认证服务的 userinfo 性能与网络连通性。

---

### 10) 部署与 Docker 多阶段构建

#### 10.1 Dockerfile 示例（多阶段构建）

```dockerfile
# 阶段 1：构建 service-auth-middleware（若在 monorepo 内）
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared/service-auth-middleware ./shared/service-auth-middleware
RUN npm ci --workspace shared/service-auth-middleware && \
    npm run build --workspace shared/service-auth-middleware

# 阶段 2：构建应用服务
FROM node:18-alpine AS app-builder
WORKDIR /app
COPY --from=builder /app/shared/service-auth-middleware ./shared/service-auth-middleware
COPY package*.json ./
COPY src ./src
COPY tsconfig.json ./
RUN npm ci && npm run build

# 阶段 3：生产运行
FROM node:18-alpine
WORKDIR /app
COPY --from=app-builder /app/dist ./dist
COPY --from=app-builder /app/node_modules ./node_modules
COPY --from=app-builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### 10.2 docker-compose 示例

```yaml
version: '3.8'
services:
  bff-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - AUTH_BASE_URL=http://auth-service:4001/api
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - OAUTH_APP_CLIENT_ID=${OAUTH_APP_CLIENT_ID}
      - OAUTH_APP_CLIENT_SECRET=${OAUTH_APP_CLIENT_SECRET}
      - DATA_BASE_URL=http://data-service:4002
      - POINTS_BASE_URL=http://points-service:4003
      - LLMAPI_BASE_URL=http://llmapi-service:4004
    depends_on:
      - auth-service
      - data-service
      - points-service
      - llmapi-service
```

---

### 11) 最小可运行清单

#### 11.1 依赖安装

```bash
# 核心依赖
npm install fastify @autolabz/service-auth-middleware @autolabz/oauth-app-sdk
npm install @autolabz/data-sdk @autolabz/points-sdk @autolabz/llmapi-sdk axios

# 开发依赖
npm install -D typescript @types/node ts-node
```

#### 11.2 关键代码片段

**鉴权插件注册**：
```typescript
import { authPlugin } from '@autolabz/service-auth-middleware';

app.register(authPlugin, {
  authConfig: {
    jwtAlg: 'HS256',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    authBaseUrl: process.env.AUTH_BASE_URL!,
    oauthUserinfoPath: '/oauth/userinfo',
    oauthUserinfoTimeoutMs: 2000,
  },
  clientId: {},
  enforce: { requiredScopes: ['data'] },
});
```

**用户身份 AuthBridge**：
```typescript
import { makeAuthBridgeFromRequest } from '@autolabz/service-auth-middleware';

const auth = makeAuthBridgeFromRequest(req);
const dataClient = createDataClient({ baseURL: process.env.DATA_BASE_URL!, auth });
```

**应用身份 AuthBridge**：
```typescript
import { OAuthAppClient, createAuthBridge } from '@autolabz/oauth-app-sdk';

const appClient = new OAuthAppClient({
  clientId: process.env.OAUTH_APP_CLIENT_ID!,
  clientSecret: process.env.OAUTH_APP_CLIENT_SECRET!,
  authServiceUrl: process.env.AUTH_BASE_URL!,
});
const appAuthBridge = createAuthBridge(appClient);
const dataClient = createDataClient({ baseURL: process.env.DATA_BASE_URL!, auth: appAuthBridge });
```

---

### 12) 常见问题（FAQ）

#### Q1: 用户身份与应用身份有什么区别？
- **用户身份**：透传前端用户令牌，操作用户自己的资源（如用户 KV、用户积分）。
- **应用身份**：使用 client_credentials 获取应用令牌，操作系统级资源（如批量任务、管理员操作）。

#### Q2: 如何选择使用哪种身份模式？
- 若请求由前端用户发起（BFF 代理），使用**用户身份**（`makeAuthBridgeFromRequest`）。
- 若为后台定时任务、Cron、管理员操作，使用**应用身份**（`oauth-app-sdk`）。

#### Q3: ClientSecret 从哪里来？如何安全存储？
- 在 AutoLab Admin Portal 创建 OAuth2 应用时获得（仅显示一次）。
- **绝不**提交到版本控制；通过环境变量或 Secrets 管理（如 Kubernetes Secret、AWS Secrets Manager）注入。

#### Q4: 为什么下游请求返回 401？
- **用户身份**：检查前端令牌是否有效；确认 scope 包含所需权限（如 `data`、`points`、`llmapi`）。
- **应用身份**：检查 `clientId`/`clientSecret` 是否正确；确认应用的 scope 配置。

#### Q5: 如何在同一服务中同时支持用户身份与应用身份？
- 参考"完整服务示例"：用户身份路由使用 `makeAuthBridgeFromRequest`，应用身份路由或定时任务使用 `appAuthBridge`。

#### Q6: Userinfo 回落慢怎么办？
- 调大 `oauthUserinfoTimeoutMs`（默认 2000ms）。
- 检查认证服务的 userinfo 接口性能与网络延迟。
- 若可能，启用 SIMPLE 模式（本地 JWT 验签）以减少远程调用。

#### Q7: 如何自定义不同路由的 scope 要求？
- 全局 `authPlugin` 配置基线 scope（如 `['data']`）。
- 特定路由在 `preHandler` 再挂一次 `oauthEnforceClientScope`：
```typescript
import { oauthEnforceClientScope } from '@autolabz/service-auth-middleware';

app.get('/api/admin/users', {
  preHandler: oauthEnforceClientScope(authCfg, { requiredScopes: ['admin'] }),
}, async (req, reply) => {
  // 需要 admin scope
});
```

---

### 附：集成架构图（概念）

```
┌──────────────┐
│  前端应用    │
│ (oauth-sdk)  │
└──────┬───────┘
       │ Bearer <user-token>
       │ X-Client-Id: <client-id>
       ↓
┌──────────────────────────────────────────┐
│  后端服务（Fastify）                     │
│  ┌─────────────────────────────────┐    │
│  │ authPlugin                       │    │
│  │ (service-auth-middleware)        │    │
│  │ - SIMPLE (JWT 验签)              │    │
│  │ - OAuth (userinfo 回落)          │    │
│  └────────────┬────────────────────┘    │
│               │ req.auth / req.clientId  │
│               ↓                          │
│  ┌─────────────────────────────────┐    │
│  │ 路由层                           │    │
│  │ - BFF 代理 (用户身份)            │    │
│  │   makeAuthBridgeFromRequest(req) │    │
│  │ - 管理员/定时任务 (应用身份)     │    │
│  │   OAuthAppClient + createAuthBridge │
│  └────────────┬────────────────────┘    │
│               │ AuthBridge               │
└───────────────┼──────────────────────────┘
                │
       ┌────────┴─────────┬─────────────┐
       ↓                  ↓             ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ data-service │  │points-service│  │llmapi-service│
│ (data-sdk)   │  │(points-sdk)  │  │ (llmapi-sdk) │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

### 总结

本文档提供了后端服务集成 AutoLab SDK 族的完整指南：

1. 使用 `@autolabz/service-auth-middleware` 完成入站请求鉴权。
2. 根据业务场景选择两种 AuthBridge 模式：
   - **用户身份**（`makeAuthBridgeFromRequest`）：BFF 代理用户请求。
   - **应用身份**（`oauth-app-sdk` + `createAuthBridge`）：后台任务与系统级操作。
3. 通过 AuthBridge 统一对接 `data-sdk`、`points-sdk`、`llmapi-sdk`，享受自动鉴权注入、401 刷新与指数退避重试。
4. 遵循安全最佳实践：环境变量存储 Secret、Scope 最小化、日志审计。

参考示例代码与架构图，快速构建稳健、安全的后端服务。

