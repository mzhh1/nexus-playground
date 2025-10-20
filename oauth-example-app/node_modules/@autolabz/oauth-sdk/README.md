# @autolabz/oauth-sdk

AutoLab OAuth SDK（基于 PKCE 的前端登录与回调处理），与 `@autolabz/auth-sdk` 风格一致，适用于希望通过 OAuth 授权码（PKCE）方式登录并获取 Access Token/Refresh Token 的 SPA 应用。

> 重要说明：本 SDK 为 OAuth-only 实现，不支持也不包含任何“门户（portal）模式”的兼容逻辑。所有登录均通过标准 OAuth 2.0 授权码（含 PKCE）流程发起与完成。

## 📦 安装

```bash
npm install @autolabz/oauth-sdk
```

## 🚀 快速开始

### 1) 在根组件挂载 Provider（使用环境变量配置绝对地址）

```tsx
import { OAuthProvider } from '@autolabz/oauth-sdk';

function App() {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL; // 例如: http://114.132.91.247/api

  return (
    <OAuthProvider authServiceUrl={authServiceUrl}>
      <YourApp />
    </OAuthProvider>
  );
}
```

> 可通过 `clientId` 或 `clientIdProvider` 提供客户端 ID；若均未提供，SDK 会尝试从 `?client_id=`/`?clientId=` 或 `sessionStorage('autolab_client_id')` 解析。

### 2) 发起登录（授权码 + PKCE）

```tsx
import { useOAuth } from '@autolabz/oauth-sdk';

function LoginButton() {
  const { startLogin } = useOAuth();

  const handleLogin = async () => {
    await startLogin({
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI, // 
      scope: 'openid profile email',
      // state: 可选，若不传由 SDK 自动生成
      usePkce: true,
      // 传递额外 OIDC/OAuth 参数（可选）
      additionalParams: { prompt: 'consent', login_hint: 'user@example.com' },
    });
  };

  return <button onClick={handleLogin}>登录</button>;
}
```

### 3) 处理回调并建立会话

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

登录成功后，SDK 会将 `access_token`/`refresh_token` 持久化到 `localStorage`，并通过 `OAuthProvider` 在全局共享状态；同时提供 `apiClient` 自动注入 `Authorization` 头并处理 401 刷新。登出时会调用撤销接口，尝试撤销当前 Access Token 和 Refresh Token。

## 🔄 端到端流程（OAuth 授权码 + PKCE）

1. 触发登录：调用 `startLogin` 或使用 `OAuthLoginButton`/`AuthAvatar` 组件，SDK 生成 `state` 与 `code_verifier`，派生 `code_challenge(S256)`，并将二者以 `state` 为键保存于 `sessionStorage`。
2. 跳转授权端点：浏览器跳转至 `GET /api/oauth/authorize?client_id&redirect_uri&response_type=code&scope&code_challenge&code_challenge_method=S256&state`。
3. 用户同意：认证服务校验并颁发一次性 `code`，重定向回 `redirect_uri?code=...&state=...`。
4. 回调处理：前端回调页调用 `handleRedirect`，SDK 取回 `code_verifier` 与 `state`，向 `/api/oauth/token` 发起 `authorization_code + PKCE` 换令牌，获得 `access_token`（可选 `refresh_token`）。
5. 建立会话：SDK 保存令牌，按需拉取 `/api/oauth/userinfo` 并填充 `user`，后续请求通过内置 `apiClient` 自动携带 `Authorization: Bearer ...` 并在 401 时尝试刷新。

> 注：本 SDK 不包含也不跳转任何“门户登录页”，请在管理端正确配置 OAuthClient 的 `redirectUris` 与 `allowed_scopes`，并从前端传入 `redirectUri`/`scope`。

## 🧭 API 概览

### 组件与 Hook

```ts
export { OAuthProvider, useOAuth } from '@autolabz/oauth-sdk';
export { OAuthLoginButton } from '@autolabz/oauth-sdk';
export { AuthAvatar } from '@autolabz/oauth-sdk';
```

#### OAuthProvider Props

```ts
interface OAuthProviderProps {
  children: React.ReactNode;
  authServiceUrl: string;                 // 认证服务基础地址，如 'http://114.132.91.247/api'
  clientId?: string;                      // 可选：固定 client_id
  clientIdProvider?: () => string | null; // 可选：动态解析
}
```

### 组件

#### OAuthLoginButton

```ts
interface OAuthLoginButtonProps {
  label?: string;
  redirectUri: string;
  scope?: string;
  usePkce?: boolean; // 默认 true
  additionalParams?: Record<string, string | number | boolean>;
}
```

