/**
 * Gomoku UI - iframe Entry Point
 * 
 * This file is the entry for the iframe-hosted game UI.
 * It handles:
 * 1. Listening for SYNC_STATE messages from the parent window
 * 2. Rendering the Gomoku React component
 * 3. Sending ACT messages back to the parent window
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GomokuUI from './ui';

interface GameState {
    perspective: any;
    isMyTurn: boolean;
    readonly: boolean;
    metadata?: {
        roomId: string;
        roleId: string;
        playerId?: string;
    };
}

const IframeApp: React.FC = () => {
    const [gameState, setGameState] = useState<GameState | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== 'object') return;

            if (event.data.type === 'SYNC_STATE' && event.data.payload) {
                setGameState(event.data.payload);
            }
        };

        window.addEventListener('message', handleMessage);

        // Notify parent that iframe is ready
        window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleAction = (action: { action_id: string; role_id: string; params?: any }) => {
        window.parent.postMessage({
            type: 'ACT',
            payload: action,
        }, '*');
    };

    if (!gameState) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
                color: '#666',
            }}>
                等待游戏数据...
            </div>
        );
    }

    return (
        <GomokuUI
            perspective={gameState.perspective}
            onAction={handleAction}
            isMyTurn={gameState.isMyTurn}
            readonly={gameState.readonly}
            metadata={gameState.metadata}
        />
    );
};

// Mount the app
const root = createRoot(document.getElementById('root')!);
root.render(<IframeApp />);
