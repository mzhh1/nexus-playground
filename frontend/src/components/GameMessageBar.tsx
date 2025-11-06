/**
 * Game Message Bar
 * 统一的游戏状态消息栏组件
 * 用于显示游戏当前状态、提示信息等
 */

import React from 'react';
import type { RolePerspective } from '../lib/types';
import '../styles/game-message-bar.css';

interface GameMessageBarProps {
  perspective: RolePerspective;
}

/**
 * 根据消息内容推断消息类型，用于应用不同的样式
 */
function inferMessageType(message: string): 'success' | 'waiting' | 'info' | 'error' {
  const lowerMessage = message.toLowerCase();
  
  // 成功/获胜消息
  if (
    lowerMessage.includes('获胜') || 
    lowerMessage.includes('胜利') || 
    lowerMessage.includes('win') ||
    lowerMessage.includes('🎉') ||
    lowerMessage.includes('👑')
  ) {
    return 'success';
  }
  
  // 等待消息
  if (
    lowerMessage.includes('等待') || 
    lowerMessage.includes('wait') ||
    lowerMessage.includes('⏳') ||
    lowerMessage.includes('👀')
  ) {
    return 'waiting';
  }
  
  // 错误/警告消息
  if (
    lowerMessage.includes('错误') || 
    lowerMessage.includes('失败') ||
    lowerMessage.includes('无效') ||
    lowerMessage.includes('error') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('❌') ||
    lowerMessage.includes('⚠️')
  ) {
    return 'error';
  }
  
  // 默认为信息类消息
  return 'info';
}

export const GameMessageBar: React.FC<GameMessageBarProps> = ({ perspective }) => {
  // 获取消息内容，如果没有则使用默认消息
  const message = perspective.message || '准备开始游戏...';
  
  // 推断消息类型
  const messageType = inferMessageType(message);
  
  // 获取当前角色信息
  const roleIdentity = perspective.your_role?.identity || '';
  
  return (
    <div className={`game-message-bar ${messageType}`}>
      {roleIdentity && (
        <span className="role-indicator">{roleIdentity}</span>
      )}
      <span className="message-content">{message}</span>
    </div>
  );
};




