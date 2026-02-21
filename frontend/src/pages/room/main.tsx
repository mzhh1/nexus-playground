import React from 'react';
import ReactDOM from 'react-dom/client';
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';
import '../../styles/global.css';
import Room from './Room.tsx';

function RoomGate() {
  return <Room />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OAuthProvider authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL} clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
      <RoomGate />
    </OAuthProvider>
  </React.StrictMode>
);

