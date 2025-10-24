import { AuthAvatar } from '@autolabz/oauth-sdk';

function LoginPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>井字棋 - Tic Tac Toe</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>请先登录以开始游戏</p>
      <AuthAvatar
        redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin + '/callback'}
        scope="openid profile email"
        profileUrl="/profile"
      />
    </div>
  );
}

export default LoginPage;

