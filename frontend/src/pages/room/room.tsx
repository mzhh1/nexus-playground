import React from 'react';
import ReactDOM from 'react-dom/client';
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';
import Room from './Room';

function RoomGate() {
  const { isAuthenticated } = useOAuth();

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>Nexus Playground</h1>
          <AuthAvatar
            redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
            scope={import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi'}
            profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
          />
        </div>
        <div className="card">
          <h2>需要登录</h2>
          <p>请点击右上角头像按钮登录。</p>
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

