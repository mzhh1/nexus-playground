@autolabz/oauth-sdk

AutoLab OAuth SDK（基于 PKCE 的前端登录与回调处理）。与 `@autolabz/auth-sdk` 风格一致，适用于需要通过 OAuth 授权码（PKCE）登录并获取 Access/Refresh Token 的 SPA 应用。

重要说明：本 SDK 为 OAuth-only 实现，不包含任何“门户（portal）模式”的逻辑。所有登录均通过标准 OAuth 2.0 授权码（含 PKCE）流程完成。

### 📦 安装

```bash
npm install @autolabz/oauth-sdk
```

### 🚀 快速开始

#### 1) 在根组件挂载 Provider

```tsx
import { OAuthProvider } from '@autolabz/oauth-sdk';

function App() {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL; // 例: http://114.132.91.247/api
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;

  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
      <YourApp />
    </OAuthProvider>
  );
}
```

必须通过 `clientId` 提供固定的客户端 ID（不再支持动态解析、URL 参数或 sessionStorage 回退）。

#### 2) 发起登录（授权码 + PKCE）

```tsx
import { useOAuth } from '@autolabz/oauth-sdk';

function LoginButton() {
  const { startLogin } = useOAuth();

  const handleLogin = async () => {
    await startLogin({
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      scope: 'openid profile email',
      // state: 可选，不传则由 SDK 自动生成
      usePkce: true,
      additionalParams: { prompt: 'consent', login_hint: 'user@example.com' },
    });
  };

  return <button onClick={handleLogin}>登录</button>;
}
```

#### 3) 处理回调并建立会话

```tsx
import { useEffect } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';

function CallbackPage() {
  const { handleRedirect, isAuthenticated, user } = useOAuth();

  useEffect(() => {
    handleRedirect({ fetchUserinfo: true, redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI })
      .catch((e) => console.error('OAuth 回调失败:', e));
  }, [handleRedirect]);

  if (!isAuthenticated) return <div>正在登录...</div>;
  return <div>欢迎回来，{user?.nickname || user?.email}</div>;
}
```

成功后，SDK 会将 `access_token`/`refresh_token` 持久化到 `localStorage`，并通过 `OAuthProvider` 提供全局状态；同时暴露 `apiClient`，自动注入 `Authorization` 头并在 401 时刷新重试。登出时会尝试撤销当前 Access/Refresh Token。

### 🔄 实现重定向（returnTo）

SDK 支持在 OAuth 登录流程中保存当前页面 URL，并在登录成功后自动重定向回原页面。

#### 自动生成 returnTo

当使用 `AuthAvatar` 或 `OAuthLoginButton` 组件时，如果不提供 `state` 参数，SDK 会自动生成包含当前页面 URL 的 state：

```tsx
import { AuthAvatar } from '@autolabz/oauth-sdk';

// 自动使用当前页面 URL 作为 returnTo
<AuthAvatar
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
/>
```

#### 自定义 returnTo

可以通过 `returnTo` prop 指定登录成功后要重定向到的 URL：

```tsx
<AuthAvatar
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
  returnTo="/dashboard"  // 自定义重定向目标
/>
```

#### 在回调页面中提取 returnTo

在回调页面中，使用 `getReturnToFromState` 工具函数从 state 中提取 returnTo URL：

```tsx
import { useOAuth, getReturnToFromState } from '@autolabz/oauth-sdk';
import { useEffect } from 'react';

function CallbackPage() {
  const { handleRedirect, isAuthenticated } = useOAuth();

  useEffect(() => {
    handleRedirect({ 
      fetchUserinfo: true, 
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI 
    })
      .then((result) => {
        // 从 state 中提取 returnTo URL
        const returnTo = getReturnToFromState(result.state) || '/';
        // 重定向到原页面
        window.location.replace(returnTo);
      })
      .catch((e) => console.error('OAuth 回调失败:', e));
  }, [handleRedirect]);

  if (!isAuthenticated) return <div>正在登录...</div>;
  return <div>正在跳转...</div>;
}
```

#### 手动创建包含 returnTo 的 state

如果需要手动创建 state，可以使用 `createStateWithReturnTo` 工具函数：

```tsx
import { useOAuth, createStateWithReturnTo } from '@autolabz/oauth-sdk';

function LoginButton() {
  const { startLogin } = useOAuth();

  const handleLogin = async () => {
    const returnTo = window.location.pathname + window.location.search;
    const state = createStateWithReturnTo(returnTo);
    
    await startLogin({
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      scope: 'openid profile email',
      state: state,
      usePkce: true,
    });
  };

  return <button onClick={handleLogin}>登录</button>;
}
```

#### State 工具函数

SDK 提供了以下工具函数用于处理 state：

```ts
import { 
  createStateWithReturnTo,  // 创建包含 returnTo 的编码 state
  decodeState,               // 解码 state 字符串
  getReturnToFromState,      // 从 state 中提取 returnTo URL
  StatePayload               // State 载荷类型定义
} from '@autolabz/oauth-sdk';
```

**注意事项：**
- 如果提供了自定义 `state`，SDK 不会自动添加 returnTo，需要手动使用 `createStateWithReturnTo` 创建
- `returnTo` URL 应该是相对于应用根路径的路径（如 `/dashboard`），而不是完整的 URL
- 如果 state 中不包含 returnTo 或解析失败，`getReturnToFromState` 会返回 `null`

### 🔍 客户端 ID

`client_id` 需要由应用在挂载 `<OAuthProvider />` 时以固定值显式传入：不支持动态 provider、URL 参数或任何存储中的自动解析。

### 🧭 API 概览

```ts
export { OAuthProvider, useOAuth } from '@autolabz/oauth-sdk';
export { OAuthLoginButton } from '@autolabz/oauth-sdk';
export { AuthAvatar } from '@autolabz/oauth-sdk';
export { OAuthAPIClient } from '@autolabz/oauth-sdk';
export { startAuthorization, handleRedirectCallback, getAuthorizeUrl, buildAuthorizeUrl } from '@autolabz/oauth-sdk';
export { createStateWithReturnTo, decodeState, getReturnToFromState, StatePayload } from '@autolabz/oauth-sdk';
```

#### OAuthProvider Props

```ts
interface OAuthProviderProps {
  children: React.ReactNode;
  authServiceUrl: string;                 // 认证服务基础地址，如 'http://114.132.91.247/api'
  clientId: string;                       // 必填：固定 client_id
}
```

#### useOAuth 返回值（完整）

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
  logoutSession(): Promise<void>;          // 仅销毁服务端会话并本地清理
  refreshAuth(): void;                     // 从 localStorage 重新加载
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
    redirectUri?: string;                  // 默认：当前地址（不含 query）
    fetchUserinfo?: boolean;               // 默认：true
  }): Promise<{ accessToken: string; refreshToken?: string; userinfo?: any; state: string; }>;
}
```

#### 组件：OAuthLoginButton

```ts
interface OAuthLoginButtonProps {
  redirectUri: string;
  scope?: string;
  usePkce?: boolean; // 默认 true
  additionalParams?: Record<string, string | number | boolean>;
  label?: string;
  className?: string;
  onError?: (error: Error) => void;
  returnTo?: string; // 登录成功后重定向到的 URL，不传则使用当前页面 URL
  state?: string | (() => string); // 可选：自定义/延迟生成 state（如果提供，returnTo 将被忽略）
}
```

示例：

```tsx
<OAuthLoginButton
  label="登录（OAuth/PKCE）"
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
  additionalParams={{ prompt: 'consent' }}
  className="btn-primary"
