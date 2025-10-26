# API Client 重构说明

## 🎯 问题

用户提问："按照我们在 README 的设计，是否没有必要。oauth-sdk 提供了 AuthProvider。也能基于它处理业务 API 方法和拦截器"

## ✅ 答案：您说得对！

经过分析，**自定义的复杂 `ApiClient` 类确实可以大幅简化**。

## 📊 分析

### OAuth SDK 已提供的能力

`@autolabz/oauth-sdk` 的 `useOAuth()` 暴露了 `apiClient`（`OAuthAPIClient`类），它提供：

1. ✅ 自动注入 `Authorization: Bearer <token>`
2. ✅ 401 自动刷新令牌并重试
3. ✅ 请求队列机制（避免并发刷新冲突）
4. ✅ 底层 `AxiosInstance` 可直接使用

### 后端不强制要求的头

根据后端配置（`backend/src/plugins/auth.ts`）：

```typescript
clientId: {}, // 可选：从 X-Client-Id header 或 client_id 查询参数提取
enforce: {}, // 没有强制 scope 要求
```

- ❌ **`X-Client-Id`** - 可选（非必需）
- ❌ **`X-Request-Id`** - 由 Fastify 后端自动生成

### 原有 `ApiClient` 的冗余部分

1. 重复实现了 OAuth SDK 已有的功能
   - 自定义的 `setAuthProviders()` 机制
   - 重复的 401 刷新逻辑
   - 重复的拦截器设置

2. 不必要的功能
   - 手动生成 `X-Request-Id`（后端会生成）
   - `X-Client-Id` 注入（后端可从查询参数获取）

## 🔄 重构方案

### 新架构

```
┌─────────────────────────────────────────┐
│         React Components                 │
│  useGameAPI() → 类型安全的业务 API        │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│         GameAPI (轻量封装)                │
│  提供: getRoomInfo(), submitAction()...  │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  OAuth SDK's OAuthAPIClient              │
│  处理: 鉴权、刷新、重试、队列             │
└─────────────────────────────────────────┘
```

### 新的 `api-client.ts`

```typescript
/**
 * Architecture:
 * - OAuth SDK's apiClient → Auth service (/api/oauth/*)
 * - GameAPI's axios → Game backend (/api/v1/*)
 */
export class GameAPI {
  constructor(private client: AxiosInstance) {}
  
  // 业务方法
  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    const response = await this.client.get<RoomInfo>(`/rooms/${roomId}`);
    return response.data;
  }
  
  // ... 其他业务方法
}

/**
 * Hook: Get game API client
 * 
 * Creates a NEW axios instance specifically for game backend,
 * separate from OAuth SDK's client to avoid interfering with userinfo calls.
 */
export function useGameAPI() {
  const { apiClient, getAccessToken } = useOAuth();
  
  // Create dedicated axios instance for game backend
  const gameAxios = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1',
    timeout: 30000,
  });
  
  // Add auth header
  gameAxios.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  
  // Handle 401 refresh
  gameAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        await apiClient.refreshAccessToken();
        const newToken = await getAccessToken();
        if (newToken) error.config.headers.Authorization = `Bearer ${newToken}`;
        return gameAxios(error.config);
      }
      return Promise.reject(error);
    }
  );
  
  return new GameAPI(gameAxios);
}
```

### 使用方式

**之前（复杂）：**

```tsx
// 需要手动设置 auth providers
const api = getApiClient();
api.setAuthProviders({
  getAccessToken,
  getClientId,
  refreshAccessToken: () => apiClient.refreshAccessToken(),
  onUnauthorized: () => { /* ... */ }
});
```

**现在（简单）：**

```tsx
// 直接使用，OAuth SDK 自动处理一切
const api = useGameAPI();
const roomInfo = await api.getRoomInfo(roomId);
```

## 📝 已完成的修改

### 1. 简化 `api-client.ts`

- ✅ 移除 `ApiClient` 类的所有拦截器逻辑
- ✅ 移除 `setAuthProviders()` 机制
- ✅ 移除 `X-Request-Id` 生成
- ✅ 创建轻量级 `GameAPI` 类（只封装业务方法）
- ✅ 提供 `useGameAPI()` hook

### 2. 更新所有使用方

- ✅ `hooks/useRoom.ts` - 改用 `useGameAPI()`
- ✅ `hooks/useAction.ts` - 改用 `useGameAPI()`
- ✅ `pages/room/room.tsx` - 移除 `setAuthProviders` 调用
- ✅ `pages/my-nexus/my-nexus.tsx` - 移除 `setAuthProviders` 调用
- ✅ `pages/index/Index.tsx` - 移除未使用的 `apiClient` 引用

## 🎉 收益

1. **代码更简洁**
   - 从 ~240 行复杂的 `ApiClient` 类 → ~120 行简单的 `GameAPI` 封装
   - 移除了重复的拦截器逻辑

2. **更符合最佳实践**
   - 直接使用 AutoLab SDK 的能力
   - 符合 `frontend_best_practices.md` 的指导

3. **更易维护**
   - 减少自定义逻辑
   - OAuth SDK 升级时自动受益

4. **类型安全不变**
   - 仍然提供强类型的业务 API 方法
   - `api.getRoomInfo(roomId)` vs `axios.get('/rooms/' + roomId)`

## ⚠️ 注意事项

### 关键设计决策：独立的 Axios 实例

**问题**：最初的实现尝试重用 OAuth SDK 的 `apiClient`，并修改其 `baseURL` 指向游戏后端。

**后果**：这导致 OAuth SDK 调用 `/api/oauth/userinfo` 时使用了错误的 URL（`http://124.221.145.212:51001/api/v1/oauth/userinfo` 而不是 `https://114.132.91.247/api/oauth/userinfo`）。

**解决方案**：创建一个**独立的 axios 实例**专门用于游戏后端 API：

```typescript
// ✅ 正确：两个独立的客户端
OAuth SDK's apiClient → https://114.132.91.247/api/oauth/*  (认证服务)
GameAPI's axios       → /api/v1/*                           (游戏后端)
```

```typescript
// ❌ 错误：修改 SDK 的 client
const axiosInstance = apiClient.getClient();
axiosInstance.defaults.baseURL = '/api/v1';  // 破坏了 SDK 的 userinfo 调用！

// ✅ 正确：创建新实例
const gameAxios = axios.create({
  baseURL: '/api/v1'
});
```

### 向后兼容

`getApiClient()` 函数现在会抛出错误，提示迁移到 `useGameAPI()`：

```typescript
export function getApiClient(): GameAPI {
  throw new Error(
    'getApiClient() is deprecated. Use useGameAPI() hook instead:\n' +
    'const api = useGameAPI();'
  );
}
```

### 迁移检查清单

如果有其他地方使用 `getApiClient()`，需要修改为：

```tsx
// ❌ 旧代码
const api = getApiClient();

// ✅ 新代码（在 React 组件/Hook 中）
const api = useGameAPI();
```

## 📚 参考

- `frontend_best_practices.md` - AutoLab SDK 集成最佳实践
- `reference/oauth-sdk/README.md` - OAuth SDK 文档
- `backend/src/plugins/auth.ts` - 后端鉴权配置

