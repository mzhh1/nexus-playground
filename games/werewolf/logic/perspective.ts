import type { RolePerspective, HistoryEvent } from '@nexusgame/game-sdk';
import type { Identity, Camp, NightSubPhase, WerewolfState } from './types';
import { WEREWOLF_RULES } from './config';
import { getAlivePlayers, getWerewolfTeammates, getSeerHistory, getCamp } from './utils';
import { formatStateToNaturalLanguage } from './stateFormatter';
import actionPrompts from './action-prompts.json';

export function toRolePerspective(
  state: WerewolfState,
  roleId: string,
  wholeHistory: HistoryEvent[],
  diffHistory: HistoryEvent[],
  getLegalActionsCallback: (s: WerewolfState, rid: string) => any,
  isSpectatorFn: (rid: string) => boolean
): RolePerspective {
  const knownIdentity = state.identities[roleId] ?? null;
  const isSpectator = isSpectatorFn(roleId) || knownIdentity === null;
  const identity = isSpectator ? null : knownIdentity;
  const isAlive = identity ? state.alive[roleId] : false;
  const isHunterShooting = state.phase === 'hunter_shoot' && state.pendingRoles[0] === roleId;
  const isGivingLastWords = state.phase === 'last_words' && state.pendingRoles.includes(roleId);
  const isDeadButActive = isHunterShooting || isGivingLastWords;
  const isCurrent = !isSpectator && (isAlive || isDeadButActive) && state.pendingRoles[0] === roleId;

  const baseState: Record<string, any> = {
    phase: state.phase,
    day: state.day,
    night_sub_phase: state.phase === 'night' ? state.nightSubPhase : null,
    alive_players: getAlivePlayers(state),
    dead_players: state.dead_players,
    alive_identity: state.alive_identity,
    last_night_deaths: state.lastNightDeaths.map(({ cause, ...rest }) => rest),
    last_day_exile: state.lastDayExile,
  };
  if (!isSpectator) baseState.my_role_id = roleId;
  if (state.phase === 'day_discussion') baseState.current_speaker = state.pendingRoles[0] ?? null;
  if (state.phase === 'day_voting') baseState.current_votes = state.currentDayVotes;
  if (state.phase === 'hunter_shoot') baseState.hunter_pending = state.pendingRoles[0] ?? null;
  if (state.phase === 'last_words') baseState.last_words_pending = state.pendingRoles;

  const todaySpeeches = state.speechHistory.filter((record) => record.day === state.day);
  if (todaySpeeches.length > 0) baseState.speech_history = todaySpeeches.map(({ timestamp, ...rest }) => rest);
  if (state.lastWordsHistory.length > 0) baseState.last_words_history = state.lastWordsHistory;
  if (isSpectator) baseState.pending_roles = state.pendingRoles;

  const identityInfo = getIdentitySpecificState(state, roleId, identity, isSpectator);
  const currentState = { ...baseState, ...identityInfo };

  const needActionSpace = !isSpectator && (isAlive || isDeadButActive);
  const actionSpace = needActionSpace ? getLegalActionsCallback(state, roleId) : { actions: [] };

  return {
    global_rules: WEREWOLF_RULES,
    whole_history: wholeHistory,
    diff_history: diffHistory,
    current_state: currentState,
    your_role: {
      identity: isSpectator ? 'Spectator (观战者)' : describeIdentity(identity!),
      goal: isSpectator ? '观看对局，学习推理与博弈策略。' : describeGoal(identity!),
      is_current: isCurrent,
    },
    action_space_definition: actionSpace,
    message: buildPerspectiveMessage(state, identity, isAlive, isSpectator, isCurrent),
  };
}

export function generateStatePrompt(perspective: RolePerspective): string {
  const { global_rules, current_state, your_role } = perspective;
  const roleIdText = current_state.my_role_id ? `ID: ${current_state.my_role_id}\n` : '';
  const formattedState = formatStateToNaturalLanguage(current_state);
  const sections: string[] = [];

  sections.push(`# 游戏规则\n${global_rules}`);
  sections.push(`# 你的身份\n${roleIdText}角色: ${your_role.identity}\n目标: ${your_role.goal}\n${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}`);
  if (formattedState.globalInfo) sections.push(`# 全局信息（公开信息）\n${formattedState.globalInfo}`);
  if (formattedState.perspectiveInfo) sections.push(`# 你的视角信息（私有信息）\n${formattedState.perspectiveInfo}`);
  const actionPrompt = getActionPrompt(perspective);
  if (actionPrompt) sections.push(`# 行动提示\n${actionPrompt}`);

  return sections.join('\n\n');
}

function getActionPrompt(perspective: RolePerspective): string | null {
  const { current_state, action_space_definition } = perspective;
  if (!action_space_definition.actions || action_space_definition.actions.length === 0) return null;
  if (!current_state.my_role_id) return null;

  const phase = current_state.phase as string;
  const nightSubPhase = current_state.night_sub_phase as string | null;
  if (phase === 'night' && nightSubPhase) return (actionPrompts as any).night?.[nightSubPhase]?.prompt || null;
  return (actionPrompts as any)[phase]?.default?.prompt || null;
}

