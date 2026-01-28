/**
 * Lobby Status Bar
 * 房间开放阶段的状态栏组件
 * 显示用户身份（房主/访客）和等待状态
 */

import React from 'react';
import '../styles/lobby-status-bar.css';

interface LobbyStatusBarProps {
  isOwner: boolean;
  statusText?: string;
  isMappingComplete?: boolean;
}

export const LobbyStatusBar: React.FC<LobbyStatusBarProps> = ({ 
  isOwner,
  statusText = '等待开始',
  isMappingComplete = true
}) => {
  // 房主且角色未分配完成时显示警告
  const showWarning = isOwner && !isMappingComplete;
  
  return (
    <div className="lobby-status-bar">
      <span className="user-role-indicator">
        {isOwner ? '🏠 房主' : '👤 访客'}
      </span>
      <span className="status-content">
        {showWarning ? (
          <span style={{ color: 'var(--color-warning)' }}>
            ⚠️ 还有角色未分配，请完成角色分配
          </span>
        ) : (
          statusText
        )}
      </span>
    </div>
  );
};