/>
```

#### 组件：AuthAvatar（OAuth-only）

未登录时点击触发 OAuth 登录；已登录时显示头像菜单（可选"个人中心"入口）。

```ts
interface AuthAvatarProps {
  redirectUri: string;
  scope?: string;
  usePkce?: boolean; // 默认 true
  additionalParams?: Record<string, string | number | boolean>;
  profileUrl?: string; // 个人中心地址，默认 `${window.location.origin}/auth/profile`
  returnTo?: string; // 登录成功后重定向到的 URL，不传则使用当前页面 URL
  state?: string | (() => string); // 可选：自定义/延迟生成 state（如果提供，returnTo 将被忽略）
}
```

```tsx
<AuthAvatar
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
  additionalParams={{ prompt: 'consent' }}
  profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
/>
```

#### 客户端：OAuthAPIClient（Axios）

内置拦截器：
- 请求阶段自动注入 `Authorization: Bearer <access_token>`。
- 响应阶段遇到 401 时，使用 `refresh_token` 刷新并重试（跳过 `/oauth/token`、`/oauth/revoke`、`/oauth/logout-session`）。

```ts
import { useOAuth } from '@autolabz/oauth-sdk';

const { apiClient } = useOAuth();
const http = apiClient.getClient(); // AxiosInstance

const res = await http.get('/data/projects');
```

### 🔄 端到端流程（授权码 + PKCE）

1) 触发登录：调用 `startLogin` 或使用 `OAuthLoginButton`/`AuthAvatar`。SDK 生成 `state`（包含 returnTo URL 和随机 nonce）与 `code_verifier`，派生 `code_challenge(S256)`，并以 `state` 为键保存到 `sessionStorage`。
2) 跳转授权端点：浏览器前往 `GET /api/oauth/authorize?...`（state 参数包含编码后的 returnTo 信息）。
3) 用户同意后重定向回 `redirect_uri?code=...&state=...`。
4) 回调页 `handleRedirect`：取回 `verifier` 与 `state`，向 `/api/oauth/token` 交换令牌，可选拉取 `/api/oauth/userinfo`。
5) 持久化会话：保存令牌，填充 `user`，后续请求自动携带 `Authorization` 并在 401 时刷新。
6) 提取 returnTo：使用 `getReturnToFromState(result.state)` 从 state 中提取原始页面 URL，并重定向回该页面。

注：本 SDK 不包含或跳转任何"门户登录页"。请在管理端为 OAuthClient 配置 `redirectUris` 与 `allowed_scopes`，并从前端传入 `redirectUri`/`scope`。

### 🧱 低层方法（可选）

```ts
import { startAuthorization, getAuthorizeUrl, handleRedirectCallback, buildAuthorizeUrl } from '@autolabz/oauth-sdk';

await startAuthorization({
  authServiceUrl: import.meta.env.VITE_AUTH_API_BASE_URL,
  clientId: 'example-client',
  redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
  scope: 'openid profile email',
  usePkce: true,
  additionalParams: { prompt: 'consent', login_hint: 'user@example.com' },
});
```

### 🔐 PKCE 说明

- 每次授权生成 `code_verifier` 与 `code_challenge(S256)`，并以 `state` 作为关联键存入 `sessionStorage`。
- 回调页通过 `state` 取回对应 `verifier`，完成令牌交换后清理。
- 若回调缺失或 `state` 不匹配，将抛出错误（常见于用户刷新/更换标签页）。

### 🌐 环境与网关要求

- 通过统一入口（如 Nginx）将前端与认证服务置于同源或同一主域路径下：
  - Web: `https://yourdomain.com/app/`
  - Auth API: `https://yourdomain.com/api/`
- 认证服务环境变量：
  - `CORS_ORIGINS`：允许的来源（根域），需包含前端访问源。
  - `FRONTEND_URL`：后台拼接链接用基准（与门户无关）。

### 🔁 与数据 SDK 集成

```ts
import { createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';

const bridge = createAuthBridgeFromContext(useOAuth());
const data = createDataClient({ baseURL: import.meta.env.VITE_DATA_BASE_URL, auth: bridge });
await data.health();
```

### 🧪 开发与构建

```bash
npm run dev
npm run build
```


### 📄 License

MIT
