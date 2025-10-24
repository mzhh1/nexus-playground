import { useState } from 'react';
import { APIClient } from '@nexus/web-client';

interface RoomSetupProps {
  onRoomCreated: (roomId: string) => void;
}

function RoomSetup({ onRoomCreated }: RoomSetupProps) {
  const [creating, setCreating] = useState(false);
  const [opponent, setOpponent] = useState<'human' | 'ai'>('human');
  const [error, setError] = useState<string | null>(null);

  const apiClient = new APIClient(import.meta.env.VITE_API_BASE_URL || '/api');

  const handleCreateRoom = async () => {
    setCreating(true);
    setError(null);

    try {
      const response = await apiClient.post('/rooms', {
        gameConfig: {
          id: 'tic-tac-toe',
          name: 'Tic Tac Toe',
          minPlayers: 2,
          maxPlayers: 2,
        },
        options: {
          isPrivate: false,
          maxPlayers: 2,
        },
      });

      if (response.id) {
        onRoomCreated(response.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建房间失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }}>
      <h2 style={{ marginTop: 0 }}>创建新游戏</h2>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          选择对手：
        </label>
        <select
          value={opponent}
          onChange={(e) => setOpponent(e.target.value as 'human' | 'ai')}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        >
          <option value="human">人类玩家</option>
          <option value="ai">AI玩家</option>
        </select>
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

      <button
        onClick={handleCreateRoom}
        disabled={creating}
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: creating ? '#ccc' : '#4CAF50',
          border: 'none',
          borderRadius: '4px',
          cursor: creating ? 'not-allowed' : 'pointer',
        }}
      >
        {creating ? '创建中...' : '创建房间'}
      </button>

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
        <h3>游戏规则</h3>
        <ul style={{ lineHeight: 1.6, color: '#666' }}>
          <li>两名玩家轮流在3x3的棋盘上落子</li>
          <li>一名玩家使用X标记，另一名使用O标记</li>
          <li>第一个在横、竖或对角线上连成三个标记的玩家获胜</li>
          <li>如果棋盘填满仍无人获胜，则为平局</li>
        </ul>
      </div>
    </div>
  );
}

export default RoomSetup;


