# 星枢沙盒游戏开发指南

**版本**: 2.0  
**适用架构**: 新版 Serverless 架构 (Cloudflare Workers + Vercel)

---

## 目录

1. [设计原则](#1-设计原则)
2. [新版架构总览](#2-新版架构总览)
3. [开发流程概览](#3-开发流程概览)
4. [核心：游戏逻辑层 (Logic)](#4-核心游戏逻辑层-logic)
5. [表现：游戏 UI 层 (UI)](#5-表现游戏-ui-层-ui)
6. [服务：Worker API 层 (Worker)](#6-服务worker-api-层-worker)
7. [进阶系统：观战者、LLM与动态配置](#7-进阶系统观战者llm与动态配置)
8. [部署与测试](#8-部署与测试)

---

## 1. 设计原则

**核心理念：游戏 = 无状态纯逻辑 + 声明式沙箱 UI**

在星枢沙盒中，平台彻底接管了所有的运行时服务（WebSocket、持久化状态存储、鉴权、LLM 自动调度、回合控制等）。游戏开发者只需专注于：
1. **定义规则**：实现 `GameLogic` 接口的推演逻辑。
2. **渲染视角**：编写基于 React 的沙箱 UI 组件，展示游戏画面并响应用户操作。

### 关键设计约定
- **绝对隔离**：游戏 UI 运行在完全隔离的 Iframe 中，通过 `postMessage` 与平台引擎通信，保障安全与独立性。
- **纯函数状态机**：游戏逻辑必须是无状态的纯函数，绝不持有长效状态变量。权威状态仅由平台的 Durable Objects 维护。
- **统一状态栏**：游戏逻辑生成提示消息 (`message`)，平台前端统一渲染顶部状态控制栏，保证所有游戏交互体验的一致性。

---

## 2. 新版架构总览

每个接入星枢沙盒的游戏都是一个 **独立的微服务**，部署在 Cloudflare Workers 上，游戏项目采用典型的三层结构：

```
games/my-game/
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
1. **引擎调度**：平台核心引擎 (`nexus-engine`) 负责维护权威状态，当需要行动或状态更新时，通过 HTTP 请求调用该游戏的独立 Worker API。
2. **视角分发**：引擎获取游戏逻辑过滤后的 `RolePerspective`（角色视角），通过 WebSocket 下发给客户端浏览器。
3. **UI 渲染**：客户端平台将 `RolePerspective` 传递给 Iframe 内部的游戏 UI 组件。
4. **行动提交**：玩家在 UI 中点击操作，触发 `onAction`，由平台负责校验并提交回引擎进行下一轮推演。

---

## 3. 开发流程概览

要接入一款新游戏，你需要完成以下步骤：

1. **环境准备**：在 `games/` 目录下创建你的游戏文件夹。
2. **编写 Logic**：实现 `@nexus/game-sdk` 提供的 `GameLogic` 接口。
3. **编写 UI**：创建一个接收 `GameUIProps` 的 React 组件。
4. **包装 Worker**：使用 Hono 暴露标准的 API 路由（元数据、初始化、行动验证、推演等）。
5. **本地联调与部署**：使用 Makefile 一键部署到 Cloudflare。

---

## 4. 核心：游戏逻辑层 (Logic)

游戏逻辑层负责规则推演、验证合法性及视角过滤，**必须是纯函数**。依赖 `@nexus/game-sdk`。

### 4.1 定义游戏状态与接口

```typescript
import {
  GameLogic, GameMetadata, GameState, InitContext, ActionSpec,
  Action, ActionResult, HistoryEvent, RolePerspective,
  isSpectator
} from '@nexus/game-sdk';

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
    // 若不是当前角色，或者游戏结束，返回空
    if ((state as MyGameState).currentRole !== roleId || (state as MyGameState).winner) {
      return { actions: [] };
    }

    return {
      actions: [
        // 固定行动示例
        { action_id: 'pass', description: '跳过', params_schema: null },
        // 参数化行动示例
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

    // 处理行动逻辑...
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
      role_id: your_role.identity, // 'player_1' or 'player_2' 
      params: { row, col }
    });
  };

  return (
    <div className={styles.container}>
      {/* 渲染你的游戏画面 */}
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
  /* 自动占满容器的最大正方形 */
  width: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  height: min(calc(100cqw - 2rem), calc(100cqh - 2rem));
  background-color: #f0f0f0;
}
```

### 5.3 Sandbox 交互约束（重要）

游戏 UI 运行在受限 Iframe（默认仅允许脚本执行）的沙盒环境中。为确保安全隔离，开发时请遵循以下约束：

- **不要使用 `<form>` / 原生表单提交流程**（包括 `onSubmit`、`type="submit"`、`form.submit()`）。
- **推荐使用普通容器 + 按钮点击**：通过 `onClick` 收集参数后直接调用 `onAction(...)`。
- 如需支持回车提交，请在输入控件上使用 `onKeyDown` 监听 Enter，并调用同一套 `onAction(...)` 逻辑。

> 说明：在沙盒中使用原生表单提交会触发浏览器拦截（例如 `Blocked form submission ... sandboxed and the 'allow-forms' permission is not set`）。平台默认不建议为游戏 UI 打开 `allow-forms` 权限。

---

## 6. 服务：Worker API 层 (Worker)

每个游戏作为一个独立的 Cloudflare Worker，通过标准的 HTTP 接口对外提供逻辑服务，并托管静态 UI 资源。

### 6.1 Worker 包装 (Hono)

在 `games/my-game/worker/src/index.ts` 中，使用 `Hono` 对上述 `logic` 进行包裹，平台引擎会通过这些端点来驱动游戏。

> ⚠️ **强烈建议**：对于所有新接入的游戏，可以直接拷贝复用 `games/gomoku/worker/src/index.ts` 作为模板，并只需修改 import 的 `logic` 指向即可，几乎不需要修改业务代码。
>
> 引擎在连接新游戏时，**必须**通过 `/__nexus_worker_verify` 接口获取到字符串 `NEXUS_GAME_WORKER_VERIFIED_V1` 进行安全握手校验，这在复用的 `index.ts` 中已经自动处理。

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import logic from '../../logic/index';

const app = new Hono<{ Bindings: { ASSETS: Fetcher; UI_BASE_URL?: string } }>();

// 必须启用 CORS 确保引擎可调用
app.use('/*', cors());

// 返回校验签名（引擎安全握手，必须为 NEXUS_GAME_WORKER_VERIFIED_V1）
app.get('/__nexus_worker_verify', (c) => c.text('NEXUS_GAME_WORKER_VERIFIED_V1'));

// 静态资源托管路由（配置正确的 Headers）
app.get('/game-ui.html', async (c) => {
    const response = await c.env.ASSETS.fetch(new Request(new URL(c.req.url), c.req.raw));
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Content-Type', 'text/html');
    return newResponse;
});
// (对 /_ui.js, /style.css 同理处理... 详见 gomoku/worker/src/index.ts)

// 游戏逻辑标准端点
app.get('/metadata', (c) => {
    const metadata = logic.getMetadata();
    const uiBaseUrl = c.env.UI_BASE_URL || new URL(c.req.url).origin;
    return c.json({
        ...metadata,
        ui: { mode: 'url', url: `${uiBaseUrl}/game-ui.html` },
    });
});

app.post('/init', async (c) => c.json(logic.initState(await c.req.json())));
app.post('/legal-actions', async (c) => {
    const { state, roleId } = await c.req.json();
    return c.json(logic.getLegalActions(state, roleId));
});
app.post('/action', async (c) => {
    const { state, action } = await c.req.json();
    return c.json(logic.applyAction(state, action));
});
app.post('/is-terminal', async (c) => {
    const { state } = await c.req.json();
    const isTerminal = logic.isTerminal(state);
    return c.json({ isTerminal, winners: isTerminal ? logic.getWinners(state) : null });
});
app.post('/perspective', async (c) => {
    const body = await c.req.json();
    const perspective = logic.toRolePerspective(body.state, body.roleId, body.wholeHistory, body.diffHistory);
    return c.json({ ...perspective, statePrompt: logic.generateStatePrompt(perspective) });
});

export default app;
```

---

## 7. 进阶系统：观战者、LLM与动态配置

### 7.1 观战者系统 (Spectator)

平台会向不在游戏内参与的玩家下发保留的 `roleId`：`nexus_reserved_specator`。
- **必须**使用 `@nexus/game-sdk` 提供的 `isSpectator(roleId)` 辅助函数检查是否是观战者。
- 观战者的 `getLegalActions` 必须返回空数组 `[]`。
- 观战者的提示消息应该前缀 `👀 观战模式 - ...` 以示区别。
- **不完美信息游戏**：开发者需要决定观战者是否可以拥有"上帝视角"（全明牌），或"公平视角"（只能看公共牌）。

### 7.2 LLM AI 玩家支持

为了使 LLM (例如 GPT-4, Claude) 可以像人类一样流畅游玩，请注意：
1. **良好的提示词**：在 `generateStatePrompt` 中，尽量将复杂的矩阵或数组状态转化成**人类易读的文本**（如画出 ASCII 棋盘，描述最后一步落点）。
2. **多模态扩展**：若是推演步骤繁杂或注重推理策略的游戏，在 `getMetadata` 中设置 `enable_llm_memory: true`，引擎将自动为 LLM 提供记忆摘要功能。
3. **参数化 Action**：合理使用 JSON Schema 定义行动参数（限制 `minimum/maximum`），以避免 LLM 产生非法的坐标请求。

### 7.3 多人数动态配置

部分游戏（如狼人杀）在不同人数下角色配置不同。你可以在 `metadata` 的 `roleIds` 中提供对象映射结构：

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
平台会在创建房间时自动识别并展示人数选择下拉框。

---

## 8. 部署与测试

使用项目的 monorepo 根目录下提供的指令，可以极速部署和测试新游戏。

1. **配置 Wrangler**：在 `games/my-game/worker/wrangler.toml` 定义你的 Worker 名称。
2. **构建与运行开发服务**：
   ```bash
   cd games/my-game/worker
   pnpm run dev
   ```
   游戏 Worker 将在本地跑起，你可以在前台系统新建房间，并在 Admin 控制面板手动将 `gameWorkerUrl` 指向本地的 Worker 地址（如 `http://localhost:8787`）进行全链路联调。
3. **正式发布**：
   ```bash
   make deploy-game G=my-game
   ```
   随后在主后端的 Game 注册列表中添加配置即可对外开放。

---
*Happy Coding, 让 AI 与人类一起享受游戏的乐趣！*