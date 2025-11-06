/**
 * Room Page (Unified)
 * Handles both owner's nexus and visitor views based on isOwner
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AuthAvatar, useOAuth } from '@autolabz/oauth-sdk';
import '@autolabz/oauth-sdk/dist/style.css';
import { useRoom } from '../../hooks/useRoom';
import { usePerspective } from '../../hooks/usePerspective';
import { useAction } from '../../hooks/useAction';
import { useGamesMetadata, getGameName } from '../../hooks/useGamesMetadata';
import { NexusControlBar } from '../../components/NexusControlBar';
import { GameUIContainer } from '../../components/GameUIContainer';
import { GameMessageBar } from '../../components/GameMessageBar';
import { PlayerCard } from '../../components/PlayerCard';
import { RoleMappingDisplay } from '../../components/RoleMappingDisplay';
import { RoleMappingModal } from '../../components/RoleMappingModal';
import { LLMPlayerTemplateModal, LLMPlayerTemplate } from '../../components/LLMPlayerTemplateModal';
import type { RoleMapping } from '../../lib/types';
import '../../styles/global.css';

const Room: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [roleMapping, setRoleMapping] = useState<RoleMapping>({});
  const [isRoleMappingModalOpen, setIsRoleMappingModalOpen] = useState(false);
  const [isLLMTemplateModalOpen, setIsLLMTemplateModalOpen] = useState(false);

  // Fetch games metadata
  const { games: AVAILABLE_GAMES } = useGamesMetadata();

  const {
    room,
    loading,
    error,
    fetchRoom,
    joinRoom,
    selectGame,
    addPlayer,
    removePlayer,
    startGame,
    pauseGame,
    resumeGame,
    stopGame,
    restartGame,
  } = useRoom(roomId || undefined);

  // SSE event callbacks to refresh room state
  const sseCallbacks = useMemo(() => ({
    onGameStarted: () => {
      console.log('Game started, refreshing room state...');
      fetchRoom();
    },
    onGamePaused: () => {
      console.log('Game paused, refreshing room state...');
      fetchRoom();
    },
    onGameResumed: () => {
      console.log('Game resumed, refreshing room state...');
      fetchRoom();
    },
    onGameStopped: () => {
      console.log('Game stopped, refreshing room state...');
      fetchRoom();
    },
    onGameRestarted: () => {
      console.log('Game restarted, refreshing room state...');
      fetchRoom();
    },
  }), [fetchRoom]);

  const { perspective } = usePerspective(roomId, currentRoleId, playerId || undefined, sseCallbacks);
  const { submitAction, submitting } = useAction(roomId);
  const { user } = useOAuth();

  const accountDisplayName = useMemo(() => {
    if (!user) return '';

    const nickname = user.nickname?.trim();
    if (nickname) return nickname;

    const email = user.email?.trim();
    if (email) return email;

    return user.id;
  }, [user]);

  // Extract room ID from URL (/room?id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id) {
      setRoomId(id);
    }
  }, []);

  // Fetch room info when roomId is set
  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  // Determine current role and player ID
  useEffect(() => {
    if (!room || !user?.id) return;

    // Check if we're already in the room
    const myPlayerId = Object.entries(room.player_list).find(
      ([_, player]) => player.type === 'human' && player.uid === user.id
    )?.[0];

    if (myPlayerId) {
      setPlayerId(myPlayerId);

      // Find role assigned to this player
      const roleId = Object.entries(room.role_mapping).find(
        ([_, pid]) => pid === myPlayerId
      )?.[0];

      if (roleId) {
        setCurrentRoleId(roleId);
      } else {
        // Player is in the room but not assigned a role - use spectator mode
        // Use the spectator role ID from environment variable
        const spectatorRoleId = import.meta.env.VITE_SPECTATOR_ROLE_ID || 'spectator';
        setCurrentRoleId(spectatorRoleId);
      }
    }
  }, [room, user?.id]);

  // Sync role mapping with room
  useEffect(() => {
    if (room?.role_mapping) {
      setRoleMapping(room.role_mapping);
    }
  }, [room?.role_mapping]);


  // ========== Event Handlers ==========

  const handleSelectGame = async () => {
    if (!selectedGameId) return;
    
    try {
      await selectGame(selectedGameId);
      setSelectedGameId('');
    } catch (err) {
      console.error('Failed to select game:', err);
    }
  };

  const handleAddSelf = async () => {
    if (!user) {
      alert('请先登录后再加入房间。');
      return;
    }

    const displayName = accountDisplayName;
    if (!displayName) {
      alert('无法获取账号昵称，请稍后重试。');
      return;
    }

    const alreadyInRoom = Object.values(room?.player_list ?? {}).some(
      (player) => player.type === 'human' && player.uid === user.id
    );
    if (alreadyInRoom) {
      alert('你已经在房间中。');
      return;
    }

    try {
      const result = await addPlayer({
        player_type: 'human',
        display_name: displayName,
        uid: user.id,
      });
      if (result?.player_id) {
        setPlayerId(result.player_id);
      }
    } catch (err) {
      console.error('Failed to add self as human player:', err);
    }
  };

  const handleAddLLMPlayer = () => {
    setIsLLMTemplateModalOpen(true);
  };

  const handleSelectLLMTemplate = async (template: LLMPlayerTemplate) => {
    try {
      // 生成 5 位随机字符后缀，避免名称重复
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const uniqueName = `${template.name}_${randomSuffix}`;
      
      await addPlayer({
        player_type: 'llm',
        display_name: uniqueName,
        model_name: template.model_name,
        system_prompt: template.system_prompt,
      });
      setIsLLMTemplateModalOpen(false);
    } catch (err) {
      console.error('Failed to add LLM player:', err);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Remove this player?')) return;

    try {
      await removePlayer(playerId);
    } catch (err) {
      console.error('Failed to remove player:', err);
    }
  };

  const handleStartGame = async () => {
    try {
      await startGame(roleMapping);
    } catch (err) {
      console.error('Failed to start game:', err);
    }
  };

  const handleSaveRoleMapping = (newMapping: RoleMapping) => {
    setRoleMapping(newMapping);
    setIsRoleMappingModalOpen(false);
  };

  const handleCancelRoleMapping = () => {
    setIsRoleMappingModalOpen(false);
  };

  const handleJoin = async () => {
    if (!user) {
      alert('请先登录后加入房间。');
      return;
    }

    const displayName = accountDisplayName;
    if (!displayName) {
      alert('无法获取账号昵称，请稍后重试。');
      return;
    }

    try {
      const result = await joinRoom(displayName);
      setPlayerId(result.player_id);
      alert('加入成功！');
    } catch (err) {
      alert('加入房间失败');
    }
  };

  const handlePlayPause = async () => {
    if (!room) return;

    try {
      if (room.room_status === 'playing') {
        await pauseGame();
      } else if (room.room_status === 'paused') {
        if (room.resume_locked) {
          alert('游戏已停止，无法继续进行');
          return;
        }
        await resumeGame();
      }
    } catch (err) {
      console.error('Failed to toggle play/pause:', err);
    }
  };

  const handleStop = async () => {
    if (!isOwner) return;
    if (!confirm('确定要停止游戏吗？停止后将无法继续。')) return;

    try {
      await stopGame();
    } catch (err) {
      console.error('Failed to stop game:', err);
    }
  };

  const handleRestart = async () => {
    if (!isOwner) return;
    if (!confirm('确定要重新开始游戏吗？当前游戏进度将会丢失。')) return;

    try {
      await restartGame();
    } catch (err) {
      console.error('Failed to restart game:', err);
    }
  };

  // ========== Computed Values (ALL HOOKS MUST BE BEFORE ANY RETURN) ==========

  // Compute all values that depend on room data
  const currentUserId = user?.id || null;
  const isInRoom = playerId !== null;
  const isOwner = room ? room.owner_uid === currentUserId : false;
  const isOpen = room ? room.room_status === 'open' : false;
  const isPlaying = room ? room.room_status === 'playing' : false;
  const canJoin = isOpen && !isInRoom && !isOwner;
  const shouldShowControlBar = room
    ? isPlaying || room.room_status === 'paused' || (isOwner && room.game_id)
    : false;
  
  const baseContentPadding = isOpen ? 'var(--spacing-lg)' : 'var(--spacing-sm)';
  const contentPaddingBottom = !isOpen && room?.game_id && perspective
    ? '60px'
    : baseContentPadding;

  // 让NexusControlBar组件自己显示房间状态（不再显示Your Turn/Opponent Turn）
  const controlBarStatusText = undefined;

  // 根据 game_id 查找游戏名称
  const gameName = room && room.game_id ? getGameName(room.game_id, AVAILABLE_GAMES) : undefined;

  const playerList = room ? Object.entries(room.player_list) : [];
  const hasGameSelected = room ? !!room.game_id : false;
  const hasPlayers = playerList.length > 0;
  const accountAlreadyInRoom = user && room
    ? playerList.some(([, player]) => player.type === 'human' && player.uid === user.id)
    : false;

  // Get role IDs dynamically from game metadata
  // IMPORTANT: This useMemo must be called on every render, not conditionally
  const roleIds = useMemo(() => {
    if (!hasGameSelected || !room || !room.game_id) return [];
    
    const gameMetadata = AVAILABLE_GAMES.find(game => game.id === room.game_id);
    return gameMetadata?.roleIds || [];
  }, [hasGameSelected, room, AVAILABLE_GAMES]);
  
  const isMappingComplete = roleIds.length > 0 && roleIds.every(roleId => roleMapping[roleId]);

  // ========== Early Returns (AFTER all hooks) ==========

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
          <h2>错误</h2>
          <p>{typeof error === 'string' ? error : '加载房间失败'}</p>
          <button onClick={fetchRoom}>重试</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div>No room data</div>;
  }

  // ========== Render ==========

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Control Bar */}
      {shouldShowControlBar && (
        <NexusControlBar
          room={room}
          isOwner={isOwner}
          gameName={gameName}
          statusText={controlBarStatusText}
          roleMapping={roleMapping}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onRestart={handleRestart}
          onExit={() => (window.location.href = '/')}
        />
      )}

      <div style={{ 
        flex: 1, 
        overflow: isOpen ? 'auto' : 'hidden',
        display: isOpen ? 'block' : 'flex',
        flexDirection: isOpen ? undefined : 'column',
        paddingTop: baseContentPadding,
        paddingRight: baseContentPadding,
        paddingBottom: contentPaddingBottom, /* 为底部消息栏留出空间 */
        paddingLeft: baseContentPadding,
        minHeight: 0
      }}>
        <div className={isOpen ? "container" : ""} style={isOpen ? {} : { 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          width: '100%'
        }}>
          {/* Header - 只在开放状态显示，游戏中的头像已在控制栏 */}
          {isOpen && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 'var(--spacing-lg)' 
            }}>
              <h1>Room: {roomId}</h1>
              <AuthAvatar
                redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
                scope={import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi'}
                profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
              />
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}

          {/* ========== OPEN PHASE ========== */}
          {isOpen && (
            <>
              {/* Owner Controls */}
              {isOwner && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h2>房主控制</h2>

                  {/* Game Selection */}
                  {!hasGameSelected && (
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                      <h3>选择游戏</h3>
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <select
                          value={selectedGameId}
                          onChange={(e) => setSelectedGameId(e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">-- Select a Game --</option>
                          {AVAILABLE_GAMES.map(game => (
                            <option key={game.id} value={game.id}>
                              {game.name}
                            </option>
                          ))}
                        </select>
                        <button onClick={handleSelectGame} disabled={!selectedGameId}>
                          Select Game
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Player Management (after game selected) */}
                  {hasGameSelected && (
                    <>
                      <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <h3>游戏: {room.game_id}</h3>
                      </div>

                      <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <h3>玩家管理</h3>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                          <button
                            onClick={handleAddSelf}
                            disabled={!user || accountAlreadyInRoom}
                          >
                            + Add Self
                          </button>
                          <button onClick={handleAddLLMPlayer} className="secondary">+ Add LLM Player</button>
                        </div>

                        {/* Player List */}
                        {hasPlayers && (
                          <div style={{ 
                            display: 'grid', 
                            gap: 'var(--spacing-sm)', 
                            marginTop: 'var(--spacing-sm)' 
                          }}>
                            {playerList.map(([pid, player]) => (
                              <PlayerCard
                                key={pid}
                                playerId={pid}
                                player={player}
                                canRemove={true}
                                onRemove={handleRemovePlayer}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Role Mapping Display (after players added) */}
                      {hasPlayers && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <RoleMappingDisplay
                            playerList={room.player_list}
                            roleIds={roleIds}
                            mapping={roleMapping}
                            onEdit={() => setIsRoleMappingModalOpen(true)}
                          />
                        </div>
                      )}

                      {/* Start Game Button */}
                      <div>
                        <button
                          onClick={handleStartGame}
                          disabled={!isMappingComplete}
                          style={{ width: '100%' }}
                        >
                          Start Game
                        </button>
                        {!isMappingComplete && (
                          <p style={{ 
                            marginTop: 'var(--spacing-xs)', 
                            fontSize: '0.875rem', 
                            color: 'var(--color-text-secondary)' 
                          }}>
                            请分配所有角色后才能开始游戏
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Visitor: Join Button */}
              {canJoin && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h2>加入这个房间？</h2>
                  <p><strong>房主:</strong> {room.owner_uid}</p>
                  <p><strong>游戏:</strong> {room.game_id || '未选择'}</p>
                  <p><strong>玩家数:</strong> {playerList.length}</p>
                  <button onClick={handleJoin} style={{ width: '100%', marginTop: 'var(--spacing-sm)' }}>
                    Join Room
                  </button>
                </div>
              )}

              {/* Visitor: Waiting Message (already joined) */}
              {isInRoom && !isOwner && (
                <div className="card">
                  <h2>等待游戏开始...</h2>
                  <p>您已加入房间。房主将很快开始游戏。</p>
                </div>
              )}
            </>
          )}

          {/* ========== PLAYING/PAUSED/FINISHED PHASE ========== */}
          {!isOpen && room.game_id && perspective && currentRoleId && (
            <div className="card" style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              padding: 0 /* 游戏UI自己管理padding */
            }}>
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

          {/* Fallback: Status Display */}
          {!isOpen && (!room.game_id || !perspective || !currentRoleId) && (
            <div className="card">
              <h2>房间状态: {room.room_status}</h2>
              <p>游戏ID: {room.game_id || '无'}</p>
              <p>玩家数: {playerList.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Role Mapping Modal */}
      {isRoleMappingModalOpen && room && (
        <RoleMappingModal
          playerList={room.player_list}
          roleIds={roleIds}
          initialMapping={roleMapping}
          onSave={handleSaveRoleMapping}
          onCancel={handleCancelRoleMapping}
        />
      )}

      {/* LLM Player Template Modal */}
      <LLMPlayerTemplateModal
        isOpen={isLLMTemplateModalOpen}
        onClose={() => setIsLLMTemplateModalOpen(false)}
        onSelect={handleSelectLLMTemplate}
      />

      {/* Message Bar - 固定在页面底部 */}
      {!isOpen && room.game_id && perspective && currentRoleId && (
        <GameMessageBar perspective={perspective} />
      )}
    </div>
  );
};

export default Room;
