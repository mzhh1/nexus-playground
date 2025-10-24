/**
 * 井字棋特定类型定义
 */

import type {
  GlobalState,
  RolePerspective,
  PlayerAction,
  GameResult,
} from '@nexus/shared-types';

// 棋子类型
export type CellValue = 'X' | 'O' | null;

// 玩家角色
export type TicTacToeRole = 'player_X' | 'player_O';

// 井字棋全局状态
export interface TicTacToeGlobalState extends GlobalState {
  // 游戏规则描述
  game_rules: string;

  // 历史行动记录
  history: TicTacToeAction[];

  // 当前状态
  current_state: {
    // 3x3棋盘，[row][col]
    board: CellValue[][];
    
    // 当前轮到的角色
    current_role: TicTacToeRole;
    
    // 回合数（从1开始）
    turn: number;
    
    // 游戏状态
    status: 'waiting' | 'playing' | 'finished';
    
    // 获胜者（如果有）
    winner?: TicTacToeRole | 'draw';
  };
}

// 井字棋行动
export interface TicTacToeAction extends PlayerAction {
  action_type: 'place_mark';
  parameters: {
    row: number;  // 0-2
    col: number;  // 0-2
  };
}

// 井字棋角色视角
export interface TicTacToeRolePerspective extends RolePerspective {
  // 游戏规则
  global_rules: string;

  // 完整历史（完美信息游戏，所有行动可见）
  whole_history: TicTacToeAction[];

  // 差异历史（与whole_history相同，因为是完美信息）
  diff_history: TicTacToeAction[];

  // 当前状态（完美信息，与全局状态相同）
  current_state: {
    board: CellValue[][];
    current_role: TicTacToeRole;
    turn: number;
    status: 'waiting' | 'playing' | 'finished';
    winner?: TicTacToeRole | 'draw';
  };

  // 你的角色
  your_role: {
    role_id: TicTacToeRole;
    description: string;
    goal: string;
    mark: 'X' | 'O';
  };

  // 可用行动空间（显式列表模式）
  action_space_definition: {
    mode: 'explicit_list';
    available_actions: Array<{
      action_type: 'place_mark';
      parameters: {
        row: number;
        col: number;
      };
      description: string;
    }>;
  };
}

// 井字棋游戏结果
export interface TicTacToeGameResult extends GameResult {
  winner: TicTacToeRole | 'draw';
  winning_line?: {
    type: 'row' | 'col' | 'diagonal';
    index?: number; // for row/col
  };
  final_board: CellValue[][];
}

