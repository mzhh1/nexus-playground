import type { Action, ActionResult, ActionSpec } from '@nexusgame/game-sdk';
import type { DeathRecord, WerewolfState } from './types';
import { getAlivePlayers, getCamp, calculateWerewolfTarget, normalizeTargetFromAction } from './utils';

function buildTargetSchema(candidates: string[], desc: string) {
  return {
    target: {
      type: 'string',
      description: desc,
      enum: candidates,
    },
  };
}

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
  const alivePlayers = getAlivePlayers(state).filter((playerId) => playerId !== state.lastGuardTarget);
  const actions: NonNullable<ActionSpec['actions']> = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: 'guard',
      description: '守护一名玩家',
      params_schema: buildTargetSchema(alivePlayers, '要守护的玩家ID'),
    });
  }
  actions.push({ action_id: 'guard_skip', description: '不守护任何玩家', params_schema: null });
  return { actions };
}

export function getWerewolfLegalActions(state: WerewolfState): ActionSpec {
  const alivePlayers = getAlivePlayers(state);
  const actions: NonNullable<ActionSpec['actions']> = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: 'kill',
      description: '投票杀害一名玩家',
      params_schema: buildTargetSchema(alivePlayers, '要击杀的玩家ID'),
    });
  }
  actions.push({ action_id: 'kill_none', description: '本晚不杀人', params_schema: null });
  return { actions };
}

export function getSeerLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const candidates = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
  if (candidates.length === 0) return { actions: [] };
  return {
    actions: [{
      action_id: 'check',
      description: '查验一名玩家',
      params_schema: buildTargetSchema(candidates, '要查验的玩家ID'),
    }],
  };
}

export function getWitchLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const actions: NonNullable<ActionSpec['actions']> = [];
  const victim = state.currentNightActions.werewolf_target;
  if (!state.witchPotions.antidote_used && victim && victim !== roleId) {
    actions.push({ action_id: 'use_antidote', description: `使用解药救下 ${victim}`, params_schema: null });
  }
  if (!state.witchPotions.poison_used) {
    const candidates = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
    if (candidates.length > 0) {
      actions.push({
        action_id: 'use_poison',
        description: '使用毒药毒杀一名玩家',
        params_schema: buildTargetSchema(candidates, '要毒杀的玩家ID'),
      });
    }
  }
  actions.push({ action_id: 'witch_skip', description: '不使用任何药剂', params_schema: null });
  return { actions };
}

export function getDayDiscussionLegalActions(): ActionSpec {
  return {
    actions: [{
      action_id: 'speak',
      description: '发表发言',
      params_schema: {
        content: {
          type: 'string',
          description: '请输入你的发言内容',
        },
      },
    }],
  };
}

export function getDayVotingLegalActions(state: WerewolfState): ActionSpec {
  const alivePlayers = getAlivePlayers(state);
  const actions: NonNullable<ActionSpec['actions']> = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: 'vote',
      description: '投票放逐一名玩家',
      params_schema: buildTargetSchema(alivePlayers, '要放逐的玩家ID'),
    });
  }
  actions.push({ action_id: 'vote_skip', description: '弃票', params_schema: null });
  return { actions };
}

export function getHunterLegalActions(state: WerewolfState, roleId: string): ActionSpec {
  const alivePlayers = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
  const actions: NonNullable<ActionSpec['actions']> = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: 'shoot',
      description: '开枪带走一名玩家',
      params_schema: buildTargetSchema(alivePlayers, '要带走的玩家ID'),
    });
  }
  actions.push({ action_id: 'shoot_skip', description: '不开枪', params_schema: null });
  return { actions };
}

export function applyGuardAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  if (action.action_id === 'guard_skip') {
    state.currentNightActions.guard_target = null;
    consumeActor(state);
    return { success: true, nextState: state };
  }
  const targetId = normalizeTargetFromAction(action.action_id, action.params, 'guard');
  if (!targetId) return { success: false, error: '无效的守卫行动', errorCode: 'INVALID_ACTION' };
  if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法守护', errorCode: 'TARGET_DEAD' };
  if (state.lastGuardTarget && state.lastGuardTarget === targetId) {
    return { success: false, error: '守卫不能连续两晚守护同一名玩家', errorCode: 'REPEATED_GUARD' };
  }
  state.currentNightActions.guard_target = targetId;
  state.lastGuardTarget = targetId;
  consumeActor(state);
  return { success: true, nextState: state };
}

