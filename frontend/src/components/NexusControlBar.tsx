/**
 * Nexus Control Bar
 * Platform-level controls (play/pause, player list, status)
 */

import React, { useState } from 'react';
import { AuthAvatar } from '@autolabz/oauth-sdk';
import type { RoomInfo, RoleMapping } from '../lib/types';
import '../styles/control-bar.css';

interface NexusControlBarProps {
  room: RoomInfo;
  isOwner: boolean;
  gameName?: string;
  statusText?: string;
  roleMapping?: RoleMapping;
  onPlayPause?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
}

export const NexusControlBar: React.FC<NexusControlBarProps> = ({
  room,
  isOwner,
  gameName,
  statusText,
  roleMapping,
  onPlayPause,
  onStop,
  onRestart,
  onExit,
}) => {
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [showRoleMapping, setShowRoleMapping] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const isPlaying = room.room_status === 'playing';
  const isPaused = room.room_status === 'paused';

  // resume_locked 时也显示暂停/播放按钮
  const canTogglePlayPause = isOwner && (isPlaying || isPaused);
  const showActions = isOwner && (isPlaying || isPaused);

  const playerCount = Object.keys(room.player_list).length;
  const roleIds = roleMapping ? Object.keys(roleMapping) : [];

  const displayStatus = statusText || 
    (room.room_status === 'playing' ? '游戏进行中' :
     room.room_status === 'paused' ? (room.resume_locked ? '已停止' : '已暂停') :
     room.room_status === 'open' ? '准备中' : '');

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
                {Object.entries(room.player_list).map(([pid, player]) => (
                  <div key={pid} className="dropdown-item">
                    <span className="player-name">{player.display_name}</span>
                    <span className="player-type">{player.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 角色映射下拉菜单 */}
          {roleMapping && roleIds.length > 0 && (
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
                    const player = room.player_list[playerId];
                    return (
                      <div key={roleId} className="dropdown-item">
                        <span className="role-name">{roleId}</span>
                        <span className="arrow">→</span>
                        <span className="player-name">
                          {player?.display_name || '未分配'}
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
            {(gameName || room.game_id) && (
              <h2 className="game-name">{gameName || room.game_id}</h2>
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
          <div className="room-id-display room-id-desktop" title={`房间ID: ${room.room_id}`}>
            房间: {room.room_id}
          </div>

          {/* 头像组件 */}
          <div className="avatar-container">
            <AuthAvatar
              redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
              scope={import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi'}
              profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
            />
          </div>
        </div>
      </div>

      {/* 第二行：游戏信息行（移动端显示） */}
      <div className="control-bar-row-2">
        <div className="game-info-mobile">
          {(gameName || room.game_id) && displayStatus && (
            <span className="game-name-status">
              {gameName || room.game_id}: {displayStatus}
            </span>
          )}
        </div>
        <div className="room-id-display room-id-mobile" title={`房间ID: ${room.room_id}`}>
          {room.room_id}
        </div>
      </div>
    </div>
  );
};

