/**
 * My Nexus Page (Redirect-only)
 * Locates user's room ID and redirects to /room?id=...
 */

import React, { useEffect } from 'react';
import { useLogto } from '@logto/react';
import { useRoom } from '../../hooks/useRoom';
import { LOGTO_REDIRECT_URI, LOGTO_POST_LOGOUT_REDIRECT_URI } from '../../lib/logto';
import '../../styles/global.css';

export const MyNexus: React.FC = () => {
  const { signIn, signOut } = useLogto();
  const { room, loading, error, shouldReauth, fetchMyNexus } = useRoom();

  // Load my nexus on mount
  useEffect(() => {
    fetchMyNexus();
  }, [fetchMyNexus]);

  // Redirect to unified room page when room is ready
  useEffect(() => {
    if (room?.room_id) {
      const target = `/room?id=${encodeURIComponent(room.room_id)}`;
      window.location.replace(target);
    }
  }, [room?.room_id]);

  // 认证错误时清除登录态
  useEffect(() => {
    if (shouldReauth) {
      signOut(LOGTO_POST_LOGOUT_REDIRECT_URI);
    }
  }, [shouldReauth, signOut]);

  if (loading || room) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在定位您的星枢...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>错误</h2>
          <p>{error}</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={fetchMyNexus}>重试</button>
            <button onClick={() => {
              signOut(LOGTO_POST_LOGOUT_REDIRECT_URI);
              setTimeout(() => void signIn(LOGTO_REDIRECT_URI), 200);
            }}>
              重新登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>加载中...</p>
    </div>
  );
};

export default MyNexus;
