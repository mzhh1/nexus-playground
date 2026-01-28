import type { Camp, DeathRecord, NightRecord, NightSubPhase, VoteRecord, WerewolfState } from './types.js';
import {
  getAlivePlayers,
  findAliveIdentity,
  getAliveWerewolves,
  hasAliveIdentity,
  isHunterShootPhase,
} from './utils.js';

// ============ 阶段流转模块 ============

/**
 * 确保 pendingRoles 有待行动的角色
 */
export function ensurePendingRoles(
  state: WerewolfState,
  callbacks: {
    prepareNightSubPhase: (s: WerewolfState, subPhase: NightSubPhase) => void;
    resolveNight: (s: WerewolfState) => void;
    startDayVoting: (s: WerewolfState) => void;
    resolveDayVoting: (s: WerewolfState) => void;
  }
): void {
  if (state.phase === 'game_over') {
    state.pendingRoles = [];
    return;
  }

  let guard = 0;
  while (state.pendingRoles.length === 0) {
    guard += 1;
    if (guard > 32) {
      throw new Error('ensurePendingRoles safety break');
    }

    if (state.phase === 'night') {
      switch (state.nightSubPhase) {
        case 'guard':
          callbacks.prepareNightSubPhase(state, 'werewolf');
          break;
        case 'werewolf':
          callbacks.prepareNightSubPhase(state, 'seer');
          break;
        case 'seer':
          callbacks.prepareNightSubPhase(state, 'witch');
          break;
        case 'witch':
          callbacks.resolveNight(state);
          if (isHunterShootPhase(state)) {
            return;
          }
          break;
        default:
          state.pendingRoles = [];
          return;
      }
    } else if (state.phase === 'day_discussion') {
      callbacks.startDayVoting(state);
    } else if (state.phase === 'day_voting') {
      callbacks.resolveDayVoting(state);
      if (isHunterShootPhase(state)) {
        return;
      }
    } else {
      break;
    }
  }
}

/**
 * 准备夜晚子阶段
 */
export function prepareNightSubPhase(state: WerewolfState, subPhase: NightSubPhase): void {
  state.phase = 'night';
  state.nightSubPhase = subPhase;
  state.pendingRoles = [];

  switch (subPhase) {
    case 'guard': {
      const guardId = findAliveIdentity(state, 'guard');
      if (guardId) {
        state.pendingRoles = [guardId];
      }
      break;
    }
    case 'werewolf':
      state.pendingRoles = getAliveWerewolves(state);
      break;
    case 'seer': {
      const seerId = findAliveIdentity(state, 'seer');
      if (seerId) {
        state.pendingRoles = [seerId];
      }
      break;
    }
    case 'witch': {
      const witchId = findAliveIdentity(state, 'witch');
      if (witchId) {
        state.pendingRoles = [witchId];
      }
      break;
    }
    default:
      state.pendingRoles = [];
      break;
  }
}

/**
 * 解决夜晚阶段，计算死亡并进入白天讨论
 */
export function resolveNight(
  state: WerewolfState,
  applyDeathsCallback: (s: WerewolfState, deaths: DeathRecord[], resumePhase: 'day_discussion' | 'night') => void,
  startDayDiscussionCallback: (s: WerewolfState) => void
): void {
  const guardTarget = state.currentNightActions.guard_target;
  const werewolfTarget = state.currentNightActions.werewolf_target;
  const witchSaved = state.currentNightActions.witch_save;
  const poisonTarget = state.currentNightActions.witch_poison_target;

  let actualWerewolfKill: string | null = null;

  if (werewolfTarget) {
    const guardProtected = guardTarget === werewolfTarget;
    const savedByWitch = witchSaved;

    if (guardProtected && savedByWitch) {
      actualWerewolfKill = werewolfTarget; // 奶穿
    } else if (guardProtected || savedByWitch) {
      actualWerewolfKill = null;
    } else {
      actualWerewolfKill = werewolfTarget;
    }
  }

  const nightDeaths: DeathRecord[] = [];

  if (actualWerewolfKill) {
    nightDeaths.push({
      day: state.day,
      phase: 'night',
      victim: actualWerewolfKill,
      cause: 'werewolf',
    });
  }

  if (poisonTarget && !nightDeaths.some((record) => record.victim === poisonTarget)) {
    nightDeaths.push({
      day: state.day,
      phase: 'night',
      victim: poisonTarget,
      cause: 'poison',
    });
  }

  const nightRecord: NightRecord = {
    night: state.day,
    guard_target: guardTarget,
    werewolf_target: werewolfTarget,
    werewolf_killed: actualWerewolfKill,
    seer_check: state.currentNightActions.seer_target
      ? {
          target: state.currentNightActions.seer_target,
          result: state.currentNightActions.seer_result ?? 'good',
        }
      : null,
    witch_actions: {
      saved: witchSaved,
      poisoned: poisonTarget ?? null,
    },
  };

  state.nightHistory.push(nightRecord);
  state.lastNightDeaths = nightDeaths;
  state.lastDayExile = null;

  applyDeathsCallback(state, nightDeaths, 'day_discussion');

  if (state.phase === 'hunter_shoot' || state.phase === 'last_words') {
    return;
  }

  startDayDiscussionCallback(state);
}

/**
 * 开始白天讨论阶段
 */
export function startDayDiscussion(state: WerewolfState): void {
  state.phase = 'day_discussion';
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}

/**
 * 开始白天投票阶段
 */
export function startDayVoting(state: WerewolfState): void {
  state.phase = 'day_voting';
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}

/**
 * 解决白天投票，统计票数并进入下一夜
 */
export function resolveDayVoting(
  state: WerewolfState,
  applyDeathsCallback: (s: WerewolfState, deaths: DeathRecord[], resumePhase: 'day_discussion' | 'night') => void,
  startNextNightCallback: (s: WerewolfState) => void
): void {
  const voteEntries = Object.entries(state.currentDayVotes).map(([voter, target]) => ({
    voter,
    target,
  }));

  const tally = new Map<string, number>();

  for (const { target } of voteEntries) {
    if (!target || target === 'skip') {
      continue;
    }
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }

  let exiled: string | null = null;
  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  if (sorted.length > 0) {
    const [topTarget, topVotes] = sorted[0];
    const tied = sorted.filter(([, count]) => count === topVotes);
    if (tied.length === 1) {
      exiled = topTarget;
    }
  }

  const voteRecord: VoteRecord = {
    day: state.day,
    votes: voteEntries.map(({ voter, target }) => ({ voter, target })),
    exiled,
  };

  state.voteHistory.push(voteRecord);
  state.currentDayVotes = {};
  state.pendingRoles = [];

  if (exiled) {
    state.lastDayExile = exiled;
    const death: DeathRecord = {
      day: state.day,
      phase: 'day_voting',
      victim: exiled,
      cause: 'vote',
    };

    applyDeathsCallback(state, [death], 'night');
    if (state.phase === 'hunter_shoot' || state.phase === 'last_words') {
      return;
    }
  } else {
    state.lastDayExile = null;
  }

  startNextNightCallback(state);
}

/**
 * 开始下一个夜晚
 */
export function startNextNight(state: WerewolfState): void {
  state.day += 1;
  state.phase = 'night';
  state.nightSubPhase = null;
  state.pendingRoles = [];
  state.currentNightActions = {
    guard_target: null,
    werewolf_votes: {},
    werewolf_target: null,
    seer_target: null,
    seer_result: null,
    witch_save: false,
    witch_poison_target: null,
  };
  state.lastNightDeaths = [];

  const hasGuard = hasAliveIdentity(state, 'guard');
  prepareNightSubPhase(state, hasGuard ? 'guard' : 'werewolf');
}

/**
 * 应用死亡记录（先触发遗言环节）
 */
export function applyDeaths(
  state: WerewolfState,
  deaths: DeathRecord[],
  resumePhaseIfHunter: 'day_discussion' | 'night'
): void {
  // 过滤掉已经死亡的玩家
  const actualDeaths = deaths.filter(record => state.alive[record.victim]);
  
  if (actualDeaths.length === 0) {
    return;
  }

  // 进入遗言阶段
  state.phase = 'last_words';
  state.nightSubPhase = null;
  state.pendingRoles = actualDeaths.map(d => d.victim);
  state.lastWordsContext = {
    pendingDeaths: actualDeaths,
    resumePhase: resumePhaseIfHunter,
    completedLastWords: [],
  };
}

/**
 * 猎人开枪后恢复流程
 */
export function resumeAfterHunter(
  state: WerewolfState,
  shotDeath: DeathRecord | null,
  applyDeathsCallback: (s: WerewolfState, deaths: DeathRecord[], resumePhase: 'day_discussion' | 'night') => void,
  startDayDiscussionCallback: (s: WerewolfState) => void,
  startNextNightCallback: (s: WerewolfState) => void
): void {
  const context = state.hunterShootContext;
  state.hunterShootContext = null;

  const pendingDeaths: DeathRecord[] = [];
  if (shotDeath) {
    pendingDeaths.push(shotDeath);
  }
  if (context) {
    pendingDeaths.push(...context.queuedDeaths);
  }

  if (pendingDeaths.length > 0) {
    applyDeathsCallback(state, pendingDeaths, context ? context.resumePhase : 'day_discussion');
    // 如果触发了猎人开枪或遗言阶段，等待这些阶段完成
    if (state.phase === 'hunter_shoot' || state.phase === 'last_words') {
      return;
    }
  }

  if (!context) {
    startDayDiscussionCallback(state);
    return;
  }

  if (context.resumePhase === 'night') {
    startNextNightCallback(state);
  } else {
    startDayDiscussionCallback(state);
  }
}

/**
 * 检查游戏胜利条件
 */
export function checkVictory(state: WerewolfState): Camp | null {
  const alivePlayers = getAlivePlayers(state);

  const aliveWerewolves = alivePlayers.filter((playerId) => state.identities[playerId] === 'werewolf');
  if (aliveWerewolves.length === 0) {
    return 'villager';
  }

  const aliveGods = alivePlayers.filter((playerId) =>
    ['seer', 'witch', 'hunter', 'guard'].includes(state.identities[playerId])
  );

  const aliveVillagers = alivePlayers.filter((playerId) => state.identities[playerId] === 'villager');

  if (aliveGods.length === 0 || aliveVillagers.length === 0) {
    return 'werewolf';
  }

  return null;
}

/**
 * 更新胜利者（如果游戏结束）
 */
export function updateWinnerIfNeeded(state: WerewolfState): void {
  if (state.winner) {
    state.phase = 'game_over';
    state.pendingRoles = [];
    return;
  }

  const winner = checkVictory(state);
  if (winner) {
    state.winner = winner;
    state.phase = 'game_over';
    state.pendingRoles = [];
  }
}

/**
 * 消费当前行动者
 */
export function consumeCurrentActor(state: WerewolfState): void {
  state.pendingRoles.shift();
}

