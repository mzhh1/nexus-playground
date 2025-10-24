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

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/games/tic-tac-toe">
      <OAuthProvider
        authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL || '/api'}
        clientId={import.meta.env.VITE_OAUTH_CLIENT_ID || ''}
      >
        <App />
      </OAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

