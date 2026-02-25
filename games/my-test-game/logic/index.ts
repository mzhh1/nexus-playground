import {
  GameLogic, GameMetadata, GameState, InitContext, ActionSpec,
  Action, ActionResult, HistoryEvent, RolePerspective,
  isSpectator
} from '@nexusgame/game-sdk';

interface MyGameState extends GameState {
  currentRole: string;
  turn: number;
  winner: string | null;
}

export class helloLogic implements GameLogic {
  
  getMetadata(): GameMetadata {
    return {
      id: 'my-test-game',
      name: 'hello',
      description: '这是一个由脚手架生成的基础游戏模板。',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: Array.from({ length: 2 }, (_, i) => `player_${i + 1}`),
      enable_llm_memory: false,
      getStatusText: (perspective) => {
        if (perspective.current_state.winner) return '游戏结束';
        return `第 ${perspective.current_state.turn} 回合`;
      }
    };
  }

  initState(ctx: InitContext): GameState {
    return {
      currentRole: ctx.players[0],
      turn: 1,
      winner: null
    };
  }

  getCurrentRole(state: GameState): string {
    return (state as MyGameState).currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    if ((state as MyGameState).currentRole !== roleId || (state as MyGameState).winner) {
      return { actions: [] };
    }

    return {
      actions: [
        { action_id: 'example_action', description: '示例行动', params_schema: null }
      ]
    };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const s = JSON.parse(JSON.stringify(state)) as MyGameState;
    
    if (s.currentRole !== action.role_id) {
      return { success: false, error: '不是你的回合' };
    }

    if (action.action_id === 'example_action') {
      s.turn += 1;
      // TODO: 实现由谁进行下一回合的逻辑
    }

    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    return (state as MyGameState).winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as MyGameState;
    return s.winner ? [s.winner] : null;
  }

  toRolePerspective(state: GameState, roleId: string, wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]): RolePerspective {
    const s = state as MyGameState;
    const spectator = isSpectator(roleId);
    
    let message = '';
    if (spectator) {
      message = s.winner ? '👀 观战模式 - 游戏结束' : `👀 观战模式 - 轮到 ${s.currentRole}`;
    } else {
      if (s.winner) message = s.winner === roleId ? '🎉 胜利！' : '😔 失败';
      else if (s.currentRole === roleId) message = '✨ 轮到你了，请选择行动';
      else message = '⏳ 等待对手行动...';
    }

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: s,
      your_role: {
        identity: spectator ? 'Spectator' : roleId,
        goal: '你的游戏目标说明',
        is_current: spectator ? false : s.currentRole === roleId
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message
    };
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const s = perspective.current_state as MyGameState;
    return `
# 游戏状态
当前回合：${s.turn}
当前轮到：${s.currentRole}
你的身份：${perspective.your_role.identity}
    `;
  }
}

export default new helloLogic();
