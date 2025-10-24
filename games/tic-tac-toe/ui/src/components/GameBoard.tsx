import { useEffect, useState } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import { WebSocketClient } from '@nexus/web-client';
import type { TicTacToeRolePerspective, CellValue } from '@nexus/tic-tac-toe-logic';

interface GameBoardProps {
  roomId: string;
  onLeave: () => void;
}

function GameBoard({ roomId, onLeave }: GameBoardProps) {
  const { user } = useOAuth();
  const [ws, setWs] = useState<WebSocketClient | null>(null);
  const [perspective, setPerspective] = useState<TicTacToeRolePerspective | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 初始化WebSocket连接
    const wsClient = new WebSocketClient(
      import.meta.env.VITE_WS_URL || 'ws://localhost:4000',
      localStorage.getItem('autolab_oauth_access_token') || ''
    );

    wsClient.on('connect', () => {
      console.log('[WS] Connected');
      // 加入房间
      wsClient.send('room:join', { roomId, roleId: 'player_X' });
    });

    wsClient.on('room:joined', (data: any) => {
      console.log('[WS] Joined room:', data);
    });

    wsClient.on('game:state-update', (data: { perspective: TicTacToeRolePerspective }) => {
      console.log('[WS] State update:', data);
      setPerspective(data.perspective);
    });

    wsClient.on('game:error', (data: { error: string }) => {
      setError(data.error);
    });

    wsClient.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    wsClient.connect();
    setWs(wsClient);

    return () => {
      wsClient.disconnect();
    };
  }, [roomId]);

  const handleCellClick = (row: number, col: number) => {
    if (!ws || !perspective) return;

    // 检查是否轮到自己
    if (perspective.current_state.current_role !== perspective.your_role.role_id) {
      setError('现在不是你的回合');
      return;
    }

    // 检查格子是否为空
    if (perspective.current_state.board[row][col] !== null) {
      setError('该位置已被占用');
      return;
    }

    // 发送行动
    ws.send('game:action', {
      roomId,
      action: {
        action_type: 'place_mark',
        parameters: { row, col },
        role_id: perspective.your_role.role_id,
        timestamp: Date.now(),
      },
    });

    setError(null);
  };

  const handleLeave = () => {
    if (ws) {
      ws.send('room:leave', { roomId });
    }
    onLeave();
  };

  if (!perspective) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        <p>正在连接游戏...</p>
      </div>
    );
  }

  const { current_state, your_role } = perspective;
  const isMyTurn = current_state.current_role === your_role.role_id;

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h2 style={{ margin: 0 }}>你是: {your_role.mark}</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
            {isMyTurn ? '轮到你了！' : '等待对手...'}
          </p>
        </div>
        <button
          onClick={handleLeave}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            color: '#666',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          离开游戏
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '4px',
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        maxWidth: '400px',
        margin: '0 auto',
      }}>
        {current_state.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              value={cell}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              disabled={!isMyTurn || cell !== null || current_state.status === 'finished'}
            />
          ))
        )}
      </div>

      {current_state.status === 'finished' && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          textAlign: 'center',
          backgroundColor: '#f0f8ff',
          borderRadius: '4px',
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>游戏结束！</h3>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>
            {current_state.winner === 'draw'
              ? '平局'
              : current_state.winner === your_role.role_id
              ? '你赢了！🎉'
              : '你输了'}
          </p>
        </div>
      )}

      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
        <h4>历史记录</h4>
        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {perspective.whole_history.map((action, index) => (
            <div key={index} style={{ padding: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
              {index + 1}. {action.role_id} 在 ({action.parameters.row}, {action.parameters.col}) 落子
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CellProps {
  value: CellValue;
  onClick: () => void;
  disabled: boolean;
}

function Cell({ value, onClick, disabled }: CellProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        aspectRatio: '1',
        fontSize: '3rem',
        fontWeight: 'bold',
        color: value === 'X' ? '#4CAF50' : value === 'O' ? '#2196F3' : '#999',
        backgroundColor: value ? '#f5f5f5' : 'white',
        border: '2px solid #ddd',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !value) {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }
      }}
      onMouseLeave={(e) => {
        if (!value) {
          e.currentTarget.style.backgroundColor = 'white';
        }
      }}
    >
      {value || ''}
    </button>
  );
}

export default GameBoard;


