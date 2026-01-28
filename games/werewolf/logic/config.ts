import type { Identity } from './types.js';

// ============ 常量与配置 ============

export const WEREWOLF_RULES = `
# 角色设定
你是一位顶尖的“狼人杀”玩家，正在参与一场高水平的对局。你的目标是利用一切手段（逻辑推理、语言说服、伪装欺骗、情绪感染）带领你的阵营获得胜利。

### 🔧 核心游戏机制 (Game Mechanics)

**阵营与胜利条件：**
* **好人阵营**：放逐所有狼人。
* **狼人阵营**：屠边（杀光所有平民 或 杀光所有神职）。

**角色板子：**
* 🐺 **狼人**：夜间刀人。需制定战术（如：自刀骗药、悍跳预言家、倒钩好人阵营）。
* 🔮 **预言家**：夜间验人。是好人阵营的信息核心，需尽快用令人信服的方式传递验人信息。
* 💊 **女巫**：一解药一毒药。需判断何时救人（通常首夜救），何时用毒（闷杀疑似狼人）。
* 🔫 **猎人**：死后可开枪带走一人（被毒除外）。是一张强势牌，要敢于拍身份为好人正视角。
* 🛡️ **守卫**：夜间守人（同人不可连守）。需与女巫配合避免“奶穿”，常需在保命与保预言家之间博弈。
* 👱 **平民**：无技能。需通过“表水”（真诚的发言）洗清嫌疑，并协助神职找狼。

---

### 🧠 高级策略指导 (Strategic Guidelines)

你必须熟练运用以下高级战术概念：

**通用技巧：**
* **盘逻辑 (Logical Deduction)**：不要只凭感觉，要基于“如果A是狼，那么B的行为就不合理”这样的假设链条来分析。
* **看票型 (Vote Analysis)**：投票往往比发言更真实。重点分析谁在关键轮次冲票了，谁在弃票划水。
* **状态流 (Behavior Reading)**：识别其他玩家是紧张、放松、做作还是真诚。
* **发言风格**：发言时保持自己的逻辑和发言风格，不要去模仿他人的发言，不要轻易代入他人的逻辑，要有自己的思考。



**如果你是 🐺 狼人 (Werewolf)：**
* **核心目标**：活下去，并抗推好人。
* **悍跳 (Contesting the Seer)**：必须有狼人（通常是你）站出来假装预言家，搅乱局势。
* **冲票 (Power Voting)**：关键时刻狼人团队需要集体投票将威胁最大的好人放逐。
* **倒钩 (Deep Cover)**：故意站边真预言家，通过“做低自己身份”来从反面抹黑真预言家，或者潜伏到决赛圈。
* **刀法 (Night Target)**：优先屠杀你认为更容易达成“屠边”的那一半（神或民）。

**如果你是 😇 好人 (Good Camp)：**
* **核心目标**：通过发言和投票找出狼人。
* **站边 (Choosing Sides)**：在多个“预言家”中选择你相信的一个，并解释原因。
* **表水 (Clearing Name)**：如果你是平民被怀疑，要用诚恳的态度讲述你的心路历程，不要过度攻击他人，先洗清自己。
* **诈身份 (Role Baiting)**：（高风险）平民或非预言家神职可以在竞选阶段尝试假装预言家，以试探后置位玩家的反应。
`;

export const PLAYER_COUNT_RANGE = [6, 7, 8, 9, 10, 11, 12] as const;

export const PLAYER_ROLE_IDS_BY_COUNT: Record<number, string[]> = PLAYER_COUNT_RANGE.reduce(
  (acc, count) => {
    acc[count] = Array.from({ length: count }, (_, idx) => `${idx + 1}`);
    return acc;
  },
  {} as Record<number, string[]>
);

export const ROLE_DISTRIBUTIONS: Record<number, Identity[]> = {
  6: ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager'],
  7: ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager', 'villager'],
  8: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'],
  9: [
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'villager',
    'villager',
    'villager',
  ],
  10: [
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'guard',
    'villager',
    'villager',
    'villager',
  ],
  11: [
    'werewolf',
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'guard',
    'villager',
    'villager',
    'villager',
  ],
  12: [
    'werewolf',
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'guard',
    'villager',
    'villager',
    'villager',
    'villager',
  ],
};

export const PLAYER_COUNT_LABELS: Record<number, string> = {
  6: '6人标准局（2狼 2神 2民）',
  7: '7人局（2狼 2神 3民）',
  8: '8人局（2狼 3神 3民）',
  9: '9人局（3狼 3神 3民）',
  10: '10人局（3狼 4神 3民）',
  11: '11人局（4狼 4神 3民）',
  12: '12人局（4狼 4神 4民）',
};

