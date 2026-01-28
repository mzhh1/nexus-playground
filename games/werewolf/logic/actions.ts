import type {
  Action,
  ActionResult,
  ActionSpec,
} from '../../../backend/src/games/types.js';
import type { WerewolfState } from './types.js';
import {
  getAlivePlayers,
  getCamp,
  calculateWerewolfTarget,
} from './utils.js';

// ============ 合法行动生成 ============

export function getNightLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  switch (state.nightSubPhase) {
    case 'guard':
      return getGuardLegalActions(state);
    case 'werewolf':
      return getWerewolfLegalActions(state);
    case 'seer':
      return getSeerLegalActions(state, roleId);
    case 'witch':
      return getWitchLegalActions(state, roleId);
    default:
      return { actions: [] };
  }
}

export function getGuardLegalActions(state: WerewolfState): ActionSpec {
  const guardId = state.pendingRoles[0];
  if (!guardId) {
    return { actions: [] };
  }

  const alivePlayers = getAlivePlayers(state);
  const actions = alivePlayers
    .filter((playerId) => playerId !== state.lastGuardTarget)
    .map((playerId) => ({
      action_id: `guard_${playerId}`,
      description: `守护 ${playerId}`,
      params_schema: null,
    }));

  actions.push({
    action_id: 'guard_skip',
    description: '不守护任何玩家',
    params_schema: null,
  });

  return { actions };
}

export function getWerewolfLegalActions(state: WerewolfState): ActionSpec {
  const alivePlayers = getAlivePlayers(state);

  const actions = alivePlayers.map((playerId) => ({
    action_id: `kill_${playerId}`,
    description: `投票杀害 ${playerId}`,
    params_schema: null,
  }));

  actions.push({
    action_id: 'kill_none',
    description: '本晚不杀人',
    params_schema: null,
  });

  return { actions };
}

export function getSeerLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const actions = getAlivePlayers(state)
    .filter((playerId) => playerId !== roleId)
    .map((playerId) => ({
      action_id: `check_${playerId}`,
      description: `查验 ${playerId}`,
      params_schema: null,
    }));

  return { actions };
}

export function getWitchLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const actions = [] as ActionSpec['actions'];
  const victim = state.currentNightActions.werewolf_target;

  if (
    !state.witchPotions.antidote_used &&
    victim &&
    victim !== roleId
  ) {
    actions.push({
      action_id: 'use_antidote',
      description: `使用解药救下 ${victim}`,
      params_schema: null,
    });
  }

  if (!state.witchPotions.poison_used) {
    getAlivePlayers(state)
      .filter((playerId) => playerId !== roleId)
      .forEach((playerId) => {
        actions.push({
          action_id: `use_poison_${playerId}`,
          description: `使用毒药毒杀 ${playerId}`,
          params_schema: null,
        });
      });
  }

  actions.push({
    action_id: 'witch_skip',
    description: '不使用任何药剂',
    params_schema: null,
  });

  return { actions };
}

export function getDayDiscussionLegalActions(): ActionSpec {
  return {
    actions: [
      {
        action_id: 'speak',
        description: '发表发言',
        params_schema: {
          content: {
            type: 'string',
            description: '请输入你的发言内容',
          },
        },
      },
    ],
  };
}

export function getDayVotingLegalActions(state: WerewolfState): ActionSpec {
  const alivePlayers = getAlivePlayers(state);
  const actions = alivePlayers.map((playerId) => ({
    action_id: `vote_${playerId}`,
    description: `投票放逐 ${playerId}`,
    params_schema: null,
  }));

  actions.push({
    action_id: 'vote_skip',
    description: '弃票',
    params_schema: null,
  });

  return { actions };
}

export function getHunterLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const alivePlayers = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
  const actions = alivePlayers.map((playerId) => ({
    action_id: `shoot_${playerId}`,
    description: `开枪带走 ${playerId}`,
    params_schema: null,
  }));

  actions.push({
    action_id: 'shoot_skip',
    description: '不开枪',
    params_schema: null,
  });

  return { actions };
}

// ============ 行动应用 ============

export function applyGuardAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  if (action.action_id === 'guard_skip') {
    state.currentNightActions.guard_target = null;
    consumeActor(state);
    return { success: true, nextState: state };
  }

  const match = action.action_id.match(/^guard_(.+)$/);
  if (!match) {
    return {
      success: false,
      error: '无效的守卫行动',
      errorCode: 'INVALID_ACTION',
    };
  }

  const targetId = match[1];
  if (!state.alive[targetId]) {
    return {
      success: false,
      error: '目标已出局，无法守护',
      errorCode: 'TARGET_DEAD',
    };
  }

  if (state.lastGuardTarget && state.lastGuardTarget === targetId) {
    return {
      success: false,
      error: '守卫不能连续两晚守护同一名玩家',
      errorCode: 'REPEATED_GUARD',
    };
  }

  state.currentNightActions.guard_target = targetId;
  state.lastGuardTarget = targetId;

  consumeActor(state);

  return { success: true, nextState: state };
}

