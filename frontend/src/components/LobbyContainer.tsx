/**
 * Lobby Container
 * 房间开放阶段的内容容器
 * 为房主和访客提供统一的布局容器
 */

import React from 'react';
import '../styles/lobby-container.css';

interface LobbyContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const LobbyContainer: React.FC<LobbyContainerProps> = ({ children, style }) => {
  return (
    <div className="lobby-container" style={style}>
      {children}
    </div>
  );
};

