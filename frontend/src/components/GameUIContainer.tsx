/**
 * Game UI Container
 * Dynamically loads and renders game UI
 */

import React, { useState, useEffect } from 'react';
import { loadGameUI } from '../lib/game-ui-loader';
import type { GameUIComponent, GameUIProps } from '../lib/game-ui-types';

interface GameUIContainerProps extends Omit<GameUIProps, 'perspective'> {
  gameId: string;
  perspective: GameUIProps['perspective'] | null;
  uiConfig?: { mode: string; url: string; css?: string };
}

export const GameUIContainer: React.FC<GameUIContainerProps> = ({
  gameId,
  perspective,
  onAction,
  isMyTurn,
  readonly,
  metadata,
  uiConfig,
}) => {
  const [GameUI, setGameUI] = useState<GameUIComponent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const ui = await loadGameUI(gameId, uiConfig);

        if (!mounted) return;

        if (!ui) {
          setError(`Game UI not found for: ${gameId}`);
          setGameUI(null);
        } else {
          setGameUI(() => ui);
        }
      } catch (err) {
        if (!mounted) return;

        console.error('Failed to load game UI:', err);
        setError(`Failed to load game UI: ${err}`);
        setGameUI(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [gameId, uiConfig]);

  if (loading) {
    return (
      <div className="game-ui-container loading">
        <div className="spinner"></div>
        <p>Loading game UI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-ui-container error">
        <div className="error-message">
          <h3>Failed to Load Game UI</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!perspective) {
    return (
      <div className="game-ui-container waiting">
        <p>Waiting for game perspective...</p>
      </div>
    );
  }

  if (!GameUI) {
    return (
      <div className="game-ui-container error">
        <p>Game UI component not available</p>
      </div>
    );
  }

  return (
    <div className="game-ui-container">
      <GameUI
        perspective={perspective}
        onAction={onAction}
        isMyTurn={isMyTurn}
        readonly={readonly}
        metadata={metadata}
      />
    </div>
  );
};

