import { LogtoProvider } from '@logto/react';
import { logtoConfig, LOGTO_ENDPOINT, LOGTO_APP_ID } from '@/lib/logto';

interface LogtoAuthProviderProps {
  children: React.ReactNode;
}

export function LogtoAuthProvider({ children }: LogtoAuthProviderProps) {
  if (!LOGTO_ENDPOINT || !LOGTO_APP_ID) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          padding: '24px', borderRadius: '12px', backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '420px',
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>缺少必要配置</h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            请在 <code>.env</code> 中填入 <code>VITE_LOGTO_ENDPOINT</code> 与 <code>VITE_LOGTO_APP_ID</code>。
          </p>
        </div>
      </div>
    );
  }

  return <LogtoProvider config={logtoConfig}>{children}</LogtoProvider>;
}
