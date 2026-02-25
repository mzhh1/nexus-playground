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
} from '@nexusgame/game-sdk';

type PieceType = 'chariot' | 'horse' | 'elephant' | 'advisor' | 'general' | 'cannon' | 'soldier';
type PieceColor = 'red' | 'black';

interface Piece {
  type: PieceType;
  color: PieceColor;
  char: string;
}

interface XiangqiState extends GameState {
  board: (Piece | null)[][];
  currentRole: string;
  players: string[];
  turn: number;
  winner: string | null;
  inCheck: boolean;
  lastMove: { from: [number, number]; to: [number, number] } | null;
}

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
      enable_llm_memory: false,
      auto_save_mode: 'enabled',
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state as XiangqiState;
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

    const board: (Piece | null)[][] = Array(this.BOARD_ROWS)
      .fill(null)
      .map(() => Array(this.BOARD_COLS).fill(null));

    this.placeInitialPieces(board, 'black', 0);
    this.placeInitialPieces(board, 'red', 9);

    let startRole = 'player_red';
    if (!ctx.players.includes('player_red')) {
      startRole = ctx.players[0];
    }

    return {
      board,
      currentRole: startRole,
      players: ctx.players,
      turn: 1,
      winner: null,
      inCheck: false,
      lastMove: null,
    };
  }

  private placeInitialPieces(board: (Piece | null)[][], color: PieceColor, baseRow: number): void {
    const backRow = baseRow;
    const pawnRow = color === 'red' ? baseRow - 3 : baseRow + 3;
    const cannonRow = color === 'red' ? baseRow - 2 : baseRow + 2;

    const backRowPieces: PieceType[] = [
      'chariot',
      'horse',
      'elephant',
      'advisor',
      'general',
      'advisor',
      'elephant',
      'horse',
      'chariot',
    ];
    backRowPieces.forEach((type, col) => {
      board[backRow][col] = { type, color, char: PIECE_CHARS[color][type] };
    });

    board[cannonRow][1] = { type: 'cannon', color, char: PIECE_CHARS[color].cannon };
    board[cannonRow][7] = { type: 'cannon', color, char: PIECE_CHARS[color].cannon };

    [0, 2, 4, 6, 8].forEach((col) => {
      board[pawnRow][col] = { type: 'soldier', color, char: PIECE_CHARS[color].soldier };
    });
  }

  getCurrentRole(state: GameState): string {
    return (state as XiangqiState).currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as XiangqiState;
    if (s.winner || s.currentRole !== roleId) {
      return { actions: [] };
    }

    const actions: NonNullable<ActionSpec['actions']> = [];

    let color: PieceColor;
    if (roleId === 'player_red') color = 'red';
    else if (roleId === 'player_black') color = 'black';
    else color = roleId === s.players[0] ? 'red' : 'black';

    for (let fromRow = 0; fromRow < this.BOARD_ROWS; fromRow++) {
      for (let fromCol = 0; fromCol < this.BOARD_COLS; fromCol++) {
        const piece = s.board[fromRow][fromCol];
        if (!piece || piece.color !== color) continue;

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

    return moves.filter(([toRow, toCol]) => !this.wouldBeInCheckAfterMove(state, row, col, toRow, toCol));
  }

  private getChariotMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (r >= 0 && r < this.BOARD_ROWS && c >= 0 && c < this.BOARD_COLS) {
        const target = state.board[r][c];
        if (!target) {
          moves.push([r, c]);
        } else {
          if (target.color !== color) moves.push([r, c]);
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  private getHorseMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const horseMoves = [
      [2, 1, 1, 0],
      [2, -1, 1, 0],
      [-2, 1, -1, 0],
      [-2, -1, -1, 0],
      [1, 2, 0, 1],
      [-1, 2, 0, 1],
      [1, -2, 0, -1],
      [-1, -2, 0, -1],
    ];

    for (const [dr, dc, blockR, blockC] of horseMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      const blockRow = row + blockR;
      const blockCol = col + blockC;

      if (toRow < 0 || toRow >= this.BOARD_ROWS || toCol < 0 || toCol >= this.BOARD_COLS) continue;
      if (state.board[blockRow][blockCol]) continue;

      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) moves.push([toRow, toCol]);
    }
    return moves;
  }

  private getElephantMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const elephantMoves = [
      [2, 2, 1, 1],
      [2, -2, 1, -1],
      [-2, 2, -1, 1],
      [-2, -2, -1, -1],
    ];

    for (const [dr, dc, blockR, blockC] of elephantMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      const blockRow = row + blockR;
      const blockCol = col + blockC;

      if (toRow < 0 || toRow >= this.BOARD_ROWS || toCol < 0 || toCol >= this.BOARD_COLS) continue;
      const canCrossRiver = color === 'red' ? toRow >= 5 : toRow <= 4;
      if (!canCrossRiver) continue;
      if (state.board[blockRow][blockCol]) continue;

      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) moves.push([toRow, toCol]);
    }
    return moves;
  }

  private getAdvisorMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const advisorMoves = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (const [dr, dc] of advisorMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (!this.isInPalace(toRow, toCol, color)) continue;
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) moves.push([toRow, toCol]);
    }
    return moves;
  }

  private getGeneralMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const generalMoves = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dr, dc] of generalMoves) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (!this.isInPalace(toRow, toCol, color)) continue;
      const target = state.board[toRow][toCol];
      if (!target || target.color !== color) moves.push([toRow, toCol]);
    }

    return moves.filter(([toRow, toCol]) => !this.wouldGeneralsFaceEachOther(state, row, col, toRow, toCol));
  }

  private getCannonMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const directions = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      let foundPiece = false;

      while (r >= 0 && r < this.BOARD_ROWS && c >= 0 && c < this.BOARD_COLS) {
        const target = state.board[r][c];
        if (!foundPiece) {
          if (!target) moves.push([r, c]);
          else foundPiece = true;
        } else if (target) {
          if (target.color !== color) moves.push([r, c]);
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  private getSoldierMoves(state: XiangqiState, row: number, col: number, color: PieceColor): [number, number][] {
    const moves: [number, number][] = [];
    const forward = color === 'red' ? -1 : 1;
    const hasCrossedRiver = color === 'red' ? row <= 4 : row >= 5;

    const forwardRow = row + forward;
    if (forwardRow >= 0 && forwardRow < this.BOARD_ROWS) {
      const target = state.board[forwardRow][col];
      if (!target || target.color !== color) moves.push([forwardRow, col]);
    }

    if (hasCrossedRiver) {
      for (const dc of [-1, 1]) {
        const sideCol = col + dc;
        if (sideCol >= 0 && sideCol < this.BOARD_COLS) {
          const target = state.board[row][sideCol];
          if (!target || target.color !== color) moves.push([row, sideCol]);
        }
      }
    }
    return moves;
  }

  private isInPalace(row: number, col: number, color: PieceColor): boolean {
    if (col < 3 || col > 5) return false;
    return color === 'red' ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
  }

  private wouldGeneralsFaceEachOther(
    state: XiangqiState,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
  ): boolean {
    const tempBoard = state.board.map((row) => [...row]);
    tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
    tempBoard[fromRow][fromCol] = null;

    let redGeneralPos: [number, number] | null = null;
    let blackGeneralPos: [number, number] | null = null;

    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = tempBoard[r][c];
        if (piece && piece.type === 'general') {
          if (piece.color === 'red') redGeneralPos = [r, c];
          else blackGeneralPos = [r, c];
        }
      }
    }

    if (!redGeneralPos || !blackGeneralPos) return false;
    if (redGeneralPos[1] !== blackGeneralPos[1]) return false;

    const minRow = Math.min(redGeneralPos[0], blackGeneralPos[0]);
    const maxRow = Math.max(redGeneralPos[0], blackGeneralPos[0]);
    const col = redGeneralPos[1];
    for (let r = minRow + 1; r < maxRow; r++) {
      if (tempBoard[r][col]) return false;
    }
    return true;
  }

  private wouldBeInCheckAfterMove(
    state: XiangqiState,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
  ): boolean {
    const tempState = this.cloneState(state);
    tempState.board[toRow][toCol] = tempState.board[fromRow][fromCol];
    tempState.board[fromRow][fromCol] = null;
    const movingPiece = tempState.board[toRow][toCol];
    if (!movingPiece) return false;
    return this.isInCheck(tempState, movingPiece.color);
  }

  private isInCheck(state: XiangqiState, color: PieceColor): boolean {
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

    const opponentColor = color === 'red' ? 'black' : 'red';
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (!piece || piece.color !== opponentColor) continue;
        const moves = this.getPieceRawMoves(state, r, c);
        if (moves.some(([mr, mc]) => mr === generalPos![0] && mc === generalPos![1])) {
          return true;
        }
      }
    }
    return false;
  }

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
    const match = action.action_id.match(/move_(\d)(\d)_to_(\d)(\d)/);
    if (!match) return { success: false, error: '无效的行动格式' };

    const fromRow = parseInt(match[1], 10);
    const fromCol = parseInt(match[2], 10);
    const toRow = parseInt(match[3], 10);
    const toCol = parseInt(match[4], 10);

    const piece = s.board[fromRow][fromCol];
    if (!piece) return { success: false, error: '起始位置没有棋子' };

    let currentColor: PieceColor;
    if (s.currentRole === 'player_red') currentColor = 'red';
    else if (s.currentRole === 'player_black') currentColor = 'black';
    else currentColor = s.currentRole === s.players[0] ? 'red' : 'black';

    if (piece.color !== currentColor) {
      return { success: false, error: '不能移动对方的棋子' };
    }

    const legalMoves = this.getPieceLegalMoves(s, fromRow, fromCol);
    const isLegal = legalMoves.some(([r, c]) => r === toRow && c === toCol);
    if (!isLegal) return { success: false, error: '非法移动' };

    s.board[toRow][toCol] = s.board[fromRow][fromCol];
    s.board[fromRow][fromCol] = null;
    s.lastMove = { from: [fromRow, fromCol], to: [toRow, toCol] };

    const currentIndex = s.players.indexOf(s.currentRole);
    s.currentRole = s.players[(currentIndex + 1) % s.players.length];
    s.turn++;

    let nextColor: PieceColor;
    if (s.currentRole === 'player_red') nextColor = 'red';
    else if (s.currentRole === 'player_black') nextColor = 'black';
    else nextColor = s.currentRole === s.players[0] ? 'red' : 'black';

    s.inCheck = this.isInCheck(s, nextColor);
    const hasLegalMoves = this.hasAnyLegalMoves(s, nextColor);
    if (!hasLegalMoves) {
      s.winner = s.players[currentIndex % s.players.length];
    }

    return { success: true, nextState: s };
  }

  private hasAnyLegalMoves(state: XiangqiState, color: PieceColor): boolean {
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (piece && piece.color === color) {
          const moves = this.getPieceLegalMoves(state, r, c);
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  isTerminal(state: GameState): boolean {
    return (state as XiangqiState).winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const winner = (state as XiangqiState).winner;
    return winner ? [winner] : null;
  }

  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as XiangqiState;
    const isSpectator = isSpectatorRole(roleId);

    let color: PieceColor;
    if (isSpectator) color = 'red';
    else if (roleId === 'player_red') color = 'red';
    else if (roleId === 'player_black') color = 'black';
    else color = roleId === s.players[0] ? 'red' : 'black';

    const colorName = color === 'red' ? '红方' : '黑方';
    const opponentColor = color === 'red' ? '黑方' : '红方';

    let currentColorName: string;
    if (s.currentRole === 'player_red') currentColorName = '红方';
    else if (s.currentRole === 'player_black') currentColorName = '黑方';
    else currentColorName = s.currentRole === s.players[0] ? '红方' : '黑方';

    let message = '';
    if (isSpectator) {
      if (s.winner) {
        const winnerColor =
          s.winner === 'player_red'
            ? '红方'
            : s.winner === 'player_black'
              ? '黑方'
              : s.winner === s.players[0]
                ? '红方'
                : '黑方';
        message = `👀 观战模式 - ${winnerColor}获胜！`;
      } else if (s.inCheck) {
        message = `👀 观战模式 - ${currentColorName}被将军了！`;
      } else {
        message = `👀 观战模式 - 轮到${currentColorName}`;
      }
    } else if (s.winner) {
      message = s.winner === roleId ? '🎉 游戏结束 - 你获胜了！' : `😔 游戏结束 - ${opponentColor}获胜`;
    } else if (s.currentRole === roleId) {
      message = s.inCheck ? `⚠️ 你被将军了！请应将（${colorName}）` : `✨ 轮到你了（${colorName}），请选择棋子移动`;
    } else {
      message = `⏳ 等待${opponentColor}行动...`;
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
        identity: isSpectator ? 'Spectator (观战者)' : roleId,
        goal: isSpectator ? '观看对局，学习象棋策略。' : `作为${colorName}，将死对方的将/帅`,
        is_current: isSpectator ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message,
    };
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const current_state = perspective.current_state;
    const your_role = perspective.your_role;
    const whole_history = (perspective.whole_history ?? []) as any[];
    const diff_history = (perspective.diff_history ?? []) as any[];

    const historyText =
      whole_history.length > 0
        ? whole_history
            .map((h) => {
              const role = h.role_id ?? h.roleId ?? 'unknown';
              const actionId = h.action?.action_id ?? h.action?.actionId ?? 'unknown_action';
              const params = h.action?.params ? ` (${JSON.stringify(h.action.params)})` : '';
              const desc = h.description ? ` - ${h.description}` : '';
              return `Turn ${h.turn}: ${role} -> ${actionId}${params}${desc}`;
            })
            .join('\n')
        : '(Game just started)';

    const recentHistoryText =
      diff_history.length > 0
        ? diff_history
            .map((h) => {
              const role = h.role_id ?? h.roleId ?? 'unknown';
              const actionId = h.action?.action_id ?? h.action?.actionId ?? 'unknown_action';
              const params = h.action?.params ? ` (${JSON.stringify(h.action.params)})` : '';
              const desc = h.description ? ` - ${h.description}` : '';
              return `Turn ${h.turn}: ${role} -> ${actionId}${params}${desc}`;
            })
            .join('\n')
        : '(No new events since your last turn)';

    return `# 游戏规则
${perspective.global_rules}

# 你的身份
角色: ${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}

# 当前游戏状态
${JSON.stringify(current_state)}

# 完整历史记录
${historyText}

# 自上次行动以来的变化
${recentHistoryText}`;
  }

  getAttackCountAtPosition(
    state: XiangqiState,
    targetRow: number,
    targetCol: number,
    attackerColor: PieceColor
  ): number {
    let count = 0;
    for (let r = 0; r < this.BOARD_ROWS; r++) {
      for (let c = 0; c < this.BOARD_COLS; c++) {
        const piece = state.board[r][c];
        if (!piece || piece.color !== attackerColor) continue;
        const moves = this.getPieceRawMoves(state, r, c);
        if (moves.some(([mr, mc]) => mr === targetRow && mc === targetCol)) count++;
      }
    }
    return count;
  }

  cloneState(state: XiangqiState): XiangqiState {
    return {
      ...state,
      board: state.board.map((row) => row.map((piece) => (piece ? { ...piece } : null))),
      players: [...state.players],
      lastMove: state.lastMove ? { ...state.lastMove } : null,
    };
  }
}

const xiangqiLogic = new XiangqiLogic();
export default xiangqiLogic;
