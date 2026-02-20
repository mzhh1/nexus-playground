# 空行动列表处理功能实现

## 概述

实现了当 LLM 玩家接收到空行动列表时的智能处理逻辑：
- **未开启记忆**：跳过该回合，不调用 LLM（节省 API 调用成本）
- **开启记忆**：使用专门的提示词调用 LLM，仅更新记忆（不执行游戏行动）

## 修改文件

### 1. `backend/src/runtime/task-prompts.ts`
**修改内容**：
- 优化了 `NO_TASK_PROMPT_WITH_MEMORY` 提示词
- 更清晰地说明这是"无需行动"的场景
- 增加了记忆更新的建议内容（记录其他玩家行动、发言、投票等）

**关键改动**：
```typescript
export const NO_TASK_PROMPT_WITH_MEMORY = `
# 任务要求
当前无需行动，但你可以根据最新信息更新你的记忆。你必须严格按照以下JSON格式返回：

\`\`\`json
{
  "reasoning": "你的观察和思考（可选）",
  "memory_update": {
    "mode": "append",
    "content": "本回合的新观察、推理和重要信息"
  }
}
\`\`\`
...
`;
```

---

### 2. `backend/src/runtime/llm-executor.ts`
**新增方法**：

#### `executeMemoryUpdate()`
仅用于记忆更新的 LLM 调用（无行动执行）

**参数**：
- `roomId`: 房间 ID
- `roleId`: 角色 ID
- `gameId`: 游戏 ID
- `interactionGroupId`: 交互组 ID（用于日志）
- `perspective`: 角色视角
- `modelName`: LLM 模型名称
- `systemPrompt`: 系统提示词
- `currentMemory`: 当前记忆内容

**返回值**：
```typescript
{
  memory_update?: { mode: 'append' | 'replace'; content: string };
  logId: string;
} | null
```

#### `formatMemoryOnlyPrompt()`
格式化仅用于记忆更新的提示词（不包含行动列表）

**组成部分**：
1. 游戏状态提示词（调用 `gameLogic.generateStatePrompt()`）
2. 当前记忆内容
3. `NO_TASK_PROMPT_WITH_MEMORY` 任务提示

#### `parseMemoryOnlyResponse()`
解析 LLM 返回的记忆更新响应

**验证内容**：
- JSON 格式正确
- 包含 `memory_update` 字段
- `mode` 为 `'append'` 或 `'replace'`
- `content` 为非空字符串

---

### 3. `backend/src/runtime/llm-player-executor.ts`
**主要修改**：在 `executeTurn()` 方法中添加空行动列表检查逻辑

#### 执行流程（新增步骤 2.5 - 2.6）

```typescript
// 2.5. 生成视角以检查行动空间
const checkPerspective = await this.perspectiveGenerator.generatePerspective(
  roomId,
  currentRoleId,
  { skipCache: true }
);

// 2.6. 检查行动列表是否为空
const hasActions = checkPerspective.action_space_definition.actions.length > 0;

if (!hasActions) {
  // 场景 A: 未开启记忆 -> 直接返回 true（跳过回合）
  if (!memoryEnabled) {
    logger.info('Memory not enabled, skipping turn');
    return true;
  }

  // 场景 B: 开启记忆 -> 调用 LLM 仅更新记忆
  const result = await llmExecutor.executeMemoryUpdate(...);
  if (result && result.memory_update) {
    // 应用记忆更新
    const updatedMemory = this.applyMemoryUpdate(
      currentMemory || '',
      result.memory_update
    );
    // 更新玩家状态
    await this.stateManager.updateRoomState(...);
    return true;
  }
}

// 如果有行动，继续原有的行动执行流程
```

---

## 使用场景

### 狼人杀游戏示例

#### 场景 1：死亡玩家（未开启记忆）
```typescript
// 死亡玩家的视角
{
  action_space_definition: { actions: [] },  // 空行动列表
  message: "💀 你已出局，可以继续观战..."
}

