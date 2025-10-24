/**
 * useAuth - 认证状态Hook
 * 
 * 封装 @autolabz/oauth-sdk 的 useOAuth Hook
 */

import { useOAuth } from '@autolabz/oauth-sdk';

export function useAuth() {
  return useOAuth();
}

