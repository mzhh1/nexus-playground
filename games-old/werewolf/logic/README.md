# 狼人杀游戏逻辑模块说明

本目录包含狼人杀游戏的核心逻辑，采用模块化设计，便于维护和扩展。

## 📁 模块结构

```
games/werewolf/logic/
├── index.ts           # 主入口 (约 440 行) - 游戏逻辑门面类
├── types.ts           # 类型定义 (约 110 行) - 游戏状态和数据结构
├── config.ts          # 游戏配置 (约 180 行) - 规则文本和角色配置
├── utils.ts           # 工具函数 (约 150 行) - 通用工具方法
├── actions.ts         # 行动处理 (约 520 行) - 行动验证和应用
├── phases.ts          # 阶段流转 (约 350 行) - 游戏流程控制
└── perspective.ts     # 视角生成 (约 280 行) - 角色视角和消息
```

**总计约 2030 行**（原文件 1753 行，拆分后增加约 280 行主要用于模块导入导出）

---

## 🎯 各模块职责

### 1️⃣ `types.ts` - 类型定义
**作用**: 定义游戏的核心数据结构

**主要内容**:
- `Identity` - 玩家身份类型
- `Camp` - 阵营类型
- `Phase`, `NightSubPhase` - 游戏阶段
- `DeathRecord`, `NightRecord`, `VoteRecord`, `SpeechRecord` - 历史记录
- `WerewolfState` - 完整游戏状态接口

**依赖**: 无

---

### 2️⃣ `config.ts` - 游戏配置
**作用**: 存储游戏的静态配置数据

**主要内容**:
- `WEREWOLF_RULES` - 游戏规则文本（markdown 格式）
- `PLAYER_COUNT_RANGE` - 支持的人数范围 [6-12]
- `ROLE_DISTRIBUTIONS` - 各人数下的角色配置
- `PLAYER_COUNT_LABELS` - 人数配置标签
- `PLAYER_ROLE_IDS_BY_COUNT` - 角色 ID 列表

**依赖**: `types.ts`

---

### 3️⃣ `utils.ts` - 工具函数
**作用**: 提供通用的工具方法和状态查询

**主要功能**:
- **状态操作**: `cloneState()`, `cleanseUndefined()`
- **查询函数**: `getAlivePlayers()`, `findAliveIdentity()`, `hasAliveIdentity()`
- **狼人相关**: `getAliveWerewolves()`, `getWerewolfTeammates()`, `calculateWerewolfTarget()`
- **其他工具**: `shuffle()`, `getCamp()`, `getSeerHistory()`

**依赖**: `types.ts`

---

### 4️⃣ `actions.ts` - 行动处理
**作用**: 处理所有游戏行动的验证和应用

**主要功能**:

**合法行动生成** (约 150 行):
- `getNightLegalActions()` - 夜晚行动空间
- `getGuardLegalActions()` - 守卫可选行动
- `getWerewolfLegalActions()` - 狼人可选行动
- `getSeerLegalActions()` - 预言家可选行动
- `getWitchLegalActions()` - 女巫可选行动
- `getDayDiscussionLegalActions()` - 白天发言行动
- `getDayVotingLegalActions()` - 白天投票行动
- `getHunterLegalActions()` - 猎人开枪行动

**行动应用** (约 370 行):
- `applyNightAction()` - 分发夜晚行动
- `applyGuardAction()` - 应用守卫行动
- `applyWerewolfAction()` - 应用狼人投票
- `applySeerAction()` - 应用预言家查验
- `applyWitchAction()` - 应用女巫用药
- `applyDayDiscussionAction()` - 应用白天发言
- `applyDayVotingAction()` - 应用白天投票
- `applyHunterAction()` - 应用猎人开枪

**依赖**: `types.ts`, `utils.ts`, `backend/types.ts`

---

### 5️⃣ `phases.ts` - 阶段流转
**作用**: 管理游戏阶段流转和状态机

**主要功能**:

**阶段准备** (约 100 行):
- `ensurePendingRoles()` - 确保有待行动的角色
- `prepareNightSubPhase()` - 准备夜晚子阶段

**夜晚流程** (约 100 行):
- `resolveNight()` - 解决夜晚阶段，计算死亡
- `startNextNight()` - 开始下一个夜晚

**白天流程** (约 80 行):
- `startDayDiscussion()` - 开始白天讨论
- `startDayVoting()` - 开始白天投票
- `resolveDayVoting()` - 解决投票，统计票数

**死亡处理** (约 70 行):
- `applyDeaths()` - 应用死亡记录（包括猎人技能触发）
- `resumeAfterHunter()` - 猎人开枪后恢复流程

**胜利判定** (约 50 行):
- `checkVictory()` - 检查胜利条件
- `updateWinnerIfNeeded()` - 更新胜利者

**依赖**: `types.ts`, `utils.ts`

---

### 6️⃣ `perspective.ts` - 视角生成
**作用**: 生成角色视角和 LLM 提示词

**主要功能**:

