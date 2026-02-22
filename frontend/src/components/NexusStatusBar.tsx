/**
 * Nexus Status Bar
 * 统一的状态栏组件，合并了 LobbyStatusBar 和 GameMessageBar 的功能
 */

import React from 'react';
import type { RolePerspective } from '../lib/types';
import '../styles/nexus-status-bar.css';

interface NexusStatusBarProps {
    // 核心状态
    isOwner?: boolean;
    phase?: 'lobby' | 'playing' | 'paused' | 'finished';
    perspective?: RolePerspective | null;

    // 引擎连接状态
    engineError?: string | null;
    isConnecting?: boolean;
    isRetrying?: boolean;
    onRetry?: () => void;

    // 大厅特定
    lobbyStatusText?: string;
    isMappingComplete?: boolean;
}

/**
 * 根据消息内容推断消息类型（继承自原 GameMessageBar）
 */
function inferMessageType(message: string): 'success' | 'waiting' | 'info' | 'error' {
    const lowerMessage = message.toLowerCase();
    if (
        lowerMessage.includes('获胜') || lowerMessage.includes('胜利') ||
        lowerMessage.includes('win') || lowerMessage.includes('🎉') || lowerMessage.includes('👑')
    ) return 'success';

    if (
        lowerMessage.includes('等待') || lowerMessage.includes('wait') ||
        lowerMessage.includes('⏳') || lowerMessage.includes('👀')
    ) return 'waiting';

    if (
        lowerMessage.includes('错误') || lowerMessage.includes('失败') ||
        lowerMessage.includes('无效') || lowerMessage.includes('error') ||
        lowerMessage.includes('invalid') || lowerMessage.includes('❌') || lowerMessage.includes('⚠️') ||
        lowerMessage.includes('断开') || lowerMessage.includes('failed')
    ) return 'error';

    return 'info';
}

export const NexusStatusBar: React.FC<NexusStatusBarProps> = ({
    isOwner,
    phase,
    perspective,
    engineError,
    isConnecting,
    isRetrying,
    onRetry,
    lobbyStatusText = '等待开始',
    isMappingComplete = true
}) => {
    // 1. 优先级最高：引擎错误或连接中状态
    let displayMessage = '';
    let isError = false;

    if (engineError) {
        displayMessage = `连接错误: ${engineError}`;
        isError = true;
    } else if (isConnecting || isRetrying) {
        displayMessage = isRetrying ? '连接意外断开，正在尝试重连...' : '正在连接至引擎...';
    } else if (phase === 'lobby') {
        // 2. 大厅阶段逻辑
        const showWarning = isOwner && !isMappingComplete;
        displayMessage = showWarning ? '⚠️ 还有角色未分配，请完成角色分配' : lobbyStatusText;
        if (showWarning) isError = true;
    } else if (perspective) {
        // 3. 游戏阶段逻辑
        displayMessage = perspective.message || '准备开始游戏...';
    }

    // 推断类型用于样式（主要针对游戏消息）
    const messageType = inferMessageType(displayMessage);

    const statusIndicator = phase === 'lobby'
        ? (isOwner ? '🏠 房主' : '👤 访客')
        : (perspective?.your_role?.identity || '');

    return (
        <div className={`nexus-status-bar ${isError || messageType === 'error' ? 'error-state' : ''}`}>
            {/* 左侧：身份指示器 */}
            {statusIndicator && (
                <span className="status-indicator-left">
                    {statusIndicator}
                </span>
            )}

            {/* 中间：主消息内容 */}
            <span className="status-message-content">
                {displayMessage}
            </span>

            {/* 右侧：动作按钮 (仅在有持久错误且提供重试方法时显示) */}
            {engineError && onRetry && (
                <div className="status-actions-right">
                    <button className="retry-button" onClick={onRetry}>
                        手动重试
                    </button>
                </div>
            )}
        </div>
    );
};
