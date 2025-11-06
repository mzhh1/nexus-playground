/**
 * 中国象棋 (Xiangqi) Game Logic Implementation
 * A perfect information game for 2 players on a 10x9 board
 */

import {
  GameLogic,
  GameMetadata,
  GameState,
  InitContext,
  ActionSpec,
  Action,
  ActionResult,
  HistoryEvent,
  RolePerspective,
  isSpectator as isSpectatorRole,
} from '../../../backend/src/games/types.js';

// ============ Xiangqi Types ============

type PieceType = 'chariot' | 'horse' | 'elephant' | 'advisor' | 'general' | 'cannon' | 'soldier';
type PieceColor = 'red' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
  char: string; // 中文字符
}

interface XiangqiState extends GameState {
  board: (Piece | null)[][]; // 10x9 棋盘 (10行9列)
  currentRole: string; // "player_red" or "player_black"
  players: string[]; // [red_player_id, black_player_id]
  turn: number;
  winner: string | null;
  inCheck: boolean; // 当前玩家是否被将军
  lastMove: { from: [number, number]; to: [number, number] } | null;
}

// ============ Constants ============

const PIECE_CHARS = {
  red: {
    chariot: '車',
    horse: '馬',
    elephant: '相',
    advisor: '仕',
    general: '帥',
    cannon: '炮',
    soldier: '兵',
  },
  black: {
    chariot: '車',
    horse: '馬',
    elephant: '象',
    advisor: '士',
    general: '將',
    cannon: '炮',
    soldier: '卒',
  },
};

// ============ Game Logic Implementation ============

export class XiangqiLogic implements GameLogic {
  private readonly BOARD_ROWS = 10;
  private readonly BOARD_COLS = 9;

