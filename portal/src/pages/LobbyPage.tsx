import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APIClient } from '@nexus/web-client';
import { useOAuth } from '@autolabz/oauth-sdk';

interface Room {
  id: string;
  gameId: string;
  hostId: string;
  players: Array<{ uid: string; nickname: string }>;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string;
}

function LobbyPage() {
  const { isAuthenticated } = useOAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = new APIClient(import.meta.env.VITE_API_BASE_URL || '/api');

  useEffect(() => {
    if (!isAuthenticated) return;

    loadRooms();
    
    // 每5秒刷新一次房间列表
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadRooms = async () => {
    try {
      const response = await apiClient.get('/rooms', { notFull: 'true' });
      setRooms(response.rooms || []);
      setError(null);
    } catch (err) {
      setError('加载房间列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>请先登录以访问游戏大厅</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <h2 style={{ margin: 0 }}>游戏大厅</h2>
          <Link
            to="/games/tic-tac-toe"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: '#4CAF50',
              textDecoration: 'none',
              borderRadius: '8px',
            }}
          >
            创建房间
          </Link>
        </div>

        {loading ? (
          <div style={{
            backgroundColor: 'white',
            padding: '3rem',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p>加载中...</p>
          </div>
        ) : error ? (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '1rem',
            borderRadius: '8px',
          }}>
            {error}
          </div>
        ) : rooms.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '3rem',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', marginBottom: '1rem' }}>暂无可用房间</p>
            <Link
              to="/games/tic-tac-toe"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                color: '#4CAF50',
                textDecoration: 'none',
              }}
            >
              创建第一个房间 →
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem',
          }}>
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RoomCardProps {
  room: Room;
}

function RoomCard({ room }: RoomCardProps) {
  const gameNames: Record<string, string> = {
    'tic-tac-toe': '井字棋',
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>
          {gameNames[room.gameId] || room.gameId}
        </h3>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          <span>👥 {room.players.length}/{room.maxPlayers}</span>
          <span style={{ margin: '0 1rem' }}>•</span>
          <span>房主: {room.players[0]?.nickname || 'Unknown'}</span>
          <span style={{ margin: '0 1rem' }}>•</span>
          <span>
            {room.status === 'waiting' && '等待中'}
            {room.status === 'playing' && '游戏中'}
            {room.status === 'finished' && '已结束'}
          </span>
        </div>
      </div>
      
      <Link
        to={`/games/${room.gameId}/room/${room.id}`}
        style={{
          padding: '0.5rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: room.status === 'waiting' ? '#4CAF50' : '#999',
          textDecoration: 'none',
          borderRadius: '4px',
          cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed',
        }}
      >
        {room.status === 'waiting' ? '加入' : '观战'}
      </Link>
    </div>
  );
}

export default LobbyPage;


