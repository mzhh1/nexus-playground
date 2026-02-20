# 自动玩家系统架构文档

## 📋 概述

本文档描述了 Nexus Playground 的自动玩家系统架构。该系统采用**抽象化设计**，支持多种类型的自动玩家（LLM、规则AI、强化学习Agent等），通过统一的接口和协调器实现自动回合执行。

---

## 🏗️ 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│              Auto Player System                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────────────────────────────┐              │
│  │   AutoPlayerCoordinator               │              │
│  │   (协调器 - 统一入口)                  │              │
│  │                                        │              │
│  │  - 维护执行器注册表                    │              │
│  │  - 责任链模式匹配执行器                │              │
│  │  - 递归处理连续自动回合                │              │
│  │  - 触发视角更新与广播                  │              │
│  └───────────────┬───────────────────────┘              │
│                  │                                        │
│                  │ checks & delegates                    │
│                  ▼                                        │
│  ┌─────────────────────────────────────────┐            │
│  │   AutoPlayerExecutor (Interface)        │            │
│  │   (执行器接口)                           │            │
│  │                                          │            │
│  │  + getName(): string                    │            │
│  │  + canHandle(state, roleId): boolean    │            │
│  │  + executeTurn(roomId, roleId): boolean │            │
│  └─────────────────┬───────────────────────┘            │
│                    │                                      │
│                    │ implements                          │
│                    │                                      │
│       ┌────────────┼────────────┬────────────┐          │
│       ▼            ▼            ▼            ▼          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │   LLM   │ │  Rule   │ │   RL    │ │  MCTS   │      │
│  │ Player  │ │ Based   │ │ Agent   │ │ Player  │      │
│  │Executor │ │   AI    │ │Executor │ │Executor │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│   (已实现)      (未来)      (未来)      (未来)         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 触发点

自动玩家协调器在以下时机被触发：

1. **游戏开始时** (`POST /api/v1/rooms/:roomId/start-game`)
   - 检查第一个角色是否为自动玩家

2. **行动处理后** (`POST /api/v1/rooms/:roomId/actions`)
   - 每次行动完成后检查下一个角色

3. **游戏恢复时** (`POST /api/v1/rooms/:roomId/resume`)
   - 从暂停状态恢复后检查当前角色

---

## 🔧 核心接口

### AutoPlayerExecutor 接口

所有自动玩家执行器必须实现此接口：

```typescript
export interface AutoPlayerExecutor {
  /**
   * 获取执行器名称（用于日志和调试）
   */
  getName(): string;

  /**
   * 检查此执行器是否能处理当前玩家
   * 
   * @param roomState 当前房间状态
   * @param currentRoleId 当前需要行动的角色ID
   * @returns true 表示可以处理
   */
  canHandle(roomState: RoomState, currentRoleId: string): boolean;

  /**
   * 执行玩家回合
   * 
   * 应该：
   * - 生成视角
   * - 做出决策
   * - 通过 ActionProcessor 提交行动
   * - 优雅处理错误
   * 
   * @param roomId 房间ID
   * @param currentRoleId 需要行动的角色ID
   * @returns Promise<boolean> - true 表示执行成功，false 表示失败
   */
  executeTurn(roomId: string, currentRoleId: string): Promise<boolean>;
}
```

---

## 💻 已实现的执行器

### LLMPlayerExecutor

处理 LLM 控制的玩家回合。

**匹配条件：**
```typescript
canHandle(roomState: RoomState, currentRoleId: string): boolean {
  const playerId = roomState.role_mapping[currentRoleId];
  const player = roomState.player_list[playerId];
  return player?.type === 'llm';
}
```

**执行流程：**
1. 生成角色视角（`PerspectiveGenerator`）
2. 调用 LLM API 生成决策（`LLMExecutor`）
3. 提交行动（`ActionProcessor`）
4. 返回执行结果

**相关文件：**
- `backend/src/runtime/llm-player-executor.ts`
- `backend/src/runtime/llm-executor.ts` (底层 LLM 调用逻辑)

---

## 🎯 AutoPlayerCoordinator

协调器是自动玩家系统的中枢，负责：

### 核心职责

1. **执行器注册管理**
   ```typescript
   registerExecutor(executor: AutoPlayerExecutor): void
   ```

2. **回合检查与执行**
   ```typescript
   checkAndExecuteCurrentTurn(roomId: string): Promise<void>
   ```

3. **责任链模式匹配**
   - 遍历已注册的执行器
   - 找到第一个匹配的执行器
   - 执行该执行器的 `executeTurn` 方法

4. **递归处理连续回合**
   - 执行成功后自动检查下一个回合
   - 支持 LLM vs LLM 等连续自动回合场景
   - 添加小延迟（100ms）避免过于紧密的循环

