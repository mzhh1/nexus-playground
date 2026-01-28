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
 - 会话共享自动依赖存储介质，而不是依赖 React 上下文。
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

使用import '@autolabz/oauth-sdk/dist/style.css';
来保证AuthAvatar的标准样式

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

注意：回调页本身也必须挂载 `OAuthProvider`，并且其 `authServiceUrl` 与 `clientId` 与其他页面完全一致。`handleRedirect` 会完成与认证服务的换令牌，并将令牌持久化（当前实现存储于同源 `localStorage`），无需在回调页手工写入。

```tsx
// 回调页完整示例（页面入口）
import { OAuthProvider } from '@autolabz/oauth-sdk';

export default function CallbackPage() {
  return (
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <OAuthCallback />
    </OAuthProvider>
  );
}
```

要点：
- `oauth-sdk` 自动完成 PKCE、回调处理、令牌持久化与 401 刷新。
- MPA 中每页挂载 `OAuthProvider`，共享同源存储中的登录态。
- 使用自定义 `state` 承载回跳信息；务必加入唯一 `nonce`，避免并发登录造成 PKCE 关联冲突。
- 生产固定 `clientId`，避免仅依赖 URL 解析；并确保网关允许前端源访问认证域（CORS/同域网关）。
- `useOAuth()` 提供登录态与用户信息：`isAuthenticated` 表示是否已登录，`user` 形如 `{ id, email, nickname, avatarUrl }`。
  示例：`const { isAuthenticated, user } = useOAuth(); const uid = user?.id;`

### 1A) 典型场景：带 AuthAvatar 的页面（isAuthenticated 门控）

```tsx
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';

export function PageWithAvatar() {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL;
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
      <HeaderBar />
      <MainArea />
    </OAuthProvider>
  );
}

function HeaderBar() {
  return (
    <div className="header">
      <AuthAvatar
        redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
        scope={import.meta.env.VITE_OAUTH_SCOPE ?? 'openid profile email'}
        profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
      />
    </div>
  );
}

function MainArea() {
  const { isAuthenticated, user } = useOAuth();
  if (!isAuthenticated) {
    return <div>请先登录（点击右上角头像）</div>;
  }
  return <div>欢迎 {user?.nickname || user?.email}</div>;
}
```

### 1B) 典型场景：无 AuthAvatar，未登录自动 startLogin 跳转

```tsx
import { useEffect } from 'react';
import { OAuthProvider, useOAuth } from '@autolabz/oauth-sdk';

function makeState(payload: any) {
  try {
    const json = JSON.stringify({ ...payload, nonce: crypto.randomUUID?.() || String(Date.now()) });
    return btoa(encodeURIComponent(json));
  } catch { return ''; }
}

export function PageAutoLogin() {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL;
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
      <AutoLoginGate />
      <ProtectedContent />
    </OAuthProvider>
  );
}

function AutoLoginGate() {
  const { isInitialized, isAuthenticated, startLogin } = useOAuth();

  useEffect(() => {
    if (!isInitialized) return; // 等待 Provider 完成初始化
    // 若 URL 上存在 code/state/error（正在处理回调），避免再次触发登录
    const url = new URL(window.location.href);
    const hasAuthParams = url.searchParams.has('code') || url.searchParams.has('state') || url.searchParams.has('error');
    if (!isAuthenticated && !hasAuthParams) {
      const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI;
      const state = makeState({ returnTo: window.location.href });
      startLogin({
        redirectUri,
        state,
        scope: import.meta.env.VITE_OAUTH_SCOPE ?? 'openid profile email',
      });
    }
  }, [isInitialized, isAuthenticated, startLogin]);

  return null; // 只负责触发跳转
}

function ProtectedContent() {
  const { isAuthenticated } = useOAuth();
  if (!isAuthenticated) return <div>正在跳转登录...</div>;
  return <div>这是已登录用户可见的内容区域</div>;
}
```