// 行为：LLMPlayerExecutor 检测到空列表且记忆未开启
// 结果：直接返回 true，不调用 LLM（节省成本）
```

#### 场景 2：死亡玩家（开启记忆）
```typescript
// 死亡玩家的视角
{
  action_space_definition: { actions: [] },
  message: "💀 你已出局，可以继续观战..."
}

// 行为：检测到空列表但记忆已开启
// 结果：调用 LLM，使用 NO_TASK_PROMPT_WITH_MEMORY
// LLM 可以记录观察到的其他玩家发言、投票、死亡信息等
```

#### 场景 3：观战者
```typescript
// 观战者视角
{
  action_space_definition: { actions: [] },
  your_role: { identity: 'Spectator (观战者)' },
  message: "👀 观战模式 - 第3天，讨论阶段"
}

// 行为：与死亡玩家相同逻辑
// - 未开启记忆：跳过
// - 开启记忆：调用 LLM 更新记忆
```

---

## 技术优势

### 1. **性能优化**
- 未开启记忆时，避免不必要的 LLM API 调用
- 减少 API 成本和响应延迟

### 2. **记忆持续更新**
- 即使玩家无法行动，仍可持续积累游戏信息
- 提升 LLM 玩家的推理连贯性

### 3. **日志完整性**
- 所有 LLM 调用（包括仅记忆更新）都被完整记录在 `llm_logs` 表中
- 支持调试和审计

### 4. **代码清晰度**
- 明确区分"有行动"和"无行动"两种场景
- 专门的提示词和解析逻辑

---

## 数据库日志

所有 LLM 交互（包括仅记忆更新）都会记录到 `llm_logs.llm_interactions` 表：

```sql
SELECT 
  interaction_id,
  role_id,
  status,
  user_prompt,  -- 包含 NO_TASK_PROMPT_WITH_MEMORY
  response,     -- LLM 返回的 JSON（仅含 memory_update）
  response_time_ms
FROM llm_logs.llm_interactions
WHERE room_id = 'xxx' AND status = 'success';
```

**区分字段**：
- 正常行动：`user_prompt` 包含行动列表 + `TASK_PROMPT_WITH_MEMORY`
- 仅记忆更新：`user_prompt` 不含行动列表 + `NO_TASK_PROMPT_WITH_MEMORY`

---

## 测试建议

### 单元测试
1. 测试空行动列表 + 未开启记忆 → 直接返回 true
2. 测试空行动列表 + 开启记忆 → 调用 `executeMemoryUpdate()`
3. 测试非空行动列表 → 走原有 `executeDecision()` 流程

### 集成测试
1. 狼人杀游戏中，死亡玩家是否正确跳过/更新记忆
2. 观战者是否正确处理空行动列表
3. 记忆更新失败时的容错处理

### 性能测试
1. 对比开启/未开启记忆时，死亡玩家回合的 API 调用次数
2. 验证未开启记忆时确实未调用 LLM API

---

## 向后兼容性

✅ **完全兼容**

- 现有游戏无需修改
- 只影响返回空行动列表的场景
- 未开启记忆的游戏行为与之前完全一致

---

## 示例日志输出

### 场景 1：未开启记忆（跳过回合）
```
[INFO] LLMPlayerExecutor: Action list is empty
[INFO] LLMPlayerExecutor: Memory not enabled, skipping turn (no action or memory update needed)
```

### 场景 2：开启记忆（更新记忆）
```
[INFO] LLMPlayerExecutor: Action list is empty
[INFO] LLMPlayerExecutor: Memory enabled, calling LLM for memory update only
[INFO] LLM executor: Starting memory-only update (no action required)
[DEBUG] LLM executor: User prompt for memory update
[INFO] LLM executor: Successfully generated memory update
[INFO] LLMPlayerExecutor: Updated LLM player memory (no action executed)
```

---

## 总结

此功能通过智能判断行动列表状态和记忆开启状态，实现了：

1. **成本优化**：避免不必要的 LLM 调用
2. **功能完整性**：支持记忆持续更新
3. **代码可维护性**：清晰的逻辑分支和专门的处理方法
4. **向后兼容**：不影响现有游戏逻辑

适用于所有可能出现空行动列表的场景：死亡玩家、观战者、特殊游戏阶段等。





