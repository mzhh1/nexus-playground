import type { Identity, Camp, NightSubPhase, WerewolfState } from './types.js';

// ============ 工具函数 ============

/**
 * 洗牌算法
 */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 获取初始夜晚子阶段
 */
export function getInitialNightSubPhase(identities: Record<string, Identity>): NightSubPhase {
  return Object.values(identities).includes('guard') ? 'guard' : 'werewolf';
}

/**
 * 深拷贝状态
 */
export function cloneState<T>(state: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

/**
 * 清除对象中的 undefined 字段
 */
export function cleanseUndefined(target: Record<string, any>): void {
  Object.keys(target).forEach((key) => {
    if (target[key] === undefined) {
      delete target[key];
    }
  });
}

/**
 * 获取存活玩家列表
 */
export function getAlivePlayers(state: WerewolfState): string[] {
  return state.players.filter((playerId) => state.alive[playerId]);
}

/**
 * 查找存活的指定身份玩家
 */
export function findAliveIdentity(state: WerewolfState, identity: Identity): string | null {
  return (
    state.players.find((playerId) => state.alive[playerId] && state.identities[playerId] === identity) ?? null
  );
}

/**
 * 检查是否存在存活的指定身份玩家
 */
export function hasAliveIdentity(state: WerewolfState, identity: Identity): boolean {
  return findAliveIdentity(state, identity) !== null;
}

/**
 * 获取存活的狼人列表
 */
export function getAliveWerewolves(state: WerewolfState): string[] {
  return getAlivePlayers(state).filter((playerId) => state.identities[playerId] === 'werewolf');
}

/**
 * 获取狼人队友列表（不包括自己）
 */
export function getWerewolfTeammates(state: WerewolfState, roleId: string): string[] {
  return Object.entries(state.identities)
    .filter(([playerId, playerIdentity]) => playerIdentity === 'werewolf' && playerId !== roleId)
    .map(([playerId]) => playerId);
}

/**
 * 获取预言家历史查验记录
 */
export function getSeerHistory(state: WerewolfState): Array<{ night: number; target: string; result: 'werewolf' | 'good' }> {
  return state.nightHistory
    .filter((record) => record.seer_check)
    .map((record) => ({
      night: record.night,
      target: record.seer_check!.target,
      result: record.seer_check!.result,
    }));
}

/**
 * 计算狼人投票目标
 */
export function calculateWerewolfTarget(state: WerewolfState): string | null {
  const votes = state.currentNightActions.werewolf_votes;
  const tally = new Map<string, number>();

  Object.values(votes).forEach((target) => {
    if (!target || target === 'skip') {
      return;
    }
    if (!state.alive[target]) {
      return;
    }
    tally.set(target, (tally.get(target) ?? 0) + 1);
  });

  if (tally.size === 0) {
    return null;
  }

  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const top = sorted[0];
  const tied = sorted.filter(([, count]) => count === top[1]);
  if (tied.length > 1) {
    // 平票时随机选择一名
    const randomIndex = Math.floor(Math.random() * tied.length);
    return tied[randomIndex][0];
  }

  return top[0];
}

/**
 * 获取身份对应的阵营
 */
export function getCamp(identity: Identity): Camp {
  return identity === 'werewolf' ? 'werewolf' : 'villager';
}

/**
 * 判断是否处于猎人开枪阶段
 */
export function isHunterShootPhase(state: WerewolfState): boolean {
  return state.phase === 'hunter_shoot';
}