#### 避免重定向循环（Checklist）

- 确保回调页挂载了与业务页完全一致的 `OAuthProvider`（相同 `authServiceUrl`、`clientId`）。
- `redirectUri` 必须与服务端注册值完全一致，`startLogin` 与回调页使用同一地址。
- 回调页调用 `handleRedirect` 前，URL 中应存在 `code` 和 `state` 参数；若缺失，检查认证网关回跳配置。
- 回调页与业务页必须同源，以共享 `localStorage`；不同源会导致令牌不可见而反复跳转。
- 避免在包含 `code/state` 的页面再次调用 `startLogin`（见上方 `hasAuthParams` 保护）。
- 确认 `state` 携带唯一 `nonce`，并且未被多个并发登录复用。
- 浏览器未禁用第三方存储/本地存储；隐私/无痕模式下确认 `localStorage` 可用。

---

### 1C) useOAuth 返回值（完整接口）

```ts
interface AuthContextValue {
  // 状态
  isAuthenticated: boolean;
  user: User | null;                           // User = { id: string; email: string; nickname: string | null; avatarUrl: string | null }
  accessToken: string | null;
  isInitialized: boolean;

  // 会话与令牌
  login(user: User, accessToken: string, refreshToken: string): void;
  logout(): Promise<void>;
  logoutSession(): Promise<void>;              // 仅销毁服务端会话并本地清理
  refreshAuth(): void;                         // 从 localStorage 重新加载
  getAccessToken(): string | null;
  updateAccessToken(newAccessToken: string): void;
  getClientId(): string | null;

  // HTTP 客户端（Axios）
  apiClient: OAuthAPIClient;

  // 登录/回调
  startLogin(opts: {
    redirectUri: string;
    scope?: string;
    state?: string;
    usePkce?: boolean;
    additionalParams?: Record<string, string | number | boolean>;
  }): Promise<void>;

  handleRedirect(opts?: {
    redirectUri?: string;                      // 默认：当前地址（不含 query）
    fetchUserinfo?: boolean;                   // 默认：true
  }): Promise<{ accessToken: string; refreshToken?: string; userinfo?: any; state: string; }>;
}
```

常用字段说明：
- `isAuthenticated`：当前用户是否已登录（令牌有效）。
- `user`：已登录用户的基本信息，包含 `id`、`email`、`nickname`、`avatarUrl`。
- `isInitialized`：Provider 是否已完成初始化（从存储恢复会话），确保在此后读取状态可靠。
- `startLogin`：发起 OAuth 授权流程，跳转到认证服务；支持自定义 `state`、`scope` 和额外参数。
- `handleRedirect`：在回调页调用，完成授权码换令牌并返回结果（含 `state`、`accessToken`、`userinfo`）。
- `logout`：清除本地令牌并销毁服务端会话。
- `getClientId`：返回当前配置的 `clientId`。

---

### 1D) 头像图片获取接口

`oauth-sdk` 提供了专门的头像图片获取工具，用于处理需要 OAuth 认证的头像图片：

#### Hook 方式：useAuthenticatedImage

适用于 React 组件中自动管理加载状态和内存清理：

```tsx
import { useAuthenticatedImage } from '@autolabz/oauth-sdk';

function UserProfile() {
  const { user } = useOAuth();
  
  // 自动处理认证、加载状态和内存清理
  const { imageUrl, isLoading, error } = useAuthenticatedImage(user?.avatarUrl);
  
  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;
  
  return <img src={imageUrl} alt="用户头像" />;
}
```

**特性：**
- 自动使用 OAuth token 进行认证
- 返回 Blob URL，避免跨域问题
- 组件卸载时自动清理 Blob URL，防止内存泄漏
- 提供 `isLoading` 和 `error` 状态

#### 函数方式：fetchAuthenticatedImage

适用于需要手动控制的场景：