**视角生成** (约 150 行):
- `toRolePerspective()` - 生成角色视角（核心方法）
- `getIdentitySpecificState()` - 获取身份特定状态
  - 狼人：队友列表、投票状态
  - 预言家：查验历史
  - 女巫：药剂状态、狼人目标
  - 守卫：上次守护目标
  - 猎人：开枪能力

**消息生成** (约 80 行):
- `buildPerspectiveMessage()` - 构建玩家消息
- `buildSpectatorMessage()` - 构建观战者消息
- `formatNightSubPhase()` - 格式化夜晚子阶段

**提示词生成** (约 30 行):
- `generateStatePrompt()` - 为 LLM 生成状态提示词

**描述函数** (约 20 行):
- `describeIdentity()` - 描述身份
- `describeGoal()` - 描述目标
- `getCampLabel()` - 获取阵营标签

**依赖**: `types.ts`, `config.ts`, `utils.ts`, `backend/types.ts`

---

### 7️⃣ `index.ts` - 主入口
**作用**: 作为门面模式，组装所有模块并导出游戏逻辑类

**主要内容**:
- `WerewolfLogic` 类（实现 `GameLogic` 接口）
- 导入并组合所有模块
- 实现公共接口方法：
  - `getMetadata()` - 游戏元数据
  - `initState()` - 初始化游戏状态
  - `getCurrentRole()` - 获取当前行动角色
  - `getLegalActions()` - 委托给 `actions` 模块
  - `applyAction()` - 委托给 `actions` 模块
  - `isTerminal()` - 判断游戏是否结束
  - `getWinners()` - 获取获胜者
  - `toRolePerspective()` - 委托给 `perspective` 模块
  - `generateStatePrompt()` - 委托给 `perspective` 模块

**依赖**: 所有其他模块

---

## 🔗 模块依赖关系

```
index.ts (主入口)
  ├─► config.ts (配置)
  ├─► types.ts (类型)
  ├─► utils.ts (工具)
  ├─► actions.ts (行动) ──► utils.ts, types.ts
  ├─► phases.ts (阶段) ──► utils.ts, types.ts
  └─► perspective.ts (视角) ──► utils.ts, types.ts, config.ts
```

**依赖层次**（从底层到顶层）:
1. **基础层**: `types.ts`, `config.ts`（无依赖）
2. **工具层**: `utils.ts`（依赖基础层）
3. **功能层**: `actions.ts`, `perspective.ts`（依赖工具层）
4. **流程层**: `phases.ts`（依赖功能层）
5. **门面层**: `index.ts`（依赖所有层）

---

## ✅ 模块化优势

### 1. **可维护性** ⬆️
- 每个模块职责单一，修改某个功能只需改对应模块
- 文件长度从 1753 行降至最大 520 行

### 2. **可读性** ⬆️
- 按功能分组，快速定位代码
- 清晰的模块边界和依赖关系

### 3. **可测试性** ⬆️
- 每个模块可独立测试
- 工具函数可单独 mock

### 4. **可复用性** ⬆️
- `utils.ts` 和 `config.ts` 可被其他变体游戏复用
- 例如：开发"狼人杀简化版"时可复用基础模块

### 5. **团队协作** ⬆️
- 不同开发者可并行开发不同模块
- 减少 Git 冲突

---

## 📝 开发指南

### 添加新角色
1. 在 `types.ts` 中添加新的 `Identity` 类型
2. 在 `config.ts` 中更新 `ROLE_DISTRIBUTIONS`
3. 在 `actions.ts` 中添加对应的行动处理
4. 在 `perspective.ts` 中添加身份描述和视角生成

### 添加新阶段
1. 在 `types.ts` 中更新 `Phase` 或 `NightSubPhase` 类型
2. 在 `phases.ts` 中添加阶段准备和流转逻辑
3. 在 `actions.ts` 中添加对应的行动处理
4. 在 `index.ts` 中更新 `getLegalActions()` 和 `applyAction()`

### 修改游戏规则
1. 在 `config.ts` 中更新 `WEREWOLF_RULES` 文本
2. 在 `actions.ts` 中更新行动验证逻辑
3. 在 `phases.ts` 中更新胜利条件（如需要）

---

## 🔍 与原文件对比

| 指标 | 原文件 | 拆分后 |
|------|--------|--------|
| **文件数** | 1 个 | 7 个 |
| **最大文件行数** | 1753 行 | 520 行 |
| **平均文件行数** | 1753 行 | 290 行 |
| **可维护性** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **可测试性** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **团队协作** | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 总结

这次模块化重构将单一的 1753 行文件拆分成 7 个职责清晰的模块，每个模块专注于特定的功能领域。拆分遵循了以下设计原则：

- ✅ **单一职责原则** - 每个模块只负责一类功能
- ✅ **依赖倒置原则** - 高层模块依赖抽象（通过回调）
- ✅ **开闭原则** - 易于扩展新功能，无需修改核心代码
- ✅ **最小知识原则** - 模块间依赖清晰且最小化

这种结构不仅提高了代码质量，也为未来的功能扩展和维护提供了坚实的基础。

