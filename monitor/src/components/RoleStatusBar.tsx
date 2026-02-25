import React from 'react';

/**
 * Role Status Bar for Monitor
 * Based on frontend/src/components/NexusStatusBar.tsx
 */

interface RoleStatusBarProps {
    message?: string;
    identity?: string;
    error?: string | null;
}

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

export const RoleStatusBar: React.FC<RoleStatusBarProps> = ({
    message,
    identity,
    error
}) => {
    const displayMessage = error ? `Error: ${error}` : (message || '等待数据...');
    const isError = !!error || inferMessageType(displayMessage) === 'error';
    const messageType = inferMessageType(displayMessage);

    return (
        <div className={`nexus-status-bar ${isError ? 'error-state' : ''}`}>
            {identity && (
                <span className="status-indicator-left">
                    {identity}
                </span>
            )}
            <span className="status-message-content">
                {displayMessage}
            </span>
        </div>
    );
};
