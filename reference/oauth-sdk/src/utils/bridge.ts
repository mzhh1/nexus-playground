import { OAuthAPIClient } from './api';

export interface AuthBridge {
  getAccessToken(): string | null | Promise<string | null>;
  getClientId(): string | null | Promise<string | null>;
  refreshAccessToken(): Promise<string>;
  onUnauthorized?: () => void;
}

// 从 React 上下文创建桥接（解耦 data-sdk 与 React）
export function createAuthBridgeFromContext(ctx: {
  getAccessToken: () => string | null;
  getClientId: () => string | null;
  apiClient: OAuthAPIClient;
}): AuthBridge {
  return {
    getAccessToken: () => ctx.getAccessToken(),
    getClientId: () => ctx.getClientId(),
    refreshAccessToken: () => ctx.apiClient.refreshAccessToken(),
  };
}

// 从 OAuthAPIClient + 自定义存取器创建桥接（Node/非 React 场景）
export function createAuthBridgeFromClient(
  api: OAuthAPIClient,
  accessors: {
    getAccessToken: () => string | null | Promise<string | null>;
    getClientId: () => string | null | Promise<string | null>;
    onUnauthorized?: () => void;
  }
): AuthBridge {
  return {
    getAccessToken: accessors.getAccessToken,
    getClientId: accessors.getClientId,
    refreshAccessToken: () => api.refreshAccessToken(),
    onUnauthorized: accessors.onUnauthorized,
  };
}


