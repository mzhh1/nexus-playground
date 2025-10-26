/**
 * Nexus Control Bar
 * Platform-level controls (play/pause, player list, status)
 */

import React from 'react';
import type { RoomInfo, Player } from '../lib/types';
import '../styles/control-bar.module.css';

interface NexusControlBarProps {
  room: RoomInfo;
  isOwner: boolean;
  statusText?: string;
  onPlayPause?: () => void;
  onStop?: () => void;
  onExit?: () => void;
}

export const NexusControlBar: React.FC<NexusControlBarProps> = ({
  room,
  isOwner,
  statusText,
  onPlayPause,
  onStop,
  onExit,
}) => {
  const isPlaying = room.room_status === 'playing';
  const isPaused = room.room_status === 'paused';
  const isFinished = room.room_status === 'finished';
  const isOpen = room.room_status === 'open';

  const canTogglePlayPause = isOwner && (isPlaying || isPaused);
  const canStop = isOwner && (isPlaying || isPaused);

  return (
    <div className="nexus-control-bar">
      <div className="control-bar-left">
        <div className="game-info">
          {room.game_id && (
            <h2 className="game-name">{room.game_id}</h2>
          )}
          {statusText && (
            <p className="status-text">{statusText}</p>
          )}
          {!statusText && (
            <p className="status-text">
              Status: {room.room_status}
            </p>
          )}
        </div>
      </div>

      <div className="control-bar-center">
        <div className="player-list-summary">
          <span className="player-count">
            {Object.keys(room.player_list).length} Players
          </span>
        </div>
      </div>

      <div className="control-bar-right">
        {isOwner && canTogglePlayPause && (
          <button
            onClick={onPlayPause}
            className={isPlaying ? 'secondary' : ''}
          >
            {isPlaying ? '⏸ Pause' : '▶ Resume'}
          </button>
        )}

        {isOwner && canStop && (
          <button onClick={onStop} className="danger">
            ⏹ Stop
          </button>
        )}

        <button onClick={onExit} className="secondary">
          ← Exit
        </button>
      </div>
    </div>
  );
};