  getMetadata(): GameMetadata {
    return {
      id: 'xiangqi',
      name: '中国象棋',
      description: '中国象棋是一种两人对弈的策略棋类游戏。双方各有16枚棋子，目标是将死对方的将/帅。',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_red', 'player_black'],
      enable_llm_memory: false, // Perfect information game, no memory needed
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state;
        
        if (state.winner) {
          const winnerColor = state.winner === 'player_red' ? '红方' : '黑方';
          return `游戏结束 - ${winnerColor}获胜！`;
        }
        
        const currentColor = state.currentRole === 'player_red' ? '红方' : '黑方';
        const checkStatus = state.inCheck ? ' (被将军！)' : '';
        return `第 ${state.turn} 回合 - 轮到${currentColor}${checkStatus}`;
      },
    };
  }

  initState(ctx: InitContext): GameState {
    if (ctx.players.length !== 2) {
      throw new Error('Xiangqi requires exactly 2 players');
    }

    // 初始化棋盘，红方在下（行8-9），黑方在上（行0-1）
    const board: (Piece | null)[][] = Array(this.BOARD_ROWS)
      .fill(null)
      .map(() => Array(this.BOARD_COLS).fill(null));

    // 放置黑方棋子 (顶部，行0-2)
    this.placeInitialPieces(board, 'black', 0);
    
    // 放置红方棋子 (底部，行7-9)
    this.placeInitialPieces(board, 'red', 9);

    const state: XiangqiState = {
      board,
      currentRole: ctx.players[0], // 红方先行
      players: ctx.players,
      turn: 1,
      winner: null,
      inCheck: false,
      lastMove: null,
    };

    return state;
  }

  private placeInitialPieces(board: (Piece | null)[][], color: PieceColor, baseRow: number): void {
    const backRow = baseRow;
    const pawnRow = color === 'red' ? baseRow - 3 : baseRow + 3;
    const cannonRow = color === 'red' ? baseRow - 2 : baseRow + 2;

    // 第一排：車馬象士將士象馬車
    const backRowPieces: PieceType[] = ['chariot', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'chariot'];
    backRowPieces.forEach((type, col) => {
      board[backRow][col] = { type, color, char: PIECE_CHARS[color][type] };
    });

    // 炮：第3排的第2列和第8列
    board[cannonRow][1] = { type: 'cannon', color, char: PIECE_CHARS[color].cannon };
    board[cannonRow][7] = { type: 'cannon', color, char: PIECE_CHARS[color].cannon };

    // 兵/卒：第4排的0,2,4,6,8列
    [0, 2, 4, 6, 8].forEach(col => {
      board[pawnRow][col] = { type: 'soldier', color, char: PIECE_CHARS[color].soldier };
    });
  }

  getCurrentRole(state: GameState): string {
    const s = state as XiangqiState;
    return s.currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as XiangqiState;

    // 如果游戏结束或不是该角色的回合，返回空行动列表
    if (s.winner || s.currentRole !== roleId) {
      return { actions: [] };
    }

    const actions = [];
    const color = roleId === s.players[0] ? 'red' : 'black';

    // 遍历所有棋子，找出该玩家的所有合法移动
    for (let fromRow = 0; fromRow < this.BOARD_ROWS; fromRow++) {
      for (let fromCol = 0; fromCol < this.BOARD_COLS; fromCol++) {
        const piece = s.board[fromRow][fromCol];
        if (!piece || piece.color !== color) continue;

        // 获取该棋子的所有合法移动
        const moves = this.getPieceLegalMoves(s, fromRow, fromCol);
        
        for (const [toRow, toCol] of moves) {
          const actionId = `move_${fromRow}${fromCol}_to_${toRow}${toCol}`;
          const target = s.board[toRow][toCol];
          const targetDesc = target ? `吃${target.char}` : '移动';
          
          actions.push({
            action_id: actionId,
            description: `${piece.char} 从(${fromRow},${fromCol})${targetDesc}到(${toRow},${toCol})`,
            params_schema: null,
          });
        }
      }
    }

    return { actions };
  }

  private getPieceLegalMoves(state: XiangqiState, row: number, col: number): [number, number][] {
    const piece = state.board[row][col];
    if (!piece) return [];

    const moves: [number, number][] = [];

    switch (piece.type) {
      case 'chariot':
        moves.push(...this.getChariotMoves(state, row, col, piece.color));
        break;
      case 'horse':
        moves.push(...this.getHorseMoves(state, row, col, piece.color));
        break;
      case 'elephant':
        moves.push(...this.getElephantMoves(state, row, col, piece.color));
        break;
      case 'advisor':
        moves.push(...this.getAdvisorMoves(state, row, col, piece.color));
        break;
      case 'general':
        moves.push(...this.getGeneralMoves(state, row, col, piece.color));
        break;
      case 'cannon':
        moves.push(...this.getCannonMoves(state, row, col, piece.color));
        break;
      case 'soldier':
        moves.push(...this.getSoldierMoves(state, row, col, piece.color));
        break;
    }

    // 过滤掉会导致自己被将军的移动
    return moves.filter(([toRow, toCol]) => {
      return !this.wouldBeInCheckAfterMove(state, row, col, toRow, toCol);
    });
  }

  // 車（车）：横竖直线移动
  private getChariotMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (r >= 0 && r < this.BOARD_ROWS && c >= 0 && c < this.BOARD_COLS) {
        const target = state.board[r][c];
        
        if (!target) {
          moves.push([r, c]);
        } else {
          if (target.color !== color) {
            moves.push([r, c]); // 可以吃子
          }
          break; // 遇到棋子停止
        }
        
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  // 馬（马）：日字移动，检测蹩马腿
  private getHorseMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    
    // 马的8个可能移动方向，格式：[行偏移, 列偏移, 蹩马腿检查行偏移, 蹩马腿检查列偏移]
    const horseMoves = [
      [2, 1, 1, 0],   // 下右
      [2, -1, 1, 0],  // 下左
      [-2, 1, -1, 0], // 上右
      [-2, -1, -1, 0],// 上左
      [1, 2, 0, 1],   // 右下
      [-1, 2, 0, 1],  // 右上
      [1, -2, 0, -1], // 左下
      [-1, -2, 0, -1],// 左上
    ];

    for (const [dr, dc, blockR, blockC] of horseMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      const blockRow = row + blockR;
      const blockCol = col + blockC;

      // 检查目标位置是否在棋盘内
      if (toRow < 0 || toRow >= this.BOARD_ROWS || toCol < 0 || toCol >= this.BOARD_COLS) {
        continue;
      }

      // 检查是否被蹩马腿
      if (state.board[blockRow][blockCol]) {
        continue;
      }

      // 检查目标位置
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) {
        moves.push([toRow, toCol]);
      }
    }

    return moves;
  }

  // 象（相）：田字移动，不能过河，检测塞象眼
  private getElephantMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    
    // 象的4个可能移动方向
    const elephantMoves = [
      [2, 2, 1, 1],   // 右下
      [2, -2, 1, -1], // 左下
      [-2, 2, -1, 1], // 右上
      [-2, -2, -1, -1], // 左上
    ];

    for (const [dr, dc, blockR, blockC] of elephantMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      const blockRow = row + blockR;
      const blockCol = col + blockC;

      // 检查目标位置是否在棋盘内
      if (toRow < 0 || toRow >= this.BOARD_ROWS || toCol < 0 || toCol >= this.BOARD_COLS) {
        continue;
      }

      // 检查是否过河
      const canCrossRiver = color === 'red' ? toRow >= 5 : toRow <= 4;
      if (!canCrossRiver) {
        continue;
      }

      // 检查是否被塞象眼
      if (state.board[blockRow][blockCol]) {
        continue;
      }

      // 检查目标位置
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) {
        moves.push([toRow, toCol]);
      }
    }

    return moves;
  }

  // 士（仕）：斜线移动，限九宫格
  private getAdvisorMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const advisorMoves = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    for (const [dr, dc] of advisorMoves) {
      const toRow = row + dr;
      const toCol = col + dc;

      // 检查是否在九宫格内
      if (!this.isInPalace(toRow, toCol, color)) {
        continue;
      }

      // 检查目标位置
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) {
        moves.push([toRow, toCol]);
      }
    }

    return moves;
  }

  // 將（帅）：横竖一步，限九宫格
  private getGeneralMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const generalMoves = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of generalMoves) {
      const toRow = row + dr;
      const toCol = col + dc;

      // 检查是否在九宫格内
      if (!this.isInPalace(toRow, toCol, color)) {
        continue;
      }

      // 检查目标位置
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) {
        moves.push([toRow, toCol]);
      }
    }

    // 检查将帅是否会对面（特殊规则）
    return moves.filter(([toRow, toCol]) => {
      return !this.wouldGeneralsFaceEachOther(state, row, col, toRow, toCol);
    });
  }

  // 炮：隔子吃子
  private getCannonMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      let foundPiece = false;

      while (r >= 0 && r < this.BOARD_ROWS && c >= 0 && c < this.BOARD_COLS) {
        const target = state.board[r][c];
        
        if (!foundPiece) {
          // 还没遇到棋子，可以移动到空位
          if (!target) {
            moves.push([r, c]);
          } else {
            foundPiece = true; // 遇到第一个棋子
          }
        } else {
          // 已经遇到一个棋子，寻找可以吃的目标
          if (target) {
            if (target.color !== color) {
              moves.push([r, c]); // 可以吃子
            }
            break;
          }
        }
        
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  // 兵/卒：前进一步，过河后可左右移动
  private getSoldierMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const forward = color === 'red' ? -1 : 1;
    const hasCrossedRiver = color === 'red' ? row <= 4 : row >= 5;

    // 前进
    const forwardRow = row + forward;
    if (forwardRow >= 0 && forwardRow < this.BOARD_ROWS) {
      const target = state.board[forwardRow][col];
      if (!target || target.color !== color) {
        moves.push([forwardRow, col]);
      }
    }

    // 过河后可以左右移动
    if (hasCrossedRiver) {
      for (const dc of [-1, 1]) {
        const sideCol = col + dc;
        if (sideCol >= 0 && sideCol < this.BOARD_COLS) {
          const target = state.board[row][sideCol];
          if (!target || target.color !== color) {
            moves.push([row, sideCol]);
          }
        }
      }
    }

    return moves;
  }

  // 检查位置是否在九宫格内
  private isInPalace(row: number, col: number, color: PieceColor): boolean {
    if (col < 3 || col > 5) return false;
    
    if (color === 'red') {
      return row >= 7 && row <= 9;
    } else {
      return row >= 0 && row <= 2;
    }
  }

  // 检查将帅是否会对面
  private wouldGeneralsFaceEachOther(state: XiangqiState, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // 创建临时棋盘
    const tempBoard = state.board.map(row => [...row]);
    tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
    tempBoard[fromRow][fromCol] = null;

    // 找到两个将的位置
    let redGeneralPos: [number, number] | null = null;
    let blackGeneralPos: [number, number] | null = null;

    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = tempBoard[r][c];
        if (piece && piece.type === 'general') {
          if (piece.color === 'red') {
            redGeneralPos = [r, c];
          } else {
            blackGeneralPos = [r, c];
          }
        }
      }
    }

    if (!redGeneralPos || !blackGeneralPos) return false;

    // 检查是否在同一列
    if (redGeneralPos[1] !== blackGeneralPos[1]) return false;

    // 检查之间是否没有其他棋子
    const minRow = Math.min(redGeneralPos[0], blackGeneralPos[0]);
    const maxRow = Math.max(redGeneralPos[0], blackGeneralPos[0]);
    const col = redGeneralPos[1];

    for (let r = minRow + 1; r < maxRow; r++) {
      if (tempBoard[r][col]) return false;
    }

    return true; // 将帅对面
  }

  // 检查移动后是否会被将军
  private wouldBeInCheckAfterMove(state: XiangqiState, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // 创建临时状态
    const tempState = this.cloneState(state);
    tempState.board[toRow][toCol] = tempState.board[fromRow][fromCol];
    tempState.board[fromRow][fromCol] = null;

    const movingPiece = tempState.board[toRow][toCol];
    if (!movingPiece) return false;

    return this.isInCheck(tempState, movingPiece.color);
  }

  // 检查指定颜色的将是否被将军
  private isInCheck(state: XiangqiState, color: PieceColor): boolean {
    // 找到己方将的位置
    let generalPos: [number, number] | null = null;
    
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (piece && piece.type === 'general' && piece.color === color) {
          generalPos = [r, c];
          break;
        }
      }
      if (generalPos) break;
    }

    if (!generalPos) return false;

    // 检查是否有对方棋子可以攻击到将
    const opponentColor = color === 'red' ? 'black' : 'red';
    
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (!piece || piece.color !== opponentColor) continue;

        // 获取该棋子的所有可能移动（不考虑将军检查，避免无限递归）
        const moves = this.getPieceRawMoves(state, r, c);
        
        if (moves.some(([mr, mc]) => mr === generalPos![0] && mc === generalPos![1])) {
          return true;
        }
      }
    }

    return false;
  }

  // 获取棋子的原始移动（不检查是否会导致自己被将军）
  private getPieceRawMoves(state: XiangqiState, row: number, col: number): [number, number][] {
    const piece = state.board[row][col];
    if (!piece) return [];

    switch (piece.type) {
      case 'chariot':
        return this.getChariotMoves(state, row, col, piece.color);
      case 'horse':
        return this.getHorseMoves(state, row, col, piece.color);
      case 'elephant':
        return this.getElephantMoves(state, row, col, piece.color);
      case 'advisor':
        return this.getAdvisorMoves(state, row, col, piece.color);
      case 'general':
        return this.getGeneralMoves(state, row, col, piece.color);
      case 'cannon':
        return this.getCannonMoves(state, row, col, piece.color);
      case 'soldier':
        return this.getSoldierMoves(state, row, col, piece.color);
      default:
        return [];
    }
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const s = this.cloneState(state as XiangqiState);

    // 解析行动
    const match = action.action_id.match(/move_(\d)(\d)_to_(\d)(\d)/);
    if (!match) {
      return { success: false, error: '无效的行动格式' };
    }

    const fromRow = parseInt(match[1]);
    const fromCol = parseInt(match[2]);
    const toRow = parseInt(match[3]);
    const toCol = parseInt(match[4]);

    // 验证移动
    const piece = s.board[fromRow][fromCol];
    if (!piece) {
      return { success: false, error: '起始位置没有棋子' };
    }

    const currentColor = s.currentRole === s.players[0] ? 'red' : 'black';
    if (piece.color !== currentColor) {
      return { success: false, error: '不能移动对方的棋子' };
    }

    // 检查移动是否合法
    const legalMoves = this.getPieceLegalMoves(s, fromRow, fromCol);
    const isLegal = legalMoves.some(([r, c]) => r === toRow && c === toCol);
    if (!isLegal) {
      return { success: false, error: '非法移动' };
    }

    // 执行移动
    s.board[toRow][toCol] = s.board[fromRow][fromCol];
    s.board[fromRow][fromCol] = null;
    s.lastMove = { from: [fromRow, fromCol], to: [toRow, toCol] };

    // 切换回合
    const currentIndex = s.players.indexOf(s.currentRole);
    s.currentRole = s.players[(currentIndex + 1) % s.players.length];
    s.turn++;

    // 检查下一个玩家是否被将军
    const nextColor = s.currentRole === s.players[0] ? 'red' : 'black';
    s.inCheck = this.isInCheck(s, nextColor);

    // 检查是否困毙（无论是否被将军，只要没有合法移动就判负）
    const hasLegalMoves = this.hasAnyLegalMoves(s, nextColor);
    if (!hasLegalMoves) {
      // 困毙，当前移动的玩家获胜
      s.winner = s.players[(currentIndex) % s.players.length];
    }

    return { success: true, nextState: s };
  }

  // 检查指定颜色是否有任何合法移动
  private hasAnyLegalMoves(state: XiangqiState, color: PieceColor): boolean {
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (piece && piece.color === color) {
          const moves = this.getPieceLegalMoves(state, r, c);
          if (moves.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  isTerminal(state: GameState): boolean {
    const s = state as XiangqiState;
    return s.winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as XiangqiState;
    return s.winner ? [s.winner] : null;
  }

  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as XiangqiState;
    
    // Check if this is a spectator (role not in the game)
    const isSpectator = isSpectatorRole(roleId);
    
    const color = isSpectator 
      ? 'red' // Default to red perspective for spectators
      : (roleId === s.players[0] ? 'red' : 'black');
    const colorName = color === 'red' ? '红方' : '黑方';
    const opponentColor = color === 'red' ? '黑方' : '红方';
    const currentColorName = s.currentRole === s.players[0] ? '红方' : '黑方';

    // 生成消息
    let message = '';
    
    if (isSpectator) {
      // Spectator messages
      if (s.winner) {
        const winnerColor = s.winner === s.players[0] ? '红方' : '黑方';
        message = `👀 观战模式 - ${winnerColor}获胜！`;
      } else {
        if (s.inCheck) {
          message = `👀 观战模式 - ${currentColorName}被将军了！`;
        } else {
          message = `👀 观战模式 - 轮到${currentColorName}`;
        }
      }
    } else {
      // Player messages
      if (s.winner) {
        if (s.winner === roleId) {
          message = '🎉 游戏结束 - 你获胜了！';
        } else {
          message = `😔 游戏结束 - ${opponentColor}获胜`;
        }
      } else if (s.currentRole === roleId) {
        if (s.inCheck) {
          message = `⚠️ 你被将军了！请应将（${colorName}）`;
        } else {
          message = `✨ 轮到你了（${colorName}），请选择棋子移动`;
        }
      } else {
        message = `⏳ 等待${opponentColor}行动...`;
      }
    }

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        board: s.board,
        turn: s.turn,
        currentRole: s.currentRole,
        inCheck: s.inCheck,
        lastMove: s.lastMove,
        myColor: color,
      },
      your_role: {
        identity: isSpectator 
          ? 'Spectator (观战者)' 
          : roleId,
        goal: isSpectator 
          ? '观看对局，学习象棋策略。' 
          : `作为${colorName}，将死对方的将/帅`,
        is_current: isSpectator ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message,
    };
  }

  // 辅助函数：深拷贝状态
  private cloneState(state: XiangqiState): XiangqiState {
    return {
      ...state,
      board: state.board.map(row => row.map(piece => piece ? { ...piece } : null)),
      players: [...state.players],
      lastMove: state.lastMove ? { ...state.lastMove } : null,
    };
  }
}

// 导出实例
const xiangqiLogic = new XiangqiLogic();
export default xiangqiLogic;

