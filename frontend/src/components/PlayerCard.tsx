/**
 * Player Card
 * Displays player information
 */

import React from 'react';
import type { Player } from '../lib/types';

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

  return (
    <div className="player-card">
      <div className="player-icon">
        {isHuman ? '👤' : '🤖'}
      </div>
      
      <div className="player-info">
        <div className="player-name">{player.display_name}</div>
        <div className="player-type">
          {isHuman ? 'Human' : `LLM (${player.model_name})`}
        </div>
        <div className="player-status">
          Status: {player.status}
        </div>
      </div>

      {canRemove && onRemove && (
        <button
          onClick={() => onRemove(playerId)}
          className="remove-button secondary"
        >
          ×
        </button>
      )}
    </div>
  );
};