export function applyWerewolfAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  if (action.action_id === 'kill_none') {
    state.currentNightActions.werewolf_votes[action.role_id] = 'skip';
  } else {
    const match = action.action_id.match(/^kill_(.+)$/);
    if (!match) {
      return {
        success: false,
        error: '无效的狼人行动',
        errorCode: 'INVALID_ACTION',
      };
    }

    const targetId = match[1];
    if (!state.alive[targetId]) {
      return {
        success: false,
        error: '目标已出局，无法被杀害',
        errorCode: 'TARGET_DEAD',
      };
    }

    state.currentNightActions.werewolf_votes[action.role_id] = targetId;
  }

  consumeActor(state);

  if (state.pendingRoles.length === 0) {
    state.currentNightActions.werewolf_target = calculateWerewolfTarget(state);
  }

  return { success: true, nextState: state };
}

export function applySeerAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  const match = action.action_id.match(/^check_(.+)$/);
  if (!match) {
    return {
      success: false,
      error: '无效的预言家行动',
      errorCode: 'INVALID_ACTION',
    };
  }

  const targetId = match[1];
  if (!state.alive[targetId]) {
    return {
      success: false,
      error: '目标已出局，无法查验',
      errorCode: 'TARGET_DEAD',
    };
  }

  if (targetId === action.role_id) {
    return {
      success: false,
      error: '预言家不能查验自己',
      errorCode: 'INVALID_TARGET',
    };
  }

  state.currentNightActions.seer_target = targetId;
  state.currentNightActions.seer_result =
    getCamp(state.identities[targetId]) === 'werewolf' ? 'werewolf' : 'good';

  consumeActor(state);

  return { success: true, nextState: state };
}

export function applyWitchAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  if (action.action_id === 'use_antidote') {
    const victim = state.currentNightActions.werewolf_target;
    if (!victim || victim === action.role_id) {
      return {
        success: false,
        error: '当前无法使用解药',
        errorCode: 'INVALID_ACTION',
      };
    }

    if (state.witchPotions.antidote_used) {
      return {
        success: false,
        error: '解药已经用完',
        errorCode: 'POTION_USED',
      };
    }

    state.currentNightActions.witch_save = true;
    state.witchPotions.antidote_used = true;
  } else if (action.action_id === 'witch_skip') {
    // 不做任何操作
  } else if (action.action_id.startsWith('use_poison_')) {
    if (state.witchPotions.poison_used) {
      return {
        success: false,
        error: '毒药已经用完',
        errorCode: 'POTION_USED',
      };
    }

    const targetId = action.action_id.substring('use_poison_'.length);
    if (!state.alive[targetId]) {
      return {
        success: false,
        error: '目标已出局，无法毒杀',
        errorCode: 'TARGET_DEAD',
      };
    }

    if (targetId === action.role_id) {
      return {
        success: false,
        error: '女巫不能毒杀自己',
        errorCode: 'INVALID_TARGET',
      };
    }

    state.currentNightActions.witch_poison_target = targetId;
    state.witchPotions.poison_used = true;
  } else {
    return {
      success: false,
      error: '无效的女巫行动',
      errorCode: 'INVALID_ACTION',
    };
  }

  consumeActor(state);

  return { success: true, nextState: state };
}

export function applyDayDiscussionAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  if (action.action_id !== 'speak') {
    return {
      success: false,
      error: '无效的发言行动',
      errorCode: 'INVALID_ACTION',
    };
  }

  const content = action.params?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      success: false,
      error: '发言内容不能为空',
      errorCode: 'INVALID_PARAMS',
    };
  }

  state.speechHistory.push({
    day: state.day,
    speaker: action.role_id,
    content,
    timestamp: new Date().toISOString(),
  });

  consumeActor(state);

  return { success: true, nextState: state };
}

export function applyDayVotingAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): ActionResult {
  if (action.action_id === 'vote_skip') {
    state.currentDayVotes[action.role_id] = 'skip';
  } else {
    const match = action.action_id.match(/^vote_(.+)$/);
    if (!match) {
      return {
        success: false,
        error: '无效的投票行动',
        errorCode: 'INVALID_ACTION',
      };
    }

    const targetId = match[1];
    if (!state.alive[targetId]) {
      return {
        success: false,
        error: '目标已出局，无法被投票',
        errorCode: 'TARGET_DEAD',
      };
    }

    state.currentDayVotes[action.role_id] = targetId;
  }

  consumeActor(state);

  return { success: true, nextState: state };
}

export function applyHunterAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): { success: boolean; error?: string; shotDeath: import('./types.js').DeathRecord | null } {
  const hunterId = action.role_id;
  state.hunterCanShoot = false;

  let shotDeath: import('./types.js').DeathRecord | null = null;

  if (action.action_id === 'shoot_skip') {
    // do nothing
  } else if (action.action_id.startsWith('shoot_')) {
    const targetId = action.action_id.substring('shoot_'.length);

    if (!state.alive[targetId]) {
      return {
        success: false,
        error: '目标已出局，无法被带走',
        shotDeath: null,
      };
    }

    if (targetId === hunterId) {
      return {
        success: false,
        error: '猎人不能带走自己',
        shotDeath: null,
      };
    }

    shotDeath = {
      day: state.day,
      phase: 'hunter_shoot',
      victim: targetId,
      cause: 'hunter',
    };
  } else {
    return {
      success: false,
      error: '无效的猎人行动',
      shotDeath: null,
    };
  }

  consumeActor(state);

  return { success: true, shotDeath };
}

