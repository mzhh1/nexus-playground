/**
 * 浏览器端环境变量（Vite：`VITE_*` 会注入到 `import.meta.env`）
 */
export const env = {
  logtoEndpoint: import.meta.env.VITE_LOGTO_ENDPOINT ?? '',
  logtoAppId: import.meta.env.VITE_LOGTO_APP_ID ?? '',
  logtoRedirectUri: import.meta.env.VITE_LOGTO_REDIRECT_URI ?? '',
  logtoPostLogoutRedirectUri: import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI ?? '',
  backendBaseUrl: import.meta.env.VITE_BACKEND_BASE_URL ?? '',
  backendResource: import.meta.env.VITE_BACKEND_RESOURCE_INDICATOR ?? '',
} as const;
