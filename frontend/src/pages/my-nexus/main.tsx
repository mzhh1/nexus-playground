import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { useLogto } from '@logto/react';
import { LogtoAuthProvider } from '../../components/providers/LogtoAuthProvider';
import { LOGTO_REDIRECT_URI } from '../../lib/logto';
import MyNexus from './MyNexus';

function AutoLoginGate() {
  const { isAuthenticated, isLoading, signIn } = useLogto();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store returnTo URL before redirecting to Logto
      sessionStorage.setItem('nexus_return_to', window.location.href);
      void signIn(LOGTO_REDIRECT_URI);
    }
  }, [isLoading, isAuthenticated, signIn]);

  if (!isAuthenticated) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在跳转登录...</p>
      </div>
    );
  }

  return <MyNexus />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LogtoAuthProvider>
      <AutoLoginGate />
    </LogtoAuthProvider>
  </React.StrictMode>
);
