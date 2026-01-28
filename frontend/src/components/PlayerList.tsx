/**
 * Player List Component
 * Displays a responsive grid of player cards with player count
 */

import React from 'react';
import { PlayerCard } from './PlayerCard';
import type { Player } from '../lib/types';
import styles from './PlayerList.module.css';

interface PlayerListProps {
  players: Record<string, Player>;
  canRemove?: boolean;
  onRemove?: (playerId: string) => void;
  emptyMessage?: string;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  canRemove = false,
  onRemove,
  emptyMessage = '暂无玩家',
}) => {
  const playerEntries = Object.entries(players);
  const playerCount = playerEntries.length;

  if (playerCount === 0) {
    return (
      <div className={styles.playerListContainer}>
        <div className={styles.emptyState}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={styles.playerListContainer}>
      {/* Player Count Header */}
      <div className={styles.playerCount}>
        游戏人数:<span className={styles.count}>{playerCount}</span>
      </div>

      {/* Players Grid */}
      <div className={styles.playersGrid}>
        {playerEntries.map(([playerId, player]) => (
          <PlayerCard
            key={playerId}
            playerId={playerId}
            player={player}
            canRemove={canRemove}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};


