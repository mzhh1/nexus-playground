# oauth-service-hono-template

基于 Hono 与 `@autolabz/service-auth-hono` 的最小 TypeScript 后端模板，可部署到 Cloudflare Workers。仅支持“用户身份”鉴权，区分公开与受保护端点。

## 目录结构

- `src/index.ts`：应用入口，注册路由与鉴权中间件。
- `src/config.ts`：从 Worker Bindings 构建 `AuthConfig` 与 client_id 策略。
- `src/middleware/auth.ts`：封装鉴权链（auth + clientId + enforce）。
- `src/routes/health.ts`：公开健康检查 `GET /health`。
- `src/routes/protected.ts`：受保护示例 `GET /api/me`（需有效 Bearer + client_id）。
- `.dev.vars.example`：本地环境变量示例（复制为 `.dev.vars`）。

## 准备

```bash
cd oauth-service-hono-template
npm install
cp .dev.vars.example .dev.vars   # 按需修改
```

若未发布 `@autolabz/service-auth-hono`，可本地联调：

```bash
npm install ../autolab_auth/shared/service-auth-hono
# 或将 package.json 中依赖改为 "file:../autolab_auth/shared/service-auth-hono"
```

## 运行

```bash
npm run dev      # 本地 wrangler dev（使用 .dev.vars）
npm run typecheck
npm run deploy   # 部署到 Cloudflare Workers
```

## 端点

- `GET /health`：无需鉴权，返回 `{ status: "ok" }`。
- `GET /api/me`：需携带 `Authorization: Bearer <token>`，并按需携带 `X-Client-Id`（或 `client_id` 查询参数）。返回解析到的 `userId`、`clientId`、`scope`、`tokenType`。

## 环境变量 / Bindings

本地通过 `.dev.vars` 提供；生产在 Cloudflare 控制台或 `wrangler secret` 配置：

- `AUTH_BASE_URL`（必填）：认证服务基础地址。
- `JWT_ALG`（必填）：`HS256` 或 `RS256`。
- `JWT_ACCESS_SECRET`：`JWT_ALG=HS256` 时必填。
- `JWKS_URL`：`JWT_ALG=RS256` 时必填。
- `AUTH_ISSUER`（可选）：issuer 校验。
- `OAUTH_USERINFO_TIMEOUT_MS`（可选）：userinfo 超时，默认 `2000`。
- `REQUEST_CLIENT_ID_REQUIRED`（可选）：是否强制 client_id，默认 `true`。
- `ALLOW_REQUEST_CLIENT_ID`（可选）：允许的 client_id；设置后受保护端点会校验相等。

## 示例请求

```bash
# 健康检查（公开）
curl https://your-worker.workers.dev/health

# 受保护端点（需有效 Bearer 与 client_id）
curl https://your-worker.workers.dev/api/me \
  -H "Authorization: Bearer <access_token>" \
  -H "X-Client-Id: <your-client-id>"
```

## 部署

```bash
npm run deploy
```

首次部署需 `wrangler login`。生产环境变量在 Cloudflare Dashboard → Workers → 对应 Worker → Settings → Variables and Secrets 中配置。

## 常见问题

- **401 Missing Bearer token**：请求未携带 `Authorization: Bearer <token>`。
- **422 X-Client-Id is required**：未设置 `REQUEST_CLIENT_ID_REQUIRED=false` 时，受保护端点必须带 `X-Client-Id` 或 `client_id` 查询参数。
- **401 invalid client_id**：设置了 `ALLOW_REQUEST_CLIENT_ID` 时，请求的 client_id 必须与之一致。
- **本地联调未发布包**：将依赖改为 `"@autolabz/service-auth-hono": "file:../autolab_auth/shared/service-auth-hono"` 后执行 `npm install`。

npx wrangler secret put AUTH_BASE_URL      # 按提示输入
npx wrangler secret put JWT_ACCESS_SECRET
npx wrangler secret put JWT_ALG