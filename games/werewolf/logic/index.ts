import {
  Action,
  ActionResult,
  ActionSpec,
  GameLogic,
  GameMetadata,
  GameState,
  HistoryEvent,
  InitContext,
  RolePerspective,
  isSpectator as isSpectatorRole,
} from '@nexus/game-sdk';

import type { Identity, WerewolfState } from './types';
import { PLAYER_COUNT_RANGE, PLAYER_ROLE_IDS_BY_COUNT, ROLE_DISTRIBUTIONS, PLAYER_COUNT_LABELS } from './config';
import { shuffle, getInitialNightSubPhase, cloneState, getCamp } from './utils';
import {
  getNightLegalActions,
  getDayDiscussionLegalActions,
  getDayVotingLegalActions,
  getHunterLegalActions,
  applyGuardAction,
  applyWerewolfAction,
  applySeerAction,
  applyWitchAction,
  applyDayDiscussionAction,
  applyDayVotingAction,
  applyHunterAction,
} from './actions';
import {
  ensurePendingRoles,
  prepareNightSubPhase,
  resolveNight,
  startDayDiscussion,
  startDayVoting,
  resolveDayVoting,
  startNextNight,
  applyDeaths,
  resumeAfterHunter,
  updateWinnerIfNeeded,
  consumeCurrentActor,
} from './phases';
import { toRolePerspective as toRolePerspectiveImpl, generateStatePrompt as generateStatePromptImpl } from './perspective';

export class WerewolfLogic implements GameLogic {
  getMetadata(): GameMetadata {
    const metadata: GameMetadata = {
      id: 'werewolf',
      name: '狼人杀 (Werewolf)',
      description: '经典狼人杀：狼人阵营与好人阵营的推理博弈，包含预言家、女巫、猎人、守卫等角色。',
      minPlayers: 6,
      maxPlayers: 12,
      roleIds: PLAYER_ROLE_IDS_BY_COUNT,
      enable_llm_memory: true,
      getStatusText: (perspective: RolePerspective) => {
        const current = perspective.current_state as Partial<WerewolfState['currentNightActions']> & {
          phase?: WerewolfState['phase'];
          day?: number;
          nightSubPhase?: WerewolfState['nightSubPhase'];
          winner?: WerewolfState['winner'];
        };
        if (current?.winner) return `游戏结束 - ${current.winner === 'werewolf' ? '狼人阵营' : '好人阵营'}获胜`;
        if (current?.phase === 'night') {
          const subPhaseLabel = current?.nightSubPhase
            ? { guard: '守卫行动', werewolf: '狼人行动', seer: '预言家查验', witch: '女巫用药' }[current.nightSubPhase] ?? '夜晚阶段'
            : '夜晚阶段';
          return `第 ${current?.day ?? 1} 夜 - ${subPhaseLabel}`;
        }
        if (current?.phase === 'day_discussion') return `第 ${current?.day ?? 1} 天 - 白天讨论`;
        if (current?.phase === 'day_voting') return `第 ${current?.day ?? 1} 天 - 公投放逐`;
        if (current?.phase === 'last_words') return `第 ${current?.day ?? 1} 天 - 遗言阶段`;
        if (current?.phase === 'hunter_shoot') return `第 ${current?.day ?? 1} 天 - 猎人发动技能`;
        return '狼人杀 - 推理进行中';
      },
    };
    return { ...metadata, playerCountLabels: PLAYER_COUNT_LABELS } as GameMetadata;
  }

  initState(ctx: InitContext): GameState {
    const playerCount = ctx.players.length;
    if (!PLAYER_COUNT_RANGE.includes(playerCount as (typeof PLAYER_COUNT_RANGE)[number])) {
      throw new Error(`狼人杀暂不支持 ${playerCount} 人局`);
    }
    const expectedSeats = PLAYER_ROLE_IDS_BY_COUNT[playerCount]?.length ?? playerCount;
    if (ctx.players.length !== expectedSeats) {
      throw new Error(`初始化玩家数量与座位配置不匹配（期望 ${expectedSeats}，实际 ${ctx.players.length}）`);
    }

    const availableIdentities = ROLE_DISTRIBUTIONS[playerCount];
    if (!availableIdentities || availableIdentities.length !== playerCount) {
      throw new Error(`缺少 ${playerCount} 人局的身份配置`);
    }
    const shuffledIdentities = shuffle(availableIdentities);
    const identities: Record<string, Identity> = {};
    ctx.players.forEach((playerId, index) => {
      identities[playerId] = shuffledIdentities[index];
    });

    const alive: Record<string, boolean> = Object.fromEntries(ctx.players.map((playerId) => [playerId, true]));
    const alive_identity: Record<Identity, number> = {
      werewolf: 0,
      seer: 0,
      witch: 0,
      hunter: 0,
      guard: 0,
      villager: 0,
    };
    Object.values(identities).forEach((identity) => {
      alive_identity[identity] = (alive_identity[identity] || 0) + 1;
    });

    const state: WerewolfState = {
      players: [...ctx.players],
      playerCount,
      identities,
      day: 1,
      phase: 'night',
      nightSubPhase: getInitialNightSubPhase(identities),
      pendingRoles: [],
      alive,
      dead_players: {},
      alive_identity,
      currentNightActions: {
        guard_target: null,
        werewolf_votes: {},
        werewolf_target: null,
        seer_target: null,
        seer_result: null,
        witch_save: false,
        witch_poison_target: null,
      },
      currentDayVotes: {},
      witchPotions: { antidote_used: false, poison_used: false },
      lastGuardTarget: null,
      hunterAlive: Object.values(identities).includes('hunter'),
      hunterCanShoot: true,
      deathHistory: [],
      nightHistory: [],
      voteHistory: [],
      speechHistory: [],
      lastNightDeaths: [],
      lastDayExile: null,
      hunterShootContext: null,
      lastWordsHistory: [],
      lastWordsContext: null,
      winner: null,
    };
    this.ensurePendingRoles(state);
    return state;
  }

  getCurrentRole(state: GameState): string {
    const s = state as WerewolfState;
    if (s.phase === 'game_over' || s.winner) return '__game_over__';
    return s.pendingRoles[0] ?? '__system__';
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as WerewolfState;
    if (s.phase === 'game_over' || s.winner) return { actions: [] };
    if (s.pendingRoles[0] !== roleId) return { actions: [] };

    switch (s.phase) {
      case 'night':
        return getNightLegalActions(s, roleId);
      case 'day_discussion':
        return getDayDiscussionLegalActions();
      case 'day_voting':
        return getDayVotingLegalActions(s);
      case 'last_words':
        return {
          actions: [{
            action_id: 'last_words',
            description: '发表遗言',
            params_schema: { content: { type: 'string', description: '请输入你的遗言' } },
          }],
        };
      case 'hunter_shoot':
        return getHunterLegalActions(s, roleId);
      default:
        return { actions: [] };
    }
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const nextState = cloneState(state) as WerewolfState;
    this.ensurePendingRoles(nextState);

    if (nextState.phase === 'game_over' || nextState.winner) {
      return { success: false, error: '游戏已结束', errorCode: 'GAME_FINISHED' };
    }
    const currentRole = nextState.pendingRoles[0];
    if (!currentRole) return { success: false, error: '当前没有可行动的角色', errorCode: 'NO_AVAILABLE_ACTOR' };
    if (currentRole !== action.role_id) return { success: false, error: '不是你的回合', errorCode: 'NOT_YOUR_TURN' };

    switch (nextState.phase) {
      case 'night':
        return this.applyNightAction(nextState, action);
      case 'day_discussion':
        return this.applyDayDiscussionAction(nextState, action);
      case 'day_voting':
        return this.applyDayVotingAction(nextState, action);
      case 'last_words':
        return this.applyLastWordsAction(nextState, action);
      case 'hunter_shoot':
        return this.applyHunterAction(nextState, action);
      default:
        return { success: false, error: '未知的游戏阶段', errorCode: 'INVALID_PHASE' };
    }
  }

  isTerminal(state: GameState): boolean {
    const s = state as WerewolfState;
    return s.phase === 'game_over' || s.winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as WerewolfState;
    if (!s.winner) return null;
    const winningCamp = s.winner;
    return s.players.filter((playerId) => getCamp(s.identities[playerId]) === winningCamp);
  }

  toRolePerspective(state: GameState, roleId: string, wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]): RolePerspective {
    return toRolePerspectiveImpl(
      state as WerewolfState,
      roleId,
      wholeHistory,
      diffHistory,
      (s, rid) => this.getLegalActions(s, rid),
      isSpectatorRole
    );
  }

  generateStatePrompt(perspective: RolePerspective): string {
    return generateStatePromptImpl(perspective);
  }

  private ensurePendingRoles(state: WerewolfState): void {
    ensurePendingRoles(state, {
      prepareNightSubPhase: (s, subPhase) => prepareNightSubPhase(s, subPhase),
      resolveNight: (s) => this.resolveNight(s),
      startDayVoting: (s) => startDayVoting(s),
      resolveDayVoting: (s) => this.resolveDayVoting(s),
    });
  }

  private resolveNight(state: WerewolfState): void {
    resolveNight(
      state,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startDayDiscussion(s)
    );
  }

  private resolveDayVoting(state: WerewolfState): void {
    resolveDayVoting(
      state,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startNextNight(s)
    );
  }

  private applyDeaths(state: WerewolfState, deaths: import('./types').DeathRecord[], resumePhaseIfHunter: 'day_discussion' | 'night'): void {
    applyDeaths(state, deaths, resumePhaseIfHunter);
  }

  private resumeAfterHunter(state: WerewolfState, shotDeath: import('./types').DeathRecord | null): void {
    resumeAfterHunter(
      state,
      shotDeath,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startDayDiscussion(s),
      (s) => startNextNight(s)
    );
  }

  private applyNightAction(state: WerewolfState, action: Action): ActionResult {
    const consumeActor = (s: WerewolfState) => consumeCurrentActor(s);
    switch (state.nightSubPhase) {
      case 'guard': {
        const result = applyGuardAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case 'werewolf': {
        const result = applyWerewolfAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case 'seer': {
        const result = applySeerAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case 'witch': {
        const result = applyWitchAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      default:
        return { success: false, error: '夜晚阶段未准备好', errorCode: 'INVALID_PHASE' };
    }
  }

  private applyDayDiscussionAction(state: WerewolfState, action: Action): ActionResult {
    const result = applyDayDiscussionAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) this.finalizeAction(state);
    return result;
  }

  private applyDayVotingAction(state: WerewolfState, action: Action): ActionResult {
    const result = applyDayVotingAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) this.finalizeAction(state);
    return result;
  }

  private applyLastWordsAction(state: WerewolfState, action: Action): ActionResult {
    if (action.action_id !== 'last_words') return { success: false, error: '无效的遗言行动', errorCode: 'INVALID_ACTION' };
    const content = action.params?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { success: false, error: '遗言内容不能为空', errorCode: 'INVALID_PARAMS' };
    }
    const context = state.lastWordsContext;
    if (!context) return { success: false, error: '当前没有待发表遗言的玩家', errorCode: 'NO_LAST_WORDS_CONTEXT' };
    const pendingDeath = context.pendingDeaths.find((d) => d.victim === action.role_id);
    if (!pendingDeath) return { success: false, error: '你不在待发表遗言的名单中', errorCode: 'NOT_IN_LAST_WORDS_LIST' };

    state.lastWordsHistory.push({ day: state.day, speaker: action.role_id, content, timestamp: new Date().toISOString() });
    context.completedLastWords.push(action.role_id);
    consumeCurrentActor(state);

    if (state.pendingRoles.length === 0) this.resumeAfterLastWords(state);
    this.finalizeAction(state);
    return { success: true, nextState: state };
  }

  private resumeAfterLastWords(state: WerewolfState): void {
    const context = state.lastWordsContext;
    if (!context) return;
    const deaths = context.pendingDeaths;
    const resumePhase = context.resumePhase;
    state.lastWordsContext = null;
    this.applyDeathsDirectly(state, deaths, resumePhase);
    if (state.phase !== 'hunter_shoot') {
      if (resumePhase === 'day_discussion') startDayDiscussion(state);
      else if (resumePhase === 'night') startNextNight(state);
    }
  }

  private applyDeathsDirectly(
    state: WerewolfState,
    deaths: import('./types').DeathRecord[],
    resumePhaseIfHunter: 'day_discussion' | 'night'
  ): void {
    for (let i = 0; i < deaths.length; i += 1) {
      const record = deaths[i];
      const victim = record.victim;
      if (!state.alive[victim]) continue;

      state.alive[victim] = false;
      const victimIdentity = state.identities[victim];
      state.dead_players[victim] = victimIdentity;
      state.alive_identity[victimIdentity] = Math.max(0, (state.alive_identity[victimIdentity] || 0) - 1);
      state.deathHistory.push(record);

      if (state.identities[victim] === 'hunter') {
        state.hunterAlive = false;
        if (record.cause === 'poison') state.hunterCanShoot = false;
        if (state.hunterCanShoot && record.cause !== 'poison') {
          state.phase = 'hunter_shoot';
          state.pendingRoles = [victim];
          state.hunterShootContext = { resumePhase: resumePhaseIfHunter, queuedDeaths: deaths.slice(i + 1) };
          return;
        }
      }
    }
    state.pendingRoles = state.pendingRoles.filter((playerId) => state.alive[playerId]);
  }

  private applyHunterAction(state: WerewolfState, action: Action): ActionResult {
    const result = applyHunterAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) {
      this.resumeAfterHunter(state, result.shotDeath);
      this.finalizeAction(state);
      return { success: true, nextState: state };
    }
    return { success: false, error: result.error ?? '猎人行动失败', errorCode: 'HUNTER_ACTION_FAILED' };
  }

  private finalizeAction(state: WerewolfState): void {
    this.ensurePendingRoles(state);
    if (state.phase !== 'hunter_shoot' && state.phase !== 'last_words') {
      updateWinnerIfNeeded(state);
    }
  }
}

export default new WerewolfLogic();
