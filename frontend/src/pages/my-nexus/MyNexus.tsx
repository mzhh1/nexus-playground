/**
 * My Nexus Page (Redirect-only)
 * Locates user's room ID and redirects to /room?id=...
 */

import React, { useEffect } from 'react';
import { useRoom } from '../../hooks/useRoom';
import '../../styles/global.css';

export const MyNexus: React.FC = () => {
  const { room, loading, error, fetchMyNexus } = useRoom();

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
          <button onClick={fetchMyNexus}>重试</button>
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
