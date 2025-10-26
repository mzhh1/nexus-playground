/**
 * Room Page
 * View and join other users' rooms
 */

import React, { useState, useEffect } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { usePerspective } from '../../hooks/usePerspective';
import { useAction } from '../../hooks/useAction';
import { NexusControlBar } from '../../components/NexusControlBar';
import { GameUIContainer } from '../../components/GameUIContainer';
import '../../styles/global.css';

export const Room: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { room, loading, error, fetchRoom, joinRoom } = useRoom(roomId || undefined);
  const { perspective } = usePerspective(roomId, currentRoleId, playerId || undefined);
  const { submitAction, submitting } = useAction(roomId);

  // Extract room ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id) {
      setRoomId(id);
    } else {
      alert('No room ID specified');
    }
  }, []);

  // Fetch room info when roomId is set
  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  // Determine current role
  useEffect(() => {
    if (!room) return;

    // Check if we're already in the room
    const myPlayerId = Object.entries(room.player_list).find(
      ([_, player]) => player.type === 'human' // M0: Simple check
    )?.[0];

    if (myPlayerId) {
      setPlayerId(myPlayerId);

      // Find role assigned to this player
      const roleId = Object.entries(room.role_mapping).find(
        ([_, pid]) => pid === myPlayerId
      )?.[0];

      if (roleId) {
        setCurrentRoleId(roleId);
      }
    }
  }, [room]);

  const handleJoin = async () => {
    const displayName = prompt('Enter your display name:');
    if (!displayName) return;

    try {
      const result = await joinRoom(displayName);
      setPlayerId(result.player_id);
      alert('Joined successfully!');
    } catch (err) {
      alert('Failed to join room');
    }
  };

  if (!roomId) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>Invalid Room</h2>
          <p>No room ID specified in URL</p>
        </div>
      </div>
    );
  }

  if (loading && !room) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchRoom}>Retry</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div>No room data</div>;
  }

  const isInRoom = playerId !== null;
  const isPlaying = room.room_status === 'playing';
  const canJoin = room.room_status === 'open' && !isInRoom;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Control Bar */}
      {isPlaying && (
        <NexusControlBar
          room={room}
          isOwner={false}
          statusText={perspective?.your_role?.is_current ? 'Your Turn' : 'Opponent Turn'}
          onExit={() => (window.location.href = '/')}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        <div className="container">
          <h1>Room: {roomId}</h1>
          
          {error && <div className="error-message">{error}</div>}

          {/* Join button */}
          {canJoin && (
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2>Join this room?</h2>
              <p>Owner: {room.owner_uid}</p>
              <p>Game: {room.game_id || 'Not selected'}</p>
              <p>Players: {Object.keys(room.player_list).length}</p>
              <button onClick={handleJoin}>Join Room</button>
            </div>
          )}

          {/* Waiting message */}
          {isInRoom && !isPlaying && (
            <div className="card">
              <h2>Waiting for game to start...</h2>
              <p>You've joined the room. The owner will start the game soon.</p>
            </div>
          )}

          {/* Game UI */}
          {isPlaying && room.game_id && perspective && currentRoleId && (
            <div className="card">
              <GameUIContainer
                gameId={room.game_id}
                perspective={perspective}
                onAction={submitAction}
                isMyTurn={perspective.your_role.is_current}
                readonly={room.room_status !== 'playing' || submitting}
                metadata={{
                  roomId: room.room_id,
                  roleId: currentRoleId,
                  playerId: playerId || undefined,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;

