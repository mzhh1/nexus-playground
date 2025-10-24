import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';

function Header() {
  const { isAuthenticated } = useOAuth();
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin + '/callback';

  useEffect(() => {
    console.debug('[portal][Header] redirectUri =', redirectUri);
  }, [redirectUri]);

  return (
    <header style={{
      backgroundColor: 'white',
      borderBottom: '1px solid #e0e0e0',
      padding: '1rem 2rem',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
              🎮 Nexus Playground
            </h1>
          </Link>
          
          {isAuthenticated && (
            <nav style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="/" style={{ textDecoration: 'none', color: '#666' }}>
                首页
              </Link>
              <Link to="/lobby" style={{ textDecoration: 'none', color: '#666' }}>
                游戏大厅
              </Link>
              <Link to="/games" style={{ textDecoration: 'none', color: '#666' }}>
                游戏列表
              </Link>
            </nav>
          )}
        </div>

        <AuthAvatar
          redirectUri={redirectUri}
          scope="openid profile email"
          profileUrl="/profile"
        />
      </div>
    </header>
  );
}

export default Header;


