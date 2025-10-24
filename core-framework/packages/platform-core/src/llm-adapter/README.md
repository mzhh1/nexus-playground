# LLM Adapter 使用说明

## 概述

`LLMAdapter` 是一个封装了 `@autolabz/llmapi-sdk` 的适配器，提供了简化的 LLM API 调用接口。它使用 OAuth 认证，无需手动管理 API 密钥。

## 主要变更

与之前的实现相比，新的 `LLMAdapter`：

1. **使用 OAuth 认证**：通过 `AuthBridge` 接口管理认证，而不是使用 API 密钥
2. **使用 SDK**：直接使用 `@autolabz/llmapi-sdk` 的 `createLLMClient`，而不是手动 fetch
3. **自动令牌管理**：SDK 自动处理访问令牌的刷新和管理

## 使用示例

### 1. 创建认证桥接

首先，您需要创建一个 `AuthBridge` 实例，通常从 OAuth 上下文中获取：

```typescript
import { createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { useOAuth } from '@autolabz/oauth-sdk';

// 在 React 组件中
const auth = useOAuth();
const bridge = createAuthBridgeFromContext(auth);

// 适配为 LLMAdapter 所需的格式
const authBridge = {
  getAccessToken: () => bridge.getAccessToken(),
  getClientId: async () => {
    const v = await Promise.resolve(bridge.getClientId());
    return v ?? null;
  },
  refreshAccessToken: () => bridge.refreshAccessToken(),
  onUnauthorized: bridge.onUnauthorized,
};
```

### 2. 创建 LLMAdapter 实例

```typescript
import { createLLMAdapter } from '@nexus/platform-core';

const llmAdapter = createLLMAdapter({
  baseUrl: process.env.LLMAPI_BASE_URL || 'https://llmapi.autolabz.com',
  auth: authBridge,
  defaultModel: 'gpt-4o-mini',
  defaultTemperature: 0.7,
  defaultMaxTokens: 1024,
});
```

### 3. 发送普通请求

```typescript
const response = await llmAdapter.complete({
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'What is the capital of France?',
  temperature: 0.7,
  maxTokens: 100,
});

console.log(response.content);
```

### 4. 发送 JSON 模式请求

```typescript
const response = await llmAdapter.complete({
  systemPrompt: 'You are a JSON response generator.',
  userPrompt: 'Generate a user profile with name, age, and email.',
  jsonMode: true,
});

const data = JSON.parse(response.content);
console.log(data);
```

### 5. 使用流式响应

```typescript
for await (const chunk of llmAdapter.completeStream({
  systemPrompt: 'You are a storyteller.',
  userPrompt: 'Tell me a short story about a robot.',
})) {
  process.stdout.write(chunk);
}
```

### 6. 游戏 AI 决策

```typescript
import { createLLMPlayer } from '@nexus/platform-core';

// 创建 LLM 玩家
const llmPlayer = createLLMPlayer(
  {
    player_id: 'ai-player-1',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 500,
    system_prompt: 'You are a strategic game player.',
  },
  llmAdapter
);

// 根据游戏状态做决策
const action = await llmPlayer.decideAction(rolePerspective);
console.log('AI decided action:', action);
```

## 配置接口

### LLMConfig

```typescript
interface LLMConfig {
  /** LLM API基础URL */
  baseUrl: string;
  
  /** 认证桥接 */
  auth: AuthBridge;
  
  /** 默认模型（可选，默认：'gpt-4o-mini'） */
  defaultModel?: string;
  
  /** 默认温度（可选，默认：0.7） */
  defaultTemperature?: number;
  
  /** 默认最大Token数（可选，默认：1024） */
  defaultMaxTokens?: number;
}
```

### AuthBridge

```typescript
interface AuthBridge {
  /** 获取访问令牌 */
  getAccessToken: () => Promise<string>;
  
  /** 获取客户端ID */
  getClientId: () => Promise<string | null>;
  
  /** 刷新访问令牌 */
  refreshAccessToken: () => Promise<string>;
  
  /** 未授权回调（可选） */
  onUnauthorized?: () => void | Promise<void>;
}
```

## 后端服务使用 OAuth Client Credentials Flow

对于后端服务（如 API Server），应该使用 OAuth Client Credentials Flow。`AuthService` 已经提供了 `getAuthBridge()` 方法：

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

**工作原理**：
- `AuthService.getAuthBridge()` 自动使用 Client Credentials Flow 获取访问令牌
- 令牌会被缓存，并在过期前自动刷新
- 无需手动管理 API Key 或令牌

## 参考示例

- **前端应用示例**：`/oauth-example-app/src/App.tsx` - 展示如何在 React 应用中集成 OAuth 认证和 LLM API 调用
- **后端服务示例**：`/core-framework/api-server/src/index.ts` - 展示如何在后端服务中使用 OAuth Client Credentials Flow

## 注意事项

1. **OAuth 认证必需**：使用前必须先完成 OAuth 认证流程
2. **自动令牌刷新**：SDK 会自动处理令牌过期和刷新
3. **错误处理**：建议在调用时使用 try-catch 捕获可能的认证或网络错误
4. **流式响应**：流式方法返回 AsyncGenerator，可以用 for-await-of 遍历
5. **JSON 模式**：启用 jsonMode 时，LLM 会以 JSON 格式返回响应

## 迁移指南

### 前端应用

在前端应用中，使用 `createAuthBridgeFromContext` 从 OAuth 上下文创建 AuthBridge：

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

在后端服务中，使用 `AuthService.getAuthBridge()` 创建 AuthBridge：

```typescript
import { createAuthService, createLLMAdapter } from '@nexus/platform-core';

const authService = createAuthService({
  authServiceUrl: process.env.AUTH_API_BASE_URL,
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
});

const llmAdapter = createLLMAdapter({
  baseUrl: process.env.LLMAPI_BASE_URL,
  auth: authService.getAuthBridge(),
});
```

## 支持的模型

- `gpt-4o`
- `gpt-4o-mini` (推荐)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

具体可用模型取决于您的 AutoLab 账户权限。

