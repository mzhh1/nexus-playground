import React from 'react';
import ReactDOM from 'react-dom/client';
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';
import Room from './Room';

function RoomGate() {
  const { isAuthenticated } = useOAuth();

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 'clamp(1rem, 5vw, 2rem)',
      }}>
        {/* 顶部导航栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'clamp(2rem, 8vh, 4rem)',
          padding: '0.5rem',
        }}>
          <h1 style={{
            color: 'white',
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            margin: 0,
            fontWeight: 600,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}>
            Nexus Playground
          </h1>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '50%',
            padding: '0.25rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <AuthAvatar
              redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
              scope={import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi'}
              profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
            />
          </div>
        </div>

        {/* 中心内容区 */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 'clamp(1rem, 3vw, 1.5rem)',
            padding: 'clamp(2rem, 5vw, 3rem)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
          }}>
            {/* 图标 */}
            <div style={{
              width: 'clamp(60px, 15vw, 80px)',
              height: 'clamp(60px, 15vw, 80px)',
              margin: '0 auto 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(102, 126, 234, 0.3)',
            }}>
              <svg
                width="50%"
                height="50%"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            {/* 标题 */}
            <h2 style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 600,
              color: '#2d3748',
              margin: '0 0 1rem 0',
            }}>
              需要登录
            </h2>

            {/* 描述文字 */}
            <p style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              color: '#718096',
              lineHeight: 1.6,
              margin: '0 0 2rem 0',
            }}>
              欢迎来到 Nexus Playground！<br />
              请点击右上角头像按钮进行登录，<br />
              开始您的游戏之旅。
            </p>

            {/* 装饰性提示 */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '2rem',
              fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
              color: '#667eea',
              fontWeight: 500,
            }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              多人在线游戏平台
            </div>
          </div>
        </div>

        {/* 底部装饰 */}
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
        }}>
          Powered by Nexus
        </div>
      </div>
    );
  }

  return <Room />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OAuthProvider authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL} clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <RoomGate />
    </OAuthProvider>
  </React.StrictMode>
);

