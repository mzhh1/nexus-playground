import type { Identity, Camp, NightSubPhase, WerewolfState } from './types';

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getInitialNightSubPhase(identities: Record<string, Identity>): NightSubPhase {
  return Object.values(identities).includes('guard') ? 'guard' : 'werewolf';
}

export function cloneState<T>(state: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

export function getAlivePlayers(state: WerewolfState): string[] {
  return state.players.filter((playerId) => state.alive[playerId]);
}

export function findAliveIdentity(state: WerewolfState, identity: Identity): string | null {
  return state.players.find((playerId) => state.alive[playerId] && state.identities[playerId] === identity) ?? null;
}

export function hasAliveIdentity(state: WerewolfState, identity: Identity): boolean {
  return findAliveIdentity(state, identity) !== null;
}

export function getAliveWerewolves(state: WerewolfState): string[] {
  return getAlivePlayers(state).filter((playerId) => state.identities[playerId] === 'werewolf');
}

export function getWerewolfTeammates(state: WerewolfState, roleId: string): string[] {
  return Object.entries(state.identities)
    .filter(([playerId, playerIdentity]) => playerIdentity === 'werewolf' && playerId !== roleId)
    .map(([playerId]) => playerId);
}

export function getSeerHistory(state: WerewolfState): Array<{ night: number; target: string; result: 'werewolf' | 'good' }> {
  return state.nightHistory
    .filter((record) => record.seer_check)
    .map((record) => ({
      night: record.night,
      target: record.seer_check!.target,
      result: record.seer_check!.result,
    }));
}

export function calculateWerewolfTarget(state: WerewolfState): string | null {
  const votes = state.currentNightActions.werewolf_votes;
  const tally = new Map<string, number>();

  Object.values(votes).forEach((target) => {
    if (!target || target === 'skip') return;
    if (!state.alive[target]) return;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  });

  if (tally.size === 0) return null;

  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const top = sorted[0];
  const tied = sorted.filter(([, count]) => count === top[1]);
  if (tied.length > 1) {
    return tied[Math.floor(Math.random() * tied.length)][0];
  }
  return top[0];
}

export function getCamp(identity: Identity): Camp {
  return identity === 'werewolf' ? 'werewolf' : 'villager';
}

export function isHunterShootPhase(state: WerewolfState): boolean {
  return state.phase === 'hunter_shoot';
}

export function normalizeTargetFromAction(actionId: string, params: any, legacyPrefix: string): string | null {
  if (params && typeof params.target === 'string' && params.target.trim().length > 0) {
    return params.target.trim();
  }
  const match = actionId.match(new RegExp(`^${legacyPrefix}_(.+)$`));
  return match ? match[1] : null;
}
