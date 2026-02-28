# 星枢沙盒游戏开发指南

**版本**: 3.0  
**适用架构**: 新版 Serverless 架构 (Cloudflare Workers + Vercel) + `@nexusgame/cli` 开发者工具链

---

## 目录

1. [设计原则](#1-设计原则)
2. [新版架构总览](#2-新版架构总览)
3. [开发流程概览](#3-开发流程概览)
4. [核心：游戏逻辑层 (Logic)](#4-核心游戏逻辑层-logic)
5. [表现：游戏 UI 层 (UI)](#5-表现游戏-ui-层-ui)
6. [服务：Worker API 层 (Worker)](#6-服务worker-api-层-worker)
7. [本地联调与 CLI 交互](#7-本地联调与-cli-交互)
8. [进阶系统：观战者、LLM与动态配置](#8-进阶系统观战者llm与动态配置)
9. [部署与发布](#9-部署与发布)

---

## 1. 设计原则

**核心理念：游戏 = 无状态纯逻辑 + 声明式沙箱 UI**

在星枢沙盒中，平台彻底接管了所有的运行时服务（WebSocket、持久化状态存储、鉴权、LLM 自动调度、回合控制等）。平台使用全新发布的 `@nexusgame/cli` 脚手架生成标准的模版结构并使用 `@nexusgame/game-sdk` 定义类型和辅助函数，游戏开发者只需专注于：
1. **定义规则**：实现 `GameLogic` 接口的推演逻辑。
2. **渲染视角**：编写基于 React 的沙箱 UI 组件，展示游戏画面并响应用户操作。

### 关键设计约定
- **绝对隔离**：游戏 UI 运行在完全隔离的 Iframe 中，通过 `postMessage` 与平台引擎通信，保障安全与独立性。
- **纯函数状态机**：游戏逻辑必须是无状态的纯函数，绝不持有长效状态变量。权威状态仅由平台的 Durable Objects 维护。
- **统一状态栏**：游戏逻辑生成提示消息 (`message`)，平台前端统一渲染顶部状态控制栏，保证所有游戏交互体验的一致性。

---

## 2. 新版架构总览

每个接入星枢沙盒的游戏都是一个 **独立的微服务**，部署在 Cloudflare Workers 上，通过 `@nexusgame/cli` 脚手架生成的游戏项目采用典型的三层结构：

```
<your-game-id>/
├── logic/                  # 🧠 纯函数游戏逻辑（实现 GameLogic 接口）
│   └── index.ts            
├── ui/                     # 🎨 独立构建的 React 游戏 UI
│   ├── ui.tsx              # 游戏主界面组件
│   └── ui.module.css       # 独立样式
└── worker/                 # ⚙️ 托管服务（Hono + CF Worker）
    ├── src/index.ts        # 将 Logic 暴露为 HTTP API
    └── public/             # 托管 UI 构建产物（HTML/JS/CSS）
```

### 数据交互流
1. **引擎调度**：平台核心引擎 (`nexus-engine`) 或本地调试节点负责维护权威状态，当需要行动或状态更新时，通过 HTTP 请求调用该游戏的独立 Worker API。
2. **视角分发**：引擎获取游戏逻辑过滤后的 `RolePerspective`（角色视角），通过 WebSocket 下发给客户端浏览器。
3. **UI 渲染**：客户端平台将 `RolePerspective` 传递给 Iframe 内部的游戏 UI 组件。
4. **行动提交**：玩家在 UI 中点击操作，触发 `onAction`，由引擎负责校验并提交进行下一轮推演。

---

## 3. 开发流程概览

要接入一款新游戏，借助 `@nexusgame/cli`，你可以极速完成环境搭建与调试：

### 3.1 创建新游戏脚手架
我们推荐使用 `npx` 直接运行 CLI，这样可以确保你始终使用的是最新版本：
```bash
npx @nexusgame/cli create-game
```
按照提示输入游戏 ID、展示名称等信息，CLI 将会自动为你生成完整的游戏开发脚手架。

### 3.2 初始开发准备
```bash
cd <your-game-id>
pnpm install
```

### 3.3 核心步骤
1. **编写 Logic**：实现 `@nexusgame/game-sdk` 提供的 `GameLogic` 接口。
2. **编写 UI**：创建一个接收 `GameUIProps` 的 React 组件。
3. **本地开发调试**：启动并连接本地轻量级引擎模拟运行。
4. **一键部署发布**：通过 `pnpm run deploy` 部署至边缘节点。

---

## 4. 核心：游戏逻辑层 (Logic)

游戏逻辑层负责规则推演、验证合法性及视角过滤，**必须是纯函数**。依赖 `@nexusgame/game-sdk`。

### 4.1 定义游戏状态与接口

```typescript
import {
  GameLogic, GameMetadata, GameState, InitContext, ActionSpec,
  Action, ActionResult, HistoryEvent, RolePerspective,
  isSpectator
} from '@nexusgame/game-sdk';

// 1. 定义你的游戏专属状态（会被平台持久化存储）
interface MyGameState extends GameState {
  board: number[][];
  currentRole: string;
  turn: number;
  winner: string | null;
}
```

### 4.2 实现 GameLogic 接口

```typescript
export class MyGameLogic implements GameLogic {
  
  // 1. 元数据配置
  getMetadata(): GameMetadata {
    return {
      id: 'my-game',
      name: '我的游戏',
      description: '这是游戏规则说明...',
      minPlayers: 2,
      maxPlayers: 2,
      roleIds: ['player_1', 'player_2'], // 定义游戏所需的角色列表
      enable_llm_memory: false,          // 完全信息游戏设为 false，需要长期推理的（如狼人杀）设为 true
      getStatusText: (perspective) => {
        // 用于控制栏顶部显示当前全局状态的简短文字
        if (perspective.current_state.winner) return '游戏结束';
        return `第 ${perspective.current_state.turn} 回合`;
      }
    };
  }

  // 2. 初始化状态
  initState(ctx: InitContext): GameState {
    return {
      board: Array(10).fill(Array(10).fill(0)),
      currentRole: ctx.players[0],
      turn: 1,
      winner: null
    };
  }

  // 3. 确定当前行动角色
  getCurrentRole(state: GameState): string {
    return (state as MyGameState).currentRole;
  }

  // 4. 返回合法行动空间 (ActionSpec)
  getLegalActions(state: GameState, roleId: string): ActionSpec {
    if ((state as MyGameState).currentRole !== roleId || (state as MyGameState).winner) {
      return { actions: [] };
    }

    return {
      actions: [
        { action_id: 'pass', description: '跳过', params_schema: null },
        { 
          action_id: 'place', 
          description: '落子', 
          params_schema: {
            row: { type: 'integer', minimum: 0, maximum: 9 },
            col: { type: 'integer', minimum: 0, maximum: 9 }
          }
        }
      ]
    };
  }

  // 5. 应用行动，返回新状态（严禁修改原状态）
  applyAction(state: GameState, action: Action): ActionResult {
    const s = JSON.parse(JSON.stringify(state)) as MyGameState; // 深拷贝
    
    if (s.currentRole !== action.role_id) {
      return { success: false, error: '不是你的回合' };
    }

    if (action.action_id === 'place') {
      s.board[action.params.row][action.params.col] = 1;
      s.turn += 1;
      s.currentRole = s.currentRole === 'player_1' ? 'player_2' : 'player_1';
    }

    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    return (state as MyGameState).winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const s = state as MyGameState;
    return s.winner ? [s.winner] : null;
  }

  // 6. 视角过滤核心（为客户端与 LLM 提供数据）
  toRolePerspective(state: GameState, roleId: string, wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]): RolePerspective {
    const s = state as MyGameState;
    const spectator = isSpectator(roleId);
    
    // 生成平台顶部统一显示的 Message
    let message = '';
    if (spectator) {
      message = s.winner ? `👀 观战模式 - 游戏结束` : `👀 观战模式 - 轮到 ${s.currentRole}`;
    } else {
      if (s.winner) message = s.winner === roleId ? '🎉 胜利！' : '😔 失败';
      else if (s.currentRole === roleId) message = '✨ 轮到你了，请选择行动';
      else message = '⏳ 等待对手行动...';
    }

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: s, // 若是不完美信息游戏，需在此处抹去对手手牌等敏感数据！
      your_role: {
        identity: spectator ? 'Spectator' : roleId,
        goal: '你的游戏目标说明',
        is_current: spectator ? false : s.currentRole === roleId
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message // 统一消息渲染
    };
  }

  // 7. 生成发给 LLM 的自然语言 Prompt
  generateStatePrompt(perspective: RolePerspective): string {
    const s = perspective.current_state as MyGameState;
    return `
# 游戏状态
当前回合：${s.turn}
当前轮到：${s.currentRole}
你的身份：${perspective.your_role.identity}
    `;
  }
}

export default new MyGameLogic();
```

---

## 5. 表现：游戏 UI 层 (UI)

UI 层运行在隔离的 Iframe 环境中，**完全无需关注网络通信和全局状态持久化**。它只会收到 `RolePerspective`，并暴露出用户的交互意图。

### 5.1 编写 React 组件

```tsx
import React from 'react';
import styles from './ui.module.css';

// 引入类型，不要导入平台引擎相关的重依赖
interface Action {
  action_id: string;
  role_id: string;
  params?: any;
}

interface GameUIProps {
  perspective: any; // RolePerspective 类型
  onAction: (action: Action) => void;
  isMyTurn: boolean;
  readonly: boolean;
}

const MyGameUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const { current_state, your_role } = perspective;
  
  const handlePlace = (row: number, col: number) => {
    if (!isMyTurn || readonly) return;
    
    onAction({
      action_id: 'place',
      role_id: your_role.identity,
      params: { row, col }
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.board}>
        {current_state.board.map((rowArr: number[], row: number) => 
           rowArr.map((cell: number, col: number) => (
             <div key={`${row}-${col}`} onClick={() => handlePlace(row, col)}>
                {cell === 0 ? '空' : '子'}
             </div>
           ))
        )}
      </div>
    </div>
  );
};

export default MyGameUI;
```

### 5.2 布局最佳实践 ⭐

在沙盒中，游戏通常需要自适应各种比例屏幕（横屏网页版/竖屏手机）。
强烈推荐使用 **CSS Container Queries** 或自适应宽高的布局。

```css
/* ui.module.css */
.container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  container-type: size; /* 关键：启用容器查询，自适应平台 Iframe 尺寸 */
}

.board {
  width: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  height: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  background-color: #f0f0f0;
}
```

### 5.3 Sandbox 交互约束（重要）

游戏 UI 运行在受限 Iframe（默认仅允许脚本执行）的沙盒环境中。为确保安全隔离，开发时请遵循以下约束：

- **不要使用 `<form>` / 原生表单提交流程**。
- **推荐使用普通容器 + 按钮点击**：收集参数后直接调用 `onAction(...)`。
- 如需支持回车提交，请在输入控件上使用 `onKeyDown` 监听 Enter。

---

## 6. 服务：Worker API 层 (Worker)

`@nexusgame/cli` 脚手架在 `worker/src/index.ts` 中已经自动为你处理了 API 包裹与静态资源托管。你**绝大部分情况不需要手动修改**该文件，即使修改，只需更改暴露或处理的新路由即可。

内置自动包装通过 `Hono` 暴露出以下标准逻辑端点：
- `/__nexus_worker_verify`: 安全握手
- `/metadata`: 获取游戏基本配置和 UI 入口地址
- `/init`, `/legal-actions`, `/action`, `/is-terminal`, `/perspective`: 标准状态机路由交互
- `/game-ui.html` 及相关静态资源解析

---

## 7. 本地联调与 CLI 交互

新版工具链允许你在本地直接启动轻量级引擎 (`npx @nexusgame/cli start`) 并无缝进行沙盒行为的完全模拟。

**本地全链路调试工作流**：

1. **在一个终端启动轻量级引擎**:
   ```bash
   npx @nexusgame/cli start
   ```

2. **在另一个终端运行你的开发 Worker 并 Setup**:
   ```bash
   # 首先启动你的游戏 Worker (通常是运行脚手架中的 pnpm run dev)
   # 在另外的会话运行 setup 连接引擎并创建独立房间
   npx @nexusgame/cli setup --worker-url http://localhost:8788
   ```

3. **通过 CLI 即时查看与提交行动**:
   ```bash
   # 1. 查看房间全局综合状态
   npx @nexusgame/cli state
   
   # 2. 拉取特定角色的视角，并获取一个用于调试页面 UI 的独立 Local URL！
   npx @nexusgame/cli perspective player_1
   
   # 3. 模拟对应角色执行落子/行动
   npx @nexusgame/cli action player_1 '{"action_id":"place","params":{"row":0,"col":0}}'
   ```
这种方式免去了配置庞大后端、主网数据库等繁复流程。你能够彻底验证你的 Logic 与 UI 行为的一致性后再上线。

---

## 8. 进阶系统：观战者、LLM与动态配置

### 8.1 观战者系统 (Spectator)

平台会向不在游戏内参与的玩家下发保留的 `roleId`：`nexus_reserved_specator`。
- **必须**使用 `@nexusgame/game-sdk` 提供的 `isSpectator(roleId)` 辅助函数检查是否是观战者。
- 观战者的 `getLegalActions` 必须返回空数组 `[]`。
- 观战者的提示消息应该含有明显的前缀（如：`👀 观战模式 - ...`）。
- **不完美信息游戏**：开发者需要决定观战者是否可以拥有"上帝视角"（全明牌），或"公平视角"（只能看公共牌）。

### 8.2 LLM AI 玩家支持

为了使 LLM (例如 GPT-4, Claude) 可以像人类一样流畅游玩，请注意：
1. **良好的提示词**：在 `generateStatePrompt` 中精确输出纯文字的状态解释。
2. **多模态扩展**：若是推演步骤繁杂或注重推理策略的游戏，在 `getMetadata` 中设置 `enable_llm_memory: true`，引擎将自动为 LLM 提供记忆摘要功能。

### 8.3 多人数动态配置

部分游戏在不同人数下角色配置不同。你可以在 `metadata` 的 `roleIds` 中提供对象映射结构：
```typescript
getMetadata(): GameMetadata {
  return {
    id: 'werewolf',
    name: '狼人杀',
    minPlayers: 6,
    maxPlayers: 12,
    roleIds: {
      6: ['werewolf_1', 'werewolf_2', 'villager_1', 'villager_2', 'villager_3', 'seer'],
      8: ['werewolf_1', 'werewolf_2', 'werewolf_3', 'villager_1', 'villager_2', 'villager_3', 'villager_4', 'seer'],
    }
  };
}
```

---

## 9. 部署与发布

在彻底完成本地联调并确认业务代码通过测试后，通过脚手架预置的命令发布：

```bash
pnpm run deploy
```

> [!TIP]
> 部署过程会根据 `worker/wrangler.toml` 中的配置，利用 Wrangler 工具链，直接将你的游戏逻辑发布为正式的 Cloudflare Workers 边缘函数！

发布完成后，主网或中心化调度服务器即可注册并安全引入你的新游戏。