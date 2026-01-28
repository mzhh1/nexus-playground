/**
 * Gomoku (Five in a Row) Game Logic Implementation
 * A perfect information game for 2 players on a 15x15 board
 */

import type {
  GameLogic,
  GameMetadata,
  GameState,
  InitContext,
  ActionSpec,
  Action,
  ActionResult,
  HistoryEvent,
  RolePerspective,
  BaseGameLogic, // Import Base Class
  z, // Import Zod from SDK
} from '@nexus/game-sdk';
import { isSpectator as isSpectatorRole } from '@nexus/game-sdk';

// ============ Gomoku State ============

/**
 * Board cell values:
 * 0 = empty cell (空地)
 * 1 = black stone (黑棋)
 * 2 = white stone (白棋)
 */
type CellValue = 0 | 1 | 2;

interface GomokuState extends GameState {
  board: CellValue[][]; // 15x15 board with numeric encoding
  currentRole: string; // "player_black" or "player_white"
  turn: number;
  winner: string | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null; // Track last move for win checking optimization
}

// ============ Game Logic Implementation ============

export class GomokuLogic extends BaseGameLogic<GomokuState> {
  private readonly BOARD_SIZE = 15;
  private readonly WIN_LENGTH = 5;

  getMetadata(): GameMetadata {
    // ... metadata (lines 45-77) kept as is - wait, I'm replacing the block so I need to keep it or use carefully scoped replace
    return {
      id: 'gomoku',
      name: '五子棋 (Gomoku)',
      version: '1.0.0',
      logicVersion: 1,
      description: `这是一个五子棋游戏。在15x15棋盘上，两位玩家轮流下棋，先将自己的五个棋子连成一线(包括横竖和斜线)者获胜。

棋盘编码说明：
- 0 = 空地 (empty cell)
- 1 = 黑棋 (black stone) - player_black
- 2 = 白棋 (white stone) - player_white

黑棋先手，白棋后手。`,
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_black', 'player_white'],
      enable_llm_memory: false,
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state as GomokuState;

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

  getActionSchema(): z.ZodSchema {
    return z.object({
      action_id: z.literal('place'),
      params: z.object({
        row: z.number().int().min(0).max(14),
        col: z.number().int().min(0).max(14),
      }).required(),
      role_id: z.string(),
    });
  }

  // Removed redundant serializeState/deserializeState as BaseGameLogic handles them

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
    if (!action.params || typeof action.params.row !== 'number' || typeof action.params.col !== 'number') {
      return {
        success: false,
        error: '缺少必需的参数 row 和 col',
        errorCode: 'MISSING_PARAMS',
      };
    }

    const row = action.params.row;
    const col = action.params.col;

    // Validate position
    if (row < 0 || row >= this.BOARD_SIZE || col < 0 || col >= this.BOARD_SIZE) {
      return {
        success: false,
        error: '位置超出棋盘范围',
        errorCode: 'OUT_OF_BOUNDS',
      };
    }

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
      diff_history,
      your_role
    } = perspective;

    // Format history
    const historyText = whole_history.length > 0
      ? whole_history.map(h =>
        `Turn ${h.turn}: ${h.role_id} → ${h.action.action_id}${h.action.params ? ` (${JSON.stringify(h.action.params)})` : ''
        }${h.description ? ` - ${h.description}` : ''}`
      ).join('\n')
      : '(Game just started)';

    const recentHistoryText = diff_history.length > 0
      ? diff_history.map(h =>
        `Turn ${h.turn}: ${h.role_id} → ${h.action.action_id}${h.action.params ? ` (${JSON.stringify(h.action.params)})` : ''
        }${h.description ? ` - ${h.description}` : ''}`
      ).join('\n')
      : '(No new events since your last turn)';

    // Generate state prompt
    return `# 游戏规则
${global_rules}

# 你为${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}

# 当前游戏状态
${JSON.stringify(current_state)}

# 完整历史记录
${historyText}

# 自上次行动以来的变化
${recentHistoryText}`;
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