export function getIdentitySpecificState(
  state: WerewolfState,
  roleId: string,
  identity: Identity | null,
  isSpectator: boolean
): Record<string, any> {
  if (state.phase === 'game_over') {
    return {
      all_identities: state.identities,
      night_history: state.nightHistory,
      vote_history: state.voteHistory,
      death_history: state.deathHistory,
      current_night_actions: state.currentNightActions,
    };
  }

  if (isSpectator) {
    return {
      all_identities: state.identities,
      night_history: state.nightHistory,
      vote_history: state.voteHistory,
      death_history: state.deathHistory,
      current_night_actions: state.currentNightActions,
    };
  }
  if (!identity) return {};

  switch (identity) {
    case 'werewolf':
      return {
        teammates: getWerewolfTeammates(state, roleId),
        werewolf_votes: state.currentNightActions.werewolf_votes,
        werewolf_target: state.currentNightActions.werewolf_target,
      };
    case 'seer':
      return {
        seer_checks: getSeerHistory(state),
        last_check: state.currentNightActions.seer_target
          ? { target: state.currentNightActions.seer_target, result: state.currentNightActions.seer_result }
          : null,
      };
    case 'witch':
      return {
        antidote_available: !state.witchPotions.antidote_used,
        poison_available: !state.witchPotions.poison_used,
        tonight_werewolf_target: state.currentNightActions.werewolf_target,
        tonight_poison_target: state.currentNightActions.witch_poison_target,
      };
    case 'guard':
      return { last_guard_target: state.lastGuardTarget };
    case 'hunter':
      return { can_shoot: state.hunterCanShoot, is_alive: state.hunterAlive };
    default:
      return {};
  }
}

export function describeIdentity(identity: Identity): string {
  const labels: Record<Identity, string> = {
    werewolf: '狼人',
    seer: '预言家',
    witch: '女巫',
    hunter: '猎人',
    guard: '守卫',
    villager: '平民',
  };
  return labels[identity];
}

export function describeGoal(identity: Identity): string {
  switch (identity) {
    case 'werewolf':
      return '隐藏身份，与狼队友协作击杀所有好人阵营角色。';
    case 'seer':
      return '夜晚查验玩家身份，将结论传递给好人阵营并找出狼人。';
    case 'witch':
      return '合理使用解药与毒药，守护同阵营并惩罚狼人。';
    case 'hunter':
      return '即便阵亡也要选择合适目标带走，帮助好人阵营。';
    case 'guard':
      return '夜晚守护关键角色，避免狼人屠杀核心力量。';
    case 'villager':
      return '通过发言和投票辨别狼人，与神职协同守护村庄。';
    default:
      return '帮助己方阵营取得胜利。';
  }
}

export function getCampLabel(camp: Camp | null): string {
  if (camp === 'werewolf') return '狼人阵营';
  if (camp === 'villager') return '好人阵营';
  return '未知阵营';
}

export function buildPerspectiveMessage(
  state: WerewolfState,
  identity: Identity | null,
  isAlive: boolean,
  isSpectator: boolean,
  isCurrent: boolean
): string {
  if (state.phase === 'game_over') {
    const campLabel = getCampLabel(state.winner);
    if (isSpectator || !identity) return `👀 观战模式 - ${campLabel}获胜`;
    const myCamp = getCamp(identity);
    if (state.winner && myCamp === state.winner) return `🎉 游戏结束 - ${campLabel}获胜，你的阵营取得胜利！`;
    return `😔 游戏结束 - ${campLabel}获胜，你的阵营遗憾落败。`;
  }
  if (isSpectator) return buildSpectatorMessage(state);
  if (!isAlive) return '💀 你已出局，可以继续观战并等待游戏结果。';

  switch (state.phase) {
    case 'night': {
      const label = formatNightSubPhase(state.nightSubPhase);
      return isCurrent ? `🌙 第${state.day}夜 - ${label}，请立即行动。` : `🌙 第${state.day}夜 - ${label}进行中，请耐心等待。`;
    }
    case 'day_discussion':
      return isCurrent ? `☀️ 第${state.day}天 - 轮到你发言，分享你的分析。` : `☀️ 第${state.day}天 - 等待其他玩家发言。`;
    case 'day_voting':
      return isCurrent ? `🗳️ 第${state.day}天 - 请投票决定要放逐的玩家。` : `🗳️ 第${state.day}天 - 等待其他玩家完成投票。`;
    case 'last_words':
      return isCurrent ? '💬 你即将阵亡，请发表你的遗言。' : '💬 等待即将阵亡的玩家发表遗言。';
    case 'hunter_shoot':
      return identity === 'hunter' ? '🔫 你已阵亡，可以选择是否带走一名玩家。' : '🔫 猎人在行动，请稍候片刻。';
    default:
      return '⏳ 等待游戏推进。';
  }
}

export function buildSpectatorMessage(state: WerewolfState): string {
  switch (state.phase) {
    case 'night':
      return `👀 观战模式 - 第${state.day}夜，${formatNightSubPhase(state.nightSubPhase)}。`;
    case 'day_discussion':
      return `👀 观战模式 - 第${state.day}天，讨论阶段。`;
    case 'day_voting':
      return `👀 观战模式 - 第${state.day}天，投票阶段。`;
    case 'last_words':
      return `👀 观战模式 - 第${state.day}天，遗言阶段。`;
    case 'hunter_shoot':
      return '👀 观战模式 - 猎人正在发动技能。';
    default:
      return '👀 观战模式 - 游戏进行中。';
  }
}

export function formatNightSubPhase(subPhase: NightSubPhase): string {
  const labels: Record<Exclude<NightSubPhase, null>, string> = {
    guard: '守卫行动',
    werewolf: '狼人行动',
    seer: '预言家查验',
    witch: '女巫用药',
  };
  if (!subPhase) return '夜晚阶段';
  return labels[subPhase];
}
