## 面向 LLM MPA 应用的集成最佳实践（AutoLab SDK 族）

本文面向外部 LLM 应用（Web/MPA 为主，SPA 可类比参考），给出基于 AutoLab SDK 族的端到端集成方案：用户认证（oauth-sdk）、数据读写（data-sdk）、积分消费（points-sdk）、以及 LLM 调用（llmapi-sdk）。示例参考仓库中的 `oauth-example-app`（示例为 SPA，但本文示例以 MPA 场景为主）。

---

### 目标与设计要点

- 统一认证：使用 `@autolabz/oauth-sdk` 走标准 OAuth 2.0 授权码（含 PKCE），前端安全、跨域友好。
- 统一鉴权注入：下游 `data-sdk`、`points-sdk`、`llmapi-sdk` 通过 `oauth-sdk` 的 bridge 自动携带 `Authorization`/`X-Client-Id`，401 时自动刷新并重试。
- 稳健网络：自动内置请求 `x-request-id`，对 429/503/504 做指数退避 + 抖动重试；SSE 流式时也保持鉴权与一次性刷新。
- 简洁集成：Provider/Hook/组件与纯函数客户端均可用，便于在 React 应用快速落地。

---

### MPA 场景与关键原则

- 每个页面独立挂载 `OAuthProvider`，用于在页面加载时恢复/管理会话。
- 使用统一回调页（例如 `/oauth/callback`），在回调页调用 `handleRedirect` 完成令牌交换。
- 登录前通过自定义 `state` 携带回跳信息（如 `returnTo`），回调后解析 `state` 并跳回原页面。
- 在提供登录入口/用户菜单的页面挂载 `AuthAvatar` 和 `OAuthProvider`；其他页面仅需 `OAuthProvider`。
 - 会话共享自动依赖存储介质（同源 `localStorage` 或推荐的 httpOnly Cookie），而不是依赖 React 上下文。
 - 下游 `data/points/llm` 客户端建议“每页创建、页内复用”，不跨页共享实例（会话会跨页共享）。
 - 自定义 `state` 建议使用 base64(JSON) 且包含唯一 `nonce`。
 - 不要在 `state` 放敏感信息；仅放导航类数据（如 `returnTo`）。

---

### 环境变量与固定配置

在前端构建或运行时提供固定地址与回调：

```bash
VITE_AUTH_API_BASE_URL=http://114.132.91.247/api
VITE_DATA_BASE_URL=http://114.132.91.247/data
VITE_POINTS_BASE_URL=http://114.132.91.247/points
VITE_LLMAPI_BASE_URL=http://114.132.91.247/llmapi
VITE_OAUTH_REDIRECT_URI=http://114.132.91.247/oauth-app/callback
VITE_OAUTH_PROFILE_URL=http://114.132.91.247/auth/profile
VITE_OAUTH_CLIENT_ID=your-assigned-client-id
```

ClientId 建议由组织统一分配后以“固定配置”的方式注入生产环境（环境变量、运营配置或 Secrets 管理）。URL 查询、sessionStorage 解析仅适合开发联调兜底，不建议在生产依赖。

---

### 1) 认证（MPA）：每页挂 Provider + 统一回调（state 回跳）

在每个页面入口挂载 `OAuthProvider`。在需要登录入口的页面再挂一个 `AuthAvatar`。回调页统一处理 `handleRedirect`，解析 `state` 跳回来源页。

```tsx
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';

// 每个页面入口：挂 Provider
export function PageShell({ children }: { children: React.ReactNode }) {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL;
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
      {children}
    </OAuthProvider>
  );
}

// 构造/解析自定义 state（承载回跳信息）
function makeState(payload: any) {
  try {
    const json = JSON.stringify({ ...payload, nonce: crypto.randomUUID?.() || String(Date.now()) });
    return btoa(encodeURIComponent(json));
  } catch { return ''; }
}
function parseState(s: string) {
  try { return JSON.parse(decodeURIComponent(atob(s))); } catch { return null; }
}

// 需要登录入口的页面：挂 AuthAvatar，并将当前地址写入 state
export function HeaderBar() {
  const returnTo = () => window.location.href;
  return (
    <AuthAvatar
      redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
      scope={import.meta.env.VITE_OAUTH_SCOPE ?? 'openid profile email data points llmapi'}
      additionalParams={{ prompt: 'consent' }}
      profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
      state={() => makeState({ returnTo: returnTo() })}
    />
  );
}

// 统一回调页：完成换令牌并按 state 跳回
export function OAuthCallback() {
  const { handleRedirect } = useOAuth();
  useEffect(() => {
    handleRedirect({ fetchUserinfo: true, redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI })
      .then((res) => {
        const target = parseState(res.state)?.returnTo || '/';
        window.location.replace(target);
      })
      .catch((e) => {
        console.error('OAuth 回调失败:', e);
        window.location.replace('/');
      });
  }, [handleRedirect]);
  return <div>正在完成登录...</div>;
}
```