5. **视角更新与广播**
   - 自动失效视角缓存
   - 为所有角色重新生成视角
   - 通过 SSE 广播到前端

### 工作流程

```
checkAndExecuteCurrentTurn(roomId)
    ↓
1. 获取并验证房间状态
    - 检查游戏是否正在进行
    - 检查游戏是否已结束
    ↓
2. 获取当前需要行动的角色
    - gameLogic.getCurrentRole(state)
    ↓
3. 遍历执行器列表（责任链）
    - 调用 executor.canHandle(state, roleId)
    - 找到第一个匹配的执行器
    ↓
4. 执行回合
    - executor.executeTurn(roomId, roleId)
    ↓
5. 更新视角并广播
    - 失效所有角色的视角缓存
    - 重新生成所有视角
    - 通过 SSE 广播到前端
    ↓
6. 递归检查下一回合
    - await sleep(100ms)
    - checkAndExecuteCurrentTurn(roomId)
```

---

## 🚀 集成点

### 1. actions.ts - 行动处理后触发

```typescript
// 在行动成功处理并广播视角后
setImmediate(() => {
  autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
    logger.error(
      { err, roomId },
      'Auto player coordination failed after action'
    );
  });
});
```

**为什么使用 `setImmediate()`？**
- 不阻塞 HTTP 响应（LLM 调用可能需要几秒钟）
- 异步执行，用户立即收到成功响应
- 错误处理通过日志记录，不影响主流程

### 2. rooms.ts - 游戏开始时触发

```typescript
// 在游戏状态变为 'playing' 后
setImmediate(() => {
  autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
    logger.error({ err, roomId }, 'Auto player coordination failed at game start');
  });
});
```

### 3. rooms.ts - 游戏恢复时触发

```typescript
// 在游戏从 'paused' 恢复到 'playing' 后
setImmediate(() => {
  autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
    logger.error({ err, roomId }, 'Auto player coordination failed on resume');
  });
});
```

---

## 🧩 扩展新的自动玩家类型

### 示例：添加规则型 AI 执行器

```typescript
// backend/src/runtime/rule-based-player-executor.ts

import { AutoPlayerExecutor } from './auto-player-executor';
import { RoomState } from '../games/types';

export class RuleBasedPlayerExecutor implements AutoPlayerExecutor {
  getName(): string {
    return 'RuleBasedPlayerExecutor';
  }

  canHandle(roomState: RoomState, currentRoleId: string): boolean {
    const playerId = roomState.role_mapping[currentRoleId];
    const player = roomState.player_list[playerId];
    return player?.type === 'rule_ai';
  }

  async executeTurn(roomId: string, currentRoleId: string): Promise<boolean> {
    // 1. 获取游戏状态
    // 2. 应用规则算法（如 Minimax、Alpha-Beta 剪枝）
    // 3. 选择最优行动
    // 4. 提交行动
    return true;
  }
}
```

### 注册新执行器

**方式 1：修改 AutoPlayerCoordinator**

```typescript
// backend/src/runtime/auto-player-coordinator.ts

private registerDefaultExecutors(): void {
  // LLM 玩家执行器
  this.registerExecutor(createLLMPlayerExecutor(this.fastify));
  
  // 规则型 AI 执行器（新增）
  this.registerExecutor(createRuleBasedPlayerExecutor(this.fastify));
  
  // 强化学习 Agent 执行器（未来）
  // this.registerExecutor(createRLAgentExecutor(this.fastify));
}
```

**方式 2：运行时动态注册**

```typescript
// 在某个初始化逻辑中
const coordinator = createAutoPlayerCoordinator(fastify);
coordinator.registerExecutor(myCustomExecutor);
```

---

## 📊 日志与调试

### 日志级别

自动玩家系统使用以下日志级别：

```typescript
// INFO - 重要事件
logger.info({ roomId, roleId, executorName }, 
  'Auto player turn detected, triggering executor');

// DEBUG - 详细调试信息
logger.debug({ roomId, roleId, playerType }, 
  'Checking current turn');

// WARN - 警告（如执行失败）
logger.warn({ roomId, roleId, executorName }, 
  'Executor failed to execute turn');

// ERROR - 错误（如异常）
logger.error({ error, roomId }, 
  'Error in checkAndExecuteCurrentTurn');
```

### 查看执行器列表

```typescript
const coordinator = createAutoPlayerCoordinator(fastify);
const executors = coordinator.getRegisteredExecutors();
console.log('Registered executors:', executors);
// 输出: ['LLMPlayerExecutor', 'RuleBasedPlayerExecutor', ...]
```

