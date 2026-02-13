# LLM玩家对遗言的感知和记忆更新

## ✅ 结论

**是的，LLM玩家能够完整地知道遗言内容并自动更新记忆！**

## 📡 信息传递流程

### 1. 遗言数据流

```
玩家发表遗言 
  → 记录到 state.lastWordsHistory 
  → 包含在 perspective.current_state.last_words_history 
  → 通过 generateStatePrompt 生成 JSON 
  → 发送给 LLM 玩家
```

### 2. 代码证明

#### 视角生成 (perspective.ts)

```typescript
// 第70-73行
const todayLastWords = state.lastWordsHistory.filter((record) => record.day === state.day);
if (todayLastWords.length > 0) {
  baseState.last_words_history = todayLastWords.map(({ timestamp, ...rest }) => rest);
}
```

#### 状态提示词生成 (perspective.ts)

```typescript
// 第109-116行
export function generateStatePrompt(perspective: RolePerspective): string {
  const { 
    global_rules, 
    current_state, 
    your_role 
  } = perspective;

  return `# 游戏规则
${global_rules}

# 你的身份
角色: ${your_role.identity}
目标: ${your_role.goal}

# 当前游戏状态
${JSON.stringify(current_state)}`;  // ← 遗言历史在这里！
}
```

#### LLM提示词构建 (llm-executor.ts)

```typescript
// 第470-537行
private formatPrompt(gameId: string | null, perspective: RolePerspective, currentMemory: string | null, previousError?: string): string {
  // ...
  const gameLogic = getGameLogic(gameId);
  statePrompt = gameLogic.generateStatePrompt(perspective);  // ← 包含遗言
  // ...
  return `${statePrompt}${memorySection}${actionPrompt}${taskPrompt}`;
}
```

## 📋 LLM看到的遗言信息格式

### 在 current_state 中的结构

```json
{
  "phase": "day_discussion",
  "day": 2,
  "alive_players": ["player_1", "player_3", "player_4", ...],
  "dead_players": {
    "player_2": "hunter"
  },
  "last_words_history": [
    {
      "day": 2,
      "speaker": "player_2",
      "content": "我是猎人，临死前要说明3号是狼人！大家相信我的判断。",
      "cause": "vote"
    }
  ],
  "speech_history": [...],
  ...
}
```

### 完整的LLM提示词示例

```
# 游戏规则
狼人杀游戏规则...

# 你的身份
角色: 预言家
目标: 夜晚查验玩家身份，将结论传递给好人阵营并找出狼人。

# 当前游戏状态
{
  "phase": "day_discussion",
  "day": 2,
  "last_words_history": [
    {
      "day": 2,
      "speaker": "player_2",
      "content": "我是猎人，临死前要说明3号是狼人！大家相信我的判断。",
      "cause": "vote"
    }
  ],
  ...
}

# 🧠 你的记忆
第1天：我查验了5号，他是好人...

---

# 可用行动列表
- action_id: "speak"
  描述: 发表发言
  参数:
    * content (string): 请输入你的发言内容

# 任务要求
请根据当前游戏状态和你的记忆，选择一个合适的行动...
```

## 🧠 记忆更新机制

### 1. LLM自动记忆更新

LLM玩家可以在**任何回合**更新记忆，包括：
- 看到遗言后
- 听到发言后
- 观察投票后
- 执行夜晚行动后

### 2. 记忆更新示例

当LLM玩家看到遗言后，可以这样更新记忆：

```json
{
  "action_id": "speak",
  "params": {
    "content": "player_2的遗言很重要，他说3号是狼人，我们应该认真考虑"
  },
  "reasoning": "player_2作为猎人的遗言可信度很高",
  "memory_update": {
    "mode": "append",
    "content": "第2天：player_2（猎人）被投票放逐前留下遗言，指认3号是狼人。作为预言家，我应该验证这个信息。今晚查验3号。"
  }
}
```

### 3. 即使没有行动也能更新记忆

从 `CHANGELOG_EMPTY_ACTION_LIST.md` 可以看到，即使当前没有可用行动（如等待其他人发言），LLM玩家也会被调用来更新记忆。

这意味着：
- ✅ 其他玩家发表遗言时，LLM玩家可以立即更新记忆
- ✅ 观战状态下也能记录遗言信息
- ✅ 等待回合时持续更新推理

## 🎯 实际应用场景

### 场景1：好人阵营听到遗言

```
玩家A（LLM预言家）看到player_2的遗言：
"我是猎人，3号是狼人"

LLM可能的记忆更新：
"第2天：player_2被放逐前自曝猎人，指认3号。如果他是真猎人，他的判断很重要。今晚我要查验3号确认。"
```

### 场景2：狼人听到同伴遗言

```
玩家B（LLM狼人）看到狼队友player_5的遗言：
"我不是狼人，6号一直在带节奏"

LLM可能的记忆更新：
"第2天：队友player_5被票，遗言反咬6号。这给了我们机会，明天可以顺着这个方向推6号。"
```

### 场景3：女巫听到被毒杀玩家遗言

```
玩家C（LLM女巫）看到被自己毒杀的player_7遗言：
"我是真预言家，已查验出4号和9号都是狼"

LLM可能的记忆更新：
"第3天：我昨晚毒杀了player_7，他遗言说自己是预言家。如果他说的是真的，我可能毒错了。需要重新评估局势。"
```

## 📊 信息完整性对比

| 信息类型 | 是否可见 | 包含内容 | 备注 |
|---------|---------|---------|------|
| 遗言内容 | ✅ | 完整文本 | last_words_history[].content |
| 遗言发表者 | ✅ | 玩家ID | last_words_history[].speaker |
| 死亡原因 | ✅ | werewolf/poison/vote/hunter | last_words_history[].cause |
| 发表时间 | ✅ | 第几天 | last_words_history[].day |
| 历史遗言 | ✅ | 当天所有遗言 | 过滤了timestamp，保留其他字段 |

## ⚙️ 系统配置

狼人杀游戏的记忆系统已启用：

```typescript
// games/werewolf/logic/index.ts
getMetadata(): GameMetadata {
  return {
    id: 'werewolf',
    name: '狼人杀 (Werewolf)',
    // ...
    enable_llm_memory: true,  // ✅ 已启用
  };
}
```

## 🔍 验证方法

你可以通过以下方式验证LLM是否正确感知遗言：

1. **查看LLM日志**
   - 检查 `llm_interactions` 表
   - 查看 `request_prompt` 字段是否包含 `last_words_history`

2. **查看玩家记忆**
   - 检查 `players` 表的 `memory` 字段
   - 看LLM是否在遗言后更新了记忆

3. **观察游戏行为**
   - LLM玩家是否根据遗言调整策略
   - LLM玩家发言是否提到遗言内容

## 📝 总结

✅ **LLM玩家完全能够感知遗言**
- 遗言内容通过 `current_state.last_words_history` 传递
- 包含完整的遗言文本、发表者、死亡原因、时间

✅ **LLM玩家可以自动更新记忆**
- 通过 `memory_update` 字段
- 支持 `append` 和 `replace` 模式
- 可以在任何时候更新记忆，即使没有行动

✅ **信息传递及时准确**
- 遗言发表后立即出现在下一个玩家的 perspective 中
- 其他玩家轮到行动时能看到完整的遗言历史
- 观战者和所有存活玩家都能看到遗言

**遗言功能与LLM记忆系统完美集成！** 🎉



