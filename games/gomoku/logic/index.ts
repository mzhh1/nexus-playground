/**
 * Gomoku (Five in a Row) Game Logic Implementation
 * A perfect information game for 2 players on a 15x15 board
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
  z,
} from '@nexusgame/game-sdk';

// ============ Gomoku State ============

/**
 * Board cell values:
 * 0 = empty cell (空地)
 * 1 = black stone (黑棋)
 * 2 = white stone (白棋)
 */
type CellValue = 0 | 1 | 2;

export interface GomokuState extends GameState {
  board: CellValue[][]; // 15x15 board with numeric encoding
  currentRole: string; // "player_black" or "player_white"
  turn: number;
  winner: string | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null; // Track last move for win checking optimization
}

// ============ Action Schemas (Zod) ============

const BOARD_SIZE = 15;

const actionSchemas = {
  place: z.object({
    row: z.number().int().min(0).max(BOARD_SIZE - 1),
    col: z.number().int().min(0).max(BOARD_SIZE - 1),
  }),
};

export type GomokuActionSchemas = typeof actionSchemas;

// ============ Game Logic Implementation ============

export class GomokuLogic implements GameLogic {
  private readonly BOARD_SIZE = BOARD_SIZE;
  private readonly WIN_LENGTH = 5;
  actionSchemas = actionSchemas;

