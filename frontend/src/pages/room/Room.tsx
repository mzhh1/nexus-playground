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
  const { room, loading, error, fetchRoom } = useRoom();
  const { games: AVAILABLE_GAMES, loading: metadataLoading } = useGamesMetadata();

  // Nexus Engine WebSocket connection (handles both lobby and game state)
  const {
    engineState,
    gameState: perspective,
    isConnected: isEngineConnected,
    sendAction: sendEngineAction,
    error: engineError,
    setGame,
    addBot,
    removePlayer: engineRemovePlayer,
    assignRole,
    startGame: engineStartGame,
    stopGame: engineStopGame,
    restartGame: engineRestartGame,
    pauseGame: enginePauseGame,
    resumeGame: engineResumeGame,
    isOwner: isOwnerEngine,
    myRole: myRoleEngine,
    myUserId: myUserIdEngine,
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
      fetchRoom(roomId);
    }
  }, [roomId, fetchRoom]);

  // Determine current role and player ID from Engine State or Backend Fallback
  useEffect(() => {
    if (myRoleEngine) {
      setCurrentRoleId(myRoleEngine);
      setPlayerId(myUserIdEngine);
      return;
    }

    if (!room) return;

    // Fallback to backend data before Engine connects
    const myPlayerId = user?.id ? Object.entries(room.player_list).find(
      ([_, player]) => player.type === 'human' && player.uid === user.id
    )?.[0] : undefined;

    if (myPlayerId) {
      setPlayerId(myPlayerId);
      const roleId = Object.entries(room.role_mapping).find(([_, pid]) => pid === myPlayerId)?.[0];
      setCurrentRoleId(roleId || import.meta.env.VITE_SPECTATOR_ROLE_ID || 'spectator');
    } else {
      setCurrentRoleId(import.meta.env.VITE_SPECTATOR_ROLE_ID || 'spectator');
    }
  }, [room, user?.id, myRoleEngine, myUserIdEngine]);

  // Sync selected player count with room
  useEffect(() => {
    if (room?.selected_player_count !== undefined) {
      setSelectedPlayerCount(room.selected_player_count);
    }
  }, [room?.selected_player_count]);

  const currentPlayers = useMemo(() => {
    if (engineState?.players) return engineState.players;
    return room?.player_list || {};
  }, [engineState?.players, room?.player_list]);

  const effectiveRoleMapping = useMemo(() => {
    if (engineState?.players) {
      const mapping: RoleMapping = {};
      Object.entries(engineState.players).forEach(([userId, info]) => {
        if (info.role) mapping[info.role] = userId;
      });
      return mapping;
    }
    return room?.role_mapping || {};
  }, [engineState?.players, room?.role_mapping]);

  useEffect(() => {
    const currentPhase = engineState?.phase || room?.room_status;
    if (currentPhase !== 'open' && currentPhase !== 'lobby') {
      return;
    }

    if (room?.game_id) {
      setSelectedGameId(room.game_id);
    } else {
      setSelectedGameId('');
    }
  }, [room?.game_id, room?.room_status, engineState?.phase]);


  // ========== Event Handlers ==========

  const handleSelectGame = async () => {
    if (!selectedGameId) return;

    // Find the game metadata to get the worker URL
    const meta = AVAILABLE_GAMES.find(g => g.id === selectedGameId);
    if (!meta || !meta.workerUrl) {
      console.error('No worker URL for game:', selectedGameId);
      return;
    }

    try {
      setGame(selectedGameId, meta.workerUrl);
    } catch (err) {
      console.error('Failed to select game:', err);
    }
  };

  const handleAddSelf = async () => {
    // In v4.0, human players are added automatically upon connecting to the Engine.
    // This button is mostly for force-reconnecting or UI consistency.
    if (!isEngineConnected) {
      window.location.reload();
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

      addBot({
        display_name: uniqueName,
        model_name: template.model_name,
        system_prompt: template.system_prompt,
        temperature: 0.7, // Default temperature
      });
      setIsLLMTemplateModalOpen(false);
    } catch (err) {
      console.error('Failed to add LLM player:', err);
    }
  };

  const handleRemovePlayer = async (userId: string) => {
    if (!confirm('Remove this player?')) return;

    try {
      engineRemovePlayer(userId);
    } catch (err) {
      console.error('Failed to remove player:', err);
    }
  };

  const handleStartGame = async () => {
    // Find the gameWorkerUrl from metadata
    const gameWorkerUrl = currentGameMetadata?.workerUrl;
    if (!gameWorkerUrl) {
      console.error('No game worker URL found for game:', room?.game_id);
      return;
    }
    // Send GAME_START with full config to Engine DO via WebSocket
    engineStartGame(gameWorkerUrl, roleMapping);
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
    // In new engine, player count is often part of the game config or handled by the DO logic
    // We'll update mapping to empty and rely on DO sync
    setSelectedPlayerCount(count);
    setRoleMapping({});
  };

  const handleRoleMappingChange = async (newMapping: RoleMapping) => {
    // Sync each role change to the Engine
    setRoleMapping(newMapping);
    if (!isOwnerEngine) return;

    Object.entries(newMapping).forEach(([roleId, userId]) => {
      // Small check: only send update if it actually changed compared to engine state
      const currentInEngine = engineState?.players[userId]?.role;
      if (currentInEngine !== roleId) {
        assignRole(roleId, userId);
      }
    });
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
    // Human joining is handled by DO connection
    alert('已通过 WebSocket 自动加入。');
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
    if (!engineState) return;

    try {
      if (engineState.phase === 'playing') {
        enginePauseGame();
      } else {
        engineResumeGame();
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
  const isOwner = engineState?.you.isOwner ?? (room ? room.owner_uid === currentUserId : false);
  const isInRoom = engineState ? true : (playerId !== null); // If connected to engine, we are in the room

  // Use Engine engineState.phase as primary source of truth, fallback to backend room_status
  const isOpen = engineState ? engineState.phase === 'lobby' : (room ? room.room_status === 'open' : false);
  const isPlaying = engineState ? engineState.phase === 'playing' : (room ? room.room_status === 'playing' : false);
  const isFinished = engineState ? engineState.phase === 'finished' : false;
  const canJoin = isOpen && !isInRoom && !isOwner;

  // 在开放阶段也显示控制栏（当有游戏选择时）
  const shouldShowControlBar = engineState
    ? isPlaying || isFinished || (engineState.gameConfig && (isOwner || isInRoom))
    : false;

  const baseContentPadding = isOpen ? 'var(--spacing-lg)' : 'var(--spacing-sm)';
  const contentPaddingBottom = !isOpen && room?.game_id && perspective
    ? '60px'
    : baseContentPadding;

  // 让NexusControlBar组件自己显示房间状态（不再显示Your Turn/Opponent Turn）
  const controlBarStatusText = undefined;

  // 根据 game_id 查找游戏名称
  const gameName = room && room.game_id ? getGameName(room.game_id, AVAILABLE_GAMES) : undefined;

  const playerList = Object.entries(currentPlayers);
  const hasGameSelected = room ? !!room.game_id : false;
  const hasPlayers = playerList.length > 0;
  const accountAlreadyInRoom = user && room
    ? playerList.some(([, player]) => player.type === 'human' && player.uid === user.id)
    : false;

  // 获取当前游戏的元数据
  const currentGameMetadata = useMemo(() => {
    if (!hasGameSelected || !room || !room.game_id) return null;
    return AVAILABLE_GAMES.find(game => game.id === room.game_id) || null;
  }, [hasGameSelected, room, AVAILABLE_GAMES]);

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
    // 优先使用房间状态中保存的人数
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

  if ((loading && !room) || metadataLoading) {
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
          roleMapping={effectiveRoleMapping}
          enginePhase={engineState?.phase}
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
                  <p><strong>房主:</strong> {room.owner_uid}</p>
                  <p><strong>游戏:</strong> {room.game_id || '未选择'}</p>
                  <p><strong>玩家数:</strong> {playerList.length}</p>
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
                          disabled={!selectedGameId || selectedGameId === (room?.game_id ?? '')}
                        >
                          {hasGameSelected ? '更新游戏' : '确认选择'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ padding: 'var(--spacing-sm)', background: '#f3f4f6', borderRadius: '6px' }}>
                        {room.game_id ? gameName || room.game_id : '未选择'}
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
                          players={currentPlayers as any}
                          canRemove={isOwner}
                          onRemove={handleRemovePlayer}
                          emptyMessage="请添加玩家以开始游戏"
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
                            playerList={currentPlayers as any}
                            roleIds={roleIds}
                            mapping={effectiveRoleMapping}
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
                readonly={engineState?.phase !== 'playing' || submitting}
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
          {!isOpen && (!room.game_id || !perspective || !currentRoleId) && (
            <div className="card">
              <h2>房间状态: {engineState?.phase || room.room_status}</h2>
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
      {!isOpen && room.game_id && perspective && currentRoleId && (
        <GameMessageBar perspective={perspective} />
      )}
    </div>
  );
};

export default Room;
