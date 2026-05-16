# np-backend

Nexus Playground 后端服务，基于 Cloudflare Workers + Hono + Logto。替代原 `hono_backend`，将自研 OAuth 迁移为 Logto OIDC 认证。

---

## 这个服务提供什么

- 基于 Logto OIDC 的用户认证（access token 验证 + scope 授权）
- 房间 CRUD（D1 持久化）
- Nexus Engine 协调（创建引擎房间、签发 WebSocket JWT、引擎 hook 回调）
- LLM API 代理（供 Engine 通过 webhook 调用 OpenAI 兼容 API）
- 游戏元数据聚合（从各游戏 Worker 收集 `/metadata`）
- 管理端 API（Monitor 面板的房间管理）

---

## 快速开始

### 环境变量

复制 `.dev.vars.example` 为 `.dev.vars` 并填入实际值：

```bash
cp .dev.vars.example .dev.vars
```

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `ISSUER_ENDPOINT` | 是 | Logto 租户 OIDC 端点 |
| `WORKER_RESOURCE_INDICATOR` | 是 | 当前服务的 API Identifier（与 Logto 中注册一致） |
| `DEBUG` | 否 | 设为 `true` 时输出详细调试日志 |
| `NEXUS_ENGINE_URL` | 是 | Nexus Engine HTTP 地址 |
| `NEXUS_ENGINE_ADMIN_SECRET` | 是 | Engine 管理 API 密钥 |
| `NEXUS_ENGINE_JWT_SECRET` | 是 | Engine WebSocket JWT 签名密钥（HS256） |
| `LLM_WEBHOOK_SECRET` | 否 | LLM Webhook 鉴权密钥 |
| `OPENAI_API_BASE` | 否 | OpenAI 兼容 API 地址 |
| `OPENAI_API_KEY` | 否 | OpenAI 兼容 API 密钥 |
| `WORKER_URL` | 否 | 逗号分隔的游戏 Worker URL 列表 |
| `CORS_ALLOW_ORIGINS` | 否 | 逗号分隔的允许 CORS 来源 |

### 启动

```bash
pnpm install
pnpm dev        # wrangler dev，默认监听 localhost:8787
pnpm typecheck  # TypeScript 类型检查
```

---

## 鉴权模型

本服务面向"用户登录后带 access token 调后端 API"的场景，采用 Logto 用户侧 OIDC 流程（Authorization Code + PKCE）。

```
用户浏览器 → 前端应用 → Logto 登录 → 获取 access_token
前端应用 → 携带 Bearer Token 调用后端
后端 → 通过 OIDC discovery 获取 issuer / jwks_uri
后端 → 使用 JWKS 验证 JWT 签名、issuer、audience
后端 → 按路由要求检查 scope
```

**关键点**：前端请求 access token 时，必须显式传入当前 API 的 `resource`：

```
resource = "https://nexus-playground.apiservice.autolab-server.site"
```

---

## Logto 最小配置

### API Resource

在 Logto 控制台中创建 API Resource：

- **Name**：`Nexus Playground API`
- **API Identifier**：`https://nexus-playground.apiservice.autolab-server.site`

### 权限 (Scope)

| Scope | 说明 | 对应路由 |
|-------|------|----------|
| `access:playground` | 访问游戏沙盒 | `GET /api/v1/my-nexus` |

### 角色

| 角色名 | 分配的 Scope |
|--------|-------------|
| `player` | `access:playground` |

---

## 路由概览

### 公开路由（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 服务基础信息 |
| `GET` | `/health` | 健康检查（含 D1 状态） |
| `GET` | `/api/v1/games` | 游戏元数据聚合 |
| `GET` | `/api/v1/rooms` | 公开房间列表 |

### 需认证路由（Logto JWT）

| 方法 | 路径 | 认证要求 | 说明 |
|------|------|----------|------|
| `GET` | `/api/me` | 登录即可 | 返回当前用户信息和 token 摘要 |
| `GET` | `/api/v1/my-nexus` | `access:playground` | 获取或创建用户房间 + Engine 连接信息 |

### 可选认证路由（登录或访客）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/rooms/:roomId/engine-connection` | 获取 WebSocket 连接 JWT（访客自动生成 guest ID） |

### 内部认证路由

| 方法 | 路径 | 认证方式 | 说明 |
|------|------|----------|------|
| `PUT` | `/api/v1/rooms/:roomId/hook` | Engine JWT (HS256) | Engine 回调更新房间元数据 |
| `POST` | `/api/v1/webhook/llm` | `x-engine-secret` header | LLM API 代理 |
| `GET` | `/api/monitor/backendroom` | `Bearer ADMIN_SECRET` | 管理端房间列表（分页） |
| `DELETE` | `/api/monitor/backendroom/:roomId` | `Bearer ADMIN_SECRET` | 管理端删除房间 |

---

## 本地验证

```bash
# 公开接口
curl http://127.0.0.1:8787/health

# 未带 token 访问受保护接口，应返回 401
curl http://127.0.0.1:8787/api/me

# 带 token 访问（需先从 Logto 获取 access_token）
curl http://127.0.0.1:8787/api/me \
  -H "Authorization: Bearer <your_access_token>"

# 需要 access:playground scope
curl http://127.0.0.1:8787/api/v1/my-nexus \
  -H "Authorization: Bearer <your_access_token>"

# 访客访问引擎连接
curl http://127.0.0.1:8787/api/v1/rooms/abcd1234/engine-connection \
  -H "X-Guest-Id: my-guest-id"
```

---

## 部署

```bash
pnpm deploy                    # 或 .\build.ps1 deploy-backend
pnpm exec wrangler d1 migrations apply np-backend-db --remote   # 首次部署后执行 D1 迁移
```

敏感变量通过 Cloudflare Secret 管理：

```bash
pnpm exec wrangler secret put NEXUS_ENGINE_URL
pnpm exec wrangler secret put NEXUS_ENGINE_ADMIN_SECRET
pnpm exec wrangler secret put NEXUS_ENGINE_JWT_SECRET
pnpm exec wrangler secret put LLM_WEBHOOK_SECRET
pnpm exec wrangler secret put OPENAI_API_KEY
```

---

## 项目结构

```
src/
├── index.ts                    # Hono 入口，CORS，全局错误处理，路由注册
├── types.ts                    # Env + Variables 共享类型
├── error.ts                    # 自定义错误类（Authentication/Authorization/Server）
├── logger.ts                   # 统一日志工具
├── config/
│   └── env.ts                  # Zod 环境变量解析与校验
├── middleware/
│   └── auth.ts                 # requireAuth / withOptionalAuth / requireEngineJwt
├── services/
│   └── token-verifier.ts       # Logto OIDC Discovery + JWT 验证（带缓存）
├── routes/
│   ├── public.ts               # 公开路由（/ /health /api/v1/games /api/v1/rooms）
│   ├── protected.ts            # 需认证路由（/api/me /api/v1/my-nexus /api/v1/rooms/:id/engine-connection）
│   ├── hook.ts                 # Engine 回调路由（PUT /api/v1/rooms/:id/hook）
│   ├── llm-webhook.ts          # LLM Webhook 路由（POST /api/v1/webhook/llm）
│   └── monitor.ts              # 管理端路由（/api/monitor/backendroom）
├── db/
│   └── rooms-repo.ts           # D1 rooms 表数据访问
├── runtime/
│   ├── nexus-engine-client.ts  # Engine HTTP 客户端 + JWT 签发
│   └── games.ts                # 游戏元数据发现与聚合
└── utils/
    └── room-id.ts              # Room ID 生成与校验
```
