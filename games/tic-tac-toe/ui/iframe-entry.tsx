import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TicTacToeUI from './ui';

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
    const params = new URLSearchParams(window.location.search);
    const stateUrl = params.get('stateUrl');
    const token = params.get('token');

    // 直连调试模式
    if (stateUrl && token) {
      const headers = { Authorization: `Bearer ${token}` };
      fetch(stateUrl, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setGameState({
              perspective: data.data,
              isMyTurn: data.data.your_role.is_current,
              readonly: false,
              metadata: { roleId: new URL(stateUrl).searchParams.get('roleId') as string, roomId: 'dev-room' }
            });
          }
        })
        .catch(err => console.error("Failed to fetch state:", err));
      return;
    }

    // 默认的 iframe 通信模式
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

  const handleAction = async (action: { action_id: string; role_id: string; params?: any }) => {
    const params = new URLSearchParams(window.location.search);
    const actionUrl = params.get('actionUrl');
    const token = params.get('token');

    // 直连调试模式
    if (actionUrl && token) {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      try {
        const res = await fetch(actionUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ roleId: action.role_id, action })
        });
        const data = await res.json();
        if (data.success) {
          console.log("Action succeeded. Please refresh the page manually to see the new state.");
          alert("行动成功！请手动刷新页面查看最新状态。");
        } else {
          console.error("Action failed:", data);
          alert("行动失败: " + (data.error || JSON.stringify(data)));
        }
      } catch (err) {
        console.error("Failed to submit action:", err);
        alert("网络请求失败");
      }
      return;
    }

    // 默认的 iframe 通信模式
    window.parent.postMessage(
      {
        type: 'ACT',
        payload: action,
      },
      '*'
    );
  };

  if (!gameState) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#666',
        }}
      >
        等待游戏数据...
      </div>
    );
  }

  return (
    <TicTacToeUI
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
