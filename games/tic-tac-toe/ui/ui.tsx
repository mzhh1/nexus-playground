import React from 'react';
import styles from './ui.module.css';
import type { GameUIProps, Action } from '@nexusgame/game-sdk';

const TicTacToeUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const { current_state, your_role, action_space_definition } = perspective;
  const { board, winner, isDraw } = current_state;

  const resolveRoleId = (): string | null => {
    if (your_role.identity === 'Player X') return 'player_X';
    if (your_role.identity === 'Player O') return 'player_O';
    return null;
  };

  const isCellClickable = (row: number, col: number): boolean => {
    if (!isMyTurn || readonly || winner || isDraw) return false;
    const actionId = `place_${row}_${col}`;
    return action_space_definition.actions.some((a) => a.action_id === actionId);
  };

  const handleCellClick = (row: number, col: number) => {
    if (!isCellClickable(row, col)) return;
    const roleId = resolveRoleId();
    if (!roleId) return;

    onAction({
      action_id: `place_${row}_${col}`,
      role_id: roleId,
      params: {},
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.board}>
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.boardRow}>
            {row.map((cell, colIndex) => {
              const clickable = isCellClickable(rowIndex, colIndex);
              const symbol = cell ?? '';
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  className={`${styles.cell} ${clickable ? styles.clickable : ''} ${symbol === 'X' ? styles.x : symbol === 'O' ? styles.o : ''
                    }`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={!clickable}
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
