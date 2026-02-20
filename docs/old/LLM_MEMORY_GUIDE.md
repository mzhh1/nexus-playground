# LLM 玩家记忆系统使用指南

## 📖 概述

LLM 玩家记忆系统允许 AI 玩家在游戏过程中维护和更新自己的记忆状态，用于累积推理链、观察记录和策略规划。每个 LLM 玩家的记忆是**完全独立**的。

## 🎯 适用场景

### ✅ 应该启用记忆的游戏

- **狼人杀**：需要追踪多个玩家的发言历史、身份伪装策略、复杂的社交推理
- **德州扑克**：需要记住玩家的下注模式、bluff 习惯、历史行为
- **谈判类游戏**：需要记录谈判历史、承诺、信任关系
- **长期策略游戏**：回合数多、需要长期规划的游戏

### ❌ 不应该启用记忆的游戏

- **井字棋/五子棋/象棋**：完全信息游戏，`current_state` 已包含所有必要信息
- **短回合游戏**：游戏在 10 回合内结束，历史记录已经足够
- **纯反应式游戏**：不需要复杂推理链的游戏

---

## 🚀 快速开始

### 1. 在游戏逻辑中启用记忆

在游戏的 `getMetadata()` 方法中添加 `enable_llm_memory: true`：

```typescript
// games/werewolf/logic/index.ts

export class WerewolfLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'werewolf',
      name: '狼人杀',
      description: '社交推理游戏，狼人与好人阵营的对抗',
      minPlayers: 6,
      maxPlayers: 12,
      roleIds: ['player_1', 'player_2', ..., 'player_12'],
      enable_llm_memory: true, // ✅ 启用记忆系统
    };
  }
  
  // ... 其他方法
}
```

### 2. 记忆自动管理

启用记忆后，系统会自动处理：

- ✅ **游戏开始时**：清空所有 LLM 玩家的记忆
- ✅ **游戏重启时**：重新清空记忆
- ✅ **执行行动前**：将当前记忆注入到 Prompt
- ✅ **执行行动后**：根据 LLM 返回更新记忆

---

## 📝 LLM 玩家如何使用记忆

### Prompt 中的记忆部分

当 `enable_llm_memory: true` 时，LLM 玩家的 Prompt 会自动包含记忆部分：

```
# 🧠 你的记忆
以下是你在本局游戏中积累的个人记忆和推理笔记：

第1天：我是预言家，查验了3号是狼人。
第2天：我投票给3号，因为他的预言家发言不可信。需要重点观察5号和7号的互动。

---

# 当前游戏状态
...

# 可用行动列表
...
```

### 记忆更新格式

LLM 可以在返回的 JSON 中包含 `memory_update` 字段：

```json
{
  "action_id": "vote",
  "params": { "target": "player_3" },
  "reasoning": "3号玩家发言逻辑矛盾",
  "memory_update": {
    "mode": "append",
    "content": "第2天：我投票给3号，因为他的预言家发言不可信。需要重点观察5号和7号的互动。"
  }
}
```

---

## 🔧 记忆更新模式

### 1. 追加模式 (Append) - 推荐

追加到现有记忆，用于累积推理链：

```json
{
  "memory_update": {
    "mode": "append",
    "content": "第3天：5号和7号确实互相呼应，可能是狼队。"
  }
}
```

**效果：**
```
旧记忆：
第1天：我是预言家，查验了3号是狼人。
第2天：我投票给3号...

新记忆：
第1天：我是预言家，查验了3号是狼人。
第2天：我投票给3号...
第3天：5号和7号确实互相呼应，可能是狼队。
```

### 2. 覆盖模式 (Replace) - 慎用

完全替换记忆，仅当需要重置推理时使用：

```json
{
  "memory_update": {
    "mode": "replace",
    "content": "游戏重启，之前的推理全部作废。现在我重新分析..."
  }
}
```

**⚠️ 警告：** 覆盖模式会丢失所有旧记忆，慎用！

---

## 💡 最佳实践

### 1. 结构化记忆内容

建议使用结构化格式便于 LLM 理解：

```
第1天白天：
- 观察：3号自称预言家，查验5号是狼
- 推理：我作为真预言家，3号是假跳狼
- 策略：今天投票3号

第1天晚上：
- 行动：查验了7号，是好人
- 计划：明天继续推3号
```

### 2. 记录关键信息

