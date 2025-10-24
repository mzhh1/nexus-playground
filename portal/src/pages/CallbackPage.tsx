import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOAuth } from '@autolabz/oauth-sdk';

function CallbackPage() {
  const { handleRedirect } = useOAuth();
  const navigate = useNavigate();
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin + '/callback';

  useEffect(() => {
    console.debug('[portal][CallbackPage] redirectUri =', redirectUri, ' location =', window.location.href);
    handleRedirect({
      redirectUri,
      fetchUserinfo: true,
    })
      .then(() => {
        navigate('/');
      })
      .catch((err) => {
        console.error('登录失败:', err);
        navigate('/');
      });
  }, [handleRedirect, navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>正在登录...</h2>
        <p style={{ color: '#666' }}>请稍候</p>
      </div>
    </div>
  );
}

export default CallbackPage;