要点：
- `oauth-sdk` 自动完成 PKCE、回调处理、令牌持久化与 401 刷新。
- MPA 中每页挂载 `OAuthProvider`，共享同源存储中的登录态。
- 使用自定义 `state` 承载回跳信息；务必加入唯一 `nonce`，避免并发登录造成 PKCE 关联冲突。
- 生产固定 `clientId`，避免仅依赖 URL 解析；并确保网关允许前端源访问认证域（CORS/同域网关）。
- `useOAuth()` 提供登录态与用户信息：`isAuthenticated` 表示是否已登录，`user` 形如 `{ id, email, nickname, avatarUrl }`。
  示例：`const { isAuthenticated, user } = useOAuth(); const uid = user?.id;`

---

### 2) 鉴权桥接：一次登录，多 SDK 复用

用 `createAuthBridgeFromContext` 将认证上下文桥接到数据、积分与 LLM 客户端：

```tsx
import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';

const auth = useOAuth();
const authBridge = useMemo(() => createAuthBridgeFromContext(auth), [auth]);

const data = useMemo(() => createDataClient({
  baseURL: import.meta.env.VITE_DATA_BASE_URL,
  auth: authBridge,
}), [authBridge]);

const points = useMemo(() => createPointsClient({
  baseURL: import.meta.env.VITE_POINTS_BASE_URL,
  auth: authBridge,
}), [authBridge]);

const llm = useMemo(() => createLLMClient({
  baseURL: import.meta.env.VITE_LLMAPI_BASE_URL,
  auth: authBridge,
}), [authBridge]);
```

要点：
- 下游请求会自动注入 `Authorization: Bearer <token>` 与 `X-Client-Id`；请求含 `x-request-id`，401 将触发刷新并重试。
- LLM 的 `chatStream` 在流式 SSE 时也会携带鉴权，并在 401 发生时尝试刷新一次。

在 MPA 中，`data-sdk`、`points-sdk`、`llmapi-sdk` 客户端应当“每页创建，并在该页内复用（useMemo 或模块级单例）”。不建议跨页共享实例；

### 3) 数据读写：用户私有 KV 等

```ts
// 健康检查
await data.health();

// 写入/更新
await data.put(`/v1/data/${encodeURIComponent('demo-key')}`, { value: 'hello' });

// 读取
const kv = await data.get(`/v1/data/${encodeURIComponent('demo-key')}`);

// 删除
await data.delete(`/v1/data/${encodeURIComponent('demo-key')}`);
```

实践建议：
- 将关键数据 key 标准化命名并做 `encodeURIComponent`。
- 失败时记录 `x-request-id` 方便后端排查；对 429/503/504 让 SDK 的退避机制发挥作用，避免手写轮询。
- 纯前端（无自有后端）场景：可用 `data-sdk` 的用户私有 KV 作为“简易用户信息存储”，保存少量用户资料/偏好（如昵称、主题、最近会话等）。
- 前后端应用：业务数据可以直接存于自有后端/数据库，不必依赖 SDK 的数据存储；使用 `uid = user.id` 作为用户分区键在后端区分与隔离各用户数据。

---

### 4) 积分消费：余额与幂等扣费
仅有LLM调用，没有其他消费项目则无需使用此部分内容。
LLM调用会自动进行积分消费，
```ts
// 查询余额（首次会自动初始化）
const bal = await points.getMyBalance();

// 幂等扣费（建议总是传入唯一 requestId）
const res = await points.consume({ amount: 50, reason: 'chat:gpt-4o', requestId: crypto.randomUUID() });

// 列表查询
const list = await points.listMyConsumptions({ page: 1, pageSize: 20 });
```

实践建议：
- `amount` 必须为正整数，不合规则会在客户端直接抛出 `INVALID_ARGUMENT`。
- `requestId` 用于服务端实现幂等，避免网络抖动导致重复扣费；可使用 `crypto.randomUUID()` 或带时间戳的复合 ID。

---

### 5) LLM 调用：非流式与 SSE 流式

