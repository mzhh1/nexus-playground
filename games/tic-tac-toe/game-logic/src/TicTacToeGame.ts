/**
 * 井字棋游戏逻辑实现
 * 
 * 这是一个完整的USADL实现示例，展示了：
 * 1. 如何继承GameLoop基类
 * 2. 如何实现完美信息游戏
 * 3. 如何生成角色视角
 * 4. 如何验证和执行行动
 */

import { GameLoop } from '@nexus/game-sdk';
import type {
  RoleMapping,
  ActionValidationResult,
  ActionExecutionResult,
} from '@nexus/shared-types';
import type {
  TicTacToeGlobalState,
  TicTacToeAction,
  TicTacToeRolePerspective,
  TicTacToeRole,
  TicTacToeGameResult,
  CellValue,
} from './types';

export class TicTacToeGame extends GameLoop<
  TicTacToeGlobalState,
  TicTacToeRolePerspective,
  TicTacToeAction,
  TicTacToeGameResult
> {
  constructor(roleMapping: RoleMapping) {
    super(roleMapping);
  }

  /**
   * 初始化游戏状态
   */
  protected initializeState(): TicTacToeGlobalState {
    return {
      game_rules: `井字棋（Tic-Tac-Toe）规则：
- 两名玩家轮流在3x3的棋盘上落子
- 一名玩家使用X标记，另一名使用O标记
- 第一个在横、竖或对角线上连成三个标记的玩家获胜
- 如果棋盘填满仍无人获胜，则为平局`,
      
      history: [],
      
      current_state: {
        board: [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ],
        current_role: 'player_X',
        turn: 1,
        status: 'playing',
      },
    };
  }

  /**
   * 游戏开始钩子
   */
  protected onGameStart(): void {
    console.log('[TicTacToe] 游戏开始！');
    this.eventBus.emit('game:started', {
      timestamp: Date.now(),
      state: this.getGlobalState(),
    });
  }

  /**
   * 回合开始钩子
   */
  protected onTurnStart(roleId: string): void {
    console.log(`[TicTacToe] 回合 ${this.getGlobalState().current_state.turn}: ${roleId} 的回合`);
    
    this.eventBus.emit('turn:started', {
      turn: this.getGlobalState().current_state.turn,
      roleId,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取当前应该行动的角色
   */
  public getCurrentRole(): string {
    return this.getGlobalState().current_state.current_role;
  }

  /**
   * 生成角色视角（完美信息游戏）
   */
  protected generatePerspective(roleId: string): TicTacToeRolePerspective {
    const state = this.getGlobalState();
    const role = roleId as TicTacToeRole;
    const mark = role === 'player_X' ? 'X' : 'O';

    // 生成可用行动列表（所有空格子）
    const availableActions: TicTacToeRolePerspective['action_space_definition']['available_actions'] = [];
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (state.current_state.board[row][col] === null) {
          availableActions.push({
            action_type: 'place_mark',
            parameters: { row, col },
            description: `在 (${row}, ${col}) 位置落子${mark}`,
          });
        }
      }
    }

    return {
      global_rules: state.game_rules,
      whole_history: [...state.history],
      diff_history: [...state.history], // 完美信息，无差异
      
      current_state: {
        board: state.current_state.board.map(row => [...row]),
        current_role: state.current_state.current_role,
        turn: state.current_state.turn,
        status: state.current_state.status,
        winner: state.current_state.winner,
      },
      
      your_role: {
        role_id: role,
        description: `你是玩家${mark}`,
        goal: `在横、竖或对角线上连成三个${mark}标记`,
        mark,
      },
      
      action_space_definition: {
        mode: 'explicit_list',
        available_actions: availableActions,
      },
    };
  }

  /**
   * 验证行动合法性
   */
  protected validateAction(
    action: TicTacToeAction,
    roleId: string
  ): ActionValidationResult {
    const state = this.getGlobalState();

    // 检查是否轮到该角色
    if (state.current_state.current_role !== roleId) {
      return {
        valid: false,
        error: '现在不是你的回合',
      };
    }

    // 检查游戏是否已结束
    if (state.current_state.status === 'finished') {
      return {
        valid: false,
        error: '游戏已结束',
      };
    }

    // 检查行动类型
    if (action.action_type !== 'place_mark') {
      return {
        valid: false,
        error: '无效的行动类型',
      };
    }

    const { row, col } = action.parameters;

    // 检查坐标范围
    if (row < 0 || row > 2 || col < 0 || col > 2) {
      return {
        valid: false,
        error: '坐标超出范围（必须是0-2）',
      };
    }

    // 检查格子是否已被占用
    if (state.current_state.board[row][col] !== null) {
      return {
        valid: false,
        error: '该位置已被占用',
      };
    }

    return { valid: true };
  }

  /**
   * 执行行动
   */
  protected executeAction(
    action: TicTacToeAction,
    roleId: string
  ): ActionExecutionResult {
    const state = this.getGlobalState();
    const { row, col } = action.parameters;
    const mark = (roleId as TicTacToeRole) === 'player_X' ? 'X' : 'O';

    // 落子
    state.current_state.board[row][col] = mark;

    // 添加到历史
    state.history.push({
      ...action,
      role_id: roleId,
      timestamp: Date.now(),
    });

    console.log(`[TicTacToe] ${roleId} 在 (${row}, ${col}) 落子${mark}`);

    return {
      success: true,
      state_changes: {
        board: state.current_state.board,
        lastMove: { row, col, mark },
      },
    };
  }

  /**
   * 回合结束钩子
   */
  protected onTurnEnd(roleId: string): void {
    const state = this.getGlobalState();

    // 切换到下一个角色
    state.current_state.current_role =
      state.current_state.current_role === 'player_X' ? 'player_O' : 'player_X';

    // 增加回合数
    state.current_state.turn += 1;

    this.eventBus.emit('turn:ended', {
      turn: state.current_state.turn - 1,
      roleId,
      timestamp: Date.now(),
    });
  }

  /**
   * 检查游戏是否结束
   */
  protected checkGameEnd(): TicTacToeGameResult | null {
    const state = this.getGlobalState();
    const board = state.current_state.board;

    // 检查行
    for (let row = 0; row < 3; row++) {
      if (
        board[row][0] !== null &&
        board[row][0] === board[row][1] &&
        board[row][1] === board[row][2]
      ) {
        const winner = board[row][0] === 'X' ? 'player_X' : 'player_O';
        return this.createGameResult(winner, { type: 'row', index: row });
      }
    }

    // 检查列
    for (let col = 0; col < 3; col++) {
      if (
        board[0][col] !== null &&
        board[0][col] === board[1][col] &&
        board[1][col] === board[2][col]
      ) {
        const winner = board[0][col] === 'X' ? 'player_X' : 'player_O';
        return this.createGameResult(winner, { type: 'col', index: col });
      }
    }

    // 检查对角线
    if (
      board[0][0] !== null &&
      board[0][0] === board[1][1] &&
      board[1][1] === board[2][2]
    ) {
      const winner = board[0][0] === 'X' ? 'player_X' : 'player_O';
      return this.createGameResult(winner, { type: 'diagonal' });
    }

    if (
      board[0][2] !== null &&
      board[0][2] === board[1][1] &&
      board[1][1] === board[2][0]
    ) {
      const winner = board[0][2] === 'X' ? 'player_X' : 'player_O';
      return this.createGameResult(winner, { type: 'diagonal' });
    }

    // 检查平局（棋盘已满）
    const isBoardFull = board.every(row => row.every(cell => cell !== null));
    if (isBoardFull) {
      return this.createGameResult('draw');
    }

    // 游戏继续
    return null;
  }

  /**
   * 创建游戏结果
   */
  private createGameResult(
    winner: TicTacToeRole | 'draw',
    winningLine?: { type: 'row' | 'col' | 'diagonal'; index?: number }
  ): TicTacToeGameResult {
    const state = this.getGlobalState();

    return {
      winner,
      winning_line: winningLine,
      final_board: state.current_state.board.map(row => [...row]),
      role_results: {
        player_X: {
          outcome: winner === 'player_X' ? 'win' : winner === 'draw' ? 'draw' : 'loss',
        },
        player_O: {
          outcome: winner === 'player_O' ? 'win' : winner === 'draw' ? 'draw' : 'loss',
        },
      },
    };
  }

  /**
   * 游戏结束钩子
   */
  protected onGameEnd(result: TicTacToeGameResult): void {
    const state = this.getGlobalState();
    state.current_state.status = 'finished';
    state.current_state.winner = result.winner;

    console.log(`[TicTacToe] 游戏结束！结果: ${result.winner}`);

    this.eventBus.emit('game:ended', {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 导出当前游戏状态（用于保存/回放）
   */
  public exportState(): TicTacToeGlobalState {
    return JSON.parse(JSON.stringify(this.getGlobalState()));
  }

  /**
   * 从状态恢复游戏（用于加载/回放）
   */
  public restoreState(state: TicTacToeGlobalState): void {
    this.stateManager.setState(state);
  }
}

