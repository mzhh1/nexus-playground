/**
 * OAuth Callback Page (Placeholder for M0)
 */

import React, { useEffect, useRef } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import '../../styles/global.css';

export const Callback: React.FC = () => {
  const { handleRedirect } = useOAuth();
  // 使用 ref 防止 React StrictMode 导致的双重调用
  const hasProcessedRef = useRef(false);
  
  useEffect(() => {
    // 防止重复执行
    if (hasProcessedRef.current) {
      console.log('[Callback] ⏭️ 跳过重复执行');
      return;
    }
    hasProcessedRef.current = true;
    
    console.log('[Callback] 🔵 开始处理 OAuth 回调');
    console.log('[Callback] 当前 URL:', window.location.href);
    console.log('[Callback] 环境变量:', {
      authServiceUrl: import.meta.env.VITE_AUTH_API_BASE_URL,
      clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
    });
    
    // Debug: 检查 localStorage
    console.log('[Callback] 🔍 localStorage 内容:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`  ${key}:`, value?.substring(0, 100) + (value && value.length > 100 ? '...' : ''));
      }
    }
    
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.get('code');
    const hasState = url.searchParams.get('state');

    console.log('[Callback] code 参数:', hasCode ? '存在' : '缺失', hasCode?.substring(0, 20) + '...');
    console.log('[Callback] state 参数:', hasState ? '存在' : '缺失');
    
    // 尝试解码 state 看看内容（注意：URLSearchParams.get() 已经自动做了一次 URL 解码）
    if (hasState) {
      try {
        console.log('[Callback] 原始 state (已 URL 解码):', hasState);
        
        // 我们的 makeState() 使用了 btoa(encodeURIComponent(json))
        // 所以需要：Base64 解码 -> URL 解码 -> JSON 解析
        const base64Decoded = atob(hasState);
        console.log('[Callback] Base64 解码后:', base64Decoded);
        
        const urlDecoded = decodeURIComponent(base64Decoded);
        console.log('[Callback] URL 解码后:', urlDecoded);
        
        const stateObj = JSON.parse(urlDecoded);
        console.log('[Callback] state 对象:', stateObj);
      } catch (e) {
        console.error('[Callback] 解码 state 失败:', e);
      }
      
      // 检查 sessionStorage 中是否有对应的 PKCE verifier（只读取不删除！）
      const verifierKey = `autolab_pkce_verifier_${hasState}`;
      const verifier = sessionStorage.getItem(verifierKey);
      console.log(`[Callback] 检查 PKCE verifier (${verifierKey}):`, verifier ? '存在' : '❌ 缺失');
      if (verifier) {
        console.log('[Callback] PKCE verifier 内容:', verifier.substring(0, 20) + '...');
      }
      
      // 列出所有 sessionStorage 中的 PKCE verifier keys
      const allVerifierKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('autolab_pkce_verifier_')) {
          allVerifierKeys.push(key);
        }
      }
      console.log('[Callback] sessionStorage 中所有的 PKCE verifier keys:', allVerifierKeys);
    }

    if (!hasCode || !hasState) {
      // 缺少必要参数，回落首页
      console.error('[Callback] ❌ OAuth 回调缺少参数: code/state 丢失');
      window.location.replace('/');
      return;
    }

    console.log('[Callback] 🚀 开始调用 handleRedirect...');
    handleRedirect({ fetchUserinfo: true, redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI })
      .then((res: any) => {
        console.log('[Callback] ✅ handleRedirect 成功:', res);
        try {
          const state = res?.state ? JSON.parse(decodeURIComponent(atob(res.state))) : null;
          console.log('[Callback] 解析后的 state:', state);
          const target = state?.returnTo || '/';
          console.log('[Callback] 🎯 准备跳转到:', target);
          window.location.replace(target);
        } catch (e) {
          console.error('[Callback] ❌ 解析 state 失败，回落首页:', e);
          window.location.replace('/');
        }
      })
      .catch((e: any) => {
        console.error('[Callback] ❌ handleRedirect 失败，回落首页:', e);
        window.location.replace('/');
      });
  }, [handleRedirect]);

  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Processing callback...</p>
    </div>
  );
};

export default Callback;