export function applyWerewolfAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  if (action.action_id === 'kill_none') {
    state.currentNightActions.werewolf_votes[action.role_id] = 'skip';
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, 'kill');
    if (!targetId) return { success: false, error: '无效的狼人行动', errorCode: 'INVALID_ACTION' };
    if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法被杀害', errorCode: 'TARGET_DEAD' };
    state.currentNightActions.werewolf_votes[action.role_id] = targetId;
  }
  consumeActor(state);
  if (state.pendingRoles.length === 0) {
    state.currentNightActions.werewolf_target = calculateWerewolfTarget(state);
  }
  return { success: true, nextState: state };
}

export function applySeerAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  const targetId = normalizeTargetFromAction(action.action_id, action.params, 'check');
  if (!targetId) return { success: false, error: '无效的预言家行动', errorCode: 'INVALID_ACTION' };
  if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法查验', errorCode: 'TARGET_DEAD' };
  if (targetId === action.role_id) return { success: false, error: '预言家不能查验自己', errorCode: 'INVALID_TARGET' };
  state.currentNightActions.seer_target = targetId;
  state.currentNightActions.seer_result = getCamp(state.identities[targetId]) === 'werewolf' ? 'werewolf' : 'good';
  consumeActor(state);
  return { success: true, nextState: state };
}

export function applyWitchAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  if (action.action_id === 'use_antidote') {
    const victim = state.currentNightActions.werewolf_target;
    if (!victim || victim === action.role_id) return { success: false, error: '当前无法使用解药', errorCode: 'INVALID_ACTION' };
    if (state.witchPotions.antidote_used) return { success: false, error: '解药已经用完', errorCode: 'POTION_USED' };
    state.currentNightActions.witch_save = true;
    state.witchPotions.antidote_used = true;
  } else if (action.action_id === 'witch_skip') {
    // noop
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, 'use_poison');
    if (!targetId) return { success: false, error: '无效的女巫行动', errorCode: 'INVALID_ACTION' };
    if (state.witchPotions.poison_used) return { success: false, error: '毒药已经用完', errorCode: 'POTION_USED' };
    if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法毒杀', errorCode: 'TARGET_DEAD' };
    if (targetId === action.role_id) return { success: false, error: '女巫不能毒杀自己', errorCode: 'INVALID_TARGET' };
    state.currentNightActions.witch_poison_target = targetId;
    state.witchPotions.poison_used = true;
  }
  consumeActor(state);
  return { success: true, nextState: state };
}

export function applyDayDiscussionAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  if (action.action_id !== 'speak') return { success: false, error: '无效的发言行动', errorCode: 'INVALID_ACTION' };
  const content = action.params?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { success: false, error: '发言内容不能为空', errorCode: 'INVALID_PARAMS' };
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

export function applyDayVotingAction(state: WerewolfState, action: Action, consumeActor: (s: WerewolfState) => void): ActionResult {
  if (action.action_id === 'vote_skip') {
    state.currentDayVotes[action.role_id] = 'skip';
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, 'vote');
    if (!targetId) return { success: false, error: '无效的投票行动', errorCode: 'INVALID_ACTION' };
    if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法被投票', errorCode: 'TARGET_DEAD' };
    state.currentDayVotes[action.role_id] = targetId;
  }
  consumeActor(state);
  return { success: true, nextState: state };
}

export function applyHunterAction(
  state: WerewolfState,
  action: Action,
  consumeActor: (s: WerewolfState) => void
): { success: boolean; error?: string; shotDeath: DeathRecord | null } {
  const hunterId = action.role_id;
  state.hunterCanShoot = false;
  let shotDeath: DeathRecord | null = null;

  if (action.action_id === 'shoot_skip') {
    // noop
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, 'shoot');
    if (!targetId) return { success: false, error: '无效的猎人行动', shotDeath: null };
    if (!state.alive[targetId]) return { success: false, error: '目标已出局，无法被带走', shotDeath: null };
    if (targetId === hunterId) return { success: false, error: '猎人不能带走自己', shotDeath: null };
    shotDeath = {
      day: state.day,
      phase: 'hunter_shoot',
      victim: targetId,
      cause: 'hunter',
    };
  }

  consumeActor(state);
  return { success: true, shotDeath };
}
