/**
 * Player Card
 * Displays player information
 */

import React from 'react';
import type { Player } from '../lib/types';
import styles from './PlayerCard.module.css';

interface PlayerCardProps {
  player: Player;
  playerId: string;
  canRemove?: boolean;
  onRemove?: (playerId: string) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  playerId,
  canRemove = false,
  onRemove,
}) => {
  const isHuman = player.type === 'human';
  
  // Determine status indicator for human players
  const getStatusIndicator = () => {
    if (!isHuman) {
      // LLM players: show active/inactive/error status
      const statusColors = {
        active: '#4ade80',    // green
        inactive: '#94a3b8',  // gray
        error: '#f87171',     // red
      };
      return {
        color: statusColors[player.status] || '#94a3b8',
        label: player.status.charAt(0).toUpperCase() + player.status.slice(1),
      };
    } else {
      // Human players: show online/offline/banned status
      const statusColors = {
        online: '#4ade80',    // green
        offline: '#94a3b8',   // gray
        banned: '#f87171',    // red
      };
      return {
        color: statusColors[player.status] || '#94a3b8',
        label: player.status === 'online' ? 'Online' : 
               player.status === 'offline' ? 'Offline' : 'Banned',
      };
    }
  };

  const statusIndicator = getStatusIndicator();

  return (
    <div className={styles.playerCard}>
      <div className={styles.playerIcon}>
        {isHuman ? '👤' : '🤖'}
      </div>
      
      <div className={styles.playerInfo}>
        <div className={styles.playerName}>
          {player.display_name}
          <span 
            className={styles.statusDot}
            style={{ backgroundColor: statusIndicator.color }}
            title={statusIndicator.label}
          />
        </div>
        <div className={styles.playerType}>
          {isHuman ? 'Human' : `LLM (${player.model_name})`}
        </div>
        <div className={styles.playerStatus}>
          {statusIndicator.label}
        </div>
      </div>

      {canRemove && onRemove && (
        <button
          onClick={() => onRemove(playerId)}
          className={styles.removeButton}
        >
          ×
        </button>
      )}
    </div>
  );
};

