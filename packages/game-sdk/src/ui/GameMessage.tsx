/**
 * @nexus/game-sdk - GameMessage Component
 * A message component for game notifications
 */

import React from 'react';

export type MessageType = 'info' | 'success' | 'warning' | 'error';

export interface GameMessageProps {
    /** Message content */
    message: string;
    /** Message type for styling */
    type?: MessageType;
    /** Additional CSS class */
    className?: string;
}

/**
 * Game message component for displaying notifications
 */
export const GameMessage: React.FC<GameMessageProps> = ({
    message,
    type = 'info',
    className = '',
}) => {
    return (
        <div
            data-nexus-sdk
            className={`nexus-sdk-game-message nexus-sdk-game-message--${type} ${className}`}
            role="alert"
        >
            {message}
        </div>
    );
};