- ✅ 自己的身份和目标
- ✅ 关键玩家的行为和发言
- ✅ 推理链和证据
- ✅ 下一步计划

### 3. 避免冗余

- ❌ 不要重复历史记录中已有的信息
- ❌ 不要记录无意义的流水账
- ✅ 只记录对未来决策有帮助的信息

---

## 🔍 调试与监控

### 查看玩家记忆（调试用）

```bash
# 查看特定 LLM 玩家的记忆
curl http://localhost/api/v1/rooms/{roomId}/players/{playerId}/memory \
  -H "Authorization: Bearer <token>"
```

**返回示例：**
```json
{
  "player_id": "room_abc_player1",
  "display_name": "AI狼人1",
  "memory": "第1天：我是预言家，查验了3号是狼人。\n第2天：我投票给3号..."
}
```

### 日志监控

系统会自动记录记忆操作日志：

```
[INFO] LLMPlayerExecutor: Memory status
  roomId: "abc123"
  playerId: "room_abc_player1"
  memoryEnabled: true
  hasMemory: true

[INFO] LLMPlayerExecutor: Updated LLM player memory
  roomId: "abc123"
  playerId: "room_abc_player1"
  updateMode: "append"
  memoryLength: 324
```

---

## ⚙️ 技术细节

### 记忆存储

- **位置**：Redis `room:{roomId}:players` Hash 中的 `LLMPlayer.memory` 字段
- **类型**：字符串（可包含换行符）
- **限制**：建议不超过 10,000 字符（可根据需要调整）

### 记忆生命周期

```
1. 添加 LLM 玩家 → memory = ''
2. 游戏开始      → memory = '' (清空)
3. 执行行动      → memory 可能更新
4. 游戏结束      → memory 保留
5. 游戏重启      → memory = '' (清空)
```

### 独立性保证

每个 LLM 玩家的记忆是**完全独立**的：

- ❌ LLM 玩家 A 无法访问 LLM 玩家 B 的记忆
- ❌ 记忆不会在玩家之间共享
- ✅ 即使在同一阵营，记忆也是独立的

---

## 🎮 完整示例：狼人杀场景

### 第1天白天 - 预言家发言

**LLM Prompt（部分）：**
```
# 🧠 你的记忆
(暂无记忆)

# 你的身份
角色: 3号玩家
目标: 你是预言家，昨晚查验了5号是狼人。找出所有狼人并放逐他们。

# 可用行动
- speak: 发言
```

**LLM 返回：**
```json
{
  "action_id": "speak",
  "params": {
    "content": "大家好，我是预言家。昨晚查验了5号，他是狼人！"
  },
  "memory_update": {
    "mode": "append",
    "content": "第1天：我以预言家身份跳出，指认5号是狼。需要观察5号的反应和其他玩家的态度。"
  }
}
```

### 第2天白天 - 投票阶段

**LLM Prompt（部分）：**
```
# 🧠 你的记忆
第1天：我以预言家身份跳出，指认5号是狼。需要观察5号的反应和其他玩家的态度。

# 当前游戏状态
昨晚6号玩家死亡。现在进入投票阶段。

# 自上次行动以来的变化
Turn 5: player_5 → speak (内容: "我不是狼人！3号才是假跳的狼！")
Turn 6: player_7 → speak (内容: "我相信5号，3号可能在骗人")
```

**LLM 返回：**
```json
{
  "action_id": "vote",
  "params": { "target": "player_5" },
  "reasoning": "5号反驳我但没有实质证据，7号的发言可能是狼队保狼",
  "memory_update": {
    "mode": "append",
    "content": "第2天：5号辩解无力，我投票给他。7号也为5号说话，可能7号也是狼。需要重点观察7号后续行为。"
  }
}
```

---

## 📚 参考资料

- [游戏接入指南](./game_integration_guide.md) - 游戏逻辑开发完整指南
- [LLM 执行器使用指南](./LLM_EXECUTOR_GUIDE.md) - LLM 玩家配置详解
- [类型定义](./backend/src/games/types.ts) - `GameMetadata` 和 `LLMPlayer` 接口定义

---

## 🤝 贡献

如果你在使用 LLM 记忆系统时有任何建议或发现问题，欢迎提交 Issue 或 Pull Request！

---

**让 AI 在复杂游戏中也能展现出色的推理能力！🎮✨**

