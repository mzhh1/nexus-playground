/**
 * Tic-Tac-Toe UI Component
 * Interactive 3x3 grid for tic-tac-toe game
 */

import React from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';
import type { Action } from '../../../frontend/src/lib/types';
import styles from './ui.module.css';

const TicTacToeUI: React.FC<GameUIProps> = ({
  perspective,
  onAction,
  isMyTurn,
  readonly,
}) => {
  const { current_state, your_role, action_space_definition } = perspective;
  const { board, winner, isDraw } = current_state;

  /**
   * Handle cell click
   */
  const handleCellClick = (row: number, col: number) => {
    // Can't click if not my turn or in readonly mode
    if (!isMyTurn || readonly) {
      return;
    }

    // Check if this cell is a valid action
    const actionId = `place_${row}_${col}`;
    const isValid = action_space_definition.actions.some(
      (a) => a.action_id === actionId
    );

    if (!isValid) {
      return;
    }

    // Submit action
    const action: Action = {
      action_id: actionId,
      role_id: your_role.identity === 'Player X' ? 'player_X' : 'player_O',
      params: {},
    };

    onAction(action);
  };

  /**
   * Check if cell is clickable
   */
  const isCellClickable = (row: number, col: number): boolean => {
    if (!isMyTurn || readonly) {
      return false;
    }

    const actionId = `place_${row}_${col}`;
    return action_space_definition.actions.some(
      (a) => a.action_id === actionId
    );
  };

  /**
   * Get cell symbol
   */
  const getCellSymbol = (value: string | null): string => {
    if (value === 'X') return 'X';
    if (value === 'O') return 'O';
    return '';
  };

  return (
    <div className={styles['tic-tac-toe-ui']}>
      {/* Status message is now handled by platform's unified message bar */}

      <div className={styles['tic-tac-toe-board']}>
        {board.map((row: (string | null)[], rowIndex: number) => (
          <div key={rowIndex} className={styles['board-row']}>
            {row.map((cell: string | null, colIndex: number) => {
              const isClickable = isCellClickable(rowIndex, colIndex);
              const symbol = getCellSymbol(cell);

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  className={`${styles['board-cell']} ${symbol ? styles[symbol.toLowerCase()] : ''} ${
                    isClickable ? styles.clickable : ''
                  }`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={!isClickable}
                  aria-label={`Cell ${rowIndex}-${colIndex}`}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicTacToeUI;

