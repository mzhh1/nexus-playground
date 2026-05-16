/**
 * Nexus Control Bar
 * Platform-level controls (play/pause, player list, status)
 */

import React, { useState } from 'react';
import { useLogto } from '@logto/react';
import { UserAvatar } from './UserAvatar';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { LOGTO_REDIRECT_URI } from '../lib/logto';
import type { RoleMapping } from '../lib/types';
import '../styles/control-bar.css';

interface NexusControlBarProps {
  roomId: string;
  roomName?: string;
  isPublic?: boolean;
  onUpdateRoomMeta?: (name: string, isPublic: boolean) => void;
  players: Record<string, any>;
  isOwner: boolean;
  gameName?: string;
  gameId?: string;
  statusText?: string;
  roleMapping?: RoleMapping;
  enginePhase?: 'lobby' | 'playing' | 'paused' | 'finished';
  onPlayPause?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
}

export const NexusControlBar: React.FC<NexusControlBarProps> = ({
  roomId,
  roomName,
  isPublic,
  onUpdateRoomMeta,
  players,
  isOwner,
  gameName,
  gameId,
  statusText,
  roleMapping,
  enginePhase,
  onPlayPause,
  onStop,
  onRestart,
  onExit,
}) => {
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [showRoleMapping, setShowRoleMapping] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showRoomMetaModal, setShowRoomMetaModal] = useState(false);
  const [editRoomName, setEditRoomName] = useState(roomName || roomId);
  const [editIsPublic, setEditIsPublic] = useState(isPublic ?? true);

  // Auth hooks
  const { signIn, signOut } = useLogto();
  const { user: userAvatarUser, isAuthenticated: userAvatarIsAuth } = useCurrentUser(true);

  const handleAvatarSignIn = () => {
    void signIn(LOGTO_REDIRECT_URI);
  };

  const handleAvatarSignOut = () => {
    void signOut(import.meta.env.VITE_LOGTO_POST_LOGOUT_REDIRECT_URI || window.location.origin + '/');
  };

  // Sync state when props change
  React.useEffect(() => {
    setEditRoomName(roomName || roomId);
    setEditIsPublic(isPublic ?? true);
  }, [roomName, isPublic, roomId]);

  // Use Engine phase as primary source of truth
  const isPlaying = enginePhase === 'playing';
  const isPaused = enginePhase === 'paused';

  // resume_locked 时也显示暂停/播放按钮
  const canTogglePlayPause = isOwner && (isPlaying || isPaused);
  const showActions = isOwner && (isPlaying || isPaused || enginePhase === 'finished');

  const playerCount = Object.keys(players || {}).length;
  const roleIds = roleMapping ? Object.keys(roleMapping) : [];

  const displayStatus = statusText ||
    (enginePhase === 'playing' ? '游戏进行中' :
      enginePhase === 'paused' ? '游戏暂停' :
        enginePhase === 'finished' ? '游戏已结束' :
          enginePhase === 'lobby' ? '准备中' : '');

  return (
    <div className="nexus-control-bar">
      {/* 第一行：主控制区域 */}
      <div className="control-bar-row-1">
        {/* 左侧：退出按钮 + 下拉菜单 */}
        <div className="control-bar-left">
          <button onClick={onExit} className="icon-button exit-button" title="退出房间">
            ← 退出
          </button>

          {/* 玩家列表下拉菜单 */}
          {playerCount > 0 && (
            <div className="dropdown-container">
              <button
                className="dropdown-button"
                onClick={() => setShowPlayerList(!showPlayerList)}
                title="玩家列表"
              >
                👥 玩家 ({playerCount})
              </button>
              {showPlayerList && (
                <div className="dropdown-menu">
                  {Object.entries(players || {}).map(([pid, player]) => (
                    <div key={pid} className="dropdown-item">
                      <span className="player-name">{player.display_name || player.displayName}</span>
                      <span className="player-type">{player.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 角色映射下拉菜单 */}
          {roleMapping && roleIds.length > 0 && Object.keys(roleMapping).length > 0 && (
            <div className="dropdown-container">
              <button
                className="dropdown-button"
                onClick={() => setShowRoleMapping(!showRoleMapping)}
                title="角色映射"
              >
                🎭 角色 ({roleIds.length})
              </button>
              {showRoleMapping && (
                <div className="dropdown-menu">
                  {Object.entries(roleMapping).map(([roleId, playerId]) => {
                    const player = players ? players[playerId] : null;
                    return (
                      <div key={roleId} className="dropdown-item">
                        <span className="role-name">{roleId}</span>
                        <span className="arrow">→</span>
                        <span className="player-name">
                          {(player?.display_name || player?.displayName) || '未分配'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 中间：游戏名称和房间状态（桌面显示） */}
        <div className="control-bar-center">
          <div className="game-info">
            {(gameName || gameId) && (
              <h2 className="game-name">{gameName || gameId}</h2>
            )}
            {displayStatus && (
              <p className="status-text">{displayStatus}</p>
            )}
          </div>
        </div>

        {/* 右侧：操作按钮 + Room ID + 头像 */}
        <div className="control-bar-right">
          {/* 操作按钮组 - 在较大屏幕上显示 */}
          {showActions && (
            <div className="action-buttons-group">
              {/* 暂停/播放按钮 */}
              {canTogglePlayPause && (
                <button
                  onClick={onPlayPause}
                  className={`play-pause-button ${isPlaying ? 'pause' : 'play'}`}
                  title={isPlaying ? '暂停游戏' : '继续游戏'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
              )}

              {/* 重新开始按钮 */}
              <button
                onClick={onRestart}
                className="restart-button"
                title="重新开始游戏"
              >
                ↻
              </button>

              {/* 停止按钮 */}
              <button
                onClick={onStop}
                className="stop-button"
                title="停止游戏"
              >
                ⏹
              </button>
            </div>
          )}

          {/* 操作下拉菜单 - 在小屏幕上显示 */}
          {showActions && (
            <div className="dropdown-container actions-dropdown">
              <button
                className="dropdown-button"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                title="操作"
              >
                ⚙️ 操作
              </button>
              {showActionsMenu && (
                <div className="dropdown-menu">
                  {canTogglePlayPause && (
                    <button
                      className="dropdown-item-button"
                      onClick={() => {
                        onPlayPause?.();
                        setShowActionsMenu(false);
                      }}
                    >
                      {isPlaying ? '⏸ 暂停游戏' : '▶ 继续游戏'}
                    </button>
                  )}
                  <button
                    className="dropdown-item-button"
                    onClick={() => {
                      onRestart?.();
                      setShowActionsMenu(false);
                    }}
                  >
                    ↻ 重新开始
                  </button>
                  <button
                    className="dropdown-item-button"
                    onClick={() => {
                      onStop?.();
                      setShowActionsMenu(false);
                    }}
                  >
                    ⏹ 停止游戏
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Room ID 显示（桌面显示） */}
          <div
            className="room-id-display room-id-desktop"
            title={`房间名称: ${roomName || roomId}`}
            onClick={() => setShowRoomMetaModal(true)}
            style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
          >
            房间:{roomId}
          </div>

          {/* 头像组件 */}
          <div className="avatar-container">
            <UserAvatar
              user={userAvatarUser}
              isAuthenticated={userAvatarIsAuth}
              onSignIn={handleAvatarSignIn}
              onSignOut={handleAvatarSignOut}
            />
          </div>
        </div>
      </div>

      {/* 第二行：游戏信息行（移动端显示） */}
      <div className="control-bar-row-2">
        <div className="game-info-mobile">
          {(gameName || gameId) && displayStatus && (
            <span className="game-name-status">
              {gameName || gameId}: {displayStatus}
            </span>
          )}
        </div>
        <div
          className="room-id-display room-id-mobile"
          title={`房间名称: ${roomName || roomId}`}
          onClick={() => setShowRoomMetaModal(true)}
          style={{ cursor: 'pointer' }}
        >
          {roomId}
        </div>
      </div>

      {/* Room Meta Modal */}
      {showRoomMetaModal && (
        <div className="modal-overlay" onClick={() => setShowRoomMetaModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            background: 'white', padding: '24px', borderRadius: '12px',
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.25rem' }}>房间信息</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>房间 ID</label>
              <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280', fontFamily: 'monospace' }}>
                {roomId}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>房间名称</label>
              {isOwner ? (
                <input
                  type="text"
                  value={editRoomName}
                  onChange={e => setEditRoomName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              ) : (
                <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '6px', color: '#111827' }}>
                  {roomName || roomId}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: isOwner ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={editIsPublic}
                  onChange={e => setEditIsPublic(e.target.checked)}
                  disabled={!isOwner}
                  style={{ marginRight: '8px', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>公开房间</span>
              </label>
              <p style={{ margin: '4px 0 0 24px', fontSize: '0.75rem', color: '#6b7280' }}>
                公开房间将显示在游戏大厅中（暂未实现）
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowRoomMetaModal(false);
                  setEditRoomName(roomName || roomId);
                  setEditIsPublic(isPublic ?? true);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '6px', background: '#f3f4f6', border: 'none', color: '#374151', cursor: 'pointer', fontWeight: 500
                }}
              >
                关闭
              </button>
              {isOwner && (
                <button
                  onClick={() => {
                    onUpdateRoomMeta?.(editRoomName, editIsPublic);
                    setShowRoomMetaModal(false);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', background: 'var(--color-primary, #3b82f6)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  保存
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

