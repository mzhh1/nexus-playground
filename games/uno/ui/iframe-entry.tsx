import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import UnoUI from './ui';

interface FrameState {
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
  const [gameState, setGameState] = useState<FrameState | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SYNC_STATE' && event.data.payload) {
        setGameState(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAction = (action: { action_id: string; role_id: string; params?: any }) => {
    window.parent.postMessage(
      {
        type: 'ACT',
        payload: action,
      },
      '*'
    );
  };

  if (!gameState) {
    return <div style={{ padding: '1rem', color: '#9ca3af' }}>等待游戏数据...</div>;
  }

  return (
    <UnoUI
      perspective={gameState.perspective}
      onAction={handleAction}
      isMyTurn={gameState.isMyTurn}
      readonly={gameState.readonly}
      metadata={gameState.metadata}
    />
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<IframeApp />);