用法：

```tsx
<OAuthLoginButton
  label="登录（OAuth/PKCE）"
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
  additionalParams={{ prompt: 'consent' }}
/>
```

> 提示：如果已经使用 `AuthAvatar`，通常不需要再使用 `OAuthLoginButton`。`AuthAvatar` 在未登录时会内置触发 OAuth 登录；仅当你需要一个不带头像菜单的“独立登录按钮”时再使用 `OAuthLoginButton`。

#### AuthAvatar（OAuth-only）

未登录时点击触发 OAuth 登录；已登录时显示头像菜单（可选展示“个人中心”入口）。

```ts
interface AuthAvatarProps {
  redirectUri: string;
  scope?: string;
  usePkce?: boolean; // 默认 true
  additionalParams?: Record<string, string | number | boolean>;
  profileUrl?: string; // 可选：个人中心地址；不传则不显示该菜单项
}
```

用法：

```tsx
<AuthAvatar
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email"
  additionalParams={{ prompt: 'consent' }}
  profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
/>
```

#### useOAuth 返回值（节选）

```ts
interface AuthContextValue {
  // 状态
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;

  // 客户端
  apiClient: OAuthAPIClient;              // 内置 HTTP 客户端（自动刷新 + 重试）

  // 登录/回调
  startLogin: (opts: {
    redirectUri: string;
    scope?: string;
    state?: string;
    usePkce?: boolean;
    clientIdOverride?: string;
    additionalParams?: Record<string, string | number | boolean>;
  }) => Promise<void>;

  handleRedirect: (opts?: {
    redirectUri?: string;                 // 默认：当前地址（不含 query）
    fetchUserinfo?: boolean;              // 默认：true
    clientIdOverride?: string;
  }) => Promise<{ accessToken: string; refreshToken?: string; userinfo?: any; state: string; }>;
}
```

### 低层方法（可选）

```ts
import { startAuthorization, getAuthorizeUrl, handleRedirectCallback, buildAuthorizeUrl } from '@autolabz/oauth-sdk';
```

- `startAuthorization(params)`：组装授权 URL 并跳转。
- `getAuthorizeUrl(params)`：仅返回授权 URL（不跳转），可自定义导航。
- `handleRedirectCallback(params)`：处理回调、用 `code + verifier` 交换 token，可选拉取 `/oauth/userinfo`。
- `buildAuthorizeUrl(params)`：仅构建 URL（不跳转）。

支持传入 `additionalParams` 以扩展 OIDC/OAuth 参数（如 `prompt`、`login_hint`、`audience` 等），SDK 会避免覆盖核心参数：

```ts
await startAuthorization({
  authServiceUrl: import.meta.env.VITE_AUTH_API_BASE_URL,
  clientId: 'example-client',
  redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
  scope: 'openid profile email',
  usePkce: true,
  additionalParams: {
    prompt: 'consent',
    login_hint: 'user@example.com',
  },
});
```

## 🔐 PKCE 说明

- SDK 会为每次授权生成 `code_verifier` 与 `code_challenge(S256)`，并以 `state` 作为关联键存入 `sessionStorage`。
- 回调页通过 `state` 取回对应的 `verifier`，完成令牌交换后清理。
- 若回调缺失或 `state` 不匹配，将抛出错误（通常意味着用户更换了标签页或回调已被消费）。

## ⚙️ 环境与网关要求

- 必须通过统一入口（如 Nginx）将前端与认证服务置于同一源或同一顶级域名路径下：
  - Web: `https://yourdomain.com/app/`
  - Auth API: `https://yourdomain.com/api/`
- 认证服务环境变量：
  - `CORS_ORIGINS`：允许的来源（根域），需包含前端访问源。
  - `FRONTEND_URL`：用于少量后台拼接链接的基准（与门户无关）。

## 🔁 与数据 SDK 集成

```ts
import { createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';

const { /* ... */ } = useOAuth();
const data = createDataClient({ baseURL: import.meta.env.VITE_DATA_BASE_URL, auth: createAuthBridgeFromContext(useOAuth()) });

await data.health();
```

## 🧪 开发与构建

```bash
npm run dev
npm run build
```

## ⚠️ 安全提示

当前实现将 `refresh_token` 存储于 `localStorage`，存在 XSS 风险；生产环境推荐迁移为 httpOnly Cookie 方案（服务端配合），详见根仓库 README 的“已知限制与未来方向”。

## 📄 License

MIT