  getMetadata(): GameMetadata {
    return {
      id: 'gomoku',
      name: '五子棋 (Gomoku)',
      description: `这是一个五子棋游戏。在15x15棋盘上，两位玩家轮流下棋，先将自己的五个棋子连成一线(包括横竖和斜线)者获胜。

棋盘编码说明：
- 0 = 空地 (empty cell)
- 1 = 黑棋 (black stone) - player_black
- 2 = 白棋 (white stone) - player_white

黑棋先手，白棋后手。`,
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_black', 'player_white'], // Define the roles required for this game
      enable_llm_memory: false, // Perfect information game, no memory needed
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state;

        if (state.winner) {
          const winnerSymbol = state.winner === 'player_black' ? '黑' : '白';
          return `游戏结束 - ${winnerSymbol}棋获胜！`;
        }

        if (state.isDraw) {
          return '游戏结束 - 平局';
        }

        const currentSymbol = state.currentRole === 'player_black' ? '黑' : '白';
        return `第 ${state.turn} 回合 - 轮到${currentSymbol}棋`;
      },
    };
  }

  initState(ctx: InitContext): GameState {
    if (ctx.players.length !== 2) {
      throw new Error('Gomoku requires exactly 2 players');
    }

    // Initialize empty 15x15 board (all cells = 0)
    const board: CellValue[][] = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(0) as CellValue[]);

    const state: GomokuState = {
      board,
      currentRole: ctx.players[0], // First player (black) starts
      turn: 1,
      winner: null,
      isDraw: false,
      lastMove: null,
    };

    return state;
  }

  getCurrentRole(state: GameState): string {
    const s = state as GomokuState;
    return s.currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as GomokuState;

    // If game is over or not role's turn, no legal actions
    if (s.winner || s.isDraw || s.currentRole !== roleId) {
      return { actions: [] };
    }

    // Use parameterized template instead of fixed options
    // This is more efficient than generating 225 fixed actions for a 15x15 board
    return {
      actions: [
        {
          action_id: 'place',
          description: '在棋盘的空位上落子',
          params_schema: {
            row: {
              type: 'integer',
              description: '棋盘行坐标 (0-14)',
              minimum: 0,
              maximum: this.BOARD_SIZE - 1,
            },
            col: {
              type: 'integer',
              description: '棋盘列坐标 (0-14)',
              minimum: 0,
              maximum: this.BOARD_SIZE - 1,
            },
          },
        },
      ],
    };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    // Deep clone state to ensure immutability
    const s = JSON.parse(JSON.stringify(state)) as GomokuState;

    // Validate it's the role's turn
    if (s.currentRole !== action.role_id) {
      return {
        success: false,
        error: '不是你的回合',
        errorCode: 'NOT_YOUR_TURN',
      };
    }

    // Game already finished
    if (s.winner || s.isDraw) {
      return {
        success: false,
        error: '游戏已结束',
        errorCode: 'GAME_FINISHED',
      };
    }

    // Validate action_id
    if (action.action_id !== 'place') {
      return {
        success: false,
        error: '无效的行动ID',
        errorCode: 'INVALID_ACTION_ID',
      };
    }

    // Validate parameters exist
    // Note: format validation (type, range) is now handled by Zod actionSchemas.
    // Only business logic validation remains here.
    if (!action.params || action.params.row === undefined || action.params.col === undefined) {
      return {
        success: false,
        error: '缺少必需的参数 row 和 col',
        errorCode: 'MISSING_PARAMS',
      };
    }

    const row = action.params.row;
    const col = action.params.col;

    // Check if cell is empty
    if (s.board[row][col] !== 0) {
      const occupiedBy = s.board[row][col] === 1 ? '黑棋' : '白棋';
      return {
        success: false,
        error: `位置(${row}, ${col})已被${occupiedBy}占用，请选择空位（board值为0的位置）`,
        errorCode: 'CELL_OCCUPIED',
      };
    }

    // Place piece: 1 for black, 2 for white
    const cellValue: CellValue = s.currentRole === 'player_black' ? 1 : 2;
    s.board[row][col] = cellValue;
    s.lastMove = { row, col };

    // Check for winner (optimized: only check around last move)
    if (this.checkWinnerAtPosition(s.board, row, col, cellValue)) {
      s.winner = s.currentRole;
    }
    // Check for draw
    else if (this.isBoardFull(s.board)) {
      s.isDraw = true;
    }
    // Switch turn
    else {
      s.currentRole = s.currentRole === 'player_black' ? 'player_white' : 'player_black';
      s.turn += 1;
    }

    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    const s = state as GomokuState;
    return s.winner !== null || s.isDraw;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as GomokuState;

    if (s.winner) {
      return [s.winner];
    }

    if (s.isDraw) {
      return []; // Draw - no winners
    }

    return null; // Game not finished
  }

  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as GomokuState;
    const metadata = this.getMetadata();

    // Check if this is a spectator (role not in the game)
    const isSpectator = isSpectatorRole(roleId);

    // Generate message for unified message bar
    let message = '';

    if (isSpectator) {
      // Spectator messages
      if (s.winner) {
        const winnerSymbol = s.winner === 'player_black' ? '黑' : '白';
        message = `👀 观战模式 - ${winnerSymbol}棋获胜！`;
      } else if (s.isDraw) {
        message = '👀 观战模式 - 平局';
      } else {
        const currentSymbol = s.currentRole === 'player_black' ? '黑' : '白';
        message = `👀 观战模式 - 轮到${currentSymbol}棋`;
      }
    } else {
      // Player messages
      const mySymbol = roleId === 'player_black' ? '黑' : '白';
      const opponentSymbol = roleId === 'player_black' ? '白' : '黑';

      if (s.winner) {
        if (s.winner === roleId) {
          message = `🎉 游戏结束 - 你获胜了！`;
        } else {
          message = `😔 游戏结束 - ${opponentSymbol}棋获胜`;
        }
      } else if (s.isDraw) {
        message = '🤝 游戏结束 - 平局';
      } else if (s.currentRole === roleId) {
        message = `✨ 轮到你了 (${mySymbol}棋)，请在棋盘上选择位置`;
      } else {
        message = `⏳ 等待${opponentSymbol}棋行动...`;
      }
    }

    // Gomoku is a perfect information game
    // All players see the complete board state
    const perspective: RolePerspective = {
      global_rules: metadata.description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        board: s.board,
        currentRole: s.currentRole,
        turn: s.turn,
        winner: s.winner,
        isDraw: s.isDraw,
        lastMove: s.lastMove,
      },
      your_role: {
        identity: isSpectator
          ? 'Spectator (观战者)'
          : (roleId === 'player_black' ? 'Player Black' : 'Player White'),
        goal: isSpectator
          ? '观看对局，学习五子棋策略。'
          : '在棋盘的空位上放置你的棋子，尝试将五个棋子连成一线以获胜。',
        is_current: isSpectator ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message, // Add unified message for platform to render
    };

    return perspective;
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const {
      global_rules,
      current_state,
      whole_history,
      your_role
    } = perspective;

    const state = current_state as GomokuState;
    const board = state.board;
    const size = board.length;

    // Generate ASCII Board
    let boardStr = '   ';
    // Column headers
    for (let i = 0; i < size; i++) {
      boardStr += (i < 10 ? ` ${i} ` : `${i} `);
    }
    boardStr += '\n';

    for (let r = 0; r < size; r++) {
      boardStr += (r < 10 ? ` ${r} ` : `${r} `); // Row header
      for (let c = 0; c < size; c++) {
        const cell = board[r][c];
        if (cell === 0) boardStr += ' . ';
        else if (cell === 1) boardStr += ' X '; // Black
        else if (cell === 2) boardStr += ' O '; // White
      }
      boardStr += '\n';
    }

    const lastMoveStr = state.lastMove ? `Last move: (${state.lastMove.row}, ${state.lastMove.col})` : 'No moves yet';

    // Format history (last 5 moves is enough context usually, but whole history is fine too)
    const historyText = whole_history.slice(-10).map(h =>
      `Turn ${h.turn}: ${h.role_id} placed at (${h.action.params.row}, ${h.action.params.col})`
    ).join('\n');

    return `# 游戏规则
${global_rules}

# 棋盘状态 (X=黑棋, O=白棋, .=空位)
${boardStr}

# 游戏信息
当前执子: ${state.currentRole === 'player_black' ? '黑棋 (X)' : '白棋 (O)'}
最后落子: ${lastMoveStr}
你的身份: ${your_role.identity}

# 最近历史 (最后10步)
${historyText || '无'}

`;
  }

  // ============ Helper Methods ============

  /**
   * Check if a cell value has won at a specific position (optimized)
   * Only checks the 4 directions from the last placed stone
   */
  private checkWinnerAtPosition(
    board: CellValue[][],
    row: number,
    col: number,
    cellValue: CellValue
  ): boolean {
    // Check 4 directions: horizontal, vertical, diagonal-left, diagonal-right
    const directions = [
      { dr: 0, dc: 1 },   // Horizontal
      { dr: 1, dc: 0 },   // Vertical
      { dr: 1, dc: 1 },   // Diagonal ↘
      { dr: 1, dc: -1 },  // Diagonal ↙
    ];

    for (const { dr, dc } of directions) {
      let count = 1; // Count the current stone

      // Check positive direction
      for (let i = 1; i < this.WIN_LENGTH; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (
          r >= 0 &&
          r < this.BOARD_SIZE &&
          c >= 0 &&
          c < this.BOARD_SIZE &&
          board[r][c] === cellValue
        ) {
          count++;
        } else {
          break;
        }
      }

      // Check negative direction
      for (let i = 1; i < this.WIN_LENGTH; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (
          r >= 0 &&
          r < this.BOARD_SIZE &&
          c >= 0 &&
          c < this.BOARD_SIZE &&
          board[r][c] === cellValue
        ) {
          count++;
        } else {
          break;
        }
      }

      // If we found 5 or more in a row, we have a winner
      if (count >= this.WIN_LENGTH) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if board is full (for draw detection)
   */
  private isBoardFull(board: CellValue[][]): boolean {
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (board[row][col] === 0) {
          return false;
        }
      }
    }
    return true;
  }
}

// Export singleton instance
export default new GomokuLogic();

