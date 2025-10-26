import React from 'react';
import ReactDOM from 'react-dom/client';
import { OAuthProvider } from '@autolabz/oauth-sdk';
import Callback from './Callback';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <Callback />
    </OAuthProvider>
  </React.StrictMode>
);

