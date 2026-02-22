import type { Camp, DeathRecord, NightRecord, NightSubPhase, VoteRecord, WerewolfState } from './types';
import { getAlivePlayers, findAliveIdentity, getAliveWerewolves, hasAliveIdentity, isHunterShootPhase } from './utils';

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
    if (guard > 32) throw new Error('ensurePendingRoles safety break');

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
          if (isHunterShootPhase(state)) return;
          break;
        default:
          state.pendingRoles = [];
          return;
      }
    } else if (state.phase === 'day_discussion') {
      callbacks.startDayVoting(state);
    } else if (state.phase === 'day_voting') {
      callbacks.resolveDayVoting(state);
      if (isHunterShootPhase(state)) return;
    } else {
      break;
    }
  }
}

export function prepareNightSubPhase(state: WerewolfState, subPhase: NightSubPhase): void {
  state.phase = 'night';
  state.nightSubPhase = subPhase;
  state.pendingRoles = [];

  switch (subPhase) {
    case 'guard': {
      const guardId = findAliveIdentity(state, 'guard');
      if (guardId) state.pendingRoles = [guardId];
      break;
    }
    case 'werewolf':
      state.pendingRoles = getAliveWerewolves(state);
      break;
    case 'seer': {
      const seerId = findAliveIdentity(state, 'seer');
      if (seerId) state.pendingRoles = [seerId];
      break;
    }
    case 'witch': {
      const witchId = findAliveIdentity(state, 'witch');
      if (witchId) state.pendingRoles = [witchId];
      break;
    }
    default:
      state.pendingRoles = [];
      break;
  }
}

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
    if (guardProtected && savedByWitch) actualWerewolfKill = werewolfTarget;
    else if (guardProtected || savedByWitch) actualWerewolfKill = null;
    else actualWerewolfKill = werewolfTarget;
  }

  const nightDeaths: DeathRecord[] = [];
  if (actualWerewolfKill) {
    nightDeaths.push({ day: state.day, phase: 'night', victim: actualWerewolfKill, cause: 'werewolf' });
  }
  if (poisonTarget && !nightDeaths.some((record) => record.victim === poisonTarget)) {
    nightDeaths.push({ day: state.day, phase: 'night', victim: poisonTarget, cause: 'poison' });
  }

  const nightRecord: NightRecord = {
    night: state.day,
    guard_target: guardTarget,
    werewolf_target: werewolfTarget,
    werewolf_killed: actualWerewolfKill,
    seer_check: state.currentNightActions.seer_target
      ? { target: state.currentNightActions.seer_target, result: state.currentNightActions.seer_result ?? 'good' }
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
  if (state.phase === 'hunter_shoot' || state.phase === 'last_words') return;
  startDayDiscussionCallback(state);
}

export function startDayDiscussion(state: WerewolfState): void {
  state.phase = 'day_discussion';
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}

export function startDayVoting(state: WerewolfState): void {
  state.phase = 'day_voting';
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}

export function resolveDayVoting(
  state: WerewolfState,
  applyDeathsCallback: (s: WerewolfState, deaths: DeathRecord[], resumePhase: 'day_discussion' | 'night') => void,
  startNextNightCallback: (s: WerewolfState) => void
): void {
  const voteEntries = Object.entries(state.currentDayVotes).map(([voter, target]) => ({ voter, target }));
  const tally = new Map<string, number>();
  for (const { target } of voteEntries) {
    if (!target || target === 'skip') continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }

  let exiled: string | null = null;
  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  if (sorted.length > 0) {
    const [topTarget, topVotes] = sorted[0];
    const tied = sorted.filter(([, count]) => count === topVotes);
    if (tied.length === 1) exiled = topTarget;
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
    const death: DeathRecord = { day: state.day, phase: 'day_voting', victim: exiled, cause: 'vote' };
    applyDeathsCallback(state, [death], 'night');
    if (state.phase === 'hunter_shoot' || state.phase === 'last_words') return;
  } else {
    state.lastDayExile = null;
  }

  startNextNightCallback(state);
}

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

export function applyDeaths(state: WerewolfState, deaths: DeathRecord[], resumePhaseIfHunter: 'day_discussion' | 'night'): void {
  const actualDeaths = deaths.filter((record) => state.alive[record.victim]);
  if (actualDeaths.length === 0) return;

  state.phase = 'last_words';
  state.nightSubPhase = null;
  state.pendingRoles = actualDeaths.map((d) => d.victim);
  state.lastWordsContext = {
    pendingDeaths: actualDeaths,
    resumePhase: resumePhaseIfHunter,
    completedLastWords: [],
  };
}

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
  if (shotDeath) pendingDeaths.push(shotDeath);
  if (context) pendingDeaths.push(...context.queuedDeaths);

  if (pendingDeaths.length > 0) {
    applyDeathsCallback(state, pendingDeaths, context ? context.resumePhase : 'day_discussion');
    if (state.phase === 'hunter_shoot' || state.phase === 'last_words') return;
  }

  if (!context) {
    startDayDiscussionCallback(state);
    return;
  }

  if (context.resumePhase === 'night') startNextNightCallback(state);
  else startDayDiscussionCallback(state);
}

export function checkVictory(state: WerewolfState): Camp | null {
  const alivePlayers = getAlivePlayers(state);
  const aliveWerewolves = alivePlayers.filter((playerId) => state.identities[playerId] === 'werewolf');
  if (aliveWerewolves.length === 0) return 'villager';

  const aliveGods = alivePlayers.filter((playerId) => ['seer', 'witch', 'hunter', 'guard'].includes(state.identities[playerId]));
  const aliveVillagers = alivePlayers.filter((playerId) => state.identities[playerId] === 'villager');
  if (aliveGods.length === 0 || aliveVillagers.length === 0) return 'werewolf';
  return null;
}

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

export function consumeCurrentActor(state: WerewolfState): void {
  state.pendingRoles.shift();
}