```tsx
import { fetchAuthenticatedImage, revokeBlobUrl } from '@autolabz/oauth-sdk';

async function downloadAvatar(avatarUrl: string, accessToken: string) {
  try {
    // 获取认证后的图片 Blob URL
    const blobUrl = await fetchAuthenticatedImage(avatarUrl, accessToken);
    
    // 使用 blobUrl...
    console.log('图片 URL:', blobUrl);
    
    // 使用完毕后手动清理（重要！）
    revokeBlobUrl(blobUrl);
  } catch (error) {
    console.error('获取头像失败:', error);
  }
}
```

**参数说明：**
- `imageUrl`: 图片 URL（相对路径或完整 URL）
- `accessToken`: OAuth 访问令牌
- `baseUrl`: （可选）API 基础 URL，用于拼接相对路径

**注意事项：**
- 使用 `fetchAuthenticatedImage` 时必须手动调用 `revokeBlobUrl` 清理，否则会造成内存泄漏
- 推荐在 React 组件中使用 `useAuthenticatedImage`，它会自动管理生命周期
- `AuthAvatar` 组件内部已使用 `useAuthenticatedImage`，无需额外处理

---

### 2A) 鉴权桥接：一次登录，多 SDK 复用

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

在 MPA 中，`data-sdk`、`points-sdk`、`llmapi-sdk` 客户端应当"每页创建，并在该页内复用（useMemo 或模块级单例）"。不建议跨页共享实例；

---

### 2B) 前端调用自定义后端：createAuthenticatedClient

在实际业务中，前端经常需要调用自己的 Next.js/Express 后端，而不是直接调用 AutoLab 服务。此时可使用 `createAuthenticatedClient` 创建指向自定义后端的已认证 HTTP 客户端。

#### 架构模式

```
前端 (oauth-sdk)
  ↓ Bearer token
自己的 Next.js 后端 (service-auth-nextjs 验证)
  ↓ 必要时调用
AutoLab 服务 (data-sdk/points-sdk/llmapi-sdk)
```

#### 使用示例

```tsx
import { useOAuth, createAuthenticatedClient } from '@autolabz/oauth-sdk';
import { useMemo } from 'react';

function MyComponent() {
  const auth = useOAuth();

  // 创建指向自己后端的已认证客户端
  const backendClient = useMemo(
    () => createAuthenticatedClient({
      baseURL: 'http://my-backend.com/api',
      auth: {
        getAccessToken: auth.getAccessToken,
        refreshAccessToken: () => auth.apiClient.refreshAccessToken(),
        onRefreshFailed: auth.logout,
      },
    }),
    [auth]
  );

  const fetchUserProfile = async () => {
    // 自动携带 Authorization: Bearer <token>
    const res = await backendClient.get('/user/profile');
    return res.data;
  };

  const updateSettings = async (settings: any) => {
    // 401 时自动刷新令牌并重试
    const res = await backendClient.post('/user/settings', settings);
    return res.data;
  };
}
```

#### 客户端特性

`createAuthenticatedClient` 返回的 Axios 实例会自动：

1. **请求拦截**：在每个请求中添加 `Authorization: Bearer <token>` 头
2. **401 自动刷新**：收到 401 响应时调用 `refreshAccessToken()` 并重试原请求
3. **刷新失败回调**：刷新失败时调用 `onRefreshFailed`（例如跳转登录）
4. **自定义头**：支持传入额外的请求头（如 `X-Client-Id`）

#### 配置选项

```ts
createAuthenticatedClient({
  // 必填：后端 API 基础地址
  baseURL: string;
  
  // 必填：认证相关回调
  auth: {
    getAccessToken: () => string | null;
    refreshAccessToken: () => Promise<string>;
    onRefreshFailed?: () => void;
  };
  
  // 可选：是否启用自动刷新（默认：true）
  autoRefresh?: boolean;
  
  // 可选：额外的请求头
  headers?: Record<string, string>;
})
```

#### 后端验证令牌

