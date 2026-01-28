# 狼人杀游戏逻辑设计文档

**版本**: 1.0  
**最后更新**: 2025-11-06

---

## 目录

1. [设计理念](#1-设计理念)
2. [游戏状态结构](#2-游戏状态结构)
3. [阶段流转系统](#3-阶段流转系统)
4. [视角生成策略](#4-视角生成策略)
5. [行动空间设计](#5-行动空间设计)
6. [胜利条件判断](#6-胜利条件判断)
7. [完整游戏流程示例](#7-完整游戏流程示例)

---

## 1. 设计理念

### 1.1 核心观察

**关键洞察：视角主要由阶段决定，而非身份**

在狼人杀中：
- ✅ **白天讨论**：所有存活玩家看到相同的公开信息（死亡名单、发言历史）
- ✅ **投票阶段**：所有存活玩家都能投票，看到相同的候选人列表
- ✅ **夜晚非自己阶段**：所有玩家闭眼，看到"等待其他角色行动"
- ❌ **夜晚自己阶段**：只有特定身份的玩家看到行动选项

**设计启示**：
- 视角生成的第一判断标准是**当前阶段**
- 身份只在**特定阶段**才影响视角（主要是夜晚行动阶段）
- 大部分时间，玩家看到的是"阶段公共视角"，而非"身份私密视角"

### 1.2 两层映射机制

#### 平台层：座位映射(平台已提供，无需手动实现)
```
player_1 → 张三 (Human)
player_2 → AI-GPT4 (LLM)
player_3 → 李四 (Human)
...
```
- **作用**：确定发言顺序、控制权归属
- **可见性**：全局可见（显示在玩家列表中）

#### 游戏层：身份映射
```
player_1 → 狼人
player_2 → 预言家
player_3 → 平民
...
```
- **作用**：确定技能、胜利条件
- **可见性**：权威状态保密，通过视角有选择地暴露

---

## 2. 游戏状态结构

### 2.1 完整状态定义

```typescript
interface WerewolfState {
  // ========== 基础配置 ==========
  players: string[];           // ['player_1', 'player_2', ..., 'player_N']
  playerCount: number;         // 6 | 7 | 8 | 9 | 10 | 11 | 12
  
  // ========== 身份映射（权威状态，保密）==========
  identities: {
    [playerId: string]: Identity;  // 'werewolf' | 'seer' | 'witch' | 'hunter' | 'guard' | 'villager'
  };
  
  // ========== 核心阶段管理 ==========
  day: number;                 // 当前第几天（从1开始）
  phase: Phase;                // 'night' | 'day_discussion' | 'day_voting' | 'game_over'
  nightSubPhase: NightSubPhase | null;  // 'guard' | 'werewolf' | 'seer' | 'witch' | null
  
  // ========== 存活状态 ==========
  alive: {
    [playerId: string]: boolean;
  };
  
  // ========== 夜晚行动缓存（当前夜晚临时数据）==========
  currentNightActions: {
    guard_target: string | null;           // 守卫保护目标
    werewolf_votes: {                      // 狼人投票（多个狼人投票）
      [playerId: string]: string;          // 狼人ID → 目标ID
    };
    werewolf_target: string | null;        // 最终确定的狼人目标（投票后统计）
    seer_target: string | null;            // 预言家查验目标
    seer_result: 'werewolf' | 'good' | null;  // 查验结果
    witch_save: boolean;                   // 女巫是否使用解药
    witch_poison_target: string | null;    // 女巫毒药目标
  };
  
  // ========== 白天行动缓存 ==========
  currentDayVotes: {
    [playerId: string]: string;  // 投票者ID → 被投票者ID
  };
  
  // ========== 角色技能状态 ==========
  witchPotions: {
    antidote_used: boolean;      // 解药是否已使用
    poison_used: boolean;        // 毒药是否已使用
  };
  
  lastGuardTarget: string | null;  // 守卫上一次保护的目标（守卫不能连续保护同一人）
  
  hunterAlive: boolean;            // 猎人是否存活
  hunterCanShoot: boolean;         // 猎人是否可以开枪（被毒杀不能开枪）
  
  // ========== 历史记录 ==========
  deathHistory: DeathRecord[];     // 死亡记录
  nightHistory: NightRecord[];     // 夜晚行动历史
  voteHistory: VoteRecord[];       // 投票历史
  speechHistory: SpeechRecord[];   // 发言历史（白天讨论）
  
  // ========== 胜利判断 ==========
  winner: 'werewolf' | 'villager' | null;  // 获胜阵营
}
```

### 2.2 核心数据结构

#### 身份类型
```
type Identity = 
  | 'werewolf'   // 狼人
  | 'seer'       // 预言家
  | 'witch'      // 女巫
  | 'hunter'     // 猎人
  | 'guard'      // 守卫
  | 'villager';  // 平民
```

#### 阶段类型
```
type Phase = 
  | 'night'           // 夜晚（包含多个子阶段）
  | 'day_discussion'  // 白天讨论
  | 'day_voting'      // 白天投票
  | 'game_over';      // 游戏结束

type NightSubPhase = 
  | 'guard'      // 守卫行动
  | 'werewolf'   // 狼人行动
  | 'seer'       // 预言家查验
  | 'witch';     // 女巫用药
```

#### 历史记录
```
interface DeathRecord {
  day: number;
  phase: 'night' | 'day_voting' | 'hunter_shoot';
  victim: string;
  cause: 'werewolf' | 'poison' | 'vote' | 'hunter';
  details?: string;
}

interface NightRecord {
  night: number;
  guard_target: string | null;
  werewolf_target: string | null;
  werewolf_killed: string | null;  // 实际被杀（考虑守卫、女巫）
  seer_check: { target: string, result: 'werewolf' | 'good' } | null;
  witch_actions: {
    saved: boolean;
    poisoned: string | null;
  };
}

interface VoteRecord {
  day: number;
  votes: Array<{ voter: string, target: string }>;
  exiled: string;  // 被放逐者
}

interface SpeechRecord {
  day: number;
  speaker: string;
  content: string;
  timestamp: string;
}
```

---

## 3. 阶段流转系统

### 3.1 完整阶段循环

```
游戏开始
  ↓
第1天夜晚 (phase: 'night')
  ├─ nightSubPhase: 'guard'      → 守卫选择保护对象
  ├─ nightSubPhase: 'werewolf'   → 狼人投票杀人（多个狼人并行）
  ├─ nightSubPhase: 'seer'       → 预言家查验身份
  └─ nightSubPhase: 'witch'      → 女巫决定救人/毒人
  ↓
第1天白天 (phase: 'day_discussion')
  ├─ 夜晚结算（计算死亡）
  └─ 存活玩家按顺序发言（player_1 → player_2 → ...）
  ↓
投票阶段 (phase: 'day_voting')
  ├─ 所有存活玩家投票
  ├─ 统计票数，放逐得票最多者
  └─放逐结算（计算死亡）
  ↓
第2天夜晚...
```

### 3.2 阶段流转逻辑

#### 夜晚子阶段顺序

根据角色存活状态，动态决定夜晚流程：

```
1. 守卫阶段 (guard)
   - 如果守卫存活 → 执行
   - 如果守卫已死 → 跳过

2. 狼人阶段 (werewolf)
   - 所有存活狼人并行行动
   - 每个狼人提名目标
   - 系统统计投票，确定最终目标

3. 预言家阶段 (seer)
   - 如果预言家存活 → 执行
   - 如果预言家已死 → 跳过

4. 女巫阶段 (witch)
   - 如果女巫存活 → 执行
   - 系统告知狼人目标（如果有）
   - 女巫决定是否用药
   - 如果女巫已死 → 跳过

5. 夜晚结算
   - 计算实际死亡：
     * 狼人杀害的目标
     * 被守卫保护？ → 不死
     * 被女巫救活？ → 不死
     * 同守同救？ → 死亡（奶穿）
     * 被女巫毒杀？ → 额外死亡
   - 更新存活状态
   - 记录死亡历史和夜晚历史
   - 如果有角色死亡 → 进行胜利判断
   - 如果游戏继续 → 清空当前夜晚行动缓存，进入白天讨论阶段
   - 如果游戏结束 → 进入 game_over 阶段
```

#### 白天阶段顺序

```
1. 讨论阶段 (day_discussion)
   - 宣布死亡名单
   - 死者依次遗言
   - 存活玩家按座位顺序发言
   - 发言轮次可以多轮（可选）

2. 投票阶段 (day_voting)
   - 所有存活玩家同时投票
   - 选择要放逐的目标
   - 可以弃票（可选规则）

3. 放逐结算
   - 统计票数
   - 如果平票 → 跳过放逐。
   - 放逐得票最多者
   - 被放逐者遗言
```

### 3.3 getCurrentRole 实现逻辑

```
function getCurrentRole(state: WerewolfState): string | string[] {
  if (state.phase === 'game_over') {
    return null;  // 游戏结束，无当前玩家
  }
  
  if (state.phase === 'night') {
    switch (state.nightSubPhase) {
      case 'guard':
        // 找到守卫玩家（如果存活）
        return findPlayerByIdentity(state, 'guard') || nextSubPhase();
      
      case 'werewolf':
        // 所有存活狼人
        return findAllPlayersByIdentity(state, 'werewolf');
      
      case 'seer':
        return findPlayerByIdentity(state, 'seer') || nextSubPhase();
      
      case 'witch':
        return findPlayerByIdentity(state, 'witch') || nextSubPhase();
      
      default:
        // 夜晚子阶段结束，进入白天
        return 'TRANSITION_TO_DAY';
    }
  }
  
  if (state.phase === 'day_discussion') {
    // 白天讨论可以有多种模式：
    // 模式1：按顺序发言（当前发言者）
    // 模式2：自由发言（所有存活玩家）
    return getNextSpeaker(state);
  }
  
  if (state.phase === 'day_voting') {
    // 所有存活玩家同时投票
    return getAllAlivePlayers(state);
  }
}
```

---

## 4. 视角生成策略

### 4.1 阶段驱动的视角生成

**核心原则：先判断阶段，再考虑身份**

```
function toRolePerspective(state, roleId, wholeHistory, diffHistory) {
  // ========== 第一步：确定玩家身份和存活状态 ==========
  const myIdentity = state.identities[roleId];
  const isAlive = state.alive[roleId];
  const isSpectator = isSpectatorRole(roleId);
  
  // ========== 第二步：根据阶段生成基础视角 ==========
  let perspective = {};
  
  if (state.phase === 'game_over') {
    perspective = generateGameOverPerspective(state, roleId);
  }
  else if (state.phase === 'night') {
    perspective = generateNightPerspective(state, roleId, myIdentity, isAlive);
  }
  else if (state.phase === 'day_discussion') {
    perspective = generateDayDiscussionPerspective(state, roleId, isAlive);
  }
  else if (state.phase === 'day_voting') {
    perspective = generateVotingPerspective(state, roleId, isAlive);
  }
  
  // ========== 第三步：添加通用信息 ==========
  perspective.global_rules = WEREWOLF_RULES;
  perspective.whole_history = wholeHistory;
  perspective.diff_history = diffHistory;
  
  return perspective;
}
```

### 4.2 夜晚视角生成

**夜晚的视角高度依赖身份和子阶段**

```
function generateNightPerspective(state, roleId, myIdentity, isAlive) {
  const currentSubPhase = state.nightSubPhase;
  
  // 情况1：轮到我行动（我的身份对应当前子阶段）
  if (isMyTurn(currentSubPhase, myIdentity) && isAlive) {
    return {
      current_state: {
        phase: 'night',
        day: state.day,
        subPhase: currentSubPhase,
        my_identity: myIdentity,
        alive_players: getAlivePlayers(state),
        
        // ✅ 身份相关的私密信息
        ...getIdentitySpecificInfo(state, roleId, myIdentity),
      },
      your_role: {
        identity: getIdentityLabel(myIdentity),
        goal: getIdentityGoal(myIdentity),
        is_current: true,
      },
      action_space_definition: getNightActions(state, roleId, myIdentity),
      message: `🌙 第${state.day}夜 - 轮到你了，${getIdentityLabel(myIdentity)}请行动`,
    };
  }
  
  // 情况2：不是我的回合，我闭眼等待
  else {
    return {
      current_state: {
        phase: 'night',
        day: state.day,
        subPhase: currentSubPhase,
        my_identity: myIdentity,  // ✅ 仍然告知自己身份
        alive_players: getAlivePlayers(state),
        message: '天黑请闭眼...',
      },
      your_role: {
        identity: getIdentityLabel(myIdentity),
        goal: getIdentityGoal(myIdentity),
        is_current: false,
      },
      action_space_definition: { actions: [] },  // ❌ 无行动选项
      message: `🌙 第${state.day}夜 - ${getCurrentSubPhaseLabel(currentSubPhase)}正在行动，请等待...`,
    };
  }
}
```

**身份相关的私密信息**：

```
function getIdentitySpecificInfo(state, roleId, myIdentity) {
  switch (myIdentity) {
    case 'werewolf':
      return {
        my_teammates: findAllWerewolves(state).filter(id => id !== roleId),
        werewolf_votes: state.currentNightActions.werewolf_votes,
      };
    
    case 'seer':
      return {
        my_checks: getSeerCheckHistory(state, roleId),
      };
    
    case 'witch':
      return {
        antidote_available: !state.witchPotions.antidote_used,
        poison_available: !state.witchPotions.poison_used,
        tonight_victim: state.currentNightActions.werewolf_target,  // ✅ 告知狼人目标
      };
    
    case 'guard':
      return {
        last_guard_target: state.lastGuardTarget,  // ✅ 不能连续守护同一人
      };
    
    case 'hunter':
      return {
        can_shoot: state.hunterCanShoot,
      };
    
    case 'villager':
      return {};  // 平民无特殊信息
  }
}
```

### 4.3 白天讨论视角生成

**白天讨论阶段：所有玩家看到基本相同的公开信息**

```
function generateDayDiscussionPerspective(state, roleId, isAlive) {
  return {
    current_state: {
      phase: 'day_discussion',
      day: state.day,
      
      // ========== 公开信息（所有人可见）==========
      alive_players: getAlivePlayers(state),
      last_night_deaths: getLastNightDeaths(state),  // 昨晚死亡名单
      death_history: state.deathHistory,             // 历史死亡记录
      speech_history: state.speechHistory,           // 发言历史
      
      // ========== 私密信息（只有自己知道）==========
      my_identity: state.identities[roleId],
      ...getIdentityMemory(state, roleId),  // 身份相关的历史信息（预言家的查验记录等）
    },
    your_role: {
      identity: getIdentityLabel(state.identities[roleId]),
      goal: getIdentityGoal(state.identities[roleId]),
      is_current: isAlive && isCurrentSpeaker(state, roleId),
    },
    action_space_definition: isAlive && isCurrentSpeaker(state, roleId)
      ? { actions: [{ action_id: 'speak', description: '发言', params_schema: { content: { type: 'string' }}}]}
      : { actions: [] },
    message: isAlive
      ? (isCurrentSpeaker(state, roleId) 
          ? `☀️ 第${state.day}天 - 轮到你发言` 
          : `☀️ 第${state.day}天 - 等待其他玩家发言`)
      : `💀 你已出局，可以观看游戏`,
  };
}
```

**身份记忆信息**：

```
function getIdentityMemory(state, roleId) {
  const identity = state.identities[roleId];
  
  switch (identity) {
    case 'seer':
      return {
        my_seer_checks: state.nightHistory
          .filter(night => night.seer_check)
          .map(night => ({
            night: night.night,
            target: night.seer_check.target,
            result: night.seer_check.result,
          })),
      };
    
    case 'werewolf':
      return {
        my_teammates: findAllWerewolves(state).filter(id => id !== roleId),
      };
    
    case 'witch':
      return {
        antidote_used: state.witchPotions.antidote_used,
        poison_used: state.witchPotions.poison_used,
      };
    
    default:
      return {};
  }
}
```

### 4.4 投票阶段视角生成

**投票阶段：所有存活玩家看到相同信息**

```
function generateVotingPerspective(state, roleId, isAlive) {
  return {
    current_state: {
      phase: 'day_voting',
      day: state.day,
      
      // ========== 公开信息 ==========
      alive_players: getAlivePlayers(state),
      current_votes: state.currentDayVotes,  // 已投票情况（可选：显示/隐藏）
      
      // ========== 私密信息 ==========
      my_identity: state.identities[roleId],
    },
    your_role: {
      identity: getIdentityLabel(state.identities[roleId]),
      goal: getIdentityGoal(state.identities[roleId]),
      is_current: isAlive,
    },
    action_space_definition: isAlive
      ? getVotingActions(state)
      : { actions: [] },
    message: isAlive
      ? `🗳️ 第${state.day}天 - 投票阶段，请选择要放逐的玩家`
      : `💀 你已出局，无法投票`,
  };
}

function getVotingActions(state) {
  const alivePlayers = getAlivePlayers(state);
  return {
    actions: alivePlayers.map(playerId => ({
      action_id: `vote_${playerId}`,
      description: `投票放逐 ${playerId}`,
      params_schema: null,
    })).concat([
      { action_id: 'vote_skip', description: '弃票', params_schema: null }
    ]),
  };
}
```

### 4.5 游戏结束视角生成

**游戏结束：所有人看到完整结果**

```
function generateGameOverPerspective(state, roleId) {
  return {
    current_state: {
      phase: 'game_over',
      winner: state.winner,
      
      // ✅ 游戏结束后，公开所有身份
      all_identities: state.identities,
      final_alive: state.alive,
      
      death_history: state.deathHistory,
      night_history: state.nightHistory,
      vote_history: state.voteHistory,
    },
    your_role: {
      identity: getIdentityLabel(state.identities[roleId]),
      goal: getIdentityGoal(state.identities[roleId]),
      is_current: false,
    },
    action_space_definition: { actions: [] },
    message: state.winner === getCamp(state.identities[roleId])
      ? `🎉 游戏结束 - ${state.winner === 'werewolf' ? '狼人' : '好人'}阵营获胜！你赢了！`
      : `😔 游戏结束 - ${state.winner === 'werewolf' ? '狼人' : '好人'}阵营获胜，你输了。`,
  };
}
```

---

## 5. 行动空间设计

### 5.1 夜晚行动

#### 守卫行动
```
getLegalActions(state, roleId) {
  if (state.nightSubPhase === 'guard' && state.identities[roleId] === 'guard') {
    const alivePlayers = getAlivePlayers(state);
    const lastTarget = state.lastGuardTarget;
    
    return {
      actions: alivePlayers
        .filter(playerId => playerId !== lastTarget)  // ❌ 不能连续守护同一人
        .map(playerId => ({
          action_id: `guard_${playerId}`,
          description: `守护 ${playerId}`,
          params_schema: null,
        })),
    };
  }
}
```

#### 狼人行动
```
getLegalActions(state, roleId) {
  if (state.nightSubPhase === 'werewolf' && state.identities[roleId] === 'werewolf') {
    const alivePlayers = getAlivePlayers(state);
    const werewolves = findAllWerewolves(state);
    
    return {
      actions: alivePlayers
        .filter(playerId => !werewolves.includes(playerId))  // ❌ 不能杀队友
        .map(playerId => ({
          action_id: `kill_${playerId}`,
          description: `投票杀害 ${playerId}`,
          params_schema: null,
        })),
    };
  }
}
```

#### 预言家行动
```
getLegalActions(state, roleId) {
  if (state.nightSubPhase === 'seer' && state.identities[roleId] === 'seer') {
    const alivePlayers = getAlivePlayers(state);
    
    return {
      actions: alivePlayers
        .filter(playerId => playerId !== roleId)  // ❌ 不能查验自己
        .map(playerId => ({
          action_id: `check_${playerId}`,
          description: `查验 ${playerId}`,
          params_schema: null,
        })),
    };
  }
}
```

#### 女巫行动
```
getLegalActions(state, roleId) {
  if (state.nightSubPhase === 'witch' && state.identities[roleId] === 'witch') {
    const actions = [];
    const victim = state.currentNightActions.werewolf_target;
    
    // 解药选项
    if (!state.witchPotions.antidote_used && victim && victim !== roleId) {
      actions.push({
        action_id: 'use_antidote',
        description: `使用解药救活 ${victim}`,
        params_schema: null,
      });
    }
    
    // 毒药选项
    if (!state.witchPotions.poison_used) {
      const alivePlayers = getAlivePlayers(state);
      alivePlayers
        .filter(playerId => playerId !== roleId)  // ❌ 不能毒自己
        .forEach(playerId => {
          actions.push({
            action_id: `use_poison_${playerId}`,
            description: `使用毒药毒杀 ${playerId}`,
            params_schema: null,
          });
        });
    }
    
    // 不使用任何药
    actions.push({
      action_id: 'witch_skip',
      description: '不使用任何药剂',
      params_schema: null,
    });
    
    return { actions };
  }
}
```

### 5.2 白天行动

#### 发言
```
getLegalActions(state, roleId) {
  if (state.phase === 'day_discussion' && isCurrentSpeaker(state, roleId)) {
    return {
      actions: [
        {
          action_id: 'speak',
          description: '发言（说明你的分析、推理、身份等）',
          params_schema: {
            content: {
              type: 'string',
              description: '发言内容',
            },
          },
        },
      ],
    };
  }
}
```

#### 投票
```
getLegalActions(state, roleId) {
  if (state.phase === 'day_voting' && state.alive[roleId]) {
    const alivePlayers = getAlivePlayers(state);
    
    return {
      actions: alivePlayers.map(playerId => ({
        action_id: `vote_${playerId}`,
        description: `投票放逐 ${playerId}`,
        params_schema: null,
      })).concat([
        {
          action_id: 'vote_skip',
          description: '弃票',
          params_schema: null,
        },
      ]),
    };
  }
}
```

---

## 6. 胜利条件判断

### 6.1 胜利条件逻辑

```
function checkVictory(state: WerewolfState): 'werewolf' | 'villager' | null {
  const alivePlayers = getAlivePlayers(state);
  
  // 统计存活的各类角色
  const aliveWerewolves = alivePlayers.filter(id => state.identities[id] === 'werewolf');
  const aliveGods = alivePlayers.filter(id => isGod(state.identities[id]));
  const aliveVillagers = alivePlayers.filter(id => state.identities[id] === 'villager');
  
  // 条件1：所有狼人死亡 → 好人胜利
  if (aliveWerewolves.length === 0) {
    return 'villager';
  }
  
  // 条件2：所有神职死亡 → 狼人胜利（屠神）
  if (aliveGods.length === 0 && aliveVillagers.length >= 0) {
    return 'werewolf';
  }
  
  // 条件3：所有平民死亡 → 狼人胜利（屠民）
  if (aliveVillagers.length === 0 && aliveGods.length >= 0) {
    return 'werewolf';
  }
  
  // 游戏继续
  return null;
}

function isGod(identity: Identity): boolean {
  return ['seer', 'witch', 'hunter', 'guard'].includes(identity);
}
```

### 6.2 角色死亡逻辑&胜利判断

1. 夜晚结算后
   - 处理完狼人杀害、女巫用药等所有夜晚死亡

2. 白天放逐后
   - 处理完投票放逐的死亡

3. 猎人导致的死亡

有角色死亡时。

1.检查胜利条件。

2.发表遗言。

3.如果死者是猎人，触发开枪选择，可以选择一个人杀死(也可以不选)，继续触发这个人的死亡逻辑。

---

## 7. 完整游戏流程示例

### 7.1 6人局示例配置

```
玩家座位：player_1, player_2, player_3, player_4, player_5, player_6

身份分配（随机）：
player_1 → 狼人
player_2 → 预言家
player_3 → 平民
player_4 → 狼人
player_5 → 女巫
player_6 → 平民
```

### 7.2 第1夜流程

#### 夜晚开始
```
状态更新：
- phase: 'night'
- nightSubPhase: 'werewolf'（6人局没有守卫，直接从狼人开始）
- day: 1
```

#### 狼人阶段
```
当前回合玩家：player_1, player_4（所有狼人）

player_1 的视角：
- current_state.my_identity: 'werewolf'
- current_state.my_teammates: ['player_4']
- action_space: [kill_player_2, kill_player_3, kill_player_5, kill_player_6]
- message: "🌙 第1夜 - 狼人请睁眼，选择要杀害的目标"

player_1 行动：kill_player_2
player_4 行动：kill_player_2

结果：state.currentNightActions.werewolf_votes = { player_1: 'player_2', player_4: 'player_2' }
统计：player_2 获得2票，确定为目标
更新：state.currentNightActions.werewolf_target = 'player_2'
```

#### 预言家阶段
```
状态更新：nightSubPhase: 'seer'
当前回合玩家：player_2

player_2 的视角：
- current_state.my_identity: 'seer'
- action_space: [check_player_1, check_player_3, check_player_4, check_player_5, check_player_6]
- message: "🌙 第1夜 - 预言家请查验"

player_2 行动：check_player_1

结果：state.currentNightActions.seer_target = 'player_1'
查验结果：player_1 是狼人
更新：state.currentNightActions.seer_result = 'werewolf'
```

#### 女巫阶段
```
状态更新：nightSubPhase: 'witch'
当前回合玩家：player_5

player_5 的视角：
- current_state.my_identity: 'witch'
- current_state.tonight_victim: 'player_2'  ← ✅ 告知狼人目标
- current_state.antidote_available: true
- current_state.poison_available: true
- action_space: [use_antidote, use_poison_player_1, use_poison_player_3, ..., witch_skip]
- message: "🌙 第1夜 - 女巫请用药"

player_5 行动：use_antidote

结果：state.currentNightActions.witch_save = true
更新：state.witchPotions.antidote_used = true
```

#### 夜晚结算
```
计算死亡：
- 狼人目标：player_2
- 女巫救人：true
- 最终：player_2 没有死亡（被救活）

胜利判断：
- 无人死亡（平安夜）→ 跳过胜利判断

更新状态：
- phase: 'day_discussion'
- nightSubPhase: null
- 清空 currentNightActions
- 记录夜晚历史
```

### 7.3 第1天白天流程

#### 白天讨论
```
状态：phase: 'day_discussion', day: 1

宣布死亡：无人死亡（平安夜）

所有玩家的视角：
- current_state.last_night_deaths: []
- current_state.alive_players: [player_1, player_2, player_3, player_4, player_5, player_6]
- message: "☀️ 第1天 - 昨晚平安夜，开始讨论"

发言顺序：player_1 → player_2 → player_3 → player_4 → player_5 → player_6

player_2（预言家）发言：
"我是预言家，昨晚查验了 player_1，他是狼人！"

player_1（狼人）发言：
"player_2 在跳预言家，我才是真预言家，昨晚查验 player_2 是好人。"

（其他玩家发言...）
```

#### 投票阶段
```
状态更新：phase: 'day_voting'

所有存活玩家的视角：
- action_space: [vote_player_1, vote_player_2, vote_player_3, vote_player_4, vote_player_5, vote_player_6, vote_skip]
- message: "🗳️ 第1天 - 投票阶段"

投票结果：
player_1 → 投票 player_2
player_2 → 投票 player_1
player_3 → 投票 player_1
player_4 → 投票 player_2
player_5 → 投票 player_1
player_6 → 投票 player_1

统计：player_1 获得4票，player_2 获得2票
结果：player_1 被放逐
```

#### 放逐结算
```
更新：state.alive[player_1] = false

player_1 遗言：
"好人别信 player_2，他是假预言家！"

死亡结算流程：
1. 检查猎人技能：player_1 不是猎人，无技能触发
2. 所有死亡处理完成，进行胜利判断

胜利判断：
- 存活狼人：player_4（1个）
- 存活神职：player_2（预言家）、player_5（女巫）
- 存活平民：player_3、player_6
→ 游戏继续

进入第2夜...
```

---

## 8. 特殊机制设计

### 8.1 狼人投票机制

**问题**：多个狼人如何确定杀人目标？

**方案**：
1. 所有存活狼人同时（并行）提名目标
2. 系统统计投票，得票最多者为最终目标
3. 如果平票，随机选择一个

```
示例：3狼局
- werewolf_1 投票：kill_player_5
- werewolf_2 投票：kill_player_5
- werewolf_3 投票：kill_player_7

结果：player_5 获得2票，player_7 获得1票
最终目标：player_5
```

### 8.2 同守同救（奶穿）

**规则**：守卫守护的玩家恰好被狼人杀害，同时女巫也使用解药，则该玩家**仍然死亡**

**实现逻辑**：
```
function calculateNightDeaths(state) {
  const werewolfTarget = state.currentNightActions.werewolf_target;
  const guardTarget = state.currentNightActions.guard_target;
  const witchSaved = state.currentNightActions.witch_save;
  const witchPoison = state.currentNightActions.witch_poison_target;
  
  const deaths = [];
  
  // 处理狼人目标
  if (werewolfTarget) {
    const isGuarded = guardTarget === werewolfTarget;
    const isSaved = witchSaved;
    
    if (isGuarded && isSaved) {
      // 同守同救 → 死亡（奶穿）
      deaths.push({ victim: werewolfTarget, cause: 'werewolf' });
    } else if (isGuarded || isSaved) {
      // 只有守卫或只有女巫 → 存活
      // 不添加到deaths
    } else {
      // 无保护 → 死亡
      deaths.push({ victim: werewolfTarget, cause: 'werewolf' });
    }
  }
  
  // 处理女巫毒杀
  if (witchPoison) {
    deaths.push({ victim: witchPoison, cause: 'poison' });
    
    // 如果毒杀的是猎人，标记猎人不能开枪
    if (state.identities[witchPoison] === 'hunter') {
      state.hunterCanShoot = false;
    }
  }
  
  return deaths;
}
```

### 8.3 猎人技能触发

**规则**：
- 猎人被狼人杀死 → 可以开枪
- 猎人被投票放逐 → 可以开枪
- 猎人被女巫毒杀 → **不能**开枪

**实现逻辑**：
```
function handleHunterDeath(state, hunterId, cause) {
  if (cause === 'poison') {
    // 被毒杀，不能开枪
    return;
  }
  
  // 触发猎人技能
  state.phase = 'hunter_shoot';
  state.currentHunter = hunterId;
  
  // 猎人的行动空间：选择一个存活玩家带走
  const alivePlayers = getAlivePlayers(state);
  return {
    actions: alivePlayers.map(playerId => ({
      action_id: `shoot_${playerId}`,
      description: `开枪带走 ${playerId}`,
      params_schema: null,
    })),
  };
}
```

---

## 9. LLM 记忆系统集成

### 9.1 为什么狼人杀需要记忆

狼人杀是**高度依赖长期推理**的游戏：

1. **身份伪装**：需要记住自己伪装的身份、编造的逻辑
2. **行为追踪**：需要记住每个玩家的发言、投票行为
3. **逻辑推理**：需要基于多轮信息进行复杂推理
4. **策略规划**：需要制定长期策略（如预言家何时跳、狼人如何配合）

### 9.2 配置启用

```
getMetadata(): GameMetadata {
  return {
    // ...
    enable_llm_memory: true,  // ✅ 必须启用
  };
}
```

### 9.3 平台自动处理

- ✅ 游戏开始时：清空所有 LLM 玩家的记忆
- ✅ 执行行动前：将当前记忆注入到 Prompt
- ✅ 执行行动后：根据 LLM 返回自动更新记忆
- ✅ 独立性保证：每个 LLM 玩家的记忆完全独立

### 9.4 记忆示例

**狼人 LLM 玩家的记忆**：
```
{
  "my_identity": "werewolf",
  "teammates": ["player_4", "player_7"],
  "seer_claims": [
    { "day": 1, "player": "player_2", "claimed_check": "player_1 is werewolf" }
  ],
  "suspicious_players": ["player_2", "player_5"],
  "my_strategy": "伪装成平民，质疑 player_2 的预言家身份"
}
```

**预言家 LLM 玩家的记忆**：
```
{
  "my_identity": "seer",
  "check_results": [
    { "night": 1, "target": "player_1", "result": "werewolf" },
    { "night": 2, "target": "player_4", "result": "werewolf" }
  ],
  "confirmed_werewolves": ["player_1", "player_4"],
  "my_strategy": "第1天跳预言家，逐步公开查验结果"
}
```

---

## 10. 总结

### 10.1 设计关键点

1. **阶段驱动视角生成**
   - 先判断阶段（night/day_discussion/day_voting）
   - 再根据身份过滤信息（仅在特定阶段需要）

2. **两层映射机制**
   - 平台层：player_1, player_2（座位）
   - 游戏层：werewolf, seer（身份）

3. **状态自包含**
   - day、phase、nightSubPhase 明确记录游戏进度
   - currentNightActions、currentDayVotes 缓存临时数据
   - 历史记录完整保存（nightHistory、deathHistory、voteHistory）

4. **信息安全**
   - identities 字段永不直接发送客户端
   - 视角生成严格过滤，只暴露应知信息
   - 观战者可选上帝视角（用于教学/回放）

5. **LLM 友好**
   - enable_llm_memory: true 支持长期推理
   - 清晰的身份目标和行动空间
   - 丰富的历史信息支持复杂决策

### 10.2 扩展方向

- **更多角色**：白狼王、骑士、守墓人等
- **不同规则**：警长机制、首刀不救、连续守护等
- **多人数配置**：6/7/8/9/10/11/12人局的平衡配置
- **高级模式**：边缘发言、警徽流等高级玩法

---

**游戏开发者只需关注：**
1. 实现身份分配逻辑（initState）
2. 实现阶段流转逻辑（getCurrentRole + phase transitions）
3. 实现视角过滤逻辑（toRolePerspective）
4. 实现行动验证逻辑（getLegalActions + applyAction）
5. 实现胜利判断逻辑（isTerminal + getWinners）

**平台自动处理：**
- 座位映射、权限验证、状态同步
- LLM 调度、记忆管理
- 事件广播、SSE 推送
- 统一消息栏渲染

