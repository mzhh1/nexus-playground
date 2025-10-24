import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { OAuthProvider } from '@autolabz/oauth-sdk';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// --- OAuth runtime debug & safe defaults ---
const rawAuthServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL;
const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID
  || new URLSearchParams(window.location.search).get('client_id')
  || sessionStorage.getItem('autolab_client_id')
  || undefined;

const authServiceUrl = (() => {
  try {
    if (!rawAuthServiceUrl) return '/api';
    if (/^https?:\/\//i.test(rawAuthServiceUrl)) return rawAuthServiceUrl.replace(/\/$/, '');
    const path = rawAuthServiceUrl.startsWith('/') ? rawAuthServiceUrl : `/${rawAuthServiceUrl}`;
    return path;
  } catch (e) {
    console.warn('[portal] 归一化 VITE_AUTH_API_BASE_URL 失败:', e);
    return rawAuthServiceUrl;
  }
})();

const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/callback`;

// Expose for container debugging (read-only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__OAUTH_PORTAL_DEBUG__ = {
  rawAuthServiceUrl,
  authServiceUrl,
  clientId,
  redirectUri,
  location: window.location.href,
};

console.info('[portal] OAuth env', { rawAuthServiceUrl, authServiceUrl, clientId, redirectUri });
if (!clientId) console.error('[portal] VITE_OAUTH_CLIENT_ID 缺失：OAuth 登录将失败。');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <OAuthProvider
        authServiceUrl={authServiceUrl}
        clientId={clientId}
      >
        <App />
      </OAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);


