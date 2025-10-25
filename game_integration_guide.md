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
8. [开发者实践指南](#8-开发者实践指南)
9. [附录：完整示例](#9-附录完整示例)

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
| **平台控制层** | 房间管理、权限控制、播放控制、角色映射 | "只有主人能点播放按钮" |
| **游戏逻辑层** | 规则定义、状态推演、合法性验证、视角过滤 | "玩家X在(1,1)落子是否合法?" |
| **游戏UI层** | 视角渲染、用户交互、视觉呈现 | "显示3x3棋盘,可点击的格子高亮" |

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
   * 从视角中提取游戏状态文字(显示在控制栏)
   * 例如: "第3回合 - 轮到玩家X" 或 "游戏结束 - 玩家O获胜"
   */
  getStatusText?: (perspective: RolePerspective) => string;
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

### 4.3 游戏注册

```typescript
// backend/src/games/registry.ts

import { GameLogic } from './types';
import { TicTacToeLogic } from './tic-tac-toe';
import { PokerLogic } from './poker';

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

### 5.3 游戏UI注册与加载

```typescript
// frontend/src/lib/game-ui-loader.ts

import { GameUIPlugin } from './game-ui-types';
import { lazy } from 'react';

/**
 * 游戏UI模块映射
 */
const gameUIModules: Record<string, () => Promise<{ default: GameUIPlugin }>> = {
  'tic-tac-toe': () => import('../games/tic-tac-toe/ui'),
  'poker': () => import('../games/poker/ui'),
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
   */
  private buildPrompt(
    perspective: RolePerspective,
    systemPrompt: string
  ): string {
    return `
你是一个游戏玩家。以下是当前游戏状态:

【游戏规则】
${perspective.global_rules}

【你的角色】
身份: ${perspective.your_role.identity}
目标: ${perspective.your_role.goal}

【历史记录】
${JSON.stringify(perspective.whole_history, null, 2)}

【当前状态】
${JSON.stringify(perspective.current_state, null, 2)}

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
   → 验证房间状态为"open"
   → 添加到玩家列表
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
  │                 paused
  │                    │
  │                    │ (主人点击"播放")
  │                    ▼
  │                 playing
  │                    │
  │                    │ (游戏结束)
  │                    ▼
  └──────────────── finished (主人点击"退出")

【状态说明】
- open: 开放阶段,可添加玩家,选择游戏
- playing: 推演中,自动处理回合
- paused: 暂停,可编辑角色映射
- finished: 游戏结束,只读模式

【权限控制】
- 只有主人可以切换状态
- 暂停时可编辑角色映射
- playing时自动处理LLM玩家回合
```

---

## 8. 开发者实践指南

### 8.1 快速接入清单

#### 步骤1: 实现游戏逻辑

```bash
# 创建游戏目录
mkdir -p backend/src/games/my-game

# 创建逻辑文件
touch backend/src/games/my-game/index.ts
```

```typescript
// backend/src/games/my-game/index.ts

import { GameLogic, GameMetadata, InitContext, ... } from '../types';

export class MyGameLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'my-game',
      name: '我的游戏',
      description: '游戏规则说明...',
      minPlayers: 2,
      maxPlayers: 4,
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
      action_space_definition: this.getLegalActions(state, roleId)
    };
  }
}
```

#### 步骤2: 注册游戏逻辑

```typescript
// backend/src/games/registry.ts

import { MyGameLogic } from './my-game';

export const gameRegistry = {
  // ... 其他游戏
  'my-game': new MyGameLogic(),
};
```

#### 步骤3: 实现游戏UI

```bash
# 创建前端游戏目录
mkdir -p frontend/src/games/my-game

touch frontend/src/games/my-game/ui.tsx
touch frontend/src/games/my-game/ui.module.css
```

```tsx
// frontend/src/games/my-game/ui.tsx

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
      <div className={styles.gameBoard}>
        {/* 渲染游戏状态 */}
        <pre>{JSON.stringify(perspective.current_state, null, 2)}</pre>
      </div>
      
      <div className={styles.actionButtons}>
        {perspective.action_space_definition.type === 'explicit_list' &&
          perspective.action_space_definition.actions.map(action => (
            <button
              key={action.action_id}
              onClick={() => handleAction(action.action_id)}
              disabled={!isMyTurn || readonly}
              className={styles.actionButton}
            >
              {action.description}
            </button>
          ))
        }
      </div>
      
      {!isMyTurn && (
        <div className={styles.waitingMessage}>
          等待其他玩家行动...
        </div>
      )}
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
  'my-game': () => import('../games/my-game/ui'),
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

### 8.2 调试技巧

#### 8.2.1 查看权威状态(仅开发环境)

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

#### 8.2.2 模拟LLM响应

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

#### 8.2.3 前端日志

```tsx
// frontend/src/pages/room/index.tsx

useEffect(() => {
  if (import.meta.env.DEV) {
    console.log('[Perspective Updated]', perspective);
  }
}, [perspective]);
```

### 8.3 性能优化建议

#### 8.3.1 视角缓存策略

```typescript
// 缓存键设计: room:{roomId}:perspective:{roleId}:v{version}
// 优点: 版本变化自动失效,无需手动清除
```

#### 8.3.2 历史记录分页

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

#### 8.3.3 大状态压缩

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

### 8.4 常见陷阱

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

## 9. 附录:完整示例

### 9.1 组合模式示例

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

### 9.2 井字棋完整实现

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
      action_space_definition: this.getLegalActions(state, roleId)
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
      
      {winner && (
        <div className={styles.winnerMessage}>
          🎉 {winner} 获胜!
        </div>
      )}
      
      {!isMyTurn && !winner && (
        <div className={styles.waitingMessage}>
          等待对手行动...
        </div>
      )}
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

.winnerMessage {
  margin-top: 2rem;
  font-size: 32px;
  font-weight: bold;
  color: white;
  animation: bounce 1s infinite;
}

.waitingMessage {
  margin-top: 2rem;
  font-size: 18px;
  color: white;
  opacity: 0.8;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
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

### 核心设计亮点

**统一的行动规范（ActionSpec）**
- 通过 `params_schema` 的有无区分固定选项和参数化模板
- 固定选项：`params_schema: null`（如"停一手"、"弃牌"）
- 参数化模板：`params_schema: {...}`（如"落子(row,col)"、"加注(amount)"）
- 支持任意组合，适配从井字棋到围棋的各类游戏

**游戏开发者只需关注两件事:**
1. **实现 `GameLogic` 接口** (后端纯逻辑)
2. **实现 `GameUIPlugin` 接口** (前端纯渲染)

**平台处理剩下的一切:**
- 房间管理、状态同步、LLM调度、权限控制、事件广播
- 行动验证、版本控制、分布式锁、幂等性保证
- 视角生成与缓存、SSE实时推送

