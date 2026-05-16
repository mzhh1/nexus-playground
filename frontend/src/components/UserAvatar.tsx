import { useEffect, useState } from 'react';
import type { IdTokenClaims } from '@logto/react';

interface UserAvatarProps {
  user: IdTokenClaims | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthenticated: boolean;
}

export function UserAvatar({ user, onSignIn, onSignOut, isAuthenticated }: UserAvatarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsDropdownOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDropdownOpen]);

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="icon-button"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        登录
      </button>
    );
  }

  const displayName =
    (typeof user?.name === 'string' ? user.name : '') ||
    (typeof user?.nickname === 'string' ? user.nickname : '') ||
    (typeof user?.username === 'string' ? user.username : '') ||
    (typeof user?.email === 'string' ? user.email : '') ||
    '用户';

  const avatarUrl = typeof user?.picture === 'string' && !imageError ? user.picture : null;

  const getAvatarBgColor = (sub?: unknown) => {
    if (!sub || typeof sub !== 'string') return '#3b82f6';
    const colors = [
      '#ef4444', '#3b82f6', '#22c55e', '#eab308',
      '#a855f7', '#ec4899', '#6366f1', '#14b8a6',
    ];
    const hash = sub.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="用户菜单"
        aria-expanded={isDropdownOpen}
        aria-haspopup="menu"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '4px', borderRadius: '8px', border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #e5e7eb', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '2px solid #e5e7eb',
              backgroundColor: getAvatarBgColor(user?.sub),
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            {getInitials(displayName)}
          </div>
        )}
        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{displayName}</span>
        <svg
          width="14" height="14" fill="none" stroke="#6b7280" viewBox="0 0 24 24"
          style={{ transform: isDropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isDropdownOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setIsDropdownOpen(false)}
          />
          <div
            role="menu"
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '8px',
              width: '240px', backgroundColor: '#fff', borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 20,
              border: '1px solid #e5e7eb', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #e5e7eb', objectFit: 'cover' }}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div
                    style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      border: '2px solid #e5e7eb',
                      backgroundColor: getAvatarBgColor(user?.sub),
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: 600,
                    }}
                  >
                    {getInitials(displayName)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  {user?.email && typeof user.email === 'string' && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onSignOut();
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', fontSize: '0.875rem', color: '#ef4444',
                  background: 'none', border: 'none', borderRadius: '8px',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                登出
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
