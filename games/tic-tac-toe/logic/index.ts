/**
 * Tic-Tac-Toe Game Logic Implementation
 * A perfect information game for 2 players
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
} from '@nexus/game-sdk';

interface TicTacToeState extends GameState {
  board: (string | null)[][];
  currentRole: string;
  turn: number;
  winner: string | null;
  isDraw: boolean;
}

export class TicTacToeLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'tic-tac-toe',
      name: '井字棋 (Tic-Tac-Toe)',
      description: '在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_X', 'player_O'],
      enable_llm_memory: false,
      auto_save_mode: 'enabled',
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state as TicTacToeState;
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

  initState(ctx: InitContext): GameState {
    if (ctx.players.length !== 2) {
      throw new Error('Tic-Tac-Toe requires exactly 2 players');
    }

    return {
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
      currentRole: ctx.players[0],
      turn: 1,
      winner: null,
      isDraw: false,
    };
  }

  getCurrentRole(state: GameState): string {
    return (state as TicTacToeState).currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as TicTacToeState;
    if (s.winner || s.isDraw || s.currentRole !== roleId) {
      return { actions: [] };
    }

    const actions: NonNullable<ActionSpec['actions']> = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (s.board[row][col] === null) {
          actions.push({
            action_id: `place_${row}_${col}`,
            description: `在位置 (${row},${col}) 落子`,
            params_schema: null,
          });
        }
      }
    }
    return { actions };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const s = JSON.parse(JSON.stringify(state)) as TicTacToeState;

    if (s.currentRole !== action.role_id) {
      return { success: false, error: '不是你的回合', errorCode: 'NOT_YOUR_TURN' };
    }
    if (s.winner || s.isDraw) {
      return { success: false, error: '游戏已结束', errorCode: 'GAME_FINISHED' };
    }

    const match = action.action_id.match(/^place_(\d)_(\d)$/);
    if (!match) {
      return { success: false, error: '无效的行动格式', errorCode: 'INVALID_ACTION_FORMAT' };
    }

    const row = parseInt(match[1], 10);
    const col = parseInt(match[2], 10);
    if (row < 0 || row >= 3 || col < 0 || col >= 3) {
      return { success: false, error: '位置超出棋盘范围', errorCode: 'OUT_OF_BOUNDS' };
    }
    if (s.board[row][col] !== null) {
      return { success: false, error: '该位置已被占用', errorCode: 'CELL_OCCUPIED' };
    }

    const symbol = s.currentRole === 'player_X' ? 'X' : 'O';
    s.board[row][col] = symbol;

    if (this.checkWinner(s.board, symbol)) {
      s.winner = s.currentRole;
    } else if (this.isBoardFull(s.board)) {
      s.isDraw = true;
    } else {
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
    if (s.winner) return [s.winner];
    if (s.isDraw) return [];
    return null;
  }

  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as TicTacToeState;
    const metadata = this.getMetadata();
    const isSpectator = isSpectatorRole(roleId);

    let message = '';
    if (isSpectator) {
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
      const mySymbol = roleId === 'player_X' ? 'X' : 'O';
      const opponentSymbol = roleId === 'player_X' ? 'O' : 'X';
      if (s.winner) {
        message = s.winner === roleId
          ? '🎉 游戏结束 - 你获胜了！'
          : `😔 游戏结束 - 玩家 ${opponentSymbol} 获胜`;
      } else if (s.isDraw) {
        message = '🤝 游戏结束 - 平局';
      } else if (s.currentRole === roleId) {
        message = `✨ 轮到你了 (${mySymbol})，请在棋盘上选择位置`;
      } else {
        message = `⏳ 等待玩家 ${opponentSymbol} 行动...`;
      }
    }

    return {
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
        identity: isSpectator ? 'Spectator (观战者)' : (roleId === 'player_X' ? 'Player X' : 'Player O'),
        goal: isSpectator
          ? '观看对局，学习井字棋策略。'
          : '在棋盘的空位上放置你的棋子，尝试将三个棋子连成一线以获胜。',
        is_current: isSpectator ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message,
    };
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const state = perspective.current_state as TicTacToeState;
    const history = perspective.whole_history ?? [];
    const lastMoves = history.slice(-5)
      .map((h) => `Turn ${h.turn}: ${h.role_id} -> ${h.action.action_id}`)
      .join('\n');

    return `# 游戏规则
在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。

# 你的身份
${perspective.your_role.identity}
目标: ${perspective.your_role.goal}
${perspective.your_role.is_current ? '现在轮到你行动' : '目前不是你的回合'}

# 当前游戏状态
${JSON.stringify(state)}

# 最近历史
${lastMoves || '无'}
`;
  }

  private checkWinner(board: (string | null)[][], symbol: string): boolean {
    for (let row = 0; row < 3; row++) {
      if (board[row][0] === symbol && board[row][1] === symbol && board[row][2] === symbol) {
        return true;
      }
    }

    for (let col = 0; col < 3; col++) {
      if (board[0][col] === symbol && board[1][col] === symbol && board[2][col] === symbol) {
        return true;
      }
    }

    if (board[0][0] === symbol && board[1][1] === symbol && board[2][2] === symbol) {
      return true;
    }
    if (board[0][2] === symbol && board[1][1] === symbol && board[2][0] === symbol) {
      return true;
    }
    return false;
  }

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

export default new TicTacToeLogic();
