# 星枢沙盒游戏接入与运行设计文档

**版本**: 1.0  
**最后更新**: 2025-10-25

---

## 目录

1. [设计原则](#1-设计原则)
2. [架构总览](#2-架构总览)
3. [游戏接入三层架构](#3-游戏接入三层架构)
4. [游戏逻辑层规范](#4-游戏逻辑层规范)
5. [游戏UI层规范](#5-游戏ui层规范)
6. [平台运行时机制](#6-平台运行时机制)
7. [完整游戏生命周期](#7-完整游戏生命周期)
8. [观战者系统](#8-观战者系统)
9. [开发者实践指南](#9-开发者实践指南)
10. [附录：完整示例](#10-附录完整示例)

---

## 1. 设计原则

### 1.1 核心理念

**游戏 = 无状态逻辑 + 声明式UI**

- **平台职责**：运行时服务、状态管理、通信、鉴权、LLM调度
- **游戏职责**：定义规则、实现推演逻辑、渲染角色视角

### 1.2 关键设计决策

| 决策点 | 方案 | 理由 |
|--------|------|------|
| **控制栏归属** | 平台直接渲染 | 权限控制（主人特权）必须在平台层实现 |
| **游戏UI加载** | 动态模块加载（非iframe） | 性能与开发体验平衡 |
| **状态管理** | 平台集中管理 | 保证可复现性与安全性 |
| **通信协议** | React Props + Callbacks | 标准数据流，简单可靠 |
| **权威状态** | 永不发送客户端 | 安全红线，防止作弊与信息泄露 |

---

## 2. 架构总览

### 2.1 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          平台前端 (Nexus Frontend)                    │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  NexusControlBar (平台组件)                    │  │  │
│  │  │  - 游戏名称、玩家列表、状态文字               │  │  │
│  │  │  - 暂停/播放 (仅主人)                          │  │  │
│  │  │  - 角色映射编辑 (仅主人)                       │  │  │
│  │  │  - 退出按钮                                     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  统一消息状态栏 (Message Bar - 平台渲染)     │  │  │
│  │  │  - 显示游戏当前状态消息                       │  │  │
│  │  │  - 内容从 RolePerspective.message 获取        │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  游戏UI容器 (Game UI Container)                │  │  │
│  │  │  ┌──────────────────────────────────────────┐  │  │  │
│  │  │  │  动态加载的游戏UI模块                    │  │  │  │
│  │  │  │  props: { perspective, onAction, ... }  │  │  │  │
│  │  │  └──────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                    平台后端 (Nexus Backend)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           游戏运行时引擎 (Runtime Engine)             │  │
│  │  - 状态管理器 (State Manager)                         │  │
│  │  - 行动处理器 (Action Processor)                      │  │
│  │  - 视角生成器 (Perspective Generator)                 │  │
│  │  - LLM执行器 (LLM Executor)                           │  │
│  │  - 事件总线 (Event Bus)                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          游戏逻辑注册表 (Game Registry)               │  │
│  │  {                                                     │  │
│  │    "tic-tac-toe": TicTacToeLogic,                     │  │
│  │    "poker": PokerLogic,                               │  │
│  │    ...                                                 │  │
│  │  }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│                数据层 (Redis + PostgreSQL)                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流向

```
1. 平台推送视角 (Perspective)
   ↓
2. 游戏UI渲染
   ↓
3. 用户交互/LLM决策
   ↓
4. 提交行动 (Action)
   ↓
5. 平台验证 + 游戏逻辑处理
   ↓
6. 状态更新 + 生成新视角
   ↓
7. 循环到步骤1
```

---

## 3. 游戏接入三层架构

### 3.1 层次划分

```typescript
// ============ 第一层：平台控制层 (Platform Control Layer) ============
// 由平台完全控制,游戏开发者无需关心

interface PlatformControl {
  // 平台渲染的控制栏
  controlBar: {
    gameName: string;
    playerList: Player[];
    gameStatusText: string;  // 从游戏获取,但由平台渲染
    playPauseButton: (isOwner: boolean) => void;
    roleMappingEditor: (isOwner: boolean) => void;
    exitButton: () => void;
  };
  
  // 平台管理的权限
  permissions: {
    isOwner: boolean;
    canEditRoleMapping: boolean;
    canControlPlayback: boolean;
  };
}

// ============ 第二层：游戏逻辑层 (Game Logic Layer) ============
// 游戏开发者实现,运行在后端,纯函数无状态

interface GameLogic {
  // 元数据
  getMetadata(): GameMetadata;
  
  // 状态初始化
  initState(ctx: InitContext): GameState;
  
  // 回合控制
  getCurrentRole(state: GameState): string;
  
  // 行动验证
  getLegalActions(state: GameState, roleId: string): ActionSpec;
  applyAction(state: GameState, action: Action): ActionResult;
  
  // 游戏结束判断
  isTerminal(state: GameState): boolean;
  getWinners(state: GameState): string[] | null;
  
  // 视角生成(核心)
  toRolePerspective(
    state: GameState, 
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective;
}

// ============ 第三层：游戏UI层 (Game UI Layer) ============
// 游戏开发者实现,运行在前端,纯渲染组件

interface GameUIPlugin {
  // 游戏只需实现一个渲染函数
  render(props: GameUIProps): React.ReactNode;
}

interface GameUIProps {
  perspective: RolePerspective;  // 角色视角
  onAction: (action: Action) => void;  // 提交行动
  isMyTurn: boolean;  // 是否当前玩家回合
  readonly: boolean;  // 是否只读(观战/游戏结束)
}
```

### 3.2 职责边界

| 层次 | 职责 | 示例 |
|------|------|------|
| **平台控制层** | 房间管理、权限控制、播放控制、角色映射、统一消息状态栏渲染 | "只有主人能点播放按钮"、"显示'轮到你了!'" |
| **游戏逻辑层** | 规则定义、状态推演、合法性验证、视角过滤、生成消息内容 | "玩家X在(1,1)落子是否合法?"、"生成'等待玩家O行动...'" |
| **游戏UI层** | 视角渲染、用户交互、视觉呈现（不包括状态消息） | "显示3x3棋盘,可点击的格子高亮" |

### 3.3 统一消息状态栏设计

#### 3.3.1 设计理念

**核心原则：游戏提供内容，平台统一渲染**

- **为什么需要统一消息栏？**
  - 保证所有游戏的用户体验一致性
  - 避免游戏UI中重复实现状态提示逻辑
  - 平台可以统一控制样式、动画、国际化

- **职责划分**
  - **游戏逻辑层**：在 `toRolePerspective()` 中生成 `message` 字段
  - **平台前端**：统一渲染消息栏，应用样式、动画、主题
  - **游戏UI层**：专注游戏内容渲染，无需关心状态消息显示

#### 3.3.2 消息内容规范

游戏开发者应在 `toRolePerspective()` 中根据游戏状态和角色视角生成合适的消息：

```typescript
toRolePerspective(state, roleId, wholeHistory, diffHistory): RolePerspective {
  let message = '';
  
  // 游戏结束消息
  if (state.winner) {
    if (state.winner === roleId) {
      message = '🎉 游戏结束 - 你获胜了！';
    } else {
      message = `😔 游戏结束 - 玩家 ${getPlayerSymbol(state.winner)} 获胜`;
    }
  }
  // 平局消息
  else if (state.isDraw) {
    message = '🤝 游戏结束 - 平局';
  }
  // 轮到当前玩家
  else if (this.getCurrentRole(state) === roleId) {
    message = '✨ 轮到你了，请选择你的行动';
  }
  // 等待其他玩家
  else {
    const currentSymbol = getCurrentPlayerSymbol(state);
    message = `⏳ 等待玩家 ${currentSymbol} 行动...`;
  }
  
  return {
    // ... 其他字段
    message,
  };
}
```

#### 3.3.3 消息类型建议

| 场景 | 消息示例 | 建议使用的 Emoji |
|------|---------|-----------------|
| **轮到玩家** | "轮到你了，请选择你的行动" | ✨ 或 🎯 |
| **等待对手** | "等待玩家 X 行动..." | ⏳ 或 👀 |
| **玩家获胜** | "游戏结束 - 你获胜了！" | 🎉 或 👑 |
| **玩家失败** | "游戏结束 - 玩家 O 获胜" | 😔 或 💔 |
| **平局** | "游戏结束 - 平局" | 🤝 或 ⚖️ |
| **警告/错误** | "无效操作，请重新选择" | ⚠️ 或 ❌ |
| **特殊事件** | "触发特殊技能！" | ⚡ 或 🌟 |

#### 3.3.4 平台渲染示例

平台前端会统一渲染消息栏，游戏开发者无需关心样式：

```tsx
// frontend/src/components/GameMessageBar.tsx (平台组件)

export function GameMessageBar({ perspective }: { perspective: RolePerspective }) {
  const message = perspective.message || '准备开始游戏...';
  
  // 根据消息内容自动判断类型（可选）
  const messageType = getMessageType(message);
  
  return (
    <div className={`game-message-bar ${messageType}`}>
      <span className="message-content">{message}</span>
    </div>
  );
}

// 自动推断消息类型（用于应用不同样式）
function getMessageType(message: string): 'info' | 'success' | 'warning' | 'waiting' {
  if (message.includes('获胜') || message.includes('🎉')) return 'success';
  if (message.includes('等待') || message.includes('⏳')) return 'waiting';
  if (message.includes('警告') || message.includes('⚠️')) return 'warning';
  return 'info';
}
```

---

## 4. 游戏逻辑层规范

### 4.1 接口定义

```typescript
// backend/src/games/types.ts

/**
 * 游戏元数据
 */
export interface GameMetadata {
  id: string;                    // 游戏唯一标识
  name: string;                  // 游戏显示名称
  description: string;           // 游戏规则描述
  minPlayers: number;            // 最少玩家数
  maxPlayers: number;            // 最多玩家数
  
  /**
   * 游戏所需的角色ID列表
   * 例如: ["player_X", "player_O"] 井字棋
   * 例如: ["player_1", "player_2", "player_3", "player_4"] 四人扑克
   * 平台将使用此列表动态生成角色映射UI
   */
  roleIds: string[];
  
  /**
   * 从视角中提取游戏状态文字(显示在控制栏)
   * 例如: "第3回合 - 轮到玩家X" 或 "游戏结束 - 玩家O获胜"
   */
  getStatusText?: (perspective: RolePerspective) => string;
  
  /**
   * 是否启用 LLM 记忆系统
   * - true: LLM 玩家可以在游戏过程中维护和更新记忆（适用于狼人杀、德州扑克等需要长期推理的游戏）
   * - false: 不启用记忆（适用于井字棋、五子棋等完全信息游戏）
   * @default false
   */
  enable_llm_memory?: boolean;
}

/**
 * 初始化上下文
 */
export interface InitContext {
  players: string[];             // 角色ID列表 ["player_X", "player_O"]
  options?: Record<string, any>; // 游戏自定义配置
}

/**
 * 游戏状态 (权威状态,永不发送客户端)
 */
export interface GameState {
  // 游戏自定义字段
  // 例如井字棋: { board: [][], currentRole: string, turn: number }
  [key: string]: any;
}

/**
 * 角色视角 (发送给客户端和LLM)
 */
export interface RolePerspective {
  global_rules: string;          // 游戏规则自然语言描述
  whole_history: HistoryEvent[]; // 完整历史
  diff_history: HistoryEvent[];  // 差异历史(上次行动至今)
  current_state: any;            // 该角色视角下的游戏状态
  your_role: {
    identity: string;            // 角色身份 "Player X"
    goal: string;                // 角色目标
    is_current: boolean;         // 是否当前回合
  };
  action_space_definition: ActionSpec; // 合法行动空间
  
  /**
   * 统一消息状态栏内容 (由平台渲染)
   * 用于向玩家显示当前游戏状态、提示信息等
   * 例如: "轮到你了!" 或 "等待对手行动..." 或 "游戏结束 - 你获胜!"
   */
  message?: string;
  
  // 可选:游戏自定义字段
  [key: string]: any;
}

/**
 * 统一的行动规范（支持固定选项 + 参数化模板组合）
 */
export interface ActionSpec {
  /**
   * 所有可用行动（包括固定选项和参数化模板）
   */
  actions: ActionDefinition[];
}

export interface ActionDefinition {
  action_id: string;              // 行动唯一标识
  description: string;            // 自然语言描述
  
  /**
   * 参数Schema (JSON Schema格式)
   * - null/undefined: 固定选项，无需参数（如"停一手"、"弃牌"）
   * - 有值: 参数化模板，需要填充参数（如"落子(row,col)"、"加注(amount)"）
   */
  params_schema?: Record<string, JsonSchemaProperty> | null;
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];             // 枚举值（可选）
  default?: any;            // 默认值（可选）
  items?: JsonSchemaProperty;  // 用于数组类型（可选）
}

/**
 * 玩家提交的行动
 */
export interface Action {
  action_id: string;             // 对应ActionSpec中的action_id或template_id
  params?: Record<string, any>;  // 行动参数
  role_id: string;               // 提交行动的角色ID
}

/**
 * 行动处理结果
 */
export type ActionResult = 
  | { success: true; nextState: GameState; events?: HistoryEvent[] }
  | { success: false; error: string; errorCode?: string };

/**
 * 历史事件
 */
export interface HistoryEvent {
  turn: number;
  role_id: string;
  action: Action;
  timestamp: string;
  description?: string;  // 自然语言描述,用于LLM理解
}

/**
 * 游戏逻辑接口 (游戏开发者必须实现)
 */
export interface GameLogic {
  /**
   * 获取游戏元数据
   */
  getMetadata(): GameMetadata;

  /**
   * 初始化游戏状态
   */
  initState(ctx: InitContext): GameState;

  /**
   * 获取当前行动角色
   */
  getCurrentRole(state: GameState): string;

  /**
   * 获取指定角色的合法行动空间
   */
  getLegalActions(state: GameState, roleId: string): ActionSpec;

  /**
   * 应用行动并返回新状态
   * 注意: 此函数必须是纯函数,不能修改输入的state
   */
  applyAction(state: GameState, action: Action): ActionResult;

  /**
   * 判断游戏是否结束
   */
  isTerminal(state: GameState): boolean;

  /**
   * 获取获胜者列表 (null表示游戏未结束或平局)
   */
  getWinners(state: GameState): string[] | null;

  /**
   * 生成角色视角 (核心方法)
   * @param state 权威游戏状态
   * @param roleId 角色ID
   * @param wholeHistory 完整历史记录
   * @param diffHistory 差异历史(该角色上次行动至今)
   */
  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective;

  /**
   * 为LLM玩家生成状态提示词 (当需要支持LLM玩家时必须实现)
   * 此方法由LLM执行器调用，游戏开发者可完全控制如何向LLM呈现游戏状态
   * @param perspective 角色视角(包含状态、历史、角色信息等)
   * @returns 状态提示词字符串(将由系统与行动提示、记忆、任务提示组合)
   */
  generateStatePrompt(perspective: RolePerspective): string;
}
```

### 4.2 实现要求

#### 4.2.1 纯函数原则

```typescript
// ✅ 正确: 纯函数,不修改输入
applyAction(state: GameState, action: Action): ActionResult {
  // 深拷贝状态
  const nextState = JSON.parse(JSON.stringify(state));
  
  // 修改新状态
  nextState.board[action.params.row][action.params.col] = 'X';
  nextState.turn++;
  
  return { success: true, nextState };
}

// ❌ 错误: 修改了输入状态
applyAction(state: GameState, action: Action): ActionResult {
  state.turn++; // 违反纯函数原则!
  return { success: true, nextState: state };
}
```

#### 4.2.2 状态自包含原则

```typescript
// GameState必须包含所有推演所需信息
interface TicTacToeState extends GameState {
  board: (string | null)[][];
  currentRole: string;
  turn: number;
  // 不依赖外部变量或全局状态
}
```

#### 4.2.3 视角过滤原则

```typescript
// 不完美信息游戏示例: 扑克
toRolePerspective(state: GameState, roleId: string, ...): RolePerspective {
  const pokerState = state as PokerState;
  
  return {
    global_rules: "德州扑克规则...",
    current_state: {
      my_hand: pokerState.hands[roleId],          // ✅ 只显示自己的手牌
      opponent_hand_count: pokerState.hands.length - 1, // ✅ 对手手牌数量
      // opponent_hands: pokerState.hands        // ❌ 绝对不能泄露对手手牌!
      community_cards: pokerState.communityCards,  // ✅ 公共牌可见
      pot: pokerState.pot,
    },
    // ...
  };
}
```

#### 4.2.4 LLM状态提示词生成

`generateStatePrompt()` 方法用于自定义如何向LLM呈现游戏状态。你可以完全控制格式、内容和结构。

```typescript
// ✅ 推荐: 结构化的提示词
generateStatePrompt(perspective: RolePerspective): string {
  const { current_state, your_role } = perspective;
  
  return `# 游戏规则
${perspective.global_rules}

# 你的身份
角色: ${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}

# 当前游戏状态
${this.formatStateForLLM(current_state)}

# 历史记录
${this.formatHistoryForLLM(perspective.diff_history)}`;
}

// ✅ 自定义格式化方法
private formatStateForLLM(state: any): string {
  // 将状态格式化为易读的文本
  return `棋盘:\n${this.renderBoard(state.board)}\n回合: ${state.turn}`;
}

// ❌ 避免: 直接JSON.stringify(完整信息可能过于冗长)
generateStatePrompt(perspective: RolePerspective): string {
  return JSON.stringify(perspective); // 不够友好
}
```

**最佳实践**：
- 使用清晰的章节标题（如"# 游戏规则"、"# 当前状态"）
- 突出重要信息（如是否轮到该玩家）
- 使用自然语言描述而非原始JSON（更易于LLM理解）
- 只包含该角色应该知道的信息（遵循视角过滤原则）

### 4.3 LLM 记忆系统（可选）

**适用场景**：狼人杀、德州扑克等需要长期推理和策略规划的游戏。

#### 启用方式

在 `getMetadata()` 中设置 `enable_llm_memory: true`：

```typescript
getMetadata(): GameMetadata {
  return {
    id: 'werewolf',
    name: '狼人杀',
    // ... 其他配置
    enable_llm_memory: true, // ✅ 启用 LLM 记忆
  };
}
```

#### 系统自动处理

启用后，平台会自动管理 LLM 玩家的记忆：

- ✅ **游戏开始时**：清空所有 LLM 玩家的记忆
- ✅ **执行行动前**：将当前记忆注入到 Prompt
- ✅ **执行行动后**：根据 LLM 返回自动更新记忆
- ✅ **独立性保证**：每个 LLM 玩家的记忆完全独立

#### 何时使用

| 场景 | 是否启用 | 原因 |
|------|---------|------|
| **狼人杀** | ✅ true | 需要追踪玩家发言、身份伪装、复杂推理 |
| **德州扑克** | ✅ true | 需要记住对手下注模式、历史行为 |
| **井字棋/五子棋** | ❌ false | 完全信息游戏，`current_state` 已包含所有必要信息 |
| **象棋** | ❌ false | 游戏状态自包含，无需额外记忆 |

**游戏开发者无需额外代码**，只需设置一个标志位，平台自动处理一切！

详细信息请参考 [LLM 玩家记忆系统使用指南](./LLM_MEMORY_GUIDE.md)。

---

### 4.4 游戏注册

```typescript
// backend/src/games/registry.ts

import { GameLogic } from './types';
// 从顶层 games/ 目录通过别名导入逻辑实现
import { TicTacToeLogic } from '@games/tic-tac-toe/logic';
import { PokerLogic } from '@games/poker/logic';

export const gameRegistry: Record<string, GameLogic> = {
  'tic-tac-toe': new TicTacToeLogic(),
  'poker': new PokerLogic(),
};

export function getGameLogic(gameId: string): GameLogic {
  const logic = gameRegistry[gameId];
  if (!logic) {
    throw new Error(`Game logic not found: ${gameId}`);
  }
  return logic;
}
```

---

## 5. 游戏UI层规范

### 5.1 接口定义

```typescript
// frontend/src/lib/game-ui-types.ts

import { RolePerspective, Action } from './types';

/**
 * 游戏UI插件接口
 */
export interface GameUIPlugin {
  /**
   * 渲染游戏界面
   */
  render(props: GameUIProps): React.ReactNode;
  
  /**
   * 可选: 自定义样式
   */
  styles?: string;
}

/**
 * 游戏UI Props
 */
export interface GameUIProps {
  /**
   * 角色视角 (从平台接收)
   */
  perspective: RolePerspective;
  
  /**
   * 提交行动的回调函数
   */
  onAction: (action: Action) => void;
  
  /**
   * 是否当前玩家的回合
   */
  isMyTurn: boolean;
  
  /**
   * 是否只读模式 (观战或游戏结束)
   */
  readonly: boolean;
  
  /**
   * 平台配置
   */
  config: {
    theme: 'light' | 'dark';
    locale: string;
  };
}
```

### 5.2 实现要求

#### 5.2.1 纯渲染组件

```tsx
// ✅ 正确: 纯渲染,无状态管理
export function TicTacToeUI({ perspective, onAction, readonly }: GameUIProps) {
  const handleCellClick = (row: number, col: number) => {
    if (readonly) return;
    
    onAction({
      action_id: `place_${row}_${col}`,
      params: { row, col },
      role_id: perspective.your_role.identity,
    });
  };

  return (
    <div className="tic-tac-toe-board">
      {perspective.current_state.board.map((row, i) =>
        row.map((cell, j) => (
          <div 
            key={`${i}-${j}`}
            onClick={() => handleCellClick(i, j)}
            className={cell ? 'occupied' : 'empty'}
          >
            {cell}
          </div>
        ))
      )}
    </div>
  );
}

// ❌ 错误: 不应在UI中维护游戏状态
function BadGameUI({ perspective, onAction }: GameUIProps) {
  const [board, setBoard] = useState([]); // 违反原则!状态应由平台管理
  // ...
}
```

#### 5.2.2 响应式交互

```tsx
// 根据 action_space_definition 动态渲染可交互元素
export function GameUI({ perspective, onAction, isMyTurn }: GameUIProps) {
  const actionSpec = perspective.action_space_definition;
  
  // 分组：固定选项 vs 参数化模板
  const fixedActions = actionSpec.actions.filter(a => !a.params_schema);
  const paramActions = actionSpec.actions.filter(a => a.params_schema);
  
  return (
    <div>
      {/* 渲染固定选项为按钮 */}
      {fixedActions.map(action => (
        <button
          key={action.action_id}
          onClick={() => onAction({
            action_id: action.action_id,
            role_id: perspective.your_role.identity,
          })}
          disabled={!isMyTurn}
        >
          {action.description}
        </button>
      ))}
      
      {/* 渲染参数化行动为表单或交互式界面 */}
      {paramActions.map(action => (
        <ActionForm
          key={action.action_id}
          action={action}
          onSubmit={(params) => onAction({
            action_id: action.action_id,
            params,
            role_id: perspective.your_role.identity,
          })}
          disabled={!isMyTurn}
        />
      ))}
    </div>
  );
}
```

#### 5.2.3 样式隔离

```tsx
// 使用CSS Modules或styled-components避免样式污染
import styles from './TicTacToe.module.css';

export function TicTacToeUI(props: GameUIProps) {
  return (
    <div className={styles.container}>
      <div className={styles.board}>
        {/* 游戏内容 */}
      </div>
    </div>
  );
}
```

#### 5.2.4 棋盘类游戏布局最佳实践 ⭐

**适用场景**：围棋、五子棋、象棋、国际象棋等需要正方形棋盘的游戏

**核心原则**：棋盘自动占满横向或纵向（取较小值），完美适配任何设备

##### 推荐实现方案

**1. 使用 CSS Container Queries（推荐）**

```css
/* games/your-game/ui/ui.module.css */

.game-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
  container-type: size; /* 关键：启用容器查询 */
}

.game-board {
  position: relative;
  /* 占满横向或纵向（取较小值） */
  width: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  height: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  /* 棋盘自定义样式 */
  background-color: #daa520;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
```

**工作原理**：
- `container-type: size`：将容器声明为查询容器
- `100cqw`：容器宽度的 100%
- `100cqh`：容器高度的 100%
- `min(100cqw, 100cqh)`：自动选择较小值，确保棋盘始终完整显示

**2. 使用 aspect-ratio（备选方案）**

如果需要更好的浏览器兼容性：

```css
.game-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}

.game-board {
  position: relative;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 1 / 1; /* 保持正方形 */
  background-color: #daa520;
  border-radius: 4px;
}
```

**优势对比**：

| 特性 | Container Queries | aspect-ratio |
|------|------------------|--------------|
| 浏览器支持 | Chrome 105+, Safari 16+ | Chrome 88+, Safari 15+ |
| 精确度 | 完美，直接计算容器尺寸 | 依赖浏览器自动计算 |
| 代码简洁度 | 非常简洁，一行搞定 | 需要配合 max-width/height |
| 推荐指数 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

##### 完整示例：五子棋

```tsx
// games/gomoku/ui/ui.tsx
import React from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';
import styles from './ui.module.css';

const GomokuUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const { board } = perspective.current_state;

  const handleIntersectionClick = (row: number, col: number) => {
    if (!isMyTurn || readonly) return;
    onAction({
      action_id: `place_${row}_${col}`,
      role_id: perspective.your_role.identity,
      params: {},
    });
  };

  return (
    <div className={styles['game-container']}>
      <div className={styles['game-board']}>
        {/* 渲染棋盘网格 */}
        <svg className={styles['board-lines']} viewBox="0 0 100 100">
          {Array.from({ length: 15 }).map((_, i) => {
            const pos = (i / 14) * 100;
            return (
              <React.Fragment key={i}>
                <line x1="0" y1={pos} x2="100" y2={pos} stroke="#000" strokeWidth="0.3" />
                <line x1={pos} y1="0" x2={pos} y2="100" stroke="#000" strokeWidth="0.3" />
              </React.Fragment>
            );
          })}
        </svg>

        {/* 渲染交点和棋子 */}
        <div className={styles['intersections']}>
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={styles['intersection']}
                style={{
                  left: `${(colIndex / 14) * 100}%`,
                  top: `${(rowIndex / 14) * 100}%`,
                }}
                onClick={() => handleIntersectionClick(rowIndex, colIndex)}
              >
                {cell && <div className={`${styles['stone']} ${styles[cell]}`} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GomokuUI;
```

```css
/* games/gomoku/ui/ui.module.css */

.game-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
  container-type: size;
}

.game-board {
  position: relative;
  width: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  height: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  background-color: #daa520;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  padding: 5%;
  box-sizing: border-box;
}

.board-lines {
  position: absolute;
  top: 5%;
  left: 5%;
  width: 90%;
  height: 90%;
  pointer-events: none;
}

.intersections {
  position: absolute;
  top: 5%;
  left: 5%;
  width: 90%;
  height: 90%;
}

.intersection {
  position: absolute;
  width: 7.5%;
  height: 7.5%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stone {
  width: 85%;
  height: 85%;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.stone.black {
  background: radial-gradient(circle at 30% 30%, #4a4a4a, #000);
}

.stone.white {
  background: radial-gradient(circle at 30% 30%, #fff, #e0e0e0);
  border: 1px solid #ccc;
}
```

##### 关键优势

1. **完美适配**：宽屏设备占满高度，竖屏设备占满宽度
2. **无滚动条**：棋盘始终完整显示在可视区域内
3. **无需媒体查询**：一套CSS适配所有设备
4. **性能优越**：纯CSS实现，无JavaScript计算
5. **代码简洁**：核心只需 3 行CSS

##### 平台层支持

平台已自动处理容器占满页面剩余空间，游戏开发者只需：
1. 容器设置 `container-type: size`
2. 棋盘使用 `min(100cqw, 100cqh)`
3. 无需关心viewport尺寸或父容器配置

**注意事项**：
- 容器 padding 会从可用空间中扣除，建议使用 `calc(100cqw - 2rem)` 
- 棋盘内部元素使用百分比定位，自动适配棋盘尺寸变化
- 避免在棋盘元素上使用固定的 px 单位

### 5.3 游戏UI注册与加载

```typescript
// frontend/src/lib/game-ui-loader.ts

import { GameUIPlugin } from './game-ui-types';
import { lazy } from 'react';

/**
 * 游戏UI模块映射
 */
// 使用路径别名从顶层 games/ 加载 UI 模块
const gameUIModules: Record<string, () => Promise<{ default: GameUIPlugin }>> = {
  'tic-tac-toe': () => import('@games/tic-tac-toe/ui'),
  'poker': () => import('@games/poker/ui'),
};

/**
 * 动态加载游戏UI
 */
export function useGameUI(gameId: string) {
  const loader = gameUIModules[gameId];
  if (!loader) {
    throw new Error(`Game UI not found: ${gameId}`);
  }
  
  return lazy(loader);
}
```

---

## 6. 平台运行时机制

### 6.1 状态管理器 (State Manager)

```typescript
// backend/src/runtime/state-manager.ts

export class StateManager {
  constructor(
    private redis: RedisClient,
    private postgres: PostgresClient
  ) {}

  /**
   * 获取房间权威状态
   */
  async getState(roomId: string): Promise<{
    state: GameState;
    version: number;
  }> {
    const stateJson = await this.redis.get(`room:${roomId}:state`);
    const version = await this.redis.get(`room:${roomId}:version`);
    
    return {
      state: JSON.parse(stateJson),
      version: parseInt(version) || 0,
    };
  }

  /**
   * 更新状态(原子操作)
   */
  async updateState(
    roomId: string,
    newState: GameState,
    expectedVersion: number
  ): Promise<void> {
    const currentVersion = await this.redis.get(`room:${roomId}:version`);
    
    // 乐观锁检查
    if (parseInt(currentVersion) !== expectedVersion) {
      throw new Error('State version conflict');
    }

    // 原子更新
    await this.redis.multi()
      .set(`room:${roomId}:state`, JSON.stringify(newState))
      .incr(`room:${roomId}:version`)
      .exec();
  }

  /**
   * 获取历史记录
   */
  async getHistory(roomId: string): Promise<HistoryEvent[]> {
    const historyJson = await this.redis.get(`room:${roomId}:history`);
    return JSON.parse(historyJson || '[]');
  }

  /**
   * 追加历史事件
   */
  async appendHistory(roomId: string, event: HistoryEvent): Promise<void> {
    const history = await this.getHistory(roomId);
    history.push(event);
    await this.redis.set(`room:${roomId}:history`, JSON.stringify(history));
  }
}
```

### 6.2 行动处理器 (Action Processor)

```typescript
// backend/src/runtime/action-processor.ts

export class ActionProcessor {
  constructor(
    private stateManager: StateManager,
    private gameRegistry: Record<string, GameLogic>
  ) {}

  /**
   * 处理玩家提交的行动
   */
  async processAction(
    roomId: string,
    action: Action,
    options: {
      requestId: string;           // 幂等性ID
      expectedStateVersion?: number; // 乐观锁
    }
  ): Promise<{ success: boolean; error?: string }> {
    // 1. 获取分布式锁
    const lock = await this.acquireLock(roomId);
    if (!lock) {
      return { success: false, error: 'Failed to acquire lock' };
    }

    try {
      // 2. 幂等性检查
      const processed = await this.isActionProcessed(roomId, options.requestId);
      if (processed) {
        return { success: true }; // 已处理,直接返回成功
      }

      // 3. 获取当前状态
      const { state, version } = await this.stateManager.getState(roomId);

      // 4. 版本检查(可选)
      if (options.expectedStateVersion !== undefined && 
          version !== options.expectedStateVersion) {
        return { success: false, error: 'State version mismatch' };
      }

      // 5. 获取游戏逻辑
      const room = await this.getRoom(roomId);
      const gameLogic = this.gameRegistry[room.gameId];

      // 6. 验证当前角色
      const currentRole = gameLogic.getCurrentRole(state);
      if (currentRole !== action.role_id) {
        return { success: false, error: 'Not your turn' };
      }

      // 7. 验证行动合法性
      const legalActions = gameLogic.getLegalActions(state, action.role_id);
      if (!this.isActionLegal(action, legalActions)) {
        return { success: false, error: 'Illegal action' };
      }

      // 8. 应用行动
      const result = gameLogic.applyAction(state, action);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // 9. 更新状态
      await this.stateManager.updateState(roomId, result.nextState, version);

      // 10. 记录历史
      await this.stateManager.appendHistory(roomId, {
        turn: version + 1,
        role_id: action.role_id,
        action,
        timestamp: new Date().toISOString(),
      });

      // 11. 标记请求已处理
      await this.markActionProcessed(roomId, options.requestId);

      return { success: true };

    } finally {
      // 12. 释放锁
      await this.releaseLock(roomId, lock);
    }
  }

  /**
   * 验证行动是否在合法行动空间中
   */
  private isActionLegal(action: Action, spec: ActionSpec): boolean {
    return spec.actions.some(a => a.action_id === action.action_id);
  }

  // 其他辅助方法...
}
```

### 6.3 视角生成器 (Perspective Generator)

```typescript
// backend/src/runtime/perspective-generator.ts

export class PerspectiveGenerator {
  constructor(
    private stateManager: StateManager,
    private gameRegistry: Record<string, GameLogic>,
    private redis: RedisClient
  ) {}

  /**
   * 生成角色视角(带缓存)
   */
  async generatePerspective(
    roomId: string,
    roleId: string
  ): Promise<RolePerspective> {
    // 1. 获取当前状态和版本
    const { state, version } = await this.stateManager.getState(roomId);

    // 2. 检查缓存
    const cacheKey = `room:${roomId}:perspective:${roleId}:v${version}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 3. 获取历史记录
    const wholeHistory = await this.stateManager.getHistory(roomId);
    const diffHistory = await this.getDiffHistory(roomId, roleId);

    // 4. 调用游戏逻辑生成视角
    const room = await this.getRoom(roomId);
    const gameLogic = this.gameRegistry[room.gameId];
    
    const perspective = gameLogic.toRolePerspective(
      state,
      roleId,
      wholeHistory,
      diffHistory
    );

    // 5. 缓存视角(5分钟)
    await this.redis.setex(cacheKey, 300, JSON.stringify(perspective));

    return perspective;
  }

  /**
   * 为房间所有角色生成视角
   */
  async generateAllPerspectives(roomId: string): Promise<Map<string, RolePerspective>> {
    const room = await this.getRoom(roomId);
    const roleMapping = room.roleMapping;
    
    const perspectives = new Map<string, RolePerspective>();
    
    for (const roleId of Object.keys(roleMapping)) {
      const perspective = await this.generatePerspective(roomId, roleId);
      perspectives.set(roleId, perspective);
    }
    
    return perspectives;
  }

  /**
   * 获取差异历史(该角色上次行动至今)
   */
  private async getDiffHistory(roomId: string, roleId: string): Promise<HistoryEvent[]> {
    const wholeHistory = await this.stateManager.getHistory(roomId);
    
    // 找到该角色最后一次行动的位置
    let lastActionIndex = -1;
    for (let i = wholeHistory.length - 1; i >= 0; i--) {
      if (wholeHistory[i].role_id === roleId) {
        lastActionIndex = i;
        break;
      }
    }
    
    // 返回从该位置至今的历史
    return lastActionIndex >= 0 
      ? wholeHistory.slice(lastActionIndex)
      : wholeHistory;
  }
}
```

### 6.4 LLM执行器 (LLM Executor)

```typescript
// backend/src/runtime/llm-executor.ts

import { createLLMClient } from '@autolabz/llmapi-sdk';

export class LLMExecutor {
  private llmClient;

  constructor(
    private perspectiveGenerator: PerspectiveGenerator,
    private actionProcessor: ActionProcessor,
    llmApiBaseUrl: string,
    auth: any
  ) {
    this.llmClient = createLLMClient({ baseURL: llmApiBaseUrl, auth });
  }

  /**
   * LLM玩家自动执行行动
   */
  async executeForLLMPlayer(
    roomId: string,
    roleId: string,
    llmPlayer: LLMPlayerConfig
  ): Promise<void> {
    // 1. 生成视角
    const perspective = await this.perspectiveGenerator.generatePerspective(
      roomId,
      roleId
    );

    // 2. 构造Prompt
    const prompt = this.buildPrompt(perspective, llmPlayer.systemPrompt);

    // 3. 调用LLM(带重试)
    let action: Action | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.llmClient.chat({
          model: llmPlayer.modelName,
          messages: [
            { role: 'system', content: llmPlayer.systemPrompt },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
        });

        action = this.parseActionFromLLMResponse(response.choices[0].message.content);
        break;
      } catch (error) {
        console.error(`LLM call failed (attempt ${attempt + 1}/3):`, error);
        if (attempt === 2) {
          throw new Error('LLM execution failed after 3 attempts');
        }
        await this.sleep(Math.pow(2, attempt) * 1000); // 指数退避
      }
    }

    if (!action) {
      throw new Error('Failed to get valid action from LLM');
    }

    // 4. 提交行动
    const result = await this.actionProcessor.processAction(roomId, action, {
      requestId: `llm-${Date.now()}-${Math.random()}`,
    });

    if (!result.success) {
      throw new Error(`LLM action rejected: ${result.error}`);
    }
  }

  /**
   * 构造LLM Prompt
   * 注意: 实际实现中会调用 gameLogic.generateStatePrompt() 来生成状态部分
   */
  private buildPrompt(
    perspective: RolePerspective,
    systemPrompt: string,
    gameLogic: GameLogic
  ): string {
    // 调用游戏逻辑层的方法生成状态提示词
    const statePrompt = gameLogic.generateStatePrompt(perspective);
    
    return `
${statePrompt}

【合法行动】
${this.formatActionSpec(perspective.action_space_definition)}

请根据上述信息,选择一个合法行动并以JSON格式返回:
{
  "action_id": "你选择的行动ID",
  "params": { /* 如果需要参数 */ },
  "reasoning": "你的决策理由"
}

你必须从合法行动列表中选择,否则行动将被拒绝。
`;
  }

  /**
   * 格式化行动空间为LLM可读格式
   */
  private formatActionSpec(spec: ActionSpec): string {
    return spec.actions.map(action => {
      let line = `- ${action.action_id}: ${action.description}`;
      
      // 如果有参数Schema，附加参数说明
      if (action.params_schema) {
        line += '\n  参数:\n';
        for (const [key, schema] of Object.entries(action.params_schema)) {
          line += `    * ${key} (${schema.type})`;
          if (schema.description) {
            line += `: ${schema.description}`;
          }
          if (schema.minimum !== undefined || schema.maximum !== undefined) {
            line += ` [范围: ${schema.minimum ?? '-∞'} ~ ${schema.maximum ?? '+∞'}]`;
          }
          if (schema.enum) {
            line += ` [可选值: ${schema.enum.join(', ')}]`;
          }
          line += '\n';
        }
      } else {
        line += ' (无需参数)';
      }
      
      return line;
    }).join('\n');
  }

  /**
   * 从LLM响应中解析行动
   */
  private parseActionFromLLMResponse(response: string): Action {
    try {
      const parsed = JSON.parse(response);
      return {
        action_id: parsed.action_id,
        params: parsed.params,
        role_id: '', // 将由调用方填充
      };
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${response}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.5 事件总线 (Event Bus)

```typescript
// backend/src/runtime/event-bus.ts

export class EventBus {
  private subscribers: Map<string, Set<SSEConnection>> = new Map();

  /**
   * 订阅房间事件
   */
  subscribe(roomId: string, connection: SSEConnection): void {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set());
    }
    this.subscribers.get(roomId)!.add(connection);
  }

  /**
   * 取消订阅
   */
  unsubscribe(roomId: string, connection: SSEConnection): void {
    this.subscribers.get(roomId)?.delete(connection);
  }

  /**
   * 广播视角更新
   */
  async broadcastPerspectiveUpdate(
    roomId: string,
    perspectives: Map<string, RolePerspective>
  ): Promise<void> {
    const room = await this.getRoom(roomId);
    const connections = this.subscribers.get(roomId);
    
    if (!connections) return;

    for (const conn of connections) {
      // 根据用户ID获取其扮演的角色
      const roleId = this.getRoleIdForUser(room, conn.userId);
      const perspective = perspectives.get(roleId);
      
      if (perspective) {
        conn.send({
          type: 'perspective_update',
          data: perspective,
        });
      }
    }
  }

  /**
   * 广播错误
   */
  async broadcastError(
    roomId: string,
    userId: string,
    error: string
  ): Promise<void> {
    const connections = this.subscribers.get(roomId);
    if (!connections) return;

    for (const conn of connections) {
      if (conn.userId === userId) {
        conn.send({
          type: 'error',
          data: { message: error },
        });
      }
    }
  }
}
```

---

## 7. 完整游戏生命周期

### 7.1 开放阶段流程

```
1. 用户登录
   ↓
2. 平台自动创建/加载星枢
   POST /api/v1/my-nexus
   → 检查PostgreSQL是否存在rooms记录
   → 不存在则创建(生成roomId, 初始化Redis)
   ↓
3. 主人选择游戏
   POST /api/v1/my-nexus/select-game
   {
     "gameId": "tic-tac-toe"
   }
   → 更新PostgreSQL rooms.game_id
   → 更新Redis room:{roomId}:meta
   ↓
4. 主人配置玩家列表
   POST /api/v1/my-nexus/players/add
   {
     "type": "llm",
     "model_name": "gpt-4",
     "system_prompt": "你是谨慎的AI玩家"
   }
   → 生成room_player_id
   → Redis HSET room:{roomId}:players
   ↓
5. 其他玩家加入
   POST /api/v1/rooms/{roomId}/join
   → 允许加入"open"或"playing"状态的房间
   → 添加到玩家列表（不分配角色映射）
   → 若房间已处于"playing"状态，需由主人手动分配角色
   ↓
6. 主人选择初始状态(可选)
   POST /api/v1/my-nexus/load-snapshot
   { "snapshotId": "uuid" }
   → 从PostgreSQL加载快照
   → 初始化Redis state
```

### 7.2 游戏开始流程

```
1. 主人配置角色映射
   【前端】拖拽连线UI
   POST /api/v1/my-nexus/role-mapping
   {
     "mapping": {
       "player_X": "room_player_abc123",
       "player_O": "room_player_def456"
     }
   }
   → 验证玩家数量 >= game.minPlayers
   → Redis HSET room:{roomId}:roles
   ↓
2. 主人点击"播放"按钮
   POST /api/v1/my-nexus/start
   → 调用game.initState()生成初始状态
   → Redis更新meta.status = "playing"
   → Redis SET room:{roomId}:state
   → Redis SET room:{roomId}:version = 0
   ↓
3. 平台生成初始视角
   → perspectiveGenerator.generateAllPerspectives(roomId)
   → 为每个角色生成视角
   ↓
4. SSE推送视角
   → eventBus.broadcastPerspectiveUpdate()
   → 前端收到perspective,渲染游戏UI
```

### 7.3 游戏进行中流程

```
【每个回合循环】

1. 确定当前行动角色
   currentRole = gameLogic.getCurrentRole(state)
   ↓
2. 检查角色类型
   room_player = roleMapping[currentRole]
   
   IF room_player.type === "human":
     → 等待人类玩家提交行动(前端UI点击)
     
   ELSE IF room_player.type === "llm":
     → llmExecutor.executeForLLMPlayer(roomId, currentRole, room_player)
   ↓
3. 人类玩家提交行动
   【前端】用户点击游戏UI
   → onAction({ action_id: "place_1_1", params: {...} })
   
   POST /api/v1/rooms/{roomId}/actions
   {
     "action": { action_id: "place_1_1", ... },
     "requestId": "uuid",
     "expectedStateVersion": 5
   }
   ↓
4. 行动处理
   actionProcessor.processAction()
   → 获取分布式锁
   → 幂等性检查
   → 验证回合
   → 验证合法性
   → 应用行动: result = gameLogic.applyAction(state, action)
   → 更新Redis state, version++
   → 记录history
   → 释放锁
   ↓
5. 生成新视角
   perspectiveGenerator.generateAllPerspectives(roomId)
   ↓
6. 广播更新
   eventBus.broadcastPerspectiveUpdate()
   → 所有玩家前端收到新perspective
   → 游戏UI重新渲染
   ↓
7. 检查游戏结束
   IF gameLogic.isTerminal(state):
     → winners = gameLogic.getWinners(state)
     → 广播游戏结束事件
     → 房间状态变为"playing"但无法继续推演
   ELSE:
     → 跳转到步骤1(下一回合)
```

### 7.4 暂停与推演状态机

```
【状态转换】

open ─────────────► playing (主人点击"播放")
  ▲                    │
  │                    │ (主人点击"暂停")
  │                    ▼
  │             paused(可恢复)
  │                    │
  │                    │ (主人点击"播放")
  │                    ▼
  │                 playing
  │                    │
  │                    │ (主人点击"停止" 或 游戏结束)
  │                    ▼
  └────────────── paused(锁定，不可恢复)

【状态说明】
- open: 开放阶段,可添加玩家,选择游戏
- playing: 推演中,自动处理回合
- paused: 暂停。若为锁定暂停(终局)，仅能查看，不能继续播放

【权限控制】
- 只有主人可以切换状态
- 暂停时可编辑角色映射
- playing时自动处理LLM玩家回合
```

---

## 8. 观战者系统

### 8.1 观战者设计理念

**核心原则：观战者是特殊的角色ID，自动分配给未映射到游戏角色的玩家**

- **什么是观战者？**
  - 加入房间但未被分配到游戏角色（如 `player_X`、`player_O`）的玩家
  - 可以实时观看游戏进行，但不能执行游戏行动
  - 支持多个观战者同时观看同一场游戏

- **为什么需要观战者？**
  - 允许更多玩家参与游戏体验（学习、社交、娱乐）
  - 支持教学场景（老师演示，学生观看）
  - 支持竞技场景（选手对战，观众围观）

### 8.2 观战者角色ID

- 观战者角色ID是平台保留的特殊ID
- 平台会自动将未分配角色的玩家标记为观战者
- 游戏逻辑需要在 `toRolePerspective()` 中检测并处理观战者

### 8.3 观战者自动分配机制

平台在广播视角时，自动为未分配角色的玩家分配观战者角色：

```typescript
// backend/src/utils/perspective-broadcast.ts

export async function broadcastPerspectivesToAllPlayers(
  roomId: string,
  stateManager: StateManager,
  perspectiveGenerator: PerspectiveGenerator,
  eventBus: EventBus
): Promise<void> {
  const roomState = await stateManager.getRoomState(roomId);
  
  // 构建反向映射：room_player_id -> role_id
  const playerIdToRole = new Map<string, string>();
  for (const [roleId, playerId] of Object.entries(roomState.role_mapping)) {
    playerIdToRole.set(playerId, roleId);
  }

  // 为房间中的所有玩家广播视角（包括观战者）
  for (const roomPlayerId of Object.keys(roomState.player_list)) {
    // 获取玩家的角色，如果未分配角色则为观战者
    const roleId = playerIdToRole.get(roomPlayerId) || SPECTATOR_ROLE_ID;
    
    const perspective = await perspectiveGenerator.generatePerspective(
      roomId,
      roleId,
      { skipCache: true }
    );

    if (perspective) {
      eventBus.broadcastPerspective(roomId, roleId, perspective);
    }
  }
}
```

**工作流程**：
1. 遍历房间的 `player_list`（所有加入房间的玩家）
2. 检查玩家是否在 `role_mapping` 中有对应的游戏角色
3. 如果有角色映射，使用游戏角色ID（如 `player_X`）
4. 如果没有角色映射，使用 `SPECTATOR_ROLE_ID`
5. 为每个玩家生成并广播对应的视角

### 8.4 游戏逻辑中的观战者支持

#### 8.4.1 在 `toRolePerspective()` 中检测观战者

游戏开发者需要在 `toRolePerspective()` 方法中检测并处理观战者：

```typescript
import { isSpectator } from '../types';

toRolePerspective(
  state: GameState,
  roleId: string,
  wholeHistory: HistoryEvent[],
  diffHistory: HistoryEvent[]
): RolePerspective {
  const s = state as MyGameState;
  
  // 检测是否为观战者
  const isSpectatorRole = isSpectator(roleId);
  
  // 根据是否为观战者生成不同的消息
  let message = '';
  
  if (isSpectatorRole) {
    // 观战者消息
    if (s.winner) {
      message = `👀 观战模式 - 玩家 ${s.winner} 获胜！`;
    } else {
      message = `👀 观战模式 - 轮到玩家 ${s.currentRole}`;
    }
  } else {
    // 玩家消息
    if (s.winner) {
      message = s.winner === roleId 
        ? '🎉 游戏结束 - 你获胜了！' 
        : '😔 游戏结束 - 对手获胜';
    } else if (s.currentRole === roleId) {
      message = '✨ 轮到你了，请选择你的行动';
    } else {
      message = '⏳ 等待对手行动...';
    }
  }
  
  return {
    global_rules: this.getMetadata().description,
    whole_history: wholeHistory,
    diff_history: diffHistory,
    current_state: {
      // 观战者通常可以看到完整的游戏状态
      // 但不完美信息游戏可能需要隐藏某些信息
      ...
    },
    your_role: {
      identity: isSpectatorRole 
        ? 'Spectator (观战者)' 
        : `Player ${roleId}`,
      goal: isSpectatorRole 
        ? '观看对局，学习游戏策略。' 
        : '你的游戏目标...',
      is_current: isSpectatorRole ? false : s.currentRole === roleId,
    },
    action_space_definition: this.getLegalActions(state, roleId),
    message,
  };
}
```

#### 8.4.2 观战者的行动空间

观战者不应有任何可执行的行动：

```typescript
getLegalActions(state: GameState, roleId: string): ActionSpec {
  // 观战者没有合法行动
  if (isSpectator(roleId)) {
    return { actions: [] };
  }
  
  // 正常玩家的行动空间
  return {
    actions: [
      // ... 游戏行动
    ]
  };
}
```

#### 8.4.3 观战者消息规范

| 场景 | 玩家消息 | 观战者消息 |
|------|---------|-----------|
| **轮到玩家** | "✨ 轮到你了，请选择你的行动" | "👀 观战模式 - 轮到玩家 X" |
| **等待对手** | "⏳ 等待对手行动..." | "👀 观战模式 - 轮到玩家 O" |
| **玩家获胜** | "🎉 游戏结束 - 你获胜了！" | "👀 观战模式 - 玩家 X 获胜！" |
| **玩家失败** | "😔 游戏结束 - 对手获胜" | "👀 观战模式 - 玩家 O 获胜！" |
| **平局** | "🤝 游戏结束 - 平局" | "👀 观战模式 - 平局" |
| **特殊事件** | "⚠️ 你被将军了！" | "👀 观战模式 - 红方被将军了！" |

**设计建议**：
- 观战者消息始终以 "👀 观战模式" 开头，清晰标识身份
- 使用第三人称描述游戏状态（"轮到玩家 X"而非"轮到你了"）
- 保持客观中立，不偏向任何一方

### 8.5 完整示例：井字棋观战者实现

```typescript
// games/tic-tac-toe/logic/index.ts

import { 
  GameLogic, 
  GameState, 
  RolePerspective, 
  isSpectator 
} from '../../../backend/src/games/types';

export class TicTacToeLogic implements GameLogic {
  // ... 其他方法
  
  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as TicTacToeState;
    const metadata = this.getMetadata();

    // 检查是否为观战者
    const isSpectatorRole = isSpectator(roleId);

    // 生成统一消息状态栏内容
    let message = '';
    
    if (isSpectatorRole) {
      // 观战者消息
      if (s.winner) {
        const winnerSymbol = s.winner === 'player_X' ? 'X' : 'O';
        message = `👀 观战模式 - 玩家 ${winnerSymbol} 获胜！`;
      } else if (s.isDraw) {
        message = '👀 观战模式 - 平局';
      } else {
        const currentSymbol = s.currentRole === 'player_X' ? 'X' : 'O';
        message = `👀 观战模式 - 轮到玩家 ${currentSymbol}`;
      }
    } else {
      // 玩家消息
      const mySymbol = roleId === 'player_X' ? 'X' : 'O';
      const opponentSymbol = roleId === 'player_X' ? 'O' : 'X';
      
      if (s.winner) {
        if (s.winner === roleId) {
          message = `🎉 游戏结束 - 你获胜了！`;
        } else {
          message = `😔 游戏结束 - 玩家 ${opponentSymbol} 获胜`;
        }
      } else if (s.isDraw) {
        message = '🤝 游戏结束 - 平局';
      } else if (s.currentRole === roleId) {
        message = `✨ 轮到你了 (${mySymbol})，请在棋盘上选择位置`;
      } else {
        message = `⏳ 等待玩家 ${opponentSymbol} 行动...`;
      }
    }

    // 井字棋是完美信息游戏，所有玩家（包括观战者）看到相同的棋盘
    const perspective: RolePerspective = {
      global_rules: metadata.description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        board: s.board,
        currentRole: s.currentRole,
        turn: s.turn,
        winner: s.winner,
        isDraw: s.isDraw,
      },
      your_role: {
        identity: isSpectatorRole 
          ? 'Spectator (观战者)' 
          : (roleId === 'player_X' ? 'Player X' : 'Player O'),
        goal: isSpectatorRole 
          ? '观看对局，学习井字棋策略。' 
          : '在棋盘的空位上放置你的棋子，尝试将三个棋子连成一线以获胜。',
        is_current: isSpectatorRole ? false : s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message,
    };

    return perspective;
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const { current_state, your_role } = perspective;
    
    // 将棋盘格式化为易读的文本
    const boardStr = current_state.board
      .map((row, i) => `  ${row.map(cell => cell || '_').join(' | ')}`)
      .join('\n');
    
    return `# 游戏规则
${perspective.global_rules}

# 你的身份
角色: ${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}

# 当前游戏状态
第 ${current_state.turn} 回合
棋盘 (3x3):
${boardStr}

${current_state.winner ? `游戏已结束，获胜者: ${current_state.winner}` : '游戏进行中'}`;
  }
  
  getLegalActions(state: GameState, roleId: string): ActionSpec {
    // 观战者没有合法行动
    if (isSpectator(roleId)) {
      return { actions: [] };
    }
    
    const s = state as TicTacToeState;
    const actions = [];
    
    // 只有当前玩家才有合法行动
    if (s.currentRole !== roleId) {
      return { actions: [] };
    }
    
    // 遍历棋盘，找到所有空位
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (s.board[row][col] === null) {
          actions.push({
            action_id: `place_${row}_${col}`,
            description: `在位置 (${row},${col}) 落子`,
            params_schema: null,
          });
        }
      }
    }
    
    return { actions };
  }
}
```

### 8.6 不完美信息游戏的观战者处理

对于不完美信息游戏（如扑克、狼人杀），观战者的视角需要特别设计：

#### 选项A：观战者看到完整信息（推荐用于教学/回放）

```typescript
toRolePerspective(state: PokerState, roleId: string, ...): RolePerspective {
  const isSpectatorRole = isSpectator(roleId);
  
  if (isSpectatorRole) {
    // 观战者看到所有玩家的手牌（上帝视角）
    return {
      current_state: {
        all_hands: state.hands, // 所有玩家手牌
        community_cards: state.communityCards,
        pot: state.pot,
        // ... 完整信息
      },
      your_role: {
        identity: 'Spectator (观战者 - 上帝视角)',
        goal: '观看对局，所有信息可见。',
        is_current: false,
      },
      action_space_definition: { actions: [] },
      message: '👀 观战模式 - 上帝视角',
    };
  }
  
  // 玩家只看到自己的手牌
  return {
    current_state: {
      my_hand: state.hands[roleId],
      opponent_count: state.hands.length - 1,
      community_cards: state.communityCards,
      pot: state.pot,
    },
    // ...
  };
}
```

#### 选项B：观战者看到有限信息（推荐用于竞技/直播）

```typescript
toRolePerspective(state: PokerState, roleId: string, ...): RolePerspective {
  const isSpectatorRole = isSpectator(roleId);
  
  if (isSpectatorRole) {
    // 观战者只看到公共信息，不看手牌（公平观战）
    return {
      current_state: {
        player_count: state.players.length,
        community_cards: state.communityCards,
        pot: state.pot,
        current_bets: state.currentBets,
        // 不包含任何玩家的手牌
      },
      your_role: {
        identity: 'Spectator (观战者)',
        goal: '观看对局，仅可见公共信息。',
        is_current: false,
      },
      action_space_definition: { actions: [] },
      message: '👀 观战模式 - 公平观战',
    };
  }
  
  // 玩家视角
  // ...
}
```

### 8.7 观战者UI处理

游戏UI会自动处理观战者状态：

```tsx
// games/my-game/ui/ui.tsx

export function MyGameUI({ 
  perspective, 
  onAction, 
  isMyTurn, 
  readonly 
}: GameUIProps) {
  
  // 观战者的 isMyTurn 永远为 false
  // 观战者的 action_space_definition.actions 为空数组
  
  const isSpectator = perspective.your_role.identity.includes('Spectator');
  
  return (
    <div className={styles.container}>
      {/* 游戏棋盘渲染（观战者和玩家看到相同的棋盘） */}
      <GameBoard board={perspective.current_state.board} />
      
      {/* 行动按钮（观战者不会看到任何按钮，因为 actions 为空） */}
      <div className={styles.actions}>
        {perspective.action_space_definition.actions.map(action => (
          <button
            key={action.action_id}
            onClick={() => onAction({
              action_id: action.action_id,
              role_id: perspective.your_role.identity,
            })}
            disabled={!isMyTurn || readonly}
          >
            {action.description}
          </button>
        ))}
      </div>
      
      {/* 可选：显示观战者特殊提示 */}
      {isSpectator && (
        <div className={styles.spectatorBadge}>
          👀 观战模式
        </div>
      )}
    </div>
  );
}
```

### 8.8 观战者系统架构优势

| 维度 | 传统方案 | 星枢观战者系统 |
|------|---------|---------------|
| **实现复杂度** | 需要单独的观战者API | 统一的视角生成机制 |
| **数据一致性** | 需要同步玩家和观战者状态 | 自动保证一致性 |
| **扩展性** | 添加观战者功能需要大量改动 | 游戏逻辑只需检测 `isSpectator()` |
| **多观战者支持** | 需要特殊处理 | 原生支持任意数量观战者 |
| **权限控制** | 需要单独实现 | 平台自动处理（观战者无行动权限） |
| **消息推送** | 需要维护两套推送逻辑 | 统一的 SSE 推送机制 |

### 8.9 观战者开发检查清单

在为游戏添加观战者支持时，请确保：

- [ ] 在 `toRolePerspective()` 中使用 `isSpectator(roleId)` 检测观战者
- [ ] 为观战者生成专门的消息（以 "👀 观战模式" 开头）
- [ ] 设置观战者的 `your_role.is_current` 为 `false`
- [ ] 设置观战者的 `your_role.identity` 包含 "Spectator" 或 "观战者"
- [ ] 设置观战者的 `your_role.goal` 描述观战目的
- [ ] 在 `getLegalActions()` 中为观战者返回空行动列表
- [ ] 考虑观战者应该看到的信息范围（完整信息 vs 有限信息）
- [ ] 测试多个观战者同时观看的场景
- [ ] 测试观战者在游戏各个阶段（开始、进行中、结束）的体验

---

## 9. 开发者实践指南

### 9.1 快速接入清单

#### 步骤1: 实现游戏逻辑

**重要提示：角色ID的定义**

在实现游戏逻辑时，必须在 `getMetadata()` 中正确定义 `roleIds` 数组：

- **作用**：平台使用此数组动态生成角色映射界面，允许主人将游戏角色分配给人类或 LLM 玩家
- **格式**：字符串数组，每个元素是一个唯一的角色标识符
- **示例**：
  - 井字棋：`['player_X', 'player_O']`
  - 四人扑克：`['player_1', 'player_2', 'player_3', 'player_4']`
  - 狼人杀：`['werewolf_1', 'werewolf_2', 'villager_1', 'villager_2', 'seer', 'witch']`
- **注意**：角色ID必须与 `initState()` 中使用的角色ID一致

```bash
# 创建游戏目录
mkdir -p backend/src/games/my-game

# 创建逻辑文件
touch backend/src/games/my-game/index.ts
```

```typescript
// games/my-game/logic/index.ts

import { GameLogic, GameMetadata, InitContext, ... } from '../types';

export class MyGameLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'my-game',
      name: '我的游戏',
      description: '游戏规则说明...',
      minPlayers: 2,
      maxPlayers: 4,
      roleIds: ['player_1', 'player_2'], // 定义游戏所需的角色
      enable_llm_memory: false, // 是否启用 LLM 记忆（狼人杀等复杂推理游戏设为 true）
      getStatusText: (perspective) => {
        return `第${perspective.current_state.turn}回合`;
      }
    };
  }

  initState(ctx: InitContext): GameState {
    // 初始化游戏状态
    return {
      players: ctx.players,
      turn: 1,
      // ...
    };
  }

  getCurrentRole(state: GameState): string {
    // 返回当前行动角色ID
    return state.players[state.turn % state.players.length];
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    // 返回合法行动空间
    return {
      actions: [
        // 固定选项示例
        { 
          action_id: 'action_1', 
          description: '执行动作1',
          params_schema: null  // 无参数
        },
        // 参数化模板示例
        {
          action_id: 'action_2',
          description: '执行参数化动作',
          params_schema: {
            value: { type: 'integer', minimum: 1, maximum: 10 }
          }
        }
      ]
    };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    // 验证并应用行动
    const nextState = { ...state };
    // ... 修改nextState
    return { success: true, nextState };
  }

  isTerminal(state: GameState): boolean {
    // 判断游戏是否结束
    return false;
  }

  getWinners(state: GameState): string[] | null {
    // 返回获胜者
    return null;
  }

  toRolePerspective(state, roleId, wholeHistory, diffHistory): RolePerspective {
    // 生成角色视角(核心)
    
    // 生成统一消息状态栏内容
    let message = '';
    if (state.isGameOver) {
      if (state.winner === roleId) {
        message = '🎉 游戏结束 - 你获胜了！';
      } else {
        message = '😔 游戏结束 - 你失败了';
      }
    } else if (this.getCurrentRole(state) === roleId) {
      message = '✨ 轮到你了，请选择你的行动';
    } else {
      message = '⏳ 等待其他玩家行动...';
    }
    
    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        // 过滤后的状态
      },
      your_role: {
        identity: roleId,
        goal: '你的目标',
        is_current: this.getCurrentRole(state) === roleId
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message, // 统一消息，由平台渲染
    };
  }
}
```

#### 步骤2: 注册游戏逻辑

```typescript
// backend/src/games/registry.ts

import { MyGameLogic } from '@games/my-game/logic';

export const gameRegistry = {
  // ... 其他游戏
  'my-game': new MyGameLogic(),
};
```

#### 步骤3: 实现游戏UI

```bash
# 创建顶层游戏目录（UI 与 逻辑分离但同一游戏目录）
mkdir -p games/my-game/logic
mkdir -p games/my-game/ui

touch games/my-game/logic/index.ts
touch games/my-game/ui/ui.tsx
touch games/my-game/ui/ui.module.css
```

```tsx
// games/my-game/ui/ui.tsx

import { GameUIProps } from '../../lib/game-ui-types';
import styles from './ui.module.css';

export function MyGameUI({ 
  perspective, 
  onAction, 
  isMyTurn, 
  readonly 
}: GameUIProps) {
  
  const handleAction = (actionId: string) => {
    if (readonly || !isMyTurn) return;
    
    onAction({
      action_id: actionId,
      role_id: perspective.your_role.identity,
    });
  };

  return (
    <div className={styles.container}>
      {/* 
        游戏状态消息（轮到你了、等待对手等）现在由平台的统一消息栏显示
        游戏UI只需关注游戏内容的渲染
      */}
      
      <div className={styles.gameBoard}>
        {/* 渲染游戏状态 */}
        <pre>{JSON.stringify(perspective.current_state, null, 2)}</pre>
      </div>
      
      <div className={styles.actionButtons}>
        {perspective.action_space_definition.actions
          .filter(action => !action.params_schema) // 仅渲染无需参数的固定选项
          .map(action => (
            <button
              key={action.action_id}
              onClick={() => handleAction(action.action_id)}
              disabled={!isMyTurn || readonly}
              className={styles.actionButton}
            >
              {action.description}
            </button>
          ))}
      </div>
    </div>
  );
}

export default { render: MyGameUI };
```

#### 步骤4: 注册游戏UI

```typescript
// frontend/src/lib/game-ui-loader.ts

const gameUIModules = {
  // ... 其他游戏
  'my-game': () => import('@games/my-game/ui'),
};
```

#### 步骤5: 测试

```bash
# 启动后端
cd backend
npm run dev

# 启动前端
cd frontend
npm run dev

# 访问 http://localhost:5173/my-nexus
# 选择"我的游戏"开始测试
```

### 9.2 调试技巧

#### 9.2.1 查看权威状态(仅开发环境)

```typescript
// backend/src/routes/debug.ts (仅开发环境启用)

app.get('/api/v1/debug/rooms/:roomId/state', async (req, reply) => {
  if (process.env.NODE_ENV !== 'development') {
    return reply.code(403).send({ error: 'Debug endpoints disabled in production' });
  }
  
  const { roomId } = req.params;
  const { state, version } = await stateManager.getState(roomId);
  
  return { state, version };
});
```

#### 9.2.2 模拟LLM响应

```typescript
// backend/src/runtime/llm-executor.ts

async executeForLLMPlayer(...) {
  // 开发模式:使用规则AI代替LLM
  if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_LLM === 'true') {
    const action = this.getMockAction(perspective);
    // ...
  }
}
```

#### 9.2.3 前端日志

```tsx
// frontend/src/pages/room/index.tsx

useEffect(() => {
  if (import.meta.env.DEV) {
    console.log('[Perspective Updated]', perspective);
  }
}, [perspective]);
```

### 9.3 性能优化建议

#### 9.3.1 视角缓存策略

```typescript
// 缓存键设计: room:{roomId}:perspective:{roleId}:v{version}
// 优点: 版本变化自动失效,无需手动清除
```

#### 9.3.2 历史记录分页

```typescript
// 对于长时间游戏,历史记录可能很大
// 建议: whole_history只保留最近100条,完整历史存PostgreSQL

toRolePerspective(state, roleId, wholeHistory, diffHistory) {
  return {
    whole_history: wholeHistory.slice(-100), // 只传最近100条
    // ...
  };
}
```

#### 9.3.3 大状态压缩

```typescript
// 对于复杂游戏(如围棋),状态可能很大
// 建议: current_state 只包含最小必要信息

toRolePerspective(state, roleId, ...) {
  return {
    current_state: {
      board_diff: this.getBoardDiff(state), // 增量数据
      // 而不是完整的19x19棋盘
    },
    // ...
  };
}
```

### 9.4 常见陷阱

#### ❌ 陷阱1: 在UI中维护游戏状态

```tsx
// 错误示例
function GameUI({ perspective, onAction }: GameUIProps) {
  const [localBoard, setLocalBoard] = useState([]); // ❌ 不要这样!
  
  // 状态应该完全由perspective驱动
}
```

#### ❌ 陷阱2: 泄露私密信息

```typescript
// 错误示例
toRolePerspective(state, roleId, ...) {
  return {
    current_state: state, // ❌ 直接返回完整状态!
    // 这会泄露所有玩家的手牌
  };
}

// 正确做法: 只返回该角色应知信息
toRolePerspective(state, roleId, ...) {
  return {
    current_state: {
      my_hand: state.hands[roleId], // ✅ 只有自己的手牌
      opponent_count: state.hands.length - 1,
    }
  };
}
```

#### ❌ 陷阱3: 修改输入状态

```typescript
// 错误示例
applyAction(state: GameState, action: Action) {
  state.turn++; // ❌ 违反纯函数原则!
  return { success: true, nextState: state };
}

// 正确做法
applyAction(state: GameState, action: Action) {
  const nextState = JSON.parse(JSON.stringify(state)); // ✅ 深拷贝
  nextState.turn++;
  return { success: true, nextState };
}
```

---

## 10. 附录:完整示例

### 10.1 组合模式示例

以下示例展示如何在一个游戏中同时使用固定选项和参数化模板。

#### 示例A: 围棋

```typescript
// backend/src/games/go/index.ts

getLegalActions(state: GoState, roleId: string): ActionSpec {
  return {
    actions: [
      // 固定选项1: 停一手
      {
        action_id: 'pass',
        description: '停一手（本回合不落子）',
        params_schema: null
      },
      
      // 固定选项2: 认输
      {
        action_id: 'resign',
        description: '认输',
        params_schema: null
      },
      
      // 参数化模板: 落子
      {
        action_id: 'place_stone',
        description: '在棋盘的合法空点上落下一子',
        params_schema: {
          row: {
            type: 'integer',
            description: '棋盘行坐标',
            minimum: 0,
            maximum: 18
          },
          col: {
            type: 'integer',
            description: '棋盘列坐标',
            minimum: 0,
            maximum: 18
          }
        }
      }
    ]
  };
}
```

**LLM看到的Prompt：**
```
你可以选择以下行动：

- pass: 停一手（本回合不落子） (无需参数)
- resign: 认输 (无需参数)
- place_stone: 在棋盘的合法空点上落下一子
  参数:
    * row (integer): 棋盘行坐标 [范围: 0 ~ 18]
    * col (integer): 棋盘列坐标 [范围: 0 ~ 18]
```

#### 示例B: 德州扑克

```typescript
// backend/src/games/poker/index.ts

getLegalActions(state: PokerState, roleId: string): ActionSpec {
  const currentBet = state.currentBet;
  const playerChips = state.players[roleId].chips;
  const toCall = currentBet - state.players[roleId].currentBet;
  
  const actions: ActionDefinition[] = [];
  
  // 固定选项: 弃牌
  actions.push({
    action_id: 'fold',
    description: '弃牌',
    params_schema: null
  });
  
  // 固定选项: 过牌（如果不需要跟注）
  if (toCall === 0) {
    actions.push({
      action_id: 'check',
      description: '过牌',
      params_schema: null
    });
  }
  
  // 固定选项: 跟注（如果需要跟注）
  if (toCall > 0 && playerChips >= toCall) {
    actions.push({
      action_id: 'call',
      description: `跟注 ${toCall} 筹码`,
      params_schema: null
    });
  }
  
  // 参数化模板: 加注
  if (playerChips > toCall) {
    actions.push({
      action_id: 'raise',
      description: '加注',
      params_schema: {
        amount: {
          type: 'integer',
          description: '加注金额',
          minimum: Math.max(currentBet * 2, state.bigBlind),
          maximum: playerChips
        }
      }
    });
  }
  
  // 固定选项: All-in
  actions.push({
    action_id: 'all_in',
    description: `All-in (${playerChips}筹码)`,
    params_schema: null
  });
  
  return { actions };
}
```

#### 示例C: 纸牌游戏（选择+数量）

```typescript
// backend/src/games/card-game/index.ts

getLegalActions(state: CardGameState, roleId: string): ActionSpec {
  const myCards = state.hands[roleId];
  
  return {
    actions: [
      // 固定选项: 跳过回合
      {
        action_id: 'skip',
        description: '跳过本回合',
        params_schema: null
      },
      
      // 参数化模板: 打出卡牌
      {
        action_id: 'play_card',
        description: '从手牌中打出一张卡牌',
        params_schema: {
          card_index: {
            type: 'integer',
            description: '手牌索引',
            minimum: 0,
            maximum: myCards.length - 1
          },
          target_player: {
            type: 'string',
            description: '目标玩家ID（某些卡牌需要）',
            enum: state.players.filter(p => p !== roleId)
          }
        }
      },
      
      // 参数化模板: 丢弃卡牌
      {
        action_id: 'discard_cards',
        description: '丢弃指定数量的卡牌',
        params_schema: {
          card_indices: {
            type: 'array',
            description: '要丢弃的卡牌索引列表',
            items: {
              type: 'integer',
              minimum: 0,
              maximum: myCards.length - 1
            }
          }
        }
      }
    ]
  };
}
```

---

### 10.2 井字棋完整实现

#### 后端逻辑

```typescript
// backend/src/games/tic-tac-toe/index.ts

import { GameLogic, GameState, Action, ActionResult, RolePerspective } from '../types';

interface TicTacToeState extends GameState {
  board: (string | null)[][];
  currentRole: string;
  turn: number;
  winner: string | null;
}

export class TicTacToeLogic implements GameLogic {
  getMetadata() {
    return {
      id: 'tic-tac-toe',
      name: '井字棋',
      description: '在3x3棋盘上,先连成三子一线者获胜',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_X', 'player_O'], // 定义井字棋的两个角色
      enable_llm_memory: false, // 完全信息游戏，无需记忆
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state;
        if (state.winner) {
          return `游戏结束 - ${state.winner}获胜!`;
        }
        return `第${state.turn}回合 - 轮到${state.currentSymbol}`;
      }
    };
  }

  initState(ctx) {
    return {
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
      currentRole: ctx.players[0],
      turn: 1,
      winner: null,
    };
  }

  getCurrentRole(state: TicTacToeState): string {
    return state.currentRole;
  }

  getLegalActions(state: TicTacToeState, roleId: string): ActionSpec {
    const actions = [];
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (state.board[i][j] === null) {
          actions.push({
            action_id: `place_${i}_${j}`,
            description: `在(${i},${j})位置落子`,
            params_schema: null  // 固定选项，位置已编码在action_id中
          });
        }
      }
    }
    
    return { actions };
  }

  applyAction(state: TicTacToeState, action: Action): ActionResult {
    // 深拷贝状态
    const nextState: TicTacToeState = JSON.parse(JSON.stringify(state));
    
    // 解析行动
    const match = action.action_id.match(/place_(\d)_(\d)/);
    if (!match) {
      return { success: false, error: 'Invalid action format' };
    }
    
    const row = parseInt(match[1]);
    const col = parseInt(match[2]);
    
    // 验证位置
    if (nextState.board[row][col] !== null) {
      return { success: false, error: 'Cell already occupied' };
    }
    
    // 放置棋子
    const symbol = state.currentRole === state.players[0] ? 'X' : 'O';
    nextState.board[row][col] = symbol;
    nextState.turn++;
    
    // 检查胜利
    if (this.checkWin(nextState.board, symbol)) {
      nextState.winner = state.currentRole;
    }
    
    // 切换角色
    const currentIndex = state.players.indexOf(state.currentRole);
    nextState.currentRole = state.players[(currentIndex + 1) % state.players.length];
    
    return { success: true, nextState };
  }

  isTerminal(state: TicTacToeState): boolean {
    if (state.winner) return true;
    
    // 检查平局
    for (const row of state.board) {
      if (row.some(cell => cell === null)) {
        return false;
      }
    }
    return true;
  }

  getWinners(state: TicTacToeState): string[] | null {
    return state.winner ? [state.winner] : null;
  }

  toRolePerspective(state: TicTacToeState, roleId, wholeHistory, diffHistory): RolePerspective {
    const symbol = state.players[0] === roleId ? 'X' : 'O';
    const opponentSymbol = symbol === 'X' ? 'O' : 'X';
    
    // Generate message for unified message bar
    let message = '';
    if (state.winner) {
      if (state.winner === roleId) {
        message = '🎉 游戏结束 - 你获胜了！';
      } else {
        message = `😔 游戏结束 - 玩家 ${opponentSymbol} 获胜`;
      }
    } else if (this.isBoardFull(state.board)) {
      message = '🤝 游戏结束 - 平局';
    } else if (this.getCurrentRole(state) === roleId) {
      message = `✨ 轮到你了 (${symbol})，请在棋盘上选择位置`;
    } else {
      message = `⏳ 等待玩家 ${opponentSymbol} 行动...`;
    }
    
    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        board: state.board,
        turn: state.turn,
        currentSymbol: symbol,
        winner: state.winner,
      },
      your_role: {
        identity: roleId,
        goal: `使用${symbol}棋子,先连成三子一线获胜`,
        is_current: this.getCurrentRole(state) === roleId
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message, // Unified message for platform to render
    };
  }

  private checkWin(board: (string | null)[][], symbol: string): boolean {
    // 检查行
    for (let i = 0; i < 3; i++) {
      if (board[i].every(cell => cell === symbol)) return true;
    }
    
    // 检查列
    for (let j = 0; j < 3; j++) {
      if (board.every(row => row[j] === symbol)) return true;
    }
    
    // 检查对角线
    if (board[0][0] === symbol && board[1][1] === symbol && board[2][2] === symbol) return true;
    if (board[0][2] === symbol && board[1][1] === symbol && board[2][0] === symbol) return true;
    
    return false;
  }
}
```

#### 前端UI

```tsx
// frontend/src/games/tic-tac-toe/ui.tsx

import { GameUIProps } from '../../lib/game-ui-types';
import styles from './ui.module.css';

export function TicTacToeUI({ 
  perspective, 
  onAction, 
  isMyTurn, 
  readonly 
}: GameUIProps) {
  
  const board = perspective.current_state.board;
  const winner = perspective.current_state.winner;
  
  const handleCellClick = (row: number, col: number) => {
    if (readonly || !isMyTurn || board[row][col]) return;
    
    onAction({
      action_id: `place_${row}_${col}`,
      params: { row, col },
      role_id: perspective.your_role.identity,
    });
  };

  return (
    <div className={styles.container}>
      {/* Game status message is now handled by platform's unified message bar */}
      
      <div className={styles.board}>
        {board.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((cell, j) => (
              <div
                key={j}
                className={`${styles.cell} ${cell ? styles.occupied : styles.empty} ${
                  !readonly && isMyTurn && !cell ? styles.clickable : ''
                }`}
                onClick={() => handleCellClick(i, j)}
              >
                {cell || ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default { render: TicTacToeUI };
```

```css
/* frontend/src/games/tic-tac-toe/ui.module.css */

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100%;
}

.board {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.row {
  display: flex;
  gap: 8px;
}

.cell {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: bold;
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  transition: all 0.2s;
}

.cell.empty.clickable {
  cursor: pointer;
  background: #e9ecef;
}

.cell.empty.clickable:hover {
  background: #667eea;
  border-color: #667eea;
  transform: scale(1.05);
}

.cell.occupied {
  background: #fff;
  color: #667eea;
}

/* 
 * Game status messages (winner, waiting, etc.) are now handled 
 * by platform's unified message bar - no need for game-specific styles 
 */
```

---

## 总结

本设计文档定义了星枢沙盒游戏接入的完整规范:

✅ **关注点分离**: 平台管理运行时,游戏提供逻辑和UI  
✅ **无状态设计**: 游戏逻辑为纯函数,状态由平台统一管理  
✅ **安全保障**: 权威状态永不泄露,视角生成严格过滤  
✅ **LLM原生**: 人类和AI使用同一视角协议  
✅ **可扩展性**: 新游戏只需实现标准接口即可接入  
✅ **灵活行动空间**: 统一支持固定选项与参数化模板的组合  
✅ **统一用户体验**: 平台统一渲染消息状态栏，保证体验一致性  
✅ **观战者支持**: 原生支持多观战者，统一视角生成机制

### 核心设计亮点

**统一的行动规范（ActionSpec）**
- 通过 `params_schema` 的有无区分固定选项和参数化模板
- 固定选项：`params_schema: null`（如"停一手"、"弃牌"）
- 参数化模板：`params_schema: {...}`（如"落子(row,col)"、"加注(amount)"）
- 支持任意组合，适配从井字棋到围棋的各类游戏

**统一消息状态栏设计**
- 游戏逻辑层在 `toRolePerspective()` 中生成 `message` 字段
- 平台前端统一渲染消息栏，应用样式、动画、主题
- 游戏UI专注游戏内容，无需重复实现状态提示逻辑
- 确保所有游戏的用户体验一致，降低开发者负担

**观战者系统设计**
- 观战者是特殊角色ID，自动分配给未映射到游戏角色的玩家
- 使用 `isSpectator(roleId)` 工具函数检测观战者身份
- 观战者看到游戏状态但无法执行行动（空行动列表）
- 支持多个观战者同时观看，统一的视角生成和推送机制
- 不完美信息游戏可选择观战者看到的信息范围（完整/有限）

**游戏开发者只需关注三件事:**
1. **实现 `GameLogic` 接口** (后端纯逻辑，支持固定或多人数角色配置)
   - `toRolePerspective()`: 生成角色视角和消息内容，处理观战者
   - `generateStatePrompt()`: 为LLM玩家生成友好的状态提示词
2. **实现 `GameUIPlugin` 接口** (前端纯渲染，不含状态消息)

**平台处理剩下的一切:**
- 房间管理、状态同步、LLM调度、权限控制、事件广播
- 行动验证、版本控制、分布式锁、幂等性保证
- 视角生成与缓存、SSE实时推送
- 统一消息状态栏渲染、样式管理、国际化支持
- 观战者自动分配、权限控制、视角推送
- LLM 记忆管理（游戏开始时清空、执行行动时自动更新）

---

## 🎮 多人数配置游戏开发指南

### 适用场景

多人数配置适用于**同一游戏规则下，不同人数有不同角色组合**的游戏，例如：
- **狼人杀**：6人局、8人局、12人局有不同的狼人和村民配置
- **阿瓦隆**：5人、7人、10人局有不同的角色卡配置
- **谁是卧底**：4人、6人、8人局

### 实现步骤

#### 1. 定义多人数角色配置

```typescript
// games/werewolf/logic/index.ts
export class WerewolfLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'werewolf',
      name: '狼人杀',
      description: '狼人和村民的对抗游戏...',
      minPlayers: 6,
      maxPlayers: 12,
      
      // ✅ 使用多人数配置格式
      roleIds: {
        6: [
          'werewolf_1',
          'werewolf_2',
          'villager_1',
          'villager_2',
          'villager_3',
          'seer',
        ],
        8: [
          'werewolf_1',
          'werewolf_2',
          'werewolf_3',
          'villager_1',
          'villager_2',
          'villager_3',
          'villager_4',
          'seer',
        ],
        12: [
          'werewolf_1',
          'werewolf_2',
          'werewolf_3',
          'werewolf_4',
          'villager_1',
          'villager_2',
          'villager_3',
          'villager_4',
          'villager_5',
          'villager_6',
          'seer',
          'witch',
        ],
      },
      
      // ✅ 可选：为每个人数配置提供描述
      playerCountLabels: {
        6: '6人标准局',
        8: '8人进阶局',
        12: '12人完整局',
      },
      
      enable_llm_memory: true,
    };
  }
  
  // ... 其余实现与传统游戏相同
}
```

#### 2. 游戏逻辑实现

多人数配置游戏的逻辑实现与传统游戏**完全相同**，无需特殊处理：

```typescript
// initState、getCurrentRole、getLegalActions、applyAction 等方法
// 实现方式与传统游戏一致，平台会自动处理人数选择
initState(ctx: InitContext): GameState {
  // ctx.players 已经是根据选择的人数配置的角色列表
  // 例如 6人局: ['werewolf_1', 'werewolf_2', 'villager_1', ...]
  return {
    players: ctx.players,
    // ... 初始化状态
  };
}
```

#### 3. 用户体验流程

主人启动游戏时的流程：

```
1. 点击"编辑角色分配"
   ↓
2. 首先看到人数选择器（自动显示）
   [6人标准局] [8人进阶局] [12人完整局]
   ↓
3. 选择人数后，显示对应的角色映射配置
   werewolf_1 → 张三 (LLM)
   werewolf_2 → 李四 (Human)
   villager_1 → 王五 (LLM)
   ...
   ↓
4. 配置完成后保存，开始游戏
```

### 平台自动处理的功能

✅ **人数选择UI**：自动检测多人数配置并显示选择器  
✅ **角色列表动态更新**：选择人数后自动切换角色列表  
✅ **后端验证**：自动验证角色映射是否与选择的人数配置匹配  
✅ **状态持久化**：自动保存选择的人数到房间状态  
✅ **恢复游戏**：重新加载时自动恢复选择的人数配置  

### 向后兼容性

传统固定人数游戏（如井字棋）**无需修改**，继续使用数组格式：

```typescript
roleIds: ['player_X', 'player_O']  // ✅ 传统格式继续有效
```

平台会自动识别格式并采用对应的处理逻辑。

---

## 📚 相关文档

- [LLM 玩家记忆系统使用指南](./LLM_MEMORY_GUIDE.md) - LLM 记忆功能详解、适用场景、使用示例
- [README](./README.md) - 平台完整介绍与快速开始
- [自动玩家系统架构](./AUTO_PLAYER_SYSTEM.md) - 自动玩家系统设计、接口定义、扩展指南