后端使用 `@autolabz/service-auth-nextjs` 验证前端传来的令牌：

```ts
// Next.js API Route (app router)
import { createAuthMiddleware } from '@autolabz/service-auth-nextjs';

const authMiddleware = createAuthMiddleware({
  authServiceUrl: process.env.AUTH_SERVICE_URL!,
  requireClientId: true,
});

export async function GET(request: Request) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { userId, clientId } = authResult;
  // 使用 userId 进行业务逻辑
  return Response.json({ userId, data: '...' });
}
```

详见 [SERVICE_AUTH_NEXTJS_GUIDE.md](./SERVICE_AUTH_NEXTJS_GUIDE.md) 的完整集成指南。

#### 何时使用自定义后端

推荐场景：

- **复杂业务逻辑**：需要在后端聚合多个数据源或执行复杂计算
- **第三方集成**：调用外部 API（支付、通知）并保护密钥
- **数据库操作**：直接访问自己的数据库（Postgres/MongoDB）
- **权限控制**：实现细粒度的业务权限逻辑
- **性能优化**：批量操作、缓存、预计算等

不推荐场景：

- **简单数据存储**：用户偏好、KV 数据可直接用 `data-sdk`
- **纯 LLM 调用**：直接用 `llmapi-sdk` 即可，无需额外后端
- **静态内容**：CDN 或对象存储更合适

#### 完整示例：用户设置页面

```tsx
import { OAuthProvider, useOAuth, createAuthenticatedClient } from '@autolabz/oauth-sdk';
import { useState, useEffect, useMemo } from 'react';

export function SettingsPage() {
  return (
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <SettingsContent />
    </OAuthProvider>
  );
}

function SettingsContent() {
  const auth = useOAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const backendClient = useMemo(
    () => createAuthenticatedClient({
      baseURL: import.meta.env.VITE_BACKEND_API_BASE_URL,
      auth: {
        getAccessToken: auth.getAccessToken,
        refreshAccessToken: () => auth.apiClient.refreshAccessToken(),
        onRefreshFailed: () => {
          console.error('Token 刷新失败，请重新登录');
          auth.logout();
        },
      },
    }),
    [auth]
  );

  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await backendClient.get('/user/settings');
        setSettings(res.data);
      } catch (error) {
        console.error('加载设置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [auth.isAuthenticated, backendClient]);

  const handleSave = async () => {
    try {
      await backendClient.post('/user/settings', settings);
      alert('保存成功');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

  if (!auth.isAuthenticated) return <div>请先登录</div>;
  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <h1>用户设置</h1>
      <input
        value={settings?.nickname || ''}
        onChange={(e) => setSettings({ ...settings, nickname: e.target.value })}
      />
      <button onClick={handleSave}>保存</button>
    </div>
  );
}
```

---

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

// 便捷方法：直接获取内容字符串（推荐）
const content = await llm.getChatContent({
  model: 'gpt-4o-mini-2024-07-18',
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(content); // 直接得到 "Hello from AutoLab! How can I assist you today?"

// 流式（SSE）
await llm.chatStream({ model: 'gpt-4o-mini', messages: [], stream: true }, {
  onEvent: (line) => {/* 原始 SSE 行，可用于调试 */},
  onMessage: (delta) => {/* 解析过的增量 JSON */},
  onDone: () => {/* 结束回调 */},
  onError: (err) => {/* 错误处理 */},
});
```

实践建议：
- **优先使用 `getChatContent`**：若只需要文本内容，无需手动从 `resp.choices[0].message.content` 提取。
- 流式模式下，SDK 自动处理 401 后的一次刷新重试；仍建议在 `onError` 中埋点或提示用户重试。
- 前端展示时采用"增量追加"策略，避免整段重渲染；对 `onMessage` 的 JSON 需做健壮性判断。
- 若需要访问 `usage`、`finish_reason` 等元信息，使用 `chat` 方法获取完整响应。

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

