# OAuth AuthBridge 迁移说明

## 概述

本次更新将 `LLMAdapter` 的认证方式从自定义的 `APIKeyAuthBridge` 迁移到使用 `@autolabz/oauth-sdk` 提供的标准 `AuthBridge` 接口。

## 主要变更

### 1. 移除的文件

- ❌ `core-framework/packages/platform-core/src/llm-adapter/APIKeyAuthBridge.ts` - 已删除

### 2. 更新的文件

#### `LLMAdapter.ts`
- ✅ 从 `@autolabz/oauth-sdk` 导入 `AuthBridge` 类型
- ✅ 移除了自定义的 `AuthBridge` 接口定义
- ✅ 保持与 `@autolabz/llmapi-sdk` 的集成

#### `AuthService.ts`
- ✅ 新增 `getAuthBridge()` 方法
- ✅ 实现了 OAuth Client Credentials Flow
- ✅ 自动管理 token 缓存和刷新

#### `api-server/src/index.ts`
- ✅ 移除了 `createAPIKeyAuthBridge` 的导入和使用
- ✅ 使用 `authService.getAuthBridge()` 创建 LLM Adapter

#### `llm-adapter/README.md`
- ✅ 更新文档，移除 API Key 相关说明
- ✅ 添加 OAuth Client Credentials Flow 使用说明
- ✅ 更新迁移指南

## 使用方法

### 前端应用

```typescript
import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createLLMAdapter } from '@nexus/platform-core';

function MyComponent() {
  const auth = useOAuth();
  const bridge = createAuthBridgeFromContext(auth);

  const llmAdapter = useMemo(() => createLLMAdapter({
    baseUrl: import.meta.env.VITE_LLMAPI_BASE_URL,
    auth: {
      getAccessToken: () => bridge.getAccessToken(),
      getClientId: async () => {
        const v = await Promise.resolve(bridge.getClientId());
        return v ?? null;
      },
      refreshAccessToken: () => bridge.refreshAccessToken(),
      onUnauthorized: bridge.onUnauthorized,
    },
  }), [auth]);

  // 使用 llmAdapter...
}
```

### 后端服务

```typescript
import { createAuthService, createLLMAdapter } from '@nexus/platform-core';

// 1. 创建认证服务
const authService = createAuthService({
  authServiceUrl: process.env.AUTH_API_BASE_URL,
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
});

// 2. 使用认证服务创建 LLM Adapter
const llmAdapter = createLLMAdapter({
  baseUrl: process.env.LLMAPI_BASE_URL,
  auth: authService.getAuthBridge(),
});
```

## 环境变量配置

### 前端应用 (.env)

```bash
VITE_AUTH_API_BASE_URL=http://localhost/api
VITE_OAUTH_CLIENT_ID=your_client_id
VITE_OAUTH_REDIRECT_URI=http://localhost/callback
VITE_LLMAPI_BASE_URL=https://llmapi.autolabz.com
```

### 后端服务 (.env)

```bash
AUTH_API_BASE_URL=http://localhost/api
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
LLMAPI_BASE_URL=https://llmapi.autolabz.com
```

## AuthBridge 工作原理

### 前端（Authorization Code + PKCE Flow）
1. 用户点击登录按钮
2. 重定向到 OAuth 授权页面
3. 用户授权后返回 authorization code
4. 使用 PKCE verifier 交换 access token
5. Token 存储在 `localStorage`
6. SDK 自动刷新过期的 token

### 后端（Client Credentials Flow）
1. 服务启动时，使用 `client_id` 和 `client_secret` 获取 token
2. Token 缓存在内存中
3. 在 token 过期前（90%生命周期）自动刷新
4. 所有 LLM API 请求自动注入 token

## 优势

✅ **统一认证方式**：前后端都使用标准的 OAuth 2.0 流程
✅ **自动 Token 管理**：无需手动管理 API Key 或 Token 刷新
✅ **更好的安全性**：使用短期 Token 代替长期 API Key
✅ **符合最佳实践**：遵循 OAuth 2.0 标准和 AutoLab SDK 设计规范
✅ **简化配置**：减少手动配置，降低出错可能

## 注意事项

⚠️ **后端服务**必须配置 `OAUTH_CLIENT_SECRET` 环境变量
⚠️ **前端应用**不应包含 `client_secret`（仅使用 PKCE Flow）
⚠️ Token 缓存在内存中，服务重启后会重新获取
⚠️ 确保 OAuth 服务端点正确配置并可访问

## 参考资料

- [OAuth 示例应用](./oauth-example-app/README.md)
- [LLM Adapter 文档](./core-framework/packages/platform-core/src/llm-adapter/README.md)
- [AuthService 源码](./core-framework/packages/platform-core/src/auth/AuthService.ts)
- [API Server 示例](./core-framework/api-server/src/index.ts)

