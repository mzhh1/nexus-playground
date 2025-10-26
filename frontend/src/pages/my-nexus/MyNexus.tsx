/**
 * My Nexus Page
 * Main page for managing user's own nexus
 */

import React, { useState, useEffect } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { usePerspective } from '../../hooks/usePerspective';
import { useAction } from '../../hooks/useAction';
import { PlayerCard } from '../../components/PlayerCard';
import { RoleMappingEditor } from '../../components/RoleMappingEditor';
import { NexusControlBar } from '../../components/NexusControlBar';
import { GameUIContainer } from '../../components/GameUIContainer';
import type { RoleMapping } from '../../lib/types';
import '../../styles/global.css';

export const MyNexus: React.FC = () => {
  const {
    room,
    loading,
    error,
    fetchMyNexus,
    selectGame,
    addPlayer,
    removePlayer,
    startGame,
    pauseGame,
    resumeGame,
    stopGame,
  } = useRoom();

  const [selectedGame, setSelectedGame] = useState<string>('');
  const [roleMapping, setRoleMapping] = useState<RoleMapping>({});
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);

  // Perspective subscription (only when game is playing)
  const { perspective } = usePerspective(
    room?.room_id || null,
    currentRoleId,
    undefined
  );

  // Action submission
  const { submitAction, submitting } = useAction(room?.room_id || null);

  // Load my nexus on mount
  useEffect(() => {
    fetchMyNexus();
  }, []);

  // Determine current role for this user
  useEffect(() => {
    if (!room) return;

    // M0: Simple logic - find first role assigned to a human player
    for (const [roleId, playerId] of Object.entries(room.role_mapping)) {
      const player = room.player_list[playerId];
      if (player && player.type === 'human') {
        setCurrentRoleId(roleId);
        break;
      }
    }
  }, [room]);

  const handleSelectGame = async () => {
    if (!selectedGame) return;

    try {
      await selectGame(selectedGame);
      alert(`Game ${selectedGame} selected!`);
    } catch (err) {
      alert('Failed to select game');
    }
  };

  const handleAddHumanPlayer = async () => {
    const displayName = prompt('Enter player display name:');
    if (!displayName) return;

    try {
      await addPlayer({
        player_type: 'human',
        display_name: displayName,
      });
    } catch (err) {
      alert('Failed to add player');
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Remove this player?')) return;

    try {
      await removePlayer(playerId);
    } catch (err) {
      alert('Failed to remove player');
    }
  };

  const handleStartGame = async () => {
    // Validate role mapping
    if (!room || !room.game_id) {
      alert('Please select a game first');
      return;
    }

    // For tic-tac-toe, we need 2 roles mapped
    const mappedRoles = Object.keys(roleMapping);
    if (mappedRoles.length < 2) {
      alert('Please assign all roles before starting');
      return;
    }

    try {
      await startGame(roleMapping);
    } catch (err) {
      alert('Failed to start game');
    }
  };

  const handlePlayPause = async () => {
    if (room?.room_status === 'playing') {
      await pauseGame();
    } else if (room?.room_status === 'paused') {
      await resumeGame();
    }
  };

  const handleStop = async () => {
    if (!confirm('Stop the game?')) return;
    await stopGame();
  };

  if (loading && !room) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading your nexus...</p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={fetchMyNexus}>Retry</button>
      </div>
    );
  }

  if (!room) {
    return <div>No room data</div>;
  }

  const isOwner = true; // Always true for my-nexus
  const isOpen = room.room_status === 'open';
  const isPlaying = room.room_status === 'playing';
  const isPaused = room.room_status === 'paused';
  const canStart = isOpen && room.game_id && Object.keys(room.player_list).length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Control Bar */}
      {(isPlaying || isPaused || room.room_status === 'finished') && (
        <NexusControlBar
          room={room}
          isOwner={isOwner}
          statusText={perspective?.your_role?.is_current ? 'Your Turn' : 'Opponent Turn'}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onExit={() => (window.location.href = '/')}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        <div className="container">
          <h1>My Nexus</h1>
          <p>Room ID: <strong>{room.room_id}</strong></p>
          
          {error && <div className="error-message">{error}</div>}

          {/* Game Selection (only when open) */}
          {isOpen && !room.game_id && (
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2>Select a Game</h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                >
                  <option value="">-- Select Game --</option>
                  <option value="tic-tac-toe">Tic-Tac-Toe (井字棋)</option>
                </select>
                <button onClick={handleSelectGame} disabled={!selectedGame}>
                  Select Game
                </button>
              </div>
            </div>
          )}

          {/* Player Management (only when open) */}
          {isOpen && room.game_id && (
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2>Players</h2>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <button onClick={handleAddHumanPlayer}>
                  + Add Human Player
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {Object.entries(room.player_list).map(([playerId, player]) => (
                  <PlayerCard
                    key={playerId}
                    playerId={playerId}
                    player={player}
                    canRemove={isOwner}
                    onRemove={handleRemovePlayer}
                  />
                ))}
                
                {Object.keys(room.player_list).length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No players yet. Add players to start the game.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Role Mapping (only when open and game selected) */}
          {isOpen && room.game_id && Object.keys(room.player_list).length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <RoleMappingEditor
                playerList={room.player_list}
                roleIds={['player_X', 'player_O']} // Tic-tac-toe roles
                initialMapping={room.role_mapping}
                onMappingChange={setRoleMapping}
              />
              
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <button onClick={handleStartGame} disabled={!canStart}>
                  Start Game
                </button>
              </div>
            </div>
          )}

          {/* Game UI (when playing) */}
          {(isPlaying || isPaused || room.room_status === 'finished') && room.game_id && perspective && currentRoleId && (
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
              <GameUIContainer
                gameId={room.game_id}
                perspective={perspective}
                onAction={submitAction}
                isMyTurn={perspective.your_role.is_current}
                readonly={isPaused || room.room_status === 'finished' || submitting}
                metadata={{
                  roomId: room.room_id,
                  roleId: currentRoleId,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyNexus;

