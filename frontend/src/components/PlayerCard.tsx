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
  const isBot = 'isBot' in player ? player.isBot : player.type !== 'human';
  const displayName = 'displayName' in player ? (player as any).displayName : player.display_name;
  const isBanned = 'status' in player && player.status === 'banned';

  // Determine status indicator
  const getStatusIndicator = () => {
    if (isBot) {
      // Bot/LLM players
      return {
        color: '#4ade80',    // green (bots always active for now)
        label: 'Active',
      };
    } else {
      // Human players
      let isOnline = false;
      if ('connected' in player) {
        isOnline = (player as any).connected;
      } else if ('status' in player) {
        isOnline = player.status === 'online';
      }

      const statusColors = {
        online: '#4ade80',    // green
        offline: '#94a3b8',   // gray
        banned: '#f87171',    // red
      };

      const status = isBanned ? 'banned' : (isOnline ? 'online' : 'offline');

      return {
        color: statusColors[status],
        label: status === 'online' ? 'Online' :
          status === 'offline' ? 'Offline' : 'Banned',
      };
    }
  };

  const statusIndicator = getStatusIndicator();

  return (
    <div className={styles.playerCard}>
      <div className={styles.playerIcon}>
        {!isBot ? '👤' : '🤖'}
      </div>

      <div className={styles.playerInfo}>
        <div className={styles.playerName}>
          {displayName}
          <span
            className={styles.statusDot}
            style={{ backgroundColor: statusIndicator.color }}
            title={statusIndicator.label}
          />
        </div>
        <div className={styles.playerType}>
          {!isBot ? 'Human' : `Bot`}
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

