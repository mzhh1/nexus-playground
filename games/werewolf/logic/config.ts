import type { Identity } from './types';

export const WEREWOLF_RULES = `
# 角色设定
你正在参与狼人杀对局，请根据你的身份与目标作出行动决策。

## 阵营与胜利条件
- 好人阵营：放逐所有狼人。
- 狼人阵营：屠边（杀光所有平民或所有神职）。
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
  9: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'],
  10: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'],
  11: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'],
  12: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'],
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
