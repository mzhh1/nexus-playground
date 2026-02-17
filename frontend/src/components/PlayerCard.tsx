/**
 * Player Card
 * Displays player information
 */

import React from 'react';
import type { ClientPlayerInfo } from '../hooks/useNexusEngine';
import styles from './PlayerCard.module.css';

interface PlayerCardProps {
  player: ClientPlayerInfo;
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

  // Determine status indicator
  const getStatusIndicator = () => {
    return {
      color: player.connected ? '#4ade80' : '#94a3b8',
      label: player.connected ? 'Online' : 'Offline',
    };
  };

  const statusIndicator = getStatusIndicator();

  return (
    <div className={styles.playerCard}>
      <div className={styles.playerIcon}>
        {isHuman ? '👤' : '🤖'}
      </div>

      <div className={styles.playerInfo}>
        <div className={styles.playerName}>
          {player.displayName}
          <span
            className={styles.statusDot}
            style={{ backgroundColor: statusIndicator.color }}
            title={statusIndicator.label}
          />
        </div>
        <div className={styles.playerType}>
          {isHuman ? 'Human' : `LLM (${player.modelName || 'Bot'})`}
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

