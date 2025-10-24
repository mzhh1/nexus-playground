/**
 * AutoLab OAuth SDK - 与 auth-sdk 一致的导出形态
 */

export { OAuthProvider, useOAuth } from './components/OAuthProvider';
export { AuthAvatar } from './components/AuthAvatar';
export { OAuthLoginButton } from './components/OAuthLoginButton';
export { OAuthAPIClient } from './utils/api';
export { createAuthBridgeFromContext, createAuthBridgeFromClient } from './utils/bridge';
export { startAuthorization, handleRedirectCallback, getAuthorizeUrl } from './core/authorization';
export { buildAuthorizeUrl } from './utils/url';

export type { User, AuthState } from './components/OAuthProvider';
export type { ApiConfig } from './utils/api';
export type { AuthBridge } from './utils/bridge';
export type { BuildAuthorizeUrlParams } from './utils/url';