```ts
// 非流式
const resp = await llm.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say hello' },
  ],
});

// 流式（SSE）
await llm.chatStream({ model: 'gpt-4o-mini', messages: [], stream: true }, {
  onEvent: (line) => {/* 原始 SSE 行，可用于调试 */},
  onMessage: (delta) => {/* 解析过的增量 JSON */},
  onDone: () => {/* 结束回调 */},
  onError: (err) => {/* 错误处理 */},
});
```

实践建议：
- 流式模式下，SDK 自动处理 401 后的一次刷新重试；仍建议在 `onError` 中埋点或提示用户重试。
- 前端展示时采用“增量追加”策略，避免整段重渲染；对 `onMessage` 的 JSON 需做健壮性判断。

---

### 6) 安全与合规

- 令牌存储：当前实现将 `refresh_token` 存储于 `localStorage`，存在 XSS 风险。生产推荐迁移到 httpOnly Cookie（需要后端配合）。
- 跨域策略：通过网关将前端与认证/数据/积分/LLM 服务置于同源或同顶级域名路径下，或确保后端正确配置 CORS。
- Scope 最小化：仅请求业务所需的 scope，例如 `openid profile email data points llmapi`，避免过宽权限。

---

### 7) 部署与路由（MPA/Nginx 示例）

MPA 下建议使用统一回调地址（如 `/oauth/callback`）指向单一回调页面（如 `callback.html` 或某个页面路由）。各业务页面独立部署为静态页面即可。

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html; # 假设此目录下有多页：/page-a.html, /page-b.html, /callback.html

    # 业务页面（示例）
    location = /page-a.html { try_files $uri =404; }
    location = /page-b.html { try_files $uri =404; }

    # 统一 OAuth 回调页
    location = /oauth/callback { try_files /callback.html =404; }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止缓存 HTML，便于回调逻辑及时更新
    location ~* \.(html)$ { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
}
```

---

### 8) 典型页面结构与交互（MPA）

- 每页入口包裹 `OAuthProvider`，用于恢复/管理会话。
- 需要登录入口/用户菜单的页面在顶栏放置 `AuthAvatar`（点击触发 OAuth 登录，已登录展示头像菜单与退出）。
- 登录发起时将当前地址编码进 `state.returnTo`；回调页解析 `state` 并跳回。
- 多标签页即时同步可选用 `BroadcastChannel` 通知刷新，或依赖刷新/导航自动同步。
- 主体区域按卡片划分：数据服务（KV）、LLM 聊天（非流/流式）、积分（余额/消费）。参照示例应用 `App.tsx` 的结构组织交互与状态。

```1:20:oauth-example-app/src/App.tsx
import { OAuthProvider, useOAuth, AuthAvatar, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';
import { createPointsClient } from '@autolabz/points-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';
// ... more code ...
```

---

### 9) 故障处理与观测性

- 鉴权失败：SDK 会在 401 时尝试刷新；多次失败将触发回落到未登录态（可在 `onUnauthorized` 上绑定跳转登录）。
- 服务器限流/暂不可用：交由 SDK 的指数退避策略处理；UI 上提示“稍后重试”与 `x-request-id`。
- SSE 断流：在 `onError` 中提示用户重试或自动退避重连；避免累积未释放的 reader。

---

### 10) 最小可运行清单

依赖：

```bash
npm install @autolabz/oauth-sdk @autolabz/data-sdk @autolabz/points-sdk @autolabz/llmapi-sdk axios
```

关键代码：

```tsx
// 每页入口
<OAuthProvider authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL} clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
  {/* 当前页面内容 */}
</OAuthProvider>
```

桥接与调用：

```ts
const auth = useOAuth();
const data = createDataClient({ baseURL: import.meta.env.VITE_DATA_BASE_URL, auth: createAuthBridgeFromContext(auth) });
const points = createPointsClient({ baseURL: import.meta.env.VITE_POINTS_BASE_URL, auth: createAuthBridgeFromContext(auth) });
const llm = createLLMClient({ baseURL: import.meta.env.VITE_LLMAPI_BASE_URL, auth: createAuthBridgeFromContext(auth) });
```

---

### 附：常见问题（FAQ）

- ClientId 从哪里来？由 AutoLab 组织分配并作为固定配置注入生产；不要依赖 URL 查询解析。
- Token 放哪？前端由 `oauth-sdk` 存于本地存储并自动刷新；生产推荐迁到 httpOnly Cookie。
- 能否自带 axios 实例？建议直接用各 SDK 客户端以获得统一的注入/刷新/重试。自定义时需确保 401 可触发刷新或回落登出。

---

