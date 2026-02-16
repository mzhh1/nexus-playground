/**
 * Room Page (Unified)
 * Handles both owner's nexus and visitor views based on isOwner
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import '@autolabz/oauth-sdk/dist/style.css';
import { useRoom } from '../../hooks/useRoom';
import { useNexusEngine } from '../../hooks/useNexusEngine';
import { useGamesMetadata, getGameName } from '../../hooks/useGamesMetadata';
import type { RoleMapping, LLMPlayerTemplate } from '../../lib/types';
import { NexusControlBar } from '../../components/NexusControlBar';
import { PlayerList } from '../../components/PlayerList';
import { RoleTemplateSelector } from '../../components/PlayerCountSelector';
import { RoleMappingGraph } from '../../components/RoleMappingGraph';
import { RoleMappingModal } from '../../components/RoleMappingModal';
import { LLMPlayerTemplateModal } from '../../components/LLMPlayerTemplateModal';
import { LobbyStatusBar } from '../../components/LobbyStatusBar';
import { GameMessageBar } from '../../components/GameMessageBar';
import { LobbyContainer } from '../../components/LobbyContainer';
import { GameUIContainer } from '../../components/GameUIContainer';
import { isMultiPlayerCountConfig, getAvailablePlayerCounts, getRoleIdsForPlayerCount } from '../../lib/types';

const Room: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [roleMapping, setRoleMapping] = useState<RoleMapping>({});
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number | null>(null);

  const [isRoleMappingModalOpen, setIsRoleMappingModalOpen] = useState(false);
  const [isLLMTemplateModalOpen, setIsLLMTemplateModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Hooks
  const { room, loading, error, fetchRoom, joinRoom, addPlayer, removePlayer, pauseGame, resumeGame, stopGame, restartGame, selectGame, updateRoleMapping } = useRoom(roomId);
  const { games: AVAILABLE_GAMES, loading: metadataLoading } = useGamesMetadata();

  // Nexus Engine WebSocket connection (handles both lobby and game state)
  const {
    gameState: perspective,
    isConnected: isEngineConnected,
    sendAction: sendEngineAction,
    lobbyState,
    error: engineError,
    startGame: engineStartGame,
    stopGame: engineStopGame,
    restartGame: engineRestartGame,
    setGame: engineSetGame,
    addBot,
    kickPlayer: engineKickPlayer,
  } = useNexusEngine({ roomId });

  const submitting = false; // Actions are async via WebSocket now

  const submitAction = async (action: any) => {
    if (isEngineConnected) {
      sendEngineAction(action);
      return { success: true };
    } else {
      console.error("Engine not connected");
      return { success: false };
    }
  };
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
    if (!room) return;

    // Check if we're already in the room
    const myPlayerId = user?.id ? Object.entries(room.player_list).find(
      ([_, player]) => player.type === 'human' && player.uid === user.id
    )?.[0] : undefined;

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
    } else {
      // User is not in the player list -> Spectator
      setPlayerId(null);
      const spectatorRoleId = import.meta.env.VITE_SPECTATOR_ROLE_ID || 'spectator';
      setCurrentRoleId(spectatorRoleId);
    }
  }, [room, user?.id]);

  // Sync role mapping with room
  useEffect(() => {
    if (room?.role_mapping) {
      setRoleMapping(room.role_mapping);
    }
  }, [room?.role_mapping]);

  // Sync selected player count with room
  useEffect(() => {
    if (room?.selected_player_count !== undefined) {
      setSelectedPlayerCount(room.selected_player_count);
    }
  }, [room?.selected_player_count]);

  useEffect(() => {
    // Engine is the source of truth for game selection
    if (lobbyState?.gameId) {
      setSelectedGameId(lobbyState.gameId);
    } else if (room?.game_id) {
      // Fallback to backend data if Engine not yet connected
      setSelectedGameId(room.game_id);
    } else {
      setSelectedGameId('');
    }
  }, [lobbyState?.gameId, room?.game_id]);


  // ========== Event Handlers ==========

  const handleSelectGame = async () => {
    if (!selectedGameId) return;

    // Find metadata to get worker URL
    const gameMeta = AVAILABLE_GAMES.find(g => g.id === selectedGameId);
    if (!gameMeta || !gameMeta.workerUrl) {
      console.error('No worker URL for game:', selectedGameId);
      return;
    }

    engineSetGame(selectedGameId, gameMeta.workerUrl);
  };

  const handleAddSelf = async () => {
    if (!user) {
      alert('请先登录后再加入房间。');
      return;
    }

    // Engine automatically adds connected users to lobby
    // We only need to call backend addPlayer if we want to persist them in Redis/Postgres
    // For now, we keep the backend call for compatibility
    const displayName = accountDisplayName;
    try {
      await addPlayer({
        player_type: 'human',
        display_name: displayName,
        uid: user.id,
      });
    } catch (err) {
      console.error('Failed to add self:', err);
    }
  };

  const handleAddLLMPlayer = () => {
    setIsLLMTemplateModalOpen(true);
  };

  const handleSelectLLMTemplate = async (template: LLMPlayerTemplate) => {
    try {
      // Use Engine addBot instead of backend
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const uniqueName = template.name // Let user see clean name, duplicates handled by unique botId if needed? No, displayName needs uniqueness for UI clarity?
        ? `${template.name} ${randomSuffix}`
        : `Bot ${randomSuffix}`;
      const botId = `bot_${Date.now()}_${randomSuffix}`;

      // Call Engine
      addBot(botId, uniqueName, {
        modelName: template.model_name,
        systemPrompt: template.system_prompt,
      });

      setIsLLMTemplateModalOpen(false);
    } catch (err) {
      console.error('Failed to add LLM player:', err);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Remove this player?')) return;

    // Use Engine kickPlayer
    engineKickPlayer(playerId);

    // Also try backend remove for cleanup (optional/fallback)
    // try { await removePlayer(playerId); } catch (e) {}
  };

  const handleStartGame = async () => {
    // Game config from Engine state
    if (!lobbyState?.gameConfig) {
      // If Engine doesn't have config yet, use selected game metadata
      const gameMeta = AVAILABLE_GAMES.find(g => g.id === selectedGameId);
      if (gameMeta?.workerUrl) {
        engineStartGame(gameMeta.workerUrl, roleMapping);
        return;
      }
    }

    // Fallback or normal case
    if (lobbyState?.gameConfig?.gameWorkerUrl) {
      engineStartGame(lobbyState.gameConfig.gameWorkerUrl, roleMapping);
    }
  };

  const handleSaveRoleMapping = (newMapping: RoleMapping, playerCount?: number) => {
    setRoleMapping(newMapping);
    if (playerCount !== undefined) {
      setSelectedPlayerCount(playerCount);
    }
    setIsRoleMappingModalOpen(false);
  };

  const handleCancelRoleMapping = () => {
    setIsRoleMappingModalOpen(false);
  };

  const handlePlayerCountChange = async (count: number) => {
    setSelectedPlayerCount(count);
    // 清空角色映射（因为角色列表变了）
    setRoleMapping({});
    // 房主选择时立即保存到服务器
    if (isOwner) {
      try {
        await updateRoleMapping({}, count);
      } catch (err) {
        console.error('Failed to update player count:', err);
      }
    }
  };

  const handleRoleMappingChange = async (newMapping: RoleMapping) => {
    setRoleMapping(newMapping);
    // 房主编辑时立即保存到服务器
    if (isOwner) {
      try {
        await updateRoleMapping(newMapping, effectivePlayerCount ?? undefined);
      } catch (err) {
        console.error('Failed to update role mapping:', err);
      }
    }
  };

  const handleRandomAssign = () => {
    if (!room) return;
    const playerIds = Object.keys(room.player_list);
    const n = Math.min(playerIds.length, roleIds.length);

    // 取前n个玩家和角色
    const selectedPlayerIds = playerIds.slice(0, n);
    const selectedRoleIds = roleIds.slice(0, n);

    // 随机打乱玩家和角色
    const shuffledPlayers = [...selectedPlayerIds].sort(() => Math.random() - 0.5);
    const shuffledRoles = [...selectedRoleIds].sort(() => Math.random() - 0.5);

    const randomMapping: RoleMapping = {};
    for (let i = 0; i < n; i++) {
      randomMapping[shuffledRoles[i]] = shuffledPlayers[i];
    }

    handleRoleMappingChange(randomMapping);
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

  const handleCopyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000); // 2秒后恢复原文本
    } catch (err) {
      console.error('Failed to copy room link:', err);
      alert('复制失败，请手动复制链接');
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
    if (!confirm('确定要停止游戏吗？停止后将返回大厅。')) return;
    engineStopGame();
  };

  const handleRestart = async () => {
    if (!isOwner) return;
    if (!confirm('确定要重新开始游戏吗？当前游戏进度将会丢失。')) return;
    engineRestartGame();
  };

  // ========== Computed Values (ALL HOOKS MUST BE BEFORE ANY RETURN) ==========

  // Compute all values that depend on room data
  const currentUserId = user?.id || null;
  // Use Engine state for ownership and presence
  const isOwner = lobbyState ? lobbyState.you.isOwner : (room ? room.owner_uid === currentUserId : false);
  const isInRoom = lobbyState ? !!lobbyState.players[currentUserId!] : (playerId !== null);

  // Use Engine lobbyState.phase as primary source of truth, fallback to backend room_status
  const enginePhase = lobbyState?.phase;
  const isOpen = enginePhase ? enginePhase === 'lobby' : (room ? room.room_status === 'open' : false);
  const isPlaying = enginePhase ? enginePhase === 'playing' : (room ? room.room_status === 'playing' : false);
  const isFinished = enginePhase === 'finished';
  const canJoin = isOpen && !isInRoom && !isOwner;

  // Game ID from Engine
  const currentGameId = lobbyState?.gameId || room?.game_id;

  // 在开放阶段也显示控制栏（当有游戏选择时）
  const shouldShowControlBar = (lobbyState || room)
    ? isPlaying || isFinished || (currentGameId && (isOwner || isInRoom))
    : false;

  const baseContentPadding = isOpen ? 'var(--spacing-lg)' : 'var(--spacing-sm)';
  const contentPaddingBottom = !isOpen && currentGameId && perspective
    ? '60px'
    : baseContentPadding;

  // 让NexusControlBar组件自己显示房间状态（不再显示Your Turn/Opponent Turn）
  const controlBarStatusText = undefined;

  // 根据 game_id 查找游戏名称
  const gameName = currentGameId ? getGameName(currentGameId, AVAILABLE_GAMES) : undefined;

  // Players from Engine LobbyState
  // We mock backend PlayerList format if using Engine state to keep UI components happy
  const players = lobbyState?.players || {};
  const hasPlayers = Object.keys(players).length > 0;
  // const playerList = room ? Object.entries(room.player_list) : [];

  const hasGameSelected = !!currentGameId;
  const accountAlreadyInRoom = isInRoom;

  // 获取当前游戏的元数据
  const currentGameMetadata = useMemo(() => {
    if (!hasGameSelected || !currentGameId) return null;
    return AVAILABLE_GAMES.find(game => game.id === currentGameId) || null;
  }, [hasGameSelected, currentGameId, AVAILABLE_GAMES]);

  // 检测是否为多人数配置游戏
  const isMultiPlayerCountGame = useMemo(() => {
    if (!currentGameMetadata) return false;
    return isMultiPlayerCountConfig(currentGameMetadata.roleIds);
  }, [currentGameMetadata]);

  // 获取可用的人数选项
  const availablePlayerCounts = useMemo(() => {
    if (!currentGameMetadata) return [];
    return getAvailablePlayerCounts(currentGameMetadata.roleIds);
  }, [currentGameMetadata]);

  // 从房间状态或本地状态获取选择的人数
  const effectivePlayerCount = useMemo(() => {
    // 优先使用房间状态中保存的人数 (TODO: Add to Engine state)
    if (room?.selected_player_count) return room.selected_player_count;
    // 其次使用本地选择的人数
    if (selectedPlayerCount) return selectedPlayerCount;
    // 默认返回 null
    return null;
  }, [room?.selected_player_count, selectedPlayerCount]);

  // 获取当前有效的角色ID列表
  // IMPORTANT: This useMemo must be called on every render, not conditionally
  const roleIds = useMemo(() => {
    if (!currentGameMetadata) return [];
    return getRoleIdsForPlayerCount(currentGameMetadata.roleIds, effectivePlayerCount ?? undefined);
  }, [currentGameMetadata, effectivePlayerCount]);

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

  // Only block on loading if we have NO data (neither Engine nor Backend)
  if (!lobbyState && loading && !room) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading room data...</p>
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
          enginePhase={lobbyState?.phase}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onRestart={handleRestart}
          onExit={() => (window.location.href = '/')}
        />
      )}

      <div style={{
        flex: 1,
        overflow: isOpen ? 'auto' : 'hidden',
        overflowY: isOpen ? 'auto' : 'hidden', /* 明确禁用上下滚动 */
        display: isOpen ? 'block' : 'flex',
        flexDirection: isOpen ? undefined : 'column',
        paddingTop: isOpen && shouldShowControlBar ? 0 : baseContentPadding,
        paddingRight: isOpen && shouldShowControlBar ? 0 : baseContentPadding,
        paddingBottom: isOpen && shouldShowControlBar ? '10px' : contentPaddingBottom, /* 为底部状态栏留出空间 */
        paddingLeft: isOpen && shouldShowControlBar ? 0 : baseContentPadding,
        minHeight: 0
      }}>
        <div className={isOpen ? "" : ""} style={isOpen ? {} : {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          width: '100%'
        }}>
          {/* Header - 只在开放状态显示，游戏中的头像已在控制栏 */}
          {error && <div className="error-message">{error}</div>}

          {/* ========== OPEN PHASE ========== */}
          {isOpen && (
            <LobbyContainer>
              {/* Visitor: Join Button (未加入房间) */}
              {canJoin && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h2>加入这个房间？</h2>
                  <p><strong>房主:</strong> {(room?.owner_uid || lobbyState?.ownerId)}</p>
                  <p><strong>游戏:</strong> {currentGameId || '未选择'}</p>
                  <p><strong>玩家数:</strong> {Object.keys(players).length}</p>
                  <button onClick={handleJoin} style={{ width: '100%', marginTop: 'var(--spacing-sm)' }}>
                    Join Room
                  </button>
                </div>
              )}

              {/* Owner Controls or Visitor View (已加入房间或房主) */}
              {(isOwner || isInRoom) && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h2 style={{ margin: 0 }}>{isOwner ? '房主控制' : '房间信息'}</h2>
                    {isOwner && (
                      <button
                        onClick={handleCopyRoomLink}
                        className="secondary"
                        style={{
                          fontSize: '0.875rem',
                          padding: '0.5rem 1rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isCopied ? '✓ 已复制到剪切板' : '复制房间链接'}
                      </button>
                    )}
                  </div>

                  {/* Game Selection */}
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h3>{hasGameSelected ? '当前游戏' : '选择游戏'}</h3>
                    {isOwner ? (
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <select
                          value={selectedGameId}
                          onChange={(e) => setSelectedGameId(e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">-- 请选择游戏 --</option>
                          {selectedGameId && !AVAILABLE_GAMES.some(game => game.id === selectedGameId) && (
                            <option value={selectedGameId} disabled>
                              {selectedGameId}
                            </option>
                          )}
                          {AVAILABLE_GAMES.map(game => (
                            <option key={game.id} value={game.id}>
                              {game.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleSelectGame}
                          disabled={!selectedGameId || selectedGameId === (currentGameId ?? '')}
                        >
                          {hasGameSelected ? '更新游戏' : '确认选择'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ padding: 'var(--spacing-sm)', background: '#f3f4f6', borderRadius: '6px' }}>
                        {currentGameId ? gameName || currentGameId : '未选择'}
                      </p>
                    )}
                  </div>

                  {/* Player Management (after game selected) */}
                  {hasGameSelected && (
                    <>
                      <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <h3>玩家列表</h3>
                        {isOwner && (
                          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                            <button
                              onClick={handleAddSelf}
                              disabled={!user || accountAlreadyInRoom}
                            >
                              + Add Self
                            </button>
                            <button onClick={handleAddLLMPlayer} className="secondary">+ Add LLM Player</button>
                          </div>
                        )}

                        {/* Player List */}
                        <PlayerList
                          players={players as any} // Cast to satisfy type union if needed
                          canRemove={isOwner}
                          onRemove={handleRemovePlayer}
                          emptyMessage="等待玩家加入..."
                        />
                      </div>

                      {/* Role Template Selector (for multi-player-count games) */}
                      {isMultiPlayerCountGame && hasPlayers && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <h3>角色模板</h3>
                          <RoleTemplateSelector
                            availableCounts={availablePlayerCounts}
                            selectedCount={effectivePlayerCount}
                            playerCountLabels={currentGameMetadata?.playerCountLabels}
                            onSelect={handlePlayerCountChange}
                            disabled={!isOwner}
                            isOwner={isOwner}
                          />
                        </div>
                      )}

                      {/* Role Mapping Display (after players added) */}
                      {hasPlayers && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                            <h3>角色分配</h3>
                            {isOwner && (
                              <button onClick={handleRandomAssign} className="secondary" style={{ fontSize: '0.875rem' }}>
                                随机分配
                              </button>
                            )}
                          </div>
                          <RoleMappingGraph
                            players={players}
                            roleIds={roleIds}
                            mapping={roleMapping}
                            onChange={handleRoleMappingChange}
                            readonly={!isOwner}
                          />
                        </div>
                      )}

                      {/* Start Game Button (Owner only) */}
                      {isOwner && (
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
                      )}
                    </>
                  )}
                </div>
              )}
            </LobbyContainer>
          )}

          {/* ========== PLAYING/PAUSED/FINISHED PHASE ========== */}
          {!isOpen && currentGameId && perspective && currentRoleId && (
            <div className="card" style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              padding: 0 /* 游戏UI自己管理padding */
            }}>
              <GameUIContainer
                gameId={currentGameId}
                perspective={perspective}
                onAction={submitAction}
                isMyTurn={perspective.your_role.is_current}
                readonly={room.room_status !== 'playing' || submitting}
                metadata={{
                  roomId: room.room_id,
                  roleId: currentRoleId,
                  playerId: playerId || undefined,
                }}
                uiConfig={currentGameMetadata?.ui}
              />
            </div>
          )}

          {/* Fallback: Status Display */}
          {!isOpen && (!currentGameId || !perspective || !currentRoleId) && (
            <div className="card">
              <h2>房间状态: {room?.room_status || enginePhase}</h2>
              <p>游戏ID: {currentGameId || '无'}</p>
              <p>玩家数: {Object.keys(players).length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Role Mapping Modal */}
      {isRoleMappingModalOpen && (
        <RoleMappingModal
          players={players}
          roleIds={roleIds}
          initialMapping={roleMapping}
          onSave={handleSaveRoleMapping}
          onCancel={handleCancelRoleMapping}
          isMultiPlayerCountGame={isMultiPlayerCountGame}
          availablePlayerCounts={availablePlayerCounts}
          initialPlayerCount={effectivePlayerCount}
          onPlayerCountChange={handlePlayerCountChange}
          playerCountLabels={currentGameMetadata?.playerCountLabels}
        />
      )}

      {/* LLM Player Template Modal */}
      <LLMPlayerTemplateModal
        isOpen={isLLMTemplateModalOpen}
        onClose={() => setIsLLMTemplateModalOpen(false)}
        onSelect={handleSelectLLMTemplate}
      />

      {/* Status Bar - 固定在页面底部 */}
      {/* 开放阶段显示 LobbyStatusBar，游戏阶段显示 GameMessageBar */}
      {isOpen && shouldShowControlBar && (
        <LobbyStatusBar
          isOwner={isOwner}
          statusText="等待开始"
          isMappingComplete={isMappingComplete}
        />
      )}
      {!isOpen && currentGameId && perspective && currentRoleId && (
        <GameMessageBar perspective={perspective} />
      )}
    </div>
  );
};

export default Room;
