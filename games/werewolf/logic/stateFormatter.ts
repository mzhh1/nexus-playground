interface FormattedState {
  globalInfo: string;
  perspectiveInfo: string;
}

export function formatStateToNaturalLanguage(currentState: Record<string, any>): FormattedState {
  const globalInfo = formatGlobalInfo(currentState);
  const perspectiveInfo = formatPerspectiveInfo(currentState);
  return { globalInfo, perspectiveInfo };
}

function formatGlobalInfo(state: Record<string, any>): string {
  const sections: string[] = [];
  sections.push(formatGamePhase(state));
  sections.push(formatAliveStatus(state, state.last_words_history || []));

  if (state.last_night_deaths?.length > 0) sections.push(formatLastNightDeaths(state.last_night_deaths));
  if (state.last_day_exile) sections.push(`昨天被放逐的玩家：${state.last_day_exile}`);
  if (state.speech_history?.length > 0) sections.push(formatSpeechHistory(state.speech_history));
  if (state.phase === 'day_voting' && state.current_votes) sections.push(formatCurrentVotes(state.current_votes));
  if (state.phase === 'day_discussion' && state.current_speaker) sections.push(`当前发言者：${state.current_speaker}`);
  if (state.phase === 'hunter_shoot' && state.hunter_pending) sections.push(`猎人 ${state.hunter_pending} 正在决定是否开枪`);
  if (state.phase === 'last_words' && state.last_words_pending) {
    const players = Array.isArray(state.last_words_pending) ? state.last_words_pending.join('、') : state.last_words_pending;
    sections.push(`等待以下玩家发表遗言：${players}`);
  }
  return sections.filter(Boolean).join('\n\n');
}

function formatGamePhase(state: Record<string, any>): string {
  const day = state.day || 1;
  switch (state.phase) {
    case 'night':
      return `第 ${day} 夜 - ${formatNightSubPhaseLabel(state.night_sub_phase)}`;
    case 'day_discussion':
      return `第 ${day} 天 - 白天讨论阶段`;
    case 'day_voting':
      return `第 ${day} 天 - 公投放逐阶段`;
    case 'last_words':
      return `第 ${day} 天 - 遗言阶段`;
    case 'hunter_shoot':
      return `第 ${day} 天 - 猎人开枪阶段`;
    case 'game_over':
      return '游戏结束';
    default:
      return `第 ${day} 天`;
  }
}

function formatNightSubPhaseLabel(subPhase: string | null): string {
  const labels: Record<string, string> = {
    guard: '守卫守护',
    werewolf: '狼人击杀',
    seer: '预言家查验',
    witch: '女巫用药',
  };
  return subPhase ? (labels[subPhase] || '夜晚行动') : '夜晚阶段';
}

function formatAliveStatus(state: Record<string, any>, lastWords: any[] = []): string {
  const sections: string[] = [];
  if (Array.isArray(state.alive_players)) {
    sections.push(`存活玩家（${state.alive_players.length}人）：${state.alive_players.join('、')}`);
  }
  if (state.dead_players && Object.keys(state.dead_players).length > 0) {
    const lastWordsMap = new Map<string, string>();
    lastWords.forEach((words: any) => lastWordsMap.set(words.speaker, words.content));
    const deadInfoLines: string[] = [];
    Object.entries(state.dead_players).forEach(([player, identity]) => {
      const identityStr = translateIdentity(identity as string);
      const lastWord = lastWordsMap.get(player);
      if (lastWord) deadInfoLines.push(`- ${player}（${identityStr}）遗言："${lastWord}"`);
      else deadInfoLines.push(`- ${player}（${identityStr}）`);
    });
    sections.push(`已出局玩家：\n${deadInfoLines.join('\n')}`);
  }
  return sections.join('\n');
}

function formatLastNightDeaths(deaths: any[]): string {
  if (deaths.length === 0) return '昨晚是平安夜，无人死亡';
  return `昨晚死亡的玩家：${deaths.map((death: any) => death.victim).join('、')}`;
}

function formatSpeechHistory(speeches: any[]): string {
  const lines = speeches.map((speech: any, index: number) => `${index + 1}. ${speech.speaker}：${speech.content}`);
  return `今日发言记录：\n${lines.join('\n')}`;
}

function formatCurrentVotes(votes: Record<string, string>): string {
  if (Object.keys(votes).length === 0) return '当前还没有玩家投票';
  const voteCount: Record<string, string[]> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!voteCount[target]) voteCount[target] = [];
    voteCount[target].push(voter);
  }
  const lines = Object.entries(voteCount)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([target, voters]) => `- ${target}（${voters.length}票）：${voters.join('、')}`);
  return `当前投票情况：\n${lines.join('\n')}`;
}

function formatPerspectiveInfo(state: Record<string, any>): string {
  if (state.all_identities) return formatSpectatorInfo(state);
  if (!state.my_role_id) return '';
  if (state.teammates !== undefined) return formatWerewolfInfo(state);
  if (state.seer_checks !== undefined) return formatSeerInfo(state);
  if (state.antidote_available !== undefined || state.poison_available !== undefined) return formatWitchInfo(state);
  if (state.last_guard_target !== undefined) return formatGuardInfo(state);
  if (state.can_shoot !== undefined) return formatHunterInfo(state);
  return '你是平民，没有特殊技能，但你可以通过观察和推理帮助好人阵营找出狼人。';
}

function formatSpectatorInfo(state: Record<string, any>): string {
  const sections: string[] = ['【观战模式 - 全知视角】'];
  if (state.all_identities) {
    const identityList = Object.entries(state.all_identities)
      .map(([player, identity]) => `${player}: ${translateIdentity(identity as string)}`)
      .join('、');
    sections.push(`玩家身份：${identityList}`);
  }
  if (state.pending_roles?.length > 0) sections.push(`待行动角色：${state.pending_roles.join('、')}`);
  return sections.join('\n');
}

function formatWerewolfInfo(state: Record<string, any>): string {
  const teammates = Array.isArray(state.teammates) && state.teammates.length > 0 ? state.teammates.join('、') : '无';
  return `【你的身份：狼人】\n狼人队友：${teammates}`;
}

function formatSeerInfo(state: Record<string, any>): string {
  const checks = (state.seer_checks || [])
    .map((check: any) => `- 第${check.night}夜查验 ${check.target}：${check.result === 'werewolf' ? '狼人' : '好人'}`)
    .join('\n');
  return `【你的身份：预言家】\n${checks || '你还没有查验记录。'}`;
}

function formatWitchInfo(state: Record<string, any>): string {
  return `【你的身份：女巫】\n解药：${state.antidote_available ? '可用' : '已使用'}\n毒药：${state.poison_available ? '可用' : '已使用'}`;
}

function formatGuardInfo(state: Record<string, any>): string {
  return `【你的身份：守卫】\n上次守护：${state.last_guard_target || '无'}`;
}

function formatHunterInfo(state: Record<string, any>): string {
  return `【你的身份：猎人】\n技能：${state.can_shoot ? '可发动' : '不可发动'}`;
}

function translateIdentity(identity: string): string {
  const labels: Record<string, string> = {
    werewolf: '狼人',
    seer: '预言家',
    witch: '女巫',
    hunter: '猎人',
    guard: '守卫',
    villager: '平民',
  };
  return labels[identity] || identity;
}
