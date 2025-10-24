import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOAuth } from '@autolabz/oauth-sdk';
import GameBoard from '../components/GameBoard';
import RoomSetup from '../components/RoomSetup';

function GamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useOAuth();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId || null);

  const handleRoomCreated = (newRoomId: string) => {
    setCurrentRoomId(newRoomId);
    navigate(`/room/${newRoomId}`);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '2rem',
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>井字棋</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>欢迎，{user?.nickname || user?.email}</span>
          <a href="/" style={{ textDecoration: 'none', color: '#666' }}>返回门户</a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        {currentRoomId ? (
          <GameBoard roomId={currentRoomId} onLeave={handleLeaveRoom} />
        ) : (
          <RoomSetup onRoomCreated={handleRoomCreated} />
        )}
      </main>
    </div>
  );
}

export default GamePage;


