/**
 * Tic-Tac-Toe Game Logic Implementation
 * A perfect information game for 2 players
 */

RolePerspective,
  BaseGameLogic,
  z,
} from '@nexus/game-sdk';
import { isSpectator as isSpectatorRole } from '@nexus/game-sdk';

// ============ Tic-Tac-Toe State ============

interface TicTacToeState extends GameState {
  board: (string | null)[][]; // 3x3 board
  currentRole: string; // "player_X" or "player_O"
  turn: number;
  winner: string | null;
  isDraw: boolean;
}

// ============ Game Logic Implementation ============

export class TicTacToeLogic extends BaseGameLogic<TicTacToeState> {
  getMetadata(): GameMetadata {
    return {
      id: 'tic-tac-toe',
      name: '井字棋 (Tic-Tac-Toe)',
      description: '在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_X', 'player_O'], // Define the roles required for this game
      enable_llm_memory: false, // Perfect information game, no memory needed
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state;

        if (state.winner) {
          const winnerSymbol = state.winner === 'player_X' ? 'X' : 'O';
          return `游戏结束 - 玩家 ${winnerSymbol} 获胜！`;
        }

        if (state.isDraw) {
          return '游戏结束 - 平局';
        }

        const currentSymbol = state.currentRole === 'player_X' ? 'X' : 'O';
        return `第 ${state.turn} 回合 - 轮到玩家 ${currentSymbol}`;
      },
    };
  }

  getActionSchema(): z.ZodSchema {
    return z.object({
      action_id: z.string().regex(/^place_\d_\d$/, "Invalid action format. Expected 'place_row_col'"),
      params: z.any().optional(),
      role_id: z.string(),
    });
  }

  initState(ctx: InitContext): GameState {
    if (ctx.players.length !== 2) {
      throw new Error('Tic-Tac-Toe requires exactly 2 players');
    }

    // Initialize empty 3x3 board
    const board: (string | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];

    const state: TicTacToeState = {
      board,
      currentRole: ctx.players[0], // First player starts
      turn: 1,
      winner: null,
      isDraw: false,
    };

    return state;
  }

  getCurrentRole(state: GameState): string {
    const s = state as TicTacToeState;
    return s.currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as TicTacToeState;

    // If game is over or not role's turn, no legal actions
    if (s.winner || s.isDraw || s.currentRole !== roleId) {
      return { actions: [] };
    }

    // Find all empty cells
    const actions = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (s.board[row][col] === null) {
          actions.push({
            action_id: `place_${row}_${col}`,
            description: `在位置 (${row},${col}) 落子`,
            params_schema: null, // Fixed action, no parameters
          });
        }
      }
    }

    return { actions };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    // Deep clone state to ensure immutability
    const s = JSON.parse(JSON.stringify(state)) as TicTacToeState;

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

    // Parse action_id to get row and col
    const match = action.action_id.match(/^place_(\d)_(\d)$/);
    if (!match) {
      return {
        success: false,
        error: '无效的行动格式',
        errorCode: 'INVALID_ACTION_FORMAT',
      };
    }

    const row = parseInt(match[1], 10);
    const col = parseInt(match[2], 10);

    // Validate position
    if (row < 0 || row >= 3 || col < 0 || col >= 3) {
      return {
        success: false,
        error: '位置超出棋盘范围',
        errorCode: 'OUT_OF_BOUNDS',
      };
    }

    // Check if cell is empty
    if (s.board[row][col] !== null) {
      return {
        success: false,
        error: '该位置已被占用',
        errorCode: 'CELL_OCCUPIED',
      };
    }

    // Place piece
    const symbol = s.currentRole === 'player_X' ? 'X' : 'O';
    s.board[row][col] = symbol;

    // Check for winner
    if (this.checkWinner(s.board, symbol)) {
      s.winner = s.currentRole;
    }
    // Check for draw
    else if (this.isBoardFull(s.board)) {
      s.isDraw = true;
    }
    // Switch turn
    else {
      s.currentRole = s.currentRole === 'player_X' ? 'player_O' : 'player_X';
      s.turn += 1;
    }

    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    const s = state as TicTacToeState;
    return s.winner !== null || s.isDraw;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as TicTacToeState;

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
    const s = state as TicTacToeState;
    const metadata = this.getMetadata();

    // Check if this is a spectator (role not in the game)
    const isSpectator = isSpectatorRole(roleId);

    // Generate message for unified message bar
    let message = '';

    if (isSpectator) {
      // Spectator messages
      if (s.winner) {
        const winnerSymbol = s.winner === 'player_X' ? 'X' : 'O';
        message = `👀 观战模式 - 玩家 ${winnerSymbol} 获胜！`;
      } else if (s.isDraw) {
        message = '👀 观战模式 - 平局';
      } else {
        const currentSymbol = s.currentRole === 'player_X' ? 'X' : 'O';
        message = `👀 观战模式 - 轮到玩家 ${currentSymbol}`;
      }
    } else {
      // Player messages
      const mySymbol = roleId === 'player_X' ? 'X' : 'O';
      const opponentSymbol = roleId === 'player_X' ? 'O' : 'X';

      if (s.winner) {
        if (s.winner === roleId) {
          message = `🎉 游戏结束 - 你获胜了！`;
        } else {
          message = `😔 游戏结束 - 玩家 ${opponentSymbol} 获胜`;
        }
      } else if (s.isDraw) {
        message = '🤝 游戏结束 - 平局';
      } else if (s.currentRole === roleId) {
        message = `✨ 轮到你了 (${mySymbol})，请在棋盘上选择位置`;
      } else {
        message = `⏳ 等待玩家 ${opponentSymbol} 行动...`;
      }
    }

    // Tic-Tac-Toe is a perfect information game
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
      },
      your_role: {
        identity: isSpectator
          ? 'Spectator (观战者)'
          : (roleId === 'player_X' ? 'Player X' : 'Player O'),
        goal: isSpectator
          ? '观看对局，学习井字棋策略。'
          : '在棋盘的空位上放置你的棋子，尝试将三个棋子连成一线以获胜。',
        is_current: isSpectator ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message, // Add unified message for platform to render
    };

    return perspective;
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const {
      // @ts-ignore
      global_rules,
      current_state,
      // @ts-ignore 
      whole_history,
      // @ts-ignore 
      diff_history,
      your_role
    } = perspective;
    // Generate state prompt
    return `# 游戏规则
在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。

# 你的身份为${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}

# 当前游戏状态
${JSON.stringify(current_state)}`;
  }

  // ============ Helper Methods ============

  /**
   * Check if a symbol has won the game
   */
  private checkWinner(board: (string | null)[][], symbol: string): boolean {
    // Check rows
    for (let row = 0; row < 3; row++) {
      if (
        board[row][0] === symbol &&
        board[row][1] === symbol &&
        board[row][2] === symbol
      ) {
        return true;
      }
    }

    // Check columns
    for (let col = 0; col < 3; col++) {
      if (
        board[0][col] === symbol &&
        board[1][col] === symbol &&
        board[2][col] === symbol
      ) {
        return true;
      }
    }

    // Check diagonals
    if (
      board[0][0] === symbol &&
      board[1][1] === symbol &&
      board[2][2] === symbol
    ) {
      return true;
    }

    if (
      board[0][2] === symbol &&
      board[1][1] === symbol &&
      board[2][0] === symbol
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if board is full (for draw detection)
   */
  private isBoardFull(board: (string | null)[][]): boolean {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] === null) {
          return false;
        }
      }
    }
    return true;
  }
}

// Export singleton instance
export default new TicTacToeLogic();

