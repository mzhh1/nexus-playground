import type { LogtoConfig } from '@logto/react';
import { env } from '@/env';

export const LOGTO_ENDPOINT = env.logtoEndpoint;
export const LOGTO_APP_ID = env.logtoAppId;
export const LOGTO_REDIRECT_URI = env.logtoRedirectUri;
export const LOGTO_POST_LOGOUT_REDIRECT_URI = env.logtoPostLogoutRedirectUri;
export const BACKEND_RESOURCE = env.backendResource;

export const logtoConfig: LogtoConfig = {
  endpoint: LOGTO_ENDPOINT,
  appId: LOGTO_APP_ID,
  resources: [BACKEND_RESOURCE].filter(Boolean),
  scopes: ['openid', 'profile', 'offline_access', 'access:playground'],
};
