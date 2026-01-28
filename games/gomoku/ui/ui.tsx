/**
 * Gomoku UI Component
 * Interactive board with stones placed on intersections (15x15 grid)
 */

import React from 'react';
import type { GameUIProps, Action } from '@nexus/game-sdk';
import styles from './ui.module.css';

interface GomokuState {
  board: (0 | 1 | 2)[][];
  currentRole: string;
  turn: number;
  winner: string | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null;
}

const GomokuUI: React.FC<GameUIProps> = ({
  perspective,
  onAction,
  isMyTurn,
  readonly,
}) => {
  const { current_state, your_role, action_space_definition } = perspective;
  const state = current_state as GomokuState;
  const { board, lastMove } = state;

  /**
   * Handle intersection click
   */
  const handleIntersectionClick = (row: number, col: number) => {
    if (!isMyTurn || readonly) {
      return;
    }

    // Check if 'place' action is available (parameterized action)
    const placeAction = action_space_definition.actions.find(
      (a) => a.action_id === 'place'
    );

    if (!placeAction) {
      return;
    }

    // Check if the cell is empty (0 = empty)
    if (board[row][col] !== 0) {
      return;
    }

    // Determine role_id from identity
    let role_id: string;
    if (your_role.identity === 'Player Black') {
      role_id = 'player_black';
    } else if (your_role.identity === 'Player White') {
      role_id = 'player_white';
    } else {
      // Spectator or unknown role - should not be able to click
      return;
    }

    const action: Action = {
      action_id: 'place',
      role_id: role_id,
      params: { row, col },
    };

    onAction(action);
  };

  /**
   * Check if intersection is clickable
   */
  const isIntersectionClickable = (row: number, col: number): boolean => {
    if (!isMyTurn || readonly) {
      return false;
    }

    // Check if 'place' action is available and the cell is empty (0 = empty)
    const placeAction = action_space_definition.actions.find(
      (a) => a.action_id === 'place'
    );

    return placeAction !== undefined && board[row][col] === 0;
  };

  /**
   * Check if intersection is the last move
   */
  const isLastMove = (row: number, col: number): boolean => {
    return lastMove !== null && lastMove.row === row && lastMove.col === col;
  };

  /**
   * Get stone type at position
   * Board encoding: 0 = empty, 1 = black, 2 = white
   */
  const getStoneType = (value: number): 'black' | 'white' | null => {
    if (value === 1) return 'black';
    if (value === 2) return 'white';
    return null;
  };

  return (
    <div className={styles['gomoku-container']}>
      <div className={styles['gomoku-board']}>
        {/* Render grid lines */}
        <svg className={styles['board-lines']} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Horizontal lines */}
          {Array.from({ length: 15 }).map((_, i) => {
            const y = (i / 14) * 100;
            return (
              <line
                key={`h-${i}`}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#000"
                strokeWidth="0.3"
              />
            );
          })}
          {/* Vertical lines */}
          {Array.from({ length: 15 }).map((_, i) => {
            const x = (i / 14) * 100;
            return (
              <line
                key={`v-${i}`}
                x1={x}
                y1="0"
                x2={x}
                y2="100"
                stroke="#000"
                strokeWidth="0.3"
              />
            );
          })}
        </svg>

        {/* Render star points (traditional markers) */}
        <div className={styles['star-points']}>
          {[3, 7, 11].map((row) =>
            [3, 7, 11].map((col) => (
              <div
                key={`star-${row}-${col}`}
                className={styles['star-point']}
                style={{
                  left: `${(col / 14) * 100}%`,
                  top: `${(row / 14) * 100}%`,
                }}
              />
            ))
          )}
        </div>

        {/* Render intersections and stones */}
        <div className={styles['intersections']}>
          {board.map((row: number[], rowIndex: number) =>
            row.map((cell: number, colIndex: number) => {
              const isClickable = isIntersectionClickable(rowIndex, colIndex);
              const stoneType = getStoneType(cell);
              const isLast = isLastMove(rowIndex, colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`${styles['intersection']} ${isClickable ? styles['clickable'] : ''
                    }`}
                  style={{
                    left: `${(colIndex / 14) * 100}%`,
                    top: `${(rowIndex / 14) * 100}%`,
                  }}
                  onClick={() => handleIntersectionClick(rowIndex, colIndex)}
                >
                  {stoneType && (
                    <div
                      className={`${styles['stone']} ${styles[stoneType]} ${isLast ? styles['last-move'] : ''
                        }`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default GomokuUI;

