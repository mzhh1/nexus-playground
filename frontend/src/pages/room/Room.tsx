/**
 * Room Page (Unified)
 * Handles both owner's nexus and visitor views based on isOwner
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import '@autolabz/oauth-sdk/dist/style.css';
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
  const [visitorDisplayName, setVisitorDisplayName] = useState('');
  const [pendingJoinRequests, setPendingJoinRequests] = useState<{ userId: string, displayName: string, id: string }[]>([]);

  // Hooks
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
    requestJoin: engineRequestJoin,
    approveJoin: engineApproveJoin,
    isOwner: isOwnerEngine,
    myRole: myRoleEngine,
    myUserId: myUserIdEngine,
  } = useNexusEngine({
    roomId,
    onJoinRequest: (userId, displayName) => {
      const requestId = Math.random().toString(36).substring(7);
      setPendingJoinRequests(prev => [...prev, { userId, displayName, id: requestId }]);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        setPendingJoinRequests(prev => prev.filter(req => req.id !== requestId));
      }, 10000);
    }
  });

  const submitting = false; // Actions are async via WebSocket now

  const submitAction = async (action: any) => {
    if (isEngineConnected) {
      sendEngineAction(action.action_id, action.params);
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

  useEffect(() => {
    if (accountDisplayName && !visitorDisplayName) {
      setVisitorDisplayName(accountDisplayName);
    }
  }, [accountDisplayName]);

  // Extract room ID from URL (/room?id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
      setRoomId(id);
    }
  }, []);

  // Determine current role and player ID from Engine State
  useEffect(() => {
    if (myRoleEngine) {
      setCurrentRoleId(myRoleEngine);
      setPlayerId(myUserIdEngine);
    } else {
      setCurrentRoleId(import.meta.env.VITE_SPECTATOR_ROLE_ID || 'spectator');
      setPlayerId(null);
    }
  }, [myRoleEngine, myUserIdEngine]);

  // Sync selected player count with room
  useEffect(() => {
    if (engineState?.gameConfig?.maxPlayers !== undefined) {
      setSelectedPlayerCount(engineState.gameConfig.maxPlayers);
    }
  }, [engineState?.gameConfig?.maxPlayers]);

  const currentPlayers = useMemo(() => {
    return engineState?.players || {};
  }, [engineState?.players]);

  const effectiveRoleMapping = useMemo(() => {
    if (engineState?.players) {
      const mapping: RoleMapping = {};
      Object.entries(engineState.players).forEach(([userId, info]) => {
        if (info.role) mapping[info.role] = userId;
      });
      return mapping;
    }
    return {};
  }, [engineState?.players]);

  useEffect(() => {
    const currentPhase = engineState?.phase;
    if (currentPhase !== 'lobby') {
      return;
    }

    if (engineState?.gameConfig?.gameId) {
      setSelectedGameId(engineState.gameConfig.gameId);
    } else {
      setSelectedGameId('');
    }
  }, [engineState?.gameConfig?.gameId, engineState?.phase]);


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
    // Send GAME_START with full config to Engine DO via WebSocket
    engineStartGame();
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
    const playerIds = Object.keys(currentPlayers);
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
    if (!visitorDisplayName.trim()) {
      alert('请输入显示名称');
      return;
    }
    engineRequestJoin(visitorDisplayName.trim());
    alert('申请已发送，等待房主批准...');
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

  // Determine current role and player ID from Engine State
  const currentUserId = user?.id || null;
  const isOwner = isOwnerEngine;
  const isInRoom = !!engineState;

  const isOpen = engineState?.phase === 'lobby';
  const isPlaying = engineState?.phase === 'playing';
  const isPaused = engineState?.phase === 'paused';
  const isFinished = engineState?.phase === 'finished';
  const isAuthorized = engineState?.you.isAuthorized ?? false;
  const canRequestJoin = !isAuthorized && !isOwner;

  // 在开放阶段也显示控制栏（当有游戏选择时）
  const shouldShowControlBar = engineState
    ? isPlaying || isPaused || isFinished || (engineState.gameConfig && (isOwner || isInRoom))
    : false;

  const baseContentPadding = isOpen ? 'var(--spacing-lg)' : 'var(--spacing-sm)';
  const contentPaddingBottom = !isOpen && engineState?.gameConfig?.gameId && perspective
    ? '60px'
    : baseContentPadding;

  // 让NexusControlBar组件自己显示房间状态（不再显示Your Turn/Opponent Turn）
  const controlBarStatusText = undefined;

  // 根据 game_id 查找游戏名称
  const gameName = engineState?.gameConfig?.gameId ? getGameName(engineState.gameConfig.gameId, AVAILABLE_GAMES) : undefined;

  const playerList = Object.entries(currentPlayers);
  const hasGameSelected = !!engineState?.gameConfig?.gameId;
  const hasPlayers = playerList.length > 0;
  const accountAlreadyInRoom = !!engineState;

  // 获取当前游戏的元数据
  const currentGameMetadata = useMemo(() => {
    if (!hasGameSelected || !engineState?.gameConfig?.gameId) return null;
    return AVAILABLE_GAMES.find(game => game.id === engineState.gameConfig!.gameId) || null;
  }, [hasGameSelected, engineState?.gameConfig?.gameId, AVAILABLE_GAMES]);

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

  // 从 Engine 状态获取选择的人数
  const effectivePlayerCount = useMemo(() => {
    return engineState?.gameConfig?.maxPlayers || selectedPlayerCount || null;
  }, [engineState?.gameConfig?.maxPlayers, selectedPlayerCount]);

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

  if (!engineState && !engineError) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Connecting to Nexus Engine...</p>
      </div>
    );
  }

  if (engineError) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>Connection Error</h2>
          <p>{engineError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!engineState) {
    return <div>No engine data</div>;
  }

  // ========== AUTHORIZATION CHECK (Minimal Visitor View) ==========
  if (!isAuthorized) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        padding: 'var(--spacing-md)'
      }}>
        <LobbyContainer style={{ maxWidth: '450px', width: '100%' }}>
          <div className="card" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderRadius: '16px',
            padding: '2rem'
          }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-xs)' }}>加入房间申请</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.925rem' }}>
              <strong>房间 ID:</strong> <code style={{ background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>{roomId}</code>
            </p>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
              您当前作为访客查看。请输入您的显示名称并申请加入。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>显示名称</label>
                <input
                  type="text"
                  value={visitorDisplayName}
                  onChange={(e) => setVisitorDisplayName(e.target.value)}
                  placeholder={accountDisplayName || "您的昵称"}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>
              <button
                onClick={handleJoin}
                className="primary"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  transition: 'transform 0.1s ease'
                }}
              >
                发送申请入场
              </button>
            </div>
            {engineState.phase === 'playing' && (
              <div style={{
                marginTop: '1.5rem',
                padding: '0.75rem',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem',
                color: '#92400e'
              }}>
                <span style={{ fontSize: '1.2rem' }}>🎮</span>
                <span>游戏正在进行中，您可以申请作为观众加入或等待转正。</span>
              </div>
            )}
          </div>
        </LobbyContainer>
      </div>
    );
  }

  // ========== Authorized Render ==========

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Control Bar */}
      {shouldShowControlBar && <NexusControlBar
        roomId={roomId!}
        players={currentPlayers}
        isOwner={isOwner}
        gameName={gameName}
        gameId={engineState.gameConfig?.gameId}
        statusText={controlBarStatusText}
        roleMapping={effectiveRoleMapping}
        enginePhase={engineState.phase}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onRestart={handleRestart}
        onExit={() => (window.location.href = '/')}
      />}

      {/* Approval Toasts for Owner - 全局层级，任何阶段可见 */}
      {isOwner && pendingJoinRequests.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {pendingJoinRequests.map(req => (
            <div key={req.id} style={{
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb',
              width: '300px',
              animation: 'slideIn 0.3s ease-out'
            }}>
              <style>{`
                @keyframes slideIn {
                  from { transform: translateX(100%); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
              `}</style>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>有人申请加入</div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}><strong>{req.displayName}</strong> 想要加入房间</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    engineApproveJoin(req.userId, req.displayName);
                    setPendingJoinRequests(prev => prev.filter(r => r.id !== req.id));
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: '#10b981',
                    border: 'none',
                    color: 'white',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  允许
                </button>
                <button
                  onClick={() => setPendingJoinRequests(prev => prev.filter(r => r.id !== req.id))}
                  className="secondary"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  忽略
                </button>
              </div>
              <div style={{
                height: '3px',
                background: '#e5e7eb',
                marginTop: '12px',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--color-primary)',
                  width: '100%',
                  animation: 'shrink 10s linear forwards'
                }}></div>
                <style>{`
                  @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                  }
                `}</style>
              </div>
            </div>
          ))}
        </div>
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
          {engineError && <div className="error-message">{engineError}</div>}

          {/* ========== AUTHORIZED PHASE (Owner or Joined Player) ========== */}
          <React.Fragment>
            {/* ========== OPEN PHASE ========== */}
            {isOpen && (
              <LobbyContainer>
                {/* Owner Controls or Visitor View (已授权) */}
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
                          disabled={!selectedGameId /*|| selectedGameId === (engineState.gameConfig?.gameId ?? '')*/}
                        >
                          {hasGameSelected ? '更新游戏' : '确认选择'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ padding: 'var(--spacing-sm)', background: '#f3f4f6', borderRadius: '6px' }}>
                        {engineState.gameConfig?.gameId ? gameName || engineState.gameConfig.gameId : '未选择'}
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
              </LobbyContainer>
            )}

            {/* ========== PLAYING/PAUSED/FINISHED PHASE ========== */}
            {!isOpen && engineState.gameConfig?.gameId && perspective && currentRoleId && (
              <div className="card" style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
                padding: 0 /* 游戏UI自己管理padding */
              }}>
                <GameUIContainer
                  gameId={engineState.gameConfig.gameId}
                  perspective={perspective}
                  onAction={submitAction}
                  isMyTurn={perspective.your_role.is_current}
                  readonly={engineState.phase !== 'playing' || submitting}
                  metadata={{
                    roomId: engineState.roomId,
                    roleId: currentRoleId,
                    playerId: playerId || undefined,
                  }}
                  uiUrl={currentGameMetadata?.ui?.url}
                />
              </div>
            )}

            {/* Fallback: Status Display */}
            {!isOpen && (!engineState.gameConfig?.gameId || !perspective || !currentRoleId) && (
              <div className="card">
                <h2>房间状态: {engineState.phase}</h2>
                <p>游戏ID: {engineState.gameConfig?.gameId || '无'}</p>
                <p>玩家数: {playerList.length}</p>
              </div>
            )}
          </React.Fragment>
        </div>
      </div>

      {/* Role Mapping Modal */}
      {isRoleMappingModalOpen && (
        <RoleMappingModal
          playerList={currentPlayers as any}
          roleIds={roleIds}
          initialMapping={effectiveRoleMapping}
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
      {!isOpen && engineState.gameConfig?.gameId && perspective && currentRoleId && (
        <GameMessageBar perspective={perspective} />
      )}
    </div>
  );
};

export default Room;
