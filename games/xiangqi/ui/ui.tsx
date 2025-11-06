/**
 * 中国象棋 (Xiangqi) UI Component
 * Traditional Chinese Chess board with responsive layout
 */

import React, { useState } from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';
import styles from './ui.module.css';

interface Piece {
  type: string;
  color: 'red' | 'black';
  char: string;
}

interface BoardState {
  board: (Piece | null)[][];
  turn: number;
  currentRole: string;
  inCheck: boolean;
  lastMove: { from: [number, number]; to: [number, number] } | null;
  myColor: 'red' | 'black';
}

const XiangqiUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);

  const state = perspective.current_state as BoardState;
  const { board, myColor, lastMove } = state;

  // 从action_space_definition获取所有合法移动
  const allLegalActions = perspective.action_space_definition.actions;

  // 执黑方时翻转棋盘，使自己在下方
  const shouldFlipBoard = myColor === 'black';

  // 坐标转换（从显示坐标到逻辑坐标）
  const reverseTransformPos = (row: number, col: number): [number, number] => {
    if (shouldFlipBoard) {
      return [9 - row, 8 - col];
    }
    return [row, col];
  };

  const handlePositionClick = (displayRow: number, displayCol: number) => {
    if (readonly || !isMyTurn) return;

    // 将显示坐标转换为逻辑坐标
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    const piece = board[row][col];

    // 如果已经选中了一个棋子
    if (selectedPos) {
      const [selectedRow, selectedCol] = selectedPos;
      
      // 如果点击的是选中的棋子，取消选择
      if (selectedRow === row && selectedCol === col) {
        setSelectedPos(null);
        setLegalMoves([]);
        return;
      }

      // 检查是否是合法移动
      const actionId = `move_${selectedRow}${selectedCol}_to_${row}${col}`;
      const isLegalMove = allLegalActions.some(action => action.action_id === actionId);

      if (isLegalMove) {
        // 执行移动
        onAction({
          action_id: actionId,
          role_id: perspective.your_role.identity,
        });
        setSelectedPos(null);
        setLegalMoves([]);
        return;
      }

      // 如果点击的是己方棋子，切换选择
      if (piece && piece.color === myColor) {
        selectPiece(row, col);
        return;
      }

      // 其他情况，取消选择
      setSelectedPos(null);
      setLegalMoves([]);
    } else {
      // 选择棋子
      if (piece && piece.color === myColor) {
        selectPiece(row, col);
      }
    }
  };

  const selectPiece = (row: number, col: number) => {
    setSelectedPos([row, col]);

    // 获取该棋子的所有合法移动
    const moves: [number, number][] = [];
    allLegalActions.forEach(action => {
      const match = action.action_id.match(/move_(\d)(\d)_to_(\d)(\d)/);
      if (match) {
        const fromRow = parseInt(match[1]);
        const fromCol = parseInt(match[2]);
        if (fromRow === row && fromCol === col) {
          moves.push([parseInt(match[3]), parseInt(match[4])]);
        }
      }
    });
    setLegalMoves(moves);
  };

  const isLegalMove = (displayRow: number, displayCol: number): boolean => {
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return legalMoves.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (displayRow: number, displayCol: number): boolean => {
    if (!lastMove) return false;
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return (
      (lastMove.from[0] === row && lastMove.from[1] === col) ||
      (lastMove.to[0] === row && lastMove.to[1] === col)
    );
  };

  const isSelected = (displayRow: number, displayCol: number): boolean => {
    if (!selectedPos) return false;
    const [row, col] = reverseTransformPos(displayRow, displayCol);
    return selectedPos[0] === row && selectedPos[1] === col;
  };

  return (
    <div className={styles['game-container']}>
      <div className={styles['game-board']}>
        {/* 棋盘背景和线条 */}
        <svg className={styles['board-lines']} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* 横线（10条） */}
          {Array.from({ length: 10 }).map((_, i) => {
            const y = (i / 9) * 100;  // 行0-9，均匀分布在0%-100%
            // 边缘线（第0行和第9行）使用与内部线一致的粗细
            const isEdge = i === 0 || i === 9;
            return (
              <line
                key={`h-${i}`}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#000"
                strokeWidth={isEdge ? "0.6" : "0.3"}
              />
            );
          })}
          
          {/* 竖线（9条） */}
          {Array.from({ length: 9 }).map((_, i) => {
            const x = (i / 8) * 100;  // 列0-8，均匀分布在0%-100%
            // 边缘线（第0列和第8列）使用与内部线一致的粗细
            const isEdge = i === 0 || i === 8;
            const strokeWidth = isEdge ? "0.6" : "0.3";
            
            // 中间7条竖线（第1-7列）在楚河汉界处断开
            if (i >= 1 && i <= 7) {
              return (
                <React.Fragment key={`v-${i}`}>
                  <line x1={x} y1="0" x2={x} y2={(4 / 9) * 100} stroke="#000" strokeWidth={strokeWidth} />
                  <line x1={x} y1={(5 / 9) * 100} x2={x} y2="100" stroke="#000" strokeWidth={strokeWidth} />
                </React.Fragment>
              );
            } else {
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  stroke="#000"
                  strokeWidth={strokeWidth}
                />
              );
            }
          })}

          {/* 九宫格对角线 - 上方（黑方），列3-5，行0-2，米字形 */}
          {/* 左上到右下 */}
          <line 
            x1={(3 / 8) * 100} 
            y1="0" 
            x2={(5 / 8) * 100} 
            y2={(2 / 9) * 100} 
            stroke="#000" 
            strokeWidth="0.3" 
          />
          {/* 右上到左下 */}
          <line 
            x1={(5 / 8) * 100} 
            y1="0" 
            x2={(3 / 8) * 100} 
            y2={(2 / 9) * 100} 
            stroke="#000" 
            strokeWidth="0.3" 
          />

          {/* 九宫格对角线 - 下方（红方），列3-5，行7-9，米字形 */}
          {/* 左上到右下 */}
          <line 
            x1={(3 / 8) * 100} 
            y1={(7 / 9) * 100} 
            x2={(5 / 8) * 100} 
            y2="100" 
            stroke="#000" 
            strokeWidth="0.3" 
          />
          {/* 右上到左下 */}
          <line 
            x1={(5 / 8) * 100} 
            y1={(7 / 9) * 100} 
            x2={(3 / 8) * 100} 
            y2="100" 
            stroke="#000" 
            strokeWidth="0.3" 
          />
        </svg>

        {/* 楚河汉界文字 */}
        <div className={styles['river-text']}>
          <span className={styles['river-left']}>楚河</span>
          <span className={styles['river-right']}>漢界</span>
        </div>

        {/* 棋子和交点 */}
        <div className={styles['pieces-container']}>
          {Array.from({ length: 10 }).map((_, displayRow) =>
            Array.from({ length: 9 }).map((_, displayCol) => {
              // 将显示坐标转换为逻辑坐标，获取对应的棋子
              const [logicRow, logicCol] = reverseTransformPos(displayRow, displayCol);
              const piece = board[logicRow][logicCol];

              // 棋子应该放在交点上，对应SVG线条的交点
              const x = (displayCol / 8) * 100;  // 列0=0%, 列8=100%
              const y = (displayRow / 9) * 100;  // 行0=0%, 行9=100%

              return (
                <div
                  key={`${displayRow}-${displayCol}`}
                  className={`${styles['position']} ${
                    isSelected(displayRow, displayCol) ? styles['selected'] : ''
                  } ${isLegalMove(displayRow, displayCol) ? styles['legal-move'] : ''} ${
                    isLastMove(displayRow, displayCol) ? styles['last-move'] : ''
                  }`}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                  }}
                  onClick={() => handlePositionClick(displayRow, displayCol)}
                >
                  {/* 合法移动提示点 */}
                  {isLegalMove(displayRow, displayCol) && !piece && (
                    <div className={styles['move-hint']} />
                  )}

                  {/* 棋子 */}
                  {piece && (
                    <div
                      className={`${styles['piece']} ${styles[piece.color]} ${
                        !isMyTurn || readonly || piece.color !== myColor
                          ? styles['not-my-turn']
                          : ''
                      }`}
                    >
                      <span className={styles['piece-char']}>{piece.char}</span>
                    </div>
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

export default XiangqiUI;

