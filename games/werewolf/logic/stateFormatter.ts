/**
 * 游戏状态格式化模块
 * 负责将state json转换为LLM更易理解的自然语言描述
 * 明确区分全局信息和视角信息
 */

// ============ 类型定义 ============

interface FormattedState {
  globalInfo: string; // 全局信息：所有玩家都能看到的公开信息
  perspectiveInfo: string; // 视角信息：特定玩家视角的私有信息
}

// ============ 主要导出函数 ============

/**
 * 将游戏状态转换为结构化的自然语言描述
 * @param currentState 当前游戏状态（已经经过视角过滤）
 * @returns 包含全局信息和视角信息的格式化文本
 */
export function formatStateToNaturalLanguage(currentState: Record<string, any>): FormattedState {
  const globalInfo = formatGlobalInfo(currentState);
  const perspectiveInfo = formatPerspectiveInfo(currentState);

  return { globalInfo, perspectiveInfo };
}

// ============ 全局信息格式化 ============

/**
 * 格式化全局信息（公开信息）
 */
function formatGlobalInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  // 1. 游戏阶段
  sections.push(formatGamePhase(state));

  // 2. 存活状态（包含已出局玩家的身份和遗言）
  sections.push(formatAliveStatus(state, state.last_words_history || []));

  // 3. 昨晚死亡情况
  if (state.last_night_deaths && state.last_night_deaths.length > 0) {
    sections.push(formatLastNightDeaths(state.last_night_deaths));
  }

  // 4. 昨天放逐情况
  if (state.last_day_exile) {
    sections.push(formatLastDayExile(state.last_day_exile));
  }

  // 5. 今日发言历史
  if (state.speech_history && state.speech_history.length > 0) {
    sections.push(formatSpeechHistory(state.speech_history));
  }

  // 6. 当前投票状态（投票阶段）
  if (state.phase === 'day_voting' && state.current_votes) {
    sections.push(formatCurrentVotes(state.current_votes));
  }

  // 7. 当前发言者（讨论阶段）
  if (state.phase === 'day_discussion' && state.current_speaker) {
    sections.push(`当前发言者：${state.current_speaker}`);
  }

  // 8. 猎人待行动（猎人开枪阶段）
  if (state.phase === 'hunter_shoot' && state.hunter_pending) {
    sections.push(`猎人 ${state.hunter_pending} 正在决定是否开枪`);
  }

  // 9. 待发表遗言的玩家（遗言阶段）
  if (state.phase === 'last_words' && state.last_words_pending) {
    const players = Array.isArray(state.last_words_pending) 
      ? state.last_words_pending.join('、') 
      : state.last_words_pending;
    sections.push(`等待以下玩家发表遗言：${players}`);
  }

  return sections.filter(s => s.length > 0).join('\n\n');
}

/**
 * 格式化游戏阶段
 */
function formatGamePhase(state: Record<string, any>): string {
  const day = state.day || 1;
  const phase = state.phase;

  switch (phase) {
    case 'night': {
      const subPhase = state.night_sub_phase;
      const subPhaseLabel = formatNightSubPhaseLabel(subPhase);
      return `**第 ${day} 夜 - ${subPhaseLabel}**`;
    }
    case 'day_discussion':
      return `**第 ${day} 天 - 白天讨论阶段**`;
    case 'day_voting':
      return `**第 ${day} 天 - 公投放逐阶段**`;
    case 'last_words':
      return `**第 ${day} 天 - 遗言阶段**`;
    case 'hunter_shoot':
      return `**第 ${day} 天 - 猎人开枪阶段**`;
    case 'game_over':
      return `**游戏结束**`;
    default:
      return `**第 ${day} 天**`;
  }
}

/**
 * 格式化夜晚子阶段标签
 */
function formatNightSubPhaseLabel(subPhase: string | null): string {
  const labels: Record<string, string> = {
    guard: '守卫守护',
    werewolf: '狼人击杀',
    seer: '预言家查验',
    witch: '女巫用药',
  };
  return subPhase ? (labels[subPhase] || '夜晚行动') : '夜晚阶段';
}

/**
 * 格式化存活状态
 */
