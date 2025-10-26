import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { OAuthProvider, useOAuth } from '@autolabz/oauth-sdk';
import MyNexus from './MyNexus';

function makeState(payload: any) {
  try {
    const json = JSON.stringify({ ...payload, nonce: crypto.randomUUID?.() || String(Date.now()) });
    return btoa(encodeURIComponent(json));
  } catch {
    return '';
  }
}

function AutoLoginGate() {
  const { isInitialized, isAuthenticated, startLogin } = useOAuth();
  const [hasAttemptedLogin, setHasAttemptedLogin] = React.useState(false);

  useEffect(() => {
    console.log('[AutoLoginGate] 🔵 useEffect 触发');
    console.log('[AutoLoginGate] isInitialized:', isInitialized);
    console.log('[AutoLoginGate] isAuthenticated:', isAuthenticated);
    console.log('[AutoLoginGate] hasAttemptedLogin:', hasAttemptedLogin);
    console.log('[AutoLoginGate] 当前 URL:', window.location.href);
    console.log('[AutoLoginGate] 环境变量:', {
      authServiceUrl: import.meta.env.VITE_AUTH_API_BASE_URL,
      clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
    });
    
    // Debug: 检查 localStorage
    console.log('[AutoLoginGate] 🔍 localStorage 内容:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`  ${key}:`, value?.substring(0, 100) + (value && value.length > 100 ? '...' : ''));
      }
    }

    if (!isInitialized) {
      console.log('[AutoLoginGate] ⏳ SDK 尚未初始化，等待...');
      return;
    }
    
    // 避免在包含 code/state 的页面触发二次登录（正在处理回调）
    const url = new URL(window.location.href);
    const hasAuthParams = url.searchParams.has('code') || url.searchParams.has('state') || url.searchParams.has('error');
    
    console.log('[AutoLoginGate] hasAuthParams:', hasAuthParams);
    
    // 只在未认证、没有认证参数、且未尝试登录过的情况下触发登录
    // 这避免了从 callback 返回后立即重新触发登录的问题
    if (!isAuthenticated && !hasAuthParams && !hasAttemptedLogin) {
      console.log('[AutoLoginGate] 🚀 触发自动登录流程');
      
      // 清除所有旧的 OAuth 数据，确保 PKCE verifier 不会冲突
      console.log('[AutoLoginGate] 🧹 清除旧的 OAuth 数据...');
      
      // 清除 localStorage 中的 token
      const localKeysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('autolab_oauth_') || key.startsWith('autolab_pkce_'))) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach(key => {
        console.log(`[AutoLoginGate] 删除 localStorage: ${key}`);
        localStorage.removeItem(key);
      });
      
      // 清除 sessionStorage 中的 PKCE verifier（这才是关键！）
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('autolab_pkce_verifier_')) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => {
        console.log(`[AutoLoginGate] 删除 sessionStorage: ${key}`);
        sessionStorage.removeItem(key);
      });
      
      setHasAttemptedLogin(true);
      const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI;
      const state = makeState({ returnTo: window.location.href });
      console.log('[AutoLoginGate] redirectUri:', redirectUri);
      console.log('[AutoLoginGate] state payload:', { returnTo: window.location.href });
      startLogin({ redirectUri, state, scope: import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi' });
    } else {
      console.log('[AutoLoginGate] ℹ️ 不触发登录，原因:', {
        isAuthenticated,
        hasAuthParams,
        hasAttemptedLogin
      });
    }
  }, [isInitialized, isAuthenticated, startLogin, hasAttemptedLogin]);

  // 给 SDK 更多时间来初始化和读取 token
  // 如果已初始化但未认证，且已经尝试过登录，显示加载状态
  if (!isAuthenticated) {
    console.log('[AutoLoginGate] 🔄 未认证，显示加载中...');
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  console.log('[AutoLoginGate] ✅ 已认证，渲染 MyNexus 组件');
  return <MyNexus />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OAuthProvider authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL} clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <AutoLoginGate />
    </OAuthProvider>
  </React.StrictMode>
);

