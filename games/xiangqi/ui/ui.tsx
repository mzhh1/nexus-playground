import React, { useState } from 'react';
import { XiangqiLogic } from '../logic/index';
import styles from './ui.module.css';
import type { GameUIProps } from '@nexus/game-sdk';

interface Piece {
  type: string;
  color: 'red' | 'black';
  char: string;
}

interface BoardState {
  board: (Piece | null)[][];
  myColor: 'red' | 'black';
  lastMove: { from: [number, number]; to: [number, number] } | null;
}

type AttackCounts = Record<string, number>;
const logic = new XiangqiLogic();

const XiangqiUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);
  const [attackCounts, setAttackCounts] = useState<AttackCounts>({});

  const state = perspective.current_state as BoardState;
  const { board, myColor, lastMove } = state;
  const allLegalActions = perspective.action_space_definition.actions;
  const shouldFlipBoard = myColor === 'black';

  const reverseTransformPos = (row: number, col: number): [number, number] => {
    if (shouldFlipBoard) return [9 - row, 8 - col];
    return [row, col];
  };

  const handlePositionClick = (displayRow: number, displayCol: number) => {
    if (readonly || !isMyTurn) return;

    const [row, col] = reverseTransformPos(displayRow, displayCol);
    const piece = board[row][col];

    if (selectedPos) {
      const [selectedRow, selectedCol] = selectedPos;
      if (selectedRow === row && selectedCol === col) {
        setSelectedPos(null);
        setLegalMoves([]);
        setAttackCounts({});
        return;
      }

      const actionId = `move_${selectedRow}${selectedCol}_to_${row}${col}`;
      const isLegalMove = allLegalActions.some((action) => action.action_id === actionId);
      if (isLegalMove) {
        onAction({
          action_id: actionId,
          role_id: perspective.your_role.identity,
        });
        setSelectedPos(null);
        setLegalMoves([]);
        setAttackCounts({});
        return;
      }

      if (piece && piece.color === myColor) {
        selectPiece(row, col);
        return;
      }

      setSelectedPos(null);
      setLegalMoves([]);
      setAttackCounts({});
    } else if (piece && piece.color === myColor) {
      selectPiece(row, col);
    }
  };

  const selectPiece = (row: number, col: number) => {
    setSelectedPos([row, col]);
    const moves: [number, number][] = [];

    allLegalActions.forEach((action) => {
      const match = action.action_id.match(/move_(\d)(\d)_to_(\d)(\d)/);
      if (!match) return;
      const fromRow = parseInt(match[1], 10);
      const fromCol = parseInt(match[2], 10);
      if (fromRow === row && fromCol === col) {
        moves.push([parseInt(match[3], 10), parseInt(match[4], 10)]);
      }
    });
    setLegalMoves(moves);

    const newAttackCounts: AttackCounts = {};
    const enemyColor = myColor === 'red' ? 'black' : 'red';
    const mockState: any = {
      ...state,
      players: ['player_red', 'player_black'],
      winner: null,
    };

    moves.forEach(([toRow, toCol]) => {
      const nextState = logic.cloneState(mockState);
      nextState.board[toRow][toCol] = nextState.board[row][col];
      nextState.board[row][col] = null;
      const count = logic.getAttackCountAtPosition(nextState, toRow, toCol, enemyColor);
      if (count > 0) newAttackCounts[`${toRow},${toCol}`] = count;
    });
    setAttackCounts(newAttackCounts);
  };

  const isLegalMove = (displayRow: number, displayCol: number): boolean => {
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return legalMoves.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (displayRow: number, displayCol: number): boolean => {
    if (!lastMove) return false;
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return (lastMove.from[0] === row && lastMove.from[1] === col) || (lastMove.to[0] === row && lastMove.to[1] === col);
  };

  const isSelected = (displayRow: number, displayCol: number): boolean => {
    if (!selectedPos) return false;
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return selectedPos[0] === row && selectedPos[1] === col;
  };

  return (
    <div className={styles['game-container']}>
      <div className={styles['game-board']}>
        <div className={styles['board-inner']}>
          <svg className={styles['board-lines']} viewBox="0 0 100 100" preserveAspectRatio="none">
            {Array.from({ length: 10 }).map((_, i) => {
              const y = (i / 9) * 100;
              const isEdge = i === 0 || i === 9;
              return <line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} stroke="#000" strokeWidth={isEdge ? '0.6' : '0.3'} />;
            })}

            {Array.from({ length: 9 }).map((_, i) => {
              const x = (i / 8) * 100;
              const isEdge = i === 0 || i === 8;
              const strokeWidth = isEdge ? '0.6' : '0.3';
              if (i >= 1 && i <= 7) {
                return (
                  <React.Fragment key={`v-${i}`}>
                    <line x1={x} y1="0" x2={x} y2={(4 / 9) * 100} stroke="#000" strokeWidth={strokeWidth} />
                    <line x1={x} y1={(5 / 9) * 100} x2={x} y2="100" stroke="#000" strokeWidth={strokeWidth} />
                  </React.Fragment>
                );
              }
              return <line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" stroke="#000" strokeWidth={strokeWidth} />;
            })}

            <line x1={(3 / 8) * 100} y1="0" x2={(5 / 8) * 100} y2={(2 / 9) * 100} stroke="#000" strokeWidth="0.3" />
            <line x1={(5 / 8) * 100} y1="0" x2={(3 / 8) * 100} y2={(2 / 9) * 100} stroke="#000" strokeWidth="0.3" />
            <line x1={(3 / 8) * 100} y1={(7 / 9) * 100} x2={(5 / 8) * 100} y2="100" stroke="#000" strokeWidth="0.3" />
            <line x1={(5 / 8) * 100} y1={(7 / 9) * 100} x2={(3 / 8) * 100} y2="100" stroke="#000" strokeWidth="0.3" />
          </svg>

          <div className={styles['river-text']}>
            <span className={styles['river-left']}>楚河</span>
            <span className={styles['river-right']}>漢界</span>
          </div>

          <div className={styles['pieces-container']}>
            {Array.from({ length: 10 }).map((_, displayRow) =>
              Array.from({ length: 9 }).map((_, displayCol) => {
                const [logicRow, logicCol] = reverseTransformPos(displayRow, displayCol);
                const piece = board[logicRow][logicCol];
                const x = (displayCol / 8) * 100;
                const y = (displayRow / 9) * 100;

                return (
                  <div
                    key={`${displayRow}-${displayCol}`}
                    className={`${styles['position']} ${isSelected(displayRow, displayCol) ? styles['selected'] : ''} ${isLegalMove(displayRow, displayCol) ? styles['legal-move'] : ''
                      } ${isLastMove(displayRow, displayCol) ? styles['last-move'] : ''}`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => handlePositionClick(displayRow, displayCol)}
                  >
                    {isLegalMove(displayRow, displayCol) && !piece && (
                      <>
                        <div className={styles['move-hint']} />
                        {attackCounts[`${logicRow},${logicCol}`] > 0 && (
                          <div className={styles['attack-count']}>{attackCounts[`${logicRow},${logicCol}`]}</div>
                        )}
                      </>
                    )}

                    {piece && (
                      <div
                        className={`${styles['piece']} ${styles[piece.color]} ${!isMyTurn || readonly || piece.color !== myColor ? styles['not-my-turn'] : ''
                          }`}
                      >
                        <span className={styles['piece-char']}>{piece.char}</span>
                        {isLegalMove(displayRow, displayCol) && attackCounts[`${logicRow},${logicCol}`] > 0 && (
                          <div className={`${styles['attack-count']} ${styles['on-piece']}`}>
                            {attackCounts[`${logicRow},${logicCol}`]}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default XiangqiUI;