---

## 🎮 使用场景

### 场景 1: 人类 vs LLM

```
游戏开始
  ↓
检查第一个玩家 → 人类玩家
  ↓
等待人类操作
  ↓
人类提交行动 → 触发协调器
  ↓
检查下一个玩家 → LLM 玩家
  ↓
LLMPlayerExecutor 自动执行
  ↓
LLM 提交行动 → 触发协调器
  ↓
检查下一个玩家 → 人类玩家
  ↓
... (循环)
```

### 场景 2: LLM vs LLM

```
游戏开始
  ↓
检查第一个玩家 → LLM 玩家 A
  ↓
LLMPlayerExecutor 执行
  ↓
递归检查 → LLM 玩家 B
  ↓
LLMPlayerExecutor 执行
  ↓
递归检查 → LLM 玩家 A
  ↓
... (自动进行到游戏结束)
```

### 场景 3: 混合模式

```
4 人游戏：人类 + LLM + 规则AI + 人类

轮次 1: 人类 → 等待操作
轮次 2: LLM → 自动执行
轮次 3: 规则AI → 自动执行
轮次 4: 人类 → 等待操作
... (循环)
```

---

## ⚙️ 配置与优化

### 递归延迟调整

```typescript
// 在 auto-player-coordinator.ts 中
await this.sleep(100); // 默认 100ms

// 可以根据需要调整：
// - 更快：50ms（测试环境）
// - 更慢：200ms（减少服务器负载）
```

### LLM 调用优化

参考 `LLM_EXECUTOR_GUIDE.md` 的性能优化部分：
- 令牌缓存（自动）
- 并发控制（自动）
- 超时设置（可配置）

---

## 🧪 测试建议

### 单元测试

```typescript
describe('AutoPlayerCoordinator', () => {
  it('should register executors', () => {
    const coordinator = createAutoPlayerCoordinator(mockFastify);
    const executors = coordinator.getRegisteredExecutors();
    expect(executors).toContain('LLMPlayerExecutor');
  });

  it('should match correct executor', async () => {
    const mockExecutor: AutoPlayerExecutor = {
      getName: () => 'MockExecutor',
      canHandle: (state, roleId) => true,
      executeTurn: async () => true,
    };
    
    coordinator.registerExecutor(mockExecutor);
    // Test matching logic
  });
});
```

### 集成测试

```typescript
describe('Auto Player System Integration', () => {
  it('should handle LLM vs LLM game', async () => {
    const roomId = await createRoomWithTwoLLMPlayers();
    await startGame(roomId);
    
    // 等待游戏自动进行
    await waitFor(() => {
      const state = getRoomState(roomId);
      return gameLogic.isTerminal(state.game_state);
    }, 60000); // 最多等待 60 秒
    
    const finalState = getRoomState(roomId);
    expect(finalState.history.length).toBeGreaterThan(0);
  });
});
```

---

## 🔮 未来扩展

### 计划中的执行器类型

1. **规则型 AI**（Rule-based AI）
   - Minimax 算法
   - Alpha-Beta 剪枝
   - 启发式搜索

2. **强化学习 Agent**（RL Agent）
   - DQN（Deep Q-Network）
   - A3C（Asynchronous Actor-Critic）
   - PPO（Proximal Policy Optimization）

3. **蒙特卡洛树搜索**（MCTS）
   - UCT（Upper Confidence Bound for Trees）
   - AlphaZero 风格

4. **混合策略**（Hybrid）
   - LLM + 规则验证
   - LLM + MCTS 精修
   - 多 Agent 协作

### 高级功能

- **执行器优先级**：支持按优先级排序执行器
- **超时保护**：为每个执行器设置超时时间
- **回退机制**：主执行器失败后尝试备用执行器
- **A/B 测试**：同一玩家类型使用不同执行器对比
- **性能监控**：记录每个执行器的延迟和成功率

---

## 📚 相关文档

- [LLM_EXECUTOR_GUIDE.md](./LLM_EXECUTOR_GUIDE.md) - LLM 执行器详细使用指南
- [game_integration_guide.md](./game_integration_guide.md) - 游戏接入指南
- [backend_best_practices.md](./backend_best_practices.md) - 后端最佳实践

---

## 🎉 总结

自动玩家系统采用**抽象化 + 协调器**的设计模式，具有以下优势：

✅ **可扩展性**：轻松添加新的自动玩家类型  
✅ **解耦性**：执行器之间相互独立  
✅ **统一管理**：通过协调器集中控制  
✅ **灵活性**：支持各种混合场景  
✅ **可测试性**：每个组件都可独立测试  

系统已完全实现并可用于生产环境！🚀

