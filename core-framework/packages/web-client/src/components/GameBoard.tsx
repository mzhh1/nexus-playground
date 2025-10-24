/**
 * GameBoard - 游戏棋盘容器组件
 */

import React, { ReactNode } from 'react';

export interface GameBoardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 游戏棋盘容器（基础组件，游戏可以自定义样式）
 */
export function GameBoard({ children, className = '', style }: GameBoardProps) {
  return (
    <div
      className={`game-board ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

