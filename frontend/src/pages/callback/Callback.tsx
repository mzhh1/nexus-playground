/**
 * OAuth Callback Page
 * Handles Logto sign-in callback with returnTo redirect support
 */

import React, { useEffect, useMemo } from 'react';
import { useLogto, useHandleSignInCallback } from '@logto/react';
import { LOGTO_REDIRECT_URI, LOGTO_POST_LOGOUT_REDIRECT_URI } from '../../lib/logto';
import '../../styles/global.css';

function CallbackHandler() {
  const { signIn, signOut } = useLogto();
  const { isLoading, error } = useHandleSignInCallback(() => {
    const returnTo = sessionStorage.getItem('nexus_return_to') || '/my-nexus.html';
    sessionStorage.removeItem('nexus_return_to');
    window.location.replace(returnTo);
  });

  // 回调出错时清除登录态，避免 broken session 残留
  useEffect(() => {
    if (error) {
      signOut(LOGTO_POST_LOGOUT_REDIRECT_URI);
    }
  }, [error, signOut]);

  const urlParams = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      code: sp.get('error') ?? '',
      description: sp.get('error_description') ?? '',
    };
  }, []);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在完成登录...</p>
      </div>
    );
  }

  if (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          padding: '24px', borderRadius: '12px', backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '420px',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>登录回调失败</h2>
          <p style={{ margin: '0 0 16px', color: '#666', fontSize: '0.9rem' }}>
            OAuth 回调处理失败。请检查 Logto 配置后重试。
          </p>
          {urlParams.code && (
            <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>
              OAuth error: <code>{urlParams.code}</code>
            </p>
          )}
          {urlParams.description && (
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {urlParams.description}
            </p>
          )}
          <details style={{ marginTop: '12px', fontSize: '0.8rem', color: '#6b7280' }}>
            <summary style={{ cursor: 'pointer' }}>调试信息</summary>
            <pre style={{ fontSize: '11px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {rawMessage}
            </pre>
          </details>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => window.location.replace('/')}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                background: '#fff', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              返回首页
            </button>
            <button
              onClick={() => {
                signOut(LOGTO_POST_LOGOUT_REDIRECT_URI);
                setTimeout(() => void signIn(LOGTO_REDIRECT_URI), 200);
              }}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none',
                background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              重新登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const Callback: React.FC = () => {
  return <CallbackHandler />;
};

export default Callback;