function formatAliveStatus(state: Record<string, any>, lastWords: any[] = []): string {
  const sections: string[] = [];

  // 存活玩家列表
  if (state.alive_players && Array.isArray(state.alive_players)) {
    sections.push(`存活玩家（${state.alive_players.length}人）：${state.alive_players.join('、')}`);
  }

  // 已死亡玩家及其身份和遗言
  if (state.dead_players && Object.keys(state.dead_players).length > 0) {
    // 创建遗言映射表，方便查找
    const lastWordsMap = new Map<string, string>();
    if (lastWords && Array.isArray(lastWords)) {
      lastWords.forEach((words: any) => {
        lastWordsMap.set(words.speaker, words.content);
      });
    }

    const deadInfoLines: string[] = [];
    Object.entries(state.dead_players).forEach(([player, identity]) => {
      const identityStr = translateIdentity(identity as string);
      const lastWord = lastWordsMap.get(player);
      
      if (lastWord) {
        deadInfoLines.push(`  - ${player}（${identityStr}）\n    遗言："${lastWord}"`);
      } else {
        deadInfoLines.push(`  - ${player}（${identityStr}）`);
      }
    });
    
    sections.push(`**已出局玩家：**\n${deadInfoLines.join('\n')}`);
  }

  // 各身份存活数量
  if (state.alive_identity) {
    const identityCounts: string[] = [];
    const identityOrder = ['werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager'];
    
    for (const identity of identityOrder) {
      const count = state.alive_identity[identity];
      if (count !== undefined && count > 0) {
        identityCounts.push(`${translateIdentity(identity)}×${count}`);
      }
    }
    
    if (identityCounts.length > 0) {
      sections.push(`存活身份分布：${identityCounts.join('、')}`);
    }
  }

  return sections.join('\n');
}

/**
 * 格式化昨晚死亡情况
 */
function formatLastNightDeaths(deaths: any[]): string {
  if (deaths.length === 0) {
    return '昨晚是平安夜，无人死亡';
  }

  const deathDescriptions = deaths.map((death: any) => {
    const victim = death.victim;
    // 注意：这里的cause已经被过滤掉了（在perspective.ts中），所以不显示死因
    return `${victim}`;
  });

  return `昨晚死亡的玩家：${deathDescriptions.join('、')}`;
}

/**
 * 格式化昨天放逐情况
 */
function formatLastDayExile(exile: string): string {
  return `昨天被放逐的玩家：${exile}`;
}

/**
 * 格式化发言历史
 */
function formatSpeechHistory(speeches: any[]): string {
  if (speeches.length === 0) {
    return '';
  }

  const lines = speeches.map((speech: any, index: number) => {
    const speaker = speech.speaker;
    const content = speech.content;
    return `${index + 1}. ${speaker}：${content}`;
  });

  return `**今日发言记录：**\n${lines.join('\n')}`;
}

/**
 * 格式化当前投票状态
 */
function formatCurrentVotes(votes: Record<string, string>): string {
  if (Object.keys(votes).length === 0) {
    return '当前还没有玩家投票';
  }

  // 统计每个被投票者收到的票数
  const voteCount: Record<string, string[]> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!voteCount[target]) {
      voteCount[target] = [];
    }
    voteCount[target].push(voter);
  }

  const lines = Object.entries(voteCount)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([target, voters]) => {
      return `- ${target}（${voters.length}票）：${voters.join('、')}`;
    });

  return `**当前投票情况：**\n${lines.join('\n')}`;
}

// ============ 视角信息格式化 ============

/**
 * 格式化视角信息（私有信息）
 */
function formatPerspectiveInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  // 观战者视角
  if (state.all_identities) {
    sections.push(formatSpectatorInfo(state));
    return sections.join('\n\n');
  }

  // 玩家视角 - 根据不同身份显示不同信息
  const myRoleId = state.my_role_id;
  if (!myRoleId) {
    return '';
  }

  // 狼人视角
  if (state.teammates !== undefined) {
    sections.push(formatWerewolfInfo(state, myRoleId));
  }
  // 预言家视角
  else if (state.seer_checks !== undefined) {
    sections.push(formatSeerInfo(state));
  }
  // 女巫视角
  else if (state.antidote_available !== undefined || state.poison_available !== undefined) {
    sections.push(formatWitchInfo(state));
  }
  // 守卫视角
  else if (state.last_guard_target !== undefined) {
    sections.push(formatGuardInfo(state));
  }
  // 猎人视角
  else if (state.can_shoot !== undefined) {
    sections.push(formatHunterInfo(state));
  }
  // 平民视角
  else {
    sections.push('你是平民，没有特殊技能，但你可以通过观察和推理帮助好人阵营找出狼人。');
  }

  return sections.filter(s => s.length > 0).join('\n\n');
}

/**
 * 格式化观战者信息
 */
function formatSpectatorInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  sections.push('**【观战模式 - 全知视角】**');

  // 所有玩家身份
  if (state.all_identities) {
    const identityList = Object.entries(state.all_identities)
      .map(([player, identity]) => `${player}: ${translateIdentity(identity as string)}`)
      .join('、');
    sections.push(`玩家身份：${identityList}`);
  }

  // 当前待行动角色
  if (state.pending_roles && state.pending_roles.length > 0) {
    sections.push(`待行动角色：${state.pending_roles.join('、')}`);
  }

  // 夜晚行动历史
  if (state.night_history && state.night_history.length > 0) {
    sections.push(formatNightHistory(state.night_history));
  }

  // 投票历史
  if (state.vote_history && state.vote_history.length > 0) {
    sections.push(formatVoteHistory(state.vote_history));
  }

  // 死亡历史
  if (state.death_history && state.death_history.length > 0) {
    sections.push(formatDeathHistory(state.death_history));
  }

  // 当前夜晚行动（如果是夜晚阶段）
  if (state.current_night_actions && state.phase === 'night') {
    sections.push(formatCurrentNightActions(state.current_night_actions));
  }

  return sections.join('\n\n');
}

/**
 * 格式化狼人信息
 */
function formatWerewolfInfo(state: Record<string, any>, myRoleId: string): string {
  const sections: string[] = [];

  sections.push('**【你的身份：狼人】**');
  sections.push('你可以在夜晚与狼队友协商并投票击杀一名玩家。');

  // 狼队友信息
  if (state.teammates && state.teammates.length > 0) {
    const teammates = state.teammates.filter((t: string) => t !== myRoleId);
    if (teammates.length > 0) {
      sections.push(`你的狼队友：${teammates.join('、')}`);
    } else {
      sections.push('你是唯一的狼人');
    }
  }

  // 当前狼人投票情况
  if (state.werewolf_votes && Object.keys(state.werewolf_votes).length > 0) {
    const votes = Object.entries(state.werewolf_votes)
      .map(([voter, target]) => `${voter} → ${target}`)
      .join('、');
    sections.push(`当前狼人投票：${votes}`);
  }

  // 狼人最终目标
  if (state.werewolf_target) {
    sections.push(`今晚的击杀目标：${state.werewolf_target}`);
  }

  return sections.join('\n');
}

/**
 * 格式化预言家信息
 */
function formatSeerInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  sections.push('**【你的身份：预言家】**');
  sections.push('你可以在夜晚查验一名玩家的身份。');

  // 历史查验记录
  if (state.seer_checks && state.seer_checks.length > 0) {
    const checks = state.seer_checks.map((check: any) => {
      const target = check.target;
      const result = check.result === 'werewolf' ? '狼人' : '好人';
      return `- 第${check.night}夜查验了 ${target}，结果是【${result}】`;
    });
    sections.push(`**你的查验记录：**\n${checks.join('\n')}`);
  } else {
    sections.push('你还没有查验过任何玩家');
  }

  // 本轮查验结果
  if (state.last_check && state.last_check.target) {
    const result = state.last_check.result === 'werewolf' ? '狼人' : '好人';
    sections.push(`本轮查验：${state.last_check.target} 是【${result}】`);
  }

  return sections.join('\n');
}

/**
 * 格式化女巫信息
 */
function formatWitchInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  sections.push('**【你的身份：女巫】**');
  sections.push('你拥有解药和毒药各一瓶，可以在夜晚使用。');

  // 药品状态
  const potionStatus: string[] = [];
  if (state.antidote_available !== undefined) {
    potionStatus.push(`解药：${state.antidote_available ? '✓ 可用' : '✗ 已使用'}`);
  }
  if (state.poison_available !== undefined) {
    potionStatus.push(`毒药：${state.poison_available ? '✓ 可用' : '✗ 已使用'}`);
  }
  if (potionStatus.length > 0) {
    sections.push(potionStatus.join('、'));
  }

  // 今晚狼人目标
  if (state.tonight_werewolf_target) {
    sections.push(`今晚狼人的击杀目标：${state.tonight_werewolf_target}`);
  } else if (state.tonight_werewolf_target === null && state.antidote_available) {
    sections.push('今晚狼人没有击杀目标（或你还未被告知）');
  }

  // 今晚毒药目标
  if (state.tonight_poison_target) {
    sections.push(`你今晚使用毒药的目标：${state.tonight_poison_target}`);
  }

  return sections.join('\n');
}

/**
 * 格式化守卫信息
 */
function formatGuardInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  sections.push('**【你的身份：守卫】**');
  sections.push('你可以在夜晚守护一名玩家，但不能连续两夜守护同一人。');

  // 上一次守护目标
  if (state.last_guard_target) {
    sections.push(`上一次你守护了：${state.last_guard_target}（今晚不能再守护此人）`);
  } else {
    sections.push('这是你第一次守护，可以守护任何人');
  }

  return sections.join('\n');
}

/**
 * 格式化猎人信息
 */
function formatHunterInfo(state: Record<string, any>): string {
  const sections: string[] = [];

  sections.push('**【你的身份：猎人】**');
  sections.push('当你被杀死时（非毒死），可以开枪带走一名玩家。');

  if (state.can_shoot !== undefined) {
    if (state.can_shoot) {
      sections.push('你的技能可用');
    } else {
      sections.push('你的技能已失效（被女巫毒死）');
    }
  }

  return sections.join('\n');
}

/**
 * 格式化夜晚历史
 */
function formatNightHistory(nightHistory: any[]): string {
  if (nightHistory.length === 0) {
    return '';
  }

  const lines = nightHistory.map((record: any) => {
    const night = record.night;
    const parts: string[] = [];
    
    if (record.guard_target) {
      parts.push(`守卫守护了${record.guard_target}`);
    }
    if (record.werewolf_target) {
      parts.push(`狼人袭击了${record.werewolf_target}`);
    }
    if (record.werewolf_killed) {
      parts.push(`实际击杀了${record.werewolf_killed}`);
    }
    if (record.seer_check) {
      const result = record.seer_check.result === 'werewolf' ? '狼人' : '好人';
      parts.push(`预言家查验了${record.seer_check.target}（${result}）`);
    }
    if (record.witch_actions?.saved) {
      parts.push('女巫使用了解药');
    }
    if (record.witch_actions?.poisoned) {
      parts.push(`女巫毒死了${record.witch_actions.poisoned}`);
    }

    return `- 第${night}夜：${parts.join('，')}`;
  });

  return `**夜晚行动历史：**\n${lines.join('\n')}`;
}

/**
 * 格式化投票历史
 */
function formatVoteHistory(voteHistory: any[]): string {
  if (voteHistory.length === 0) {
    return '';
  }

  const lines = voteHistory.map((record: any) => {
    const day = record.day;
    const exiled = record.exiled || '平票，无人被放逐';
    const voteDetails = record.votes
      .map((v: any) => `${v.voter}→${v.target}`)
      .join('、');
    return `- 第${day}天：${voteDetails} | 结果：${exiled}`;
  });

  return `**投票历史：**\n${lines.join('\n')}`;
}

/**
 * 格式化死亡历史
 */
function formatDeathHistory(deathHistory: any[]): string {
  if (deathHistory.length === 0) {
    return '';
  }

  const lines = deathHistory.map((record: any) => {
    const day = record.day;
    const phase = translatePhase(record.phase);
    const victim = record.victim;
    const cause = translateCause(record.cause);
    return `- 第${day}天${phase}：${victim} ${cause}`;
  });

  return `**死亡历史：**\n${lines.join('\n')}`;
}

/**
 * 格式化当前夜晚行动
 */
function formatCurrentNightActions(actions: any): string {
  const parts: string[] = [];

  if (actions.guard_target) {
    parts.push(`守卫守护：${actions.guard_target}`);
  }
  if (actions.werewolf_target) {
    parts.push(`狼人目标：${actions.werewolf_target}`);
  }
  if (actions.seer_target) {
    const result = actions.seer_result === 'werewolf' ? '狼人' : '好人';
    parts.push(`预言家查验：${actions.seer_target}（${result}）`);
  }
  if (actions.witch_save) {
    parts.push('女巫使用了解药');
  }
  if (actions.witch_poison_target) {
    parts.push(`女巫毒药目标：${actions.witch_poison_target}`);
  }

  if (parts.length === 0) {
    return '当前夜晚还没有行动';
  }

  return `**当前夜晚行动：**\n${parts.join('\n')}`;
}

// ============ 辅助翻译函数 ============

/**
 * 翻译身份
 */
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

/**
 * 翻译阶段
 */
function translatePhase(phase: string): string {
  const labels: Record<string, string> = {
    night: '夜晚',
    day_voting: '投票',
    hunter_shoot: '猎人开枪',
  };
  return labels[phase] || phase;
}

/**
 * 翻译死因
 */
function translateCause(cause: string): string {
  const labels: Record<string, string> = {
    werewolf: '被狼人杀死',
    poison: '被女巫毒死',
    vote: '被投票放逐',
    hunter: '被猎人射杀',
  };
  return labels[cause] || cause;
}

