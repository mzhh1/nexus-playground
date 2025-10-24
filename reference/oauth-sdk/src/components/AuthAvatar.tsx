import { useState, useRef, useEffect } from 'react';
import { useOAuth } from './OAuthProvider';
import './AuthAvatar.css';

interface AuthAvatarProps {
  // OAuth-only props
  redirectUri: string;
  scope?: string;
  usePkce?: boolean;
  additionalParams?: Record<string, string | number | boolean>;
  // Optional: profile center URL; defaults to current origin /auth/profile if omitted
  profileUrl?: string;
}

export function AuthAvatar({ redirectUri, scope, usePkce, additionalParams, profileUrl }: AuthAvatarProps) {
  const { isAuthenticated, user, logout, startLogin } = useOAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async () => {
    try {
      await startLogin({
        redirectUri,
        scope: scope || 'openid profile email',
        usePkce: typeof usePkce === 'boolean' ? usePkce : true,
        additionalParams,
      });
    } catch (e) {
      console.error('AuthAvatar OAuth login failed:', e);
    }
  };

  const resolvedProfileUrl = profileUrl || `${window.location.origin}/auth/profile`;

  const handleProfile = () => {
    window.location.href = resolvedProfileUrl;
  };

  const handleLogout = async () => {
    await logout();
    setShowMenu(false);
  };

  if (!isAuthenticated) {
    return (
      <button
        className="autolab-auth-login-btn"
        onClick={handleLogin}
        title="登录"
        aria-label="登录"
      >
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
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      </button>
    );
  }

  const avatarUrl = user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.nickname || 'User'}&background=1890ff&color=fff`;

  return (
    <div className="autolab-auth-avatar" ref={menuRef}>
      <img
        src={avatarUrl}
        alt="User Avatar"
        className="autolab-auth-avatar-img"
        onClick={() => setShowMenu(!showMenu)}
      />

      {showMenu && (
        <div className="autolab-auth-menu">
          <div className="autolab-auth-menu-item autolab-auth-user-info">
            <div className="autolab-auth-nickname">{user?.nickname || '未设置昵称'}</div>
            <div className="autolab-auth-email">{user?.email}</div>
          </div>
          <div className="autolab-auth-menu-divider" />
          <button className="autolab-auth-menu-item" onClick={handleProfile}>
            个人中心
          </button>
          <button className="autolab-auth-menu-item" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}


