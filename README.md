# 星枢沙盒 (Nexus Playground)

**可扩展的 LLM 原生游戏平台 · 让 AI 与人类共同游戏**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel)](https://vercel.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)

🌐 **在线体验**：<https://nexus.mzhh.xyz>　|　📦 **源码**：<https://github.com/mzhh1/nexus-playground>

---

## 📖 项目简介

星枢沙盒是一个高度可扩展的在线回合制游戏平台，将大型语言模型（LLM）作为原生玩家深度集成到游戏逻辑中。平台采用 **"运行时 + 纯逻辑插件"** 的架构，让开发者只需编写无状态的游戏规则函数，即可快速构建可供人类与 AI 共同参与的在线游戏。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🎮 **游戏逻辑插件化** | 游戏开发者只需提供纯函数式的游戏逻辑（`GameLogic` 接口），平台接管所有运行时服务 |
| 🤖 **LLM 原生适配** | AI 玩家通过标准化的"角色视角"（`RolePerspective`）无缝理解并参与任何游戏 |
| 🔄 **完全可复现** | 支持从任意游戏状态启动，允许玩家在任意时刻无缝接管或切换角色 |
| 🔐 **企业级鉴权** | 基于 AutoLab SDK 族的 OAuth 2.0 + PKCE 认证与多服务鉴权链 |
| 🎯 **信息完整性** | 原生支持不完美信息游戏，严格隔离权威状态与角色视角 |
| ☁️ **Serverless 架构** | 全面部署于 Cloudflare Workers + Vercel，零服务器运维 |

---

## 🏗️ 架构概览

项目采用 **全 Serverless** 架构，所有服务部署于 Cloudflare Workers 与 Vercel，彻底移除了 Docker、Nginx、Redis 和自托管 PostgreSQL 的依赖。

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│   │  frontend    │    │ llm-monitor  │    │  game UI (iframe)│  │
│   │  (Vercel)    │    │  (Vercel)    │    │  (CF Worker)     │  │
│   └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
└──────────┼───────────────────┼─────────────────────┼────────────┘
           │ REST              │ REST/SSE            │ postMessage
           ▼                   │                     │
┌──────────────────┐           │                     │
│  hono_backend    │◄──────────┘                     │
│  (CF Worker+D1)  │                                 │
│  房间管理/鉴权    │                                 │
│  LLM 代理        │──── webhook ──┐                 │
└────────┬─────────┘               │                 │
         │ Admin API               ▼                 │
         ▼                ┌──────────────────┐       │
┌──────────────────┐      │  game workers    │◄──────┘
│  nexus-engine    │◄────►│  (各游戏独立     │
│  (CF Worker+DO)  │ HTTP │  CF Worker)      │
│  GameDO 游戏状态  │      └──────────────────┘
│  MonitorDO 日志   │
│  WebSocket 通信   │
└──────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 18 + TypeScript + Vite | MPA 架构，托管于 Vercel |
| **LLM 监控** | React + Vite | 独立 SPA，托管于 Vercel |
| **业务后端** | Hono + Cloudflare Workers + D1 | 房间管理、鉴权、LLM webhook 代理 |
| **游戏引擎** | Hono + Cloudflare Workers + Durable Objects | 游戏状态管理、WebSocket 实时通信 |
| **游戏逻辑** | 独立 CF Worker（每游戏一个） | 无状态 HTTP API，托管游戏 UI 资源 |
| **游戏 SDK** | TypeScript 库（workspace 内部包） | `GameLogic` 接口定义与基础工具 |
| **鉴权** | AutoLab OAuth SDK | OAuth 2.0 + PKCE + JWT |
| **包管理** | pnpm workspace + Turborepo | monorepo 管理 |

---

## 🗂️ 项目结构

```
nexus-playground/
├── frontend/                  # 🖥️ 主前端 SPA（Vercel 托管）
│   ├── src/
│   │   ├── pages/             # MPA 页面入口
│   │   │   ├── index/         #   首页：登录引导
│   │   │   ├── my-nexus/      #   我的星枢：定位/创建 roomId
│   │   │   ├── room/          #   房间页：游戏、管理、观战
│   │   │   └── callback/      #   OAuth 回调
│   │   ├── components/        # 通用组件
│   │   ├── hooks/             # React Hooks
│   │   │   ├── useNexusEngine.ts  #   WebSocket 连接管理
│   │   │   ├── useAction.ts       #   行动提交
│   │   │   ├── useRoom.ts         #   房间数据
│   │   │   └── useGamesMetadata.ts
│   │   ├── lib/               # 工具库
│   │   └── styles/            # 样式
│   ├── vercel.json            # Vercel 路由重写配置
│   └── vite.config.ts         # Vite 多页构建配置
│
├── llm-monitor/               # 📊 LLM 交互监控面板（Vercel 托管）
│   ├── src/                   # React SPA
│   └── vercel.json
│
├── hono_backend/              # ⚙️ 业务后端（CF Worker）
│   ├── src/
│   │   ├── routes/v1/         # API 路由
│   │   │   ├── my-nexus.ts    #   星枢管理（创建/查询）
│   │   │   ├── rooms.ts       #   房间访问/加入
│   │   │   ├── games.ts       #   游戏列表
│   │   │   ├── llm-webhook.ts #   LLM 调用代理
│   │   │   └── health.ts      #   健康检查
│   │   ├── middleware/        # 鉴权中间件
│   │   ├── db/                # D1 数据库操作
│   │   └── runtime/           # 运行时工具
│   └── wrangler.toml          # CF Worker 配置（含 D1 绑定）
│
├── nexus-engine/              # 🎮 游戏运行引擎（CF Worker + Durable Objects）
│   ├── src/
│   │   ├── index.ts           # Hono 路由入口
│   │   ├── game-do.ts         # GameDO：游戏状态 + WebSocket 管理
│   │   ├── monitor-do.ts      # MonitorDO：LLM 交互日志 + SSE
│   │   ├── managers/          # 内部管理器
│   │   │   ├── room.ts        #   房间状态管理
│   │   │   ├── presence.ts    #   在线状态管理
│   │   │   ├── executor.ts    #   游戏执行器（调用 game worker）
│   │   │   ├── llm.ts         #   LLM 调用管理
│   │   │   └── task-prompts.ts
│   │   ├── types.ts           # 引擎类型定义（含 WS 协议）
│   │   └── jwt.ts             # JWT 验证
│   └── wrangler.toml          # CF Worker 配置（含 DO 绑定）
│
├── packages/
│   └── game-sdk/              # 📦 游戏开发 SDK
│       └── src/index.ts       # GameLogic 接口、类型定义、基础工具
│
├── games/                     # 🎲 游戏目录（每个游戏独立部署）
│   └── gomoku/                # 五子棋（已迁移）
│       ├── logic/             #   纯函数游戏逻辑（实现 GameLogic 接口）
│       ├── ui/                #   React 游戏 UI（构建为独立 JS/CSS）
│       └── worker/            #   CF Worker（托管逻辑 API + 静态 UI 资源）
│
├── games-old/                 # 📦 未迁移的旧游戏
│   ├── tic-tac-toe/           #   井字棋
│   ├── xiangqi/               #   象棋
│   └── werewolf/              #   狼人杀
│
├── Makefile                   # 开发与部署命令
├── pnpm-workspace.yaml        # pnpm workspace 配置
└── package.json               # monorepo 根配置（Turborepo）
```

---

## 🎮 核心概念

### 星枢（Nexus / Room）

星枢是与用户一一对应的游戏容器。每个用户登录后自动拥有一个专属星枢。

- **用户访问自己的星枢**：`/my-nexus` → 自动创建或定位 → 重定向到 `/room?id={roomId}`
- **访问他人的星枢**：通过 Room ID 访问 `/room?id={roomId}`（观战、加入游戏）

### 状态与视角分离

```
权威 GameState（仅引擎持有）
        │
        ├── toRolePerspective(state, roleA) ──→ RolePerspective A ──→ 前端 UI
        ├── toRolePerspective(state, roleB) ──→ RolePerspective B ──→ LLM
        └── toRolePerspective(state, spectator) ──→ 观战视角 ──→ 观众
```

- **GameState（权威状态）**：包含所有玩家手牌、隐藏信息，仅在 `GameDO` 的 Durable Object 存储中持有
- **RolePerspective（角色视角）**：为特定角色过滤后的视图，包含该角色可见信息、合法行动空间、历史日志

### 游戏逻辑插件（GameLogic 接口）

游戏开发者提供的**无状态纯函数**集合，定义于 `@nexus/game-sdk`：

```typescript
export interface GameLogic<TState extends GameState = GameState> {
    getMetadata(): GameMetadata;
    initState(ctx: InitContext): TState;
    getCurrentRole(state: TState): string;
    getLegalActions(state: TState, roleId: string): ActionSpec;
    applyAction(state: TState, action: Action): ActionResult<TState>;
    isTerminal(state: TState): boolean;
    getWinners(state: TState): string[] | null;
    toRolePerspective(
        state: TState, roleId: string,
        wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]
    ): RolePerspective;
    generateStatePrompt(perspective: RolePerspective): string;
}
```

游戏逻辑本身**绝不持有任何长效状态**，平台引擎负责状态存储与生命周期管理。

---

## 🔧 各组件详解

### 1. Frontend（主前端）

| 项 | 说明 |
|-----|------|
| 框架 | React 18 + TypeScript + Vite (MPA) |
| 部署 | Vercel |
| 域名 | `nexus.mzhh.xyz` |
| 鉴权 | `@autolabz/oauth-sdk`（OAuth 2.0 + PKCE） |

前端通过 **WebSocket** 连接到 `nexus-engine` 获取实时游戏状态推送（`SYNC_STATE` 消息），并通过 WebSocket 提交玩家行动（`ACT` 消息）。游戏 UI 以 **sandboxed iframe** 的方式加载游戏 Worker 提供的 `game-ui.html`，通过 `postMessage` 通信。

**关键 Hooks**：
- `useNexusEngine`：管理 WebSocket 连接与引擎状态
- `useAction`：封装行动提交逻辑
- `useRoom`：房间数据管理

### 2. LLM Monitor（LLM 监控面板）

| 项 | 说明 |
|-----|------|
| 框架 | React + Vite |
| 部署 | Vercel |
| 数据源 | `nexus-engine` 的 Monitor API（D1 + SSE） |

独立的监控面板 SPA，用于实时查看和分析 LLM 玩家的交互日志，包括 Prompt 内容、响应、Token 使用量等。支持 SSE 实时流推送和历史日志查询。

### 3. Hono Backend（业务后端）

| 项 | 说明 |
|-----|------|
| 框架 | Hono |
| 运行时 | Cloudflare Workers |
| 数据库 | Cloudflare D1（SQLite） |
| 鉴权 | `@autolabz/service-auth-hono` |

核心职责：
- **房间管理**：创建/查询星枢（`my-nexus`），维护用户→房间映射（D1）
- **鉴权网关**：统一的 JWT/OAuth 鉴权中间件
- **LLM 代理**：接收引擎的 webhook 请求，代调 LLM API 并返回结果
- **游戏元数据**：提供可用游戏列表
- **引擎协调**：调用 `nexus-engine` 的 Admin API 创建/初始化游戏房间

### 4. Nexus Engine（游戏运行引擎）

| 项 | 说明 |
|-----|------|
| 框架 | Hono |
| 运行时 | Cloudflare Workers + Durable Objects |
| 数据库 | DO SQLite（内置持久化） + D1（监控日志） |

这是平台的核心运行时，采用 **Heavy Engine** 设计，承担所有游戏执行逻辑：

- **GameDO**（Durable Object）：每个房间绑定一个 DO 实例
  - 管理完整的游戏生命周期（open → playing → paused）
  - 持有权威 GameState（DO 内部 SQLite 存储）
  - 管理 WebSocket 连接与状态广播
  - 通过 HTTP 调用 Game Worker 执行游戏逻辑
  - 通过 webhook 触发 LLM 玩家自动行动
- **MonitorDO**（Durable Object）：全局 LLM 交互日志收集与 SSE 推送
- **WebSocket 协议**：
  - 服务端消息：`SYNC_STATE`、`ERROR`、`KICKED`
  - 客户端消息：`ACT`、`ADMIN_SET_GAME`、`ADMIN_START_GAME`、`LOBBY_SELECT_ROLE` 等

### 5. Game SDK（`@nexus/game-sdk`）

游戏开发的核心 SDK，提供：
- `GameLogic<TState>` 接口定义
- `BaseGameLogic<TState>` 抽象基类（含默认序列化/反序列化）
- 通用类型：`GameState`、`Action`、`ActionSpec`、`RolePerspective`、`Player`、`RoomInfo` 等
- 工具函数：`validateAction`、`cloneState`、`stateSerializer` 等

### 6. 游戏（`games/`）

每个游戏包含三个独立部分，均可独立构建和部署：

```
games/gomoku/
├── logic/index.ts          # 实现 GameLogic 接口（纯逻辑）
├── ui/                     # React UI 组件（构建为 JS/CSS 静态资源）
│   ├── GomokuBoard.tsx
│   └── GomokuBoard.module.css
└── worker/                 # CF Worker（Hono 应用）
    ├── src/index.ts        #   HTTP API 端点 + UI 静态资源托管
    ├── public/             #   构建后的 UI 资源
    └── wrangler.toml       #   CF Worker 配置
```

Game Worker 暴露的 HTTP API：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/metadata` | GET | 返回游戏元数据（含 UI URL） |
| `/init` | POST | 初始化游戏状态 |
| `/legal-actions` | POST | 获取合法行动列表 |
| `/action` | POST | 应用行动 |
| `/is-terminal` | POST | 检查游戏是否结束 |
| `/perspective` | POST | 生成角色视角 |
| `/current-role` | POST | 获取当前行动角色 |
| `/game-ui.html` | GET | 游戏 UI 页面（iframe 加载） |

### 7. 旧游戏（`games-old/`）

尚未迁移到新架构的游戏，包括井字棋（tic-tac-toe）、象棋（xiangqi）、狼人杀（werewolf）。待后续逐步迁移为独立 Worker 部署。

---

## 🔄 核心工作流程

### 1. 用户登录与创建星枢

```
浏览器 → frontend (/) → OAuth 登录 → (/my-nexus)
    → hono_backend: POST /api/v1/my-nexus (D1 查询/创建)
    → 返回 roomId → 重定向至 /room?id={roomId}
```

### 2. 选择游戏与配置房间

```
frontend (/room) ← WebSocket → nexus-engine (GameDO)
    │
    ├── ADMIN_SET_GAME { gameWorkerUrl }
    │       → GameDO 调用 game-worker /metadata 获取元数据
    │       → 更新 gameConfig
    │
    ├── LOBBY_SELECT_ROLE { roleId }
    │       → 建立角色映射
    │
    └── ADMIN_START_GAME
            → GameDO 调用 game-worker /init 初始化状态
            → 广播 SYNC_STATE 给所有连接
```

### 3. 人类玩家提交行动

```
frontend  ── ACT { action_id, params? } ──→  GameDO
    GameDO:
    1. 验证当前行动角色
    2. 调用 game-worker /legal-actions 验证合法性
    3. 调用 game-worker /action 应用行动
    4. 更新状态 + 历史
    5. 调用 game-worker /perspective 为各角色生成视角
    6. 广播 SYNC_STATE
    7. 检查游戏是否结束
    8. 若下一角色为 LLM → 触发 LLM 自动执行
```

### 4. LLM 玩家自动执行

```
GameDO 检测到 LLM 角色回合
    → 调用 game-worker /perspective 生成 LLM 视角
    → 构造 LlmWebhookRequest（含 statePrompt）
    → POST 至 hono_backend /api/v1/webhook/llm
    → hono_backend 调用 LLM API（OpenAI 兼容）
    → 返回 { content: "action_id: ..., params: ..." }
    → GameDO 解析 → 提交行动（复用相同流程）
    → 失败则重试（最多 3 次，指数退避）
```

---

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 18
- **pnpm** ≥ 8
- **Cloudflare 账户**（用于 Workers 和 D1）
- **Vercel 账户**（用于前端部署）

### 1. 克隆与安装

```bash
git clone https://github.com/mzhh1/nexus-playground.git
cd nexus-playground
pnpm install
```

### 2. 配置环境变量

```bash
# 后端（CF Worker 使用 .dev.vars）
cp hono_backend/.dev.vars.example hono_backend/.dev.vars

# 前端
cp frontend/.env frontend/.env.local
```

主要配置项：

| 变量 | 位置 | 说明 |
|------|------|------|
| `AUTH_BASE_URL` | backend `.dev.vars` | AutoLab 认证服务地址 |
| `JWT_ACCESS_SECRET` | backend `.dev.vars` | JWT 签名密钥 |
| `NEXUS_ENGINE_URL` | backend `.dev.vars` | nexus-engine 的 URL |
| `NEXUS_ENGINE_ADMIN_SECRET` | backend `.dev.vars` | 引擎 Admin API 密钥 |
| `OPENAI_API_KEY` | backend `.dev.vars` | LLM API 密钥 |
| `VITE_API_BASE_URL` | frontend `.env` | 后端 API 地址 |
| `VITE_ENGINE_WS_URL` | frontend `.env` | 引擎 WebSocket 地址 |
| `VITE_OAUTH_CLIENT_ID` | frontend `.env` | OAuth Client ID |

### 3. 本地开发

```bash
# 启动 Workers（hono_backend + nexus-engine）
pnpm run dev:workers

# 启动前端（另一个终端）
cd frontend && pnpm run dev

# 启动 LLM Monitor（另一个终端，可选）
cd llm-monitor && pnpm run dev

# 启动游戏 Worker（另一个终端）
cd games/gomoku/worker && pnpm run dev
```

### 4. 数据库迁移

```bash
# 应用 hono_backend 的 D1 迁移（本地）
make d1-migrate
```

---

## 🛠️ Makefile 命令参考

| 命令 | 说明 |
|------|------|
| `make help` | 显示所有可用命令 |
| `make build-games` | 构建游戏逻辑 |
| `make typecheck` | 运行核心项目类型检查 |
| `make deploy-engine` | 部署 nexus-engine 到 Cloudflare |
| `make deploy-backend` | 部署 hono_backend 到 Cloudflare |
| `make deploy-game G=gomoku` | 构建并部署指定游戏 |
| `make set-engine-secret` | 设置 nexus-engine 的 CF Worker Secret |
| `make set-backend-secret` | 设置 hono_backend 的 CF Worker Secret |
| `make d1-migrate` | 应用 D1 数据库迁移（本地） |

---

## 🌐 部署

### 前端 & LLM Monitor → Vercel

通过 Vercel 连接 GitHub 仓库，分别配置 `frontend/` 和 `llm-monitor/` 为项目根目录：

- **Framework**：Vite
- **Build Command**：`pnpm run build`
- **Output Directory**：`dist`

### Workers → Cloudflare

```bash
# 部署业务后端
make deploy-backend

# 部署游戏引擎
make deploy-engine

# 部署游戏（例：五子棋）
make deploy-game G=gomoku
```

部署前确保已通过 `wrangler secret put` 或 Cloudflare Dashboard 配置好以下 Secrets：

| Worker | 必需 Secrets |
|--------|-------------|
| `hono_backend` | `JWT_ACCESS_SECRET`、`NEXUS_ENGINE_ADMIN_SECRET`、`NEXUS_ENGINE_URL`、`OPENAI_API_KEY` |
| `nexus-engine` | `JWT_SECRET`、`ADMIN_SECRET`、`LLM_WEBHOOK_URL`、`LLM_WEBHOOK_SECRET` |

---

## 🧩 添加新游戏

1. **创建游戏目录**

```bash
mkdir -p games/my-game/{logic,ui,worker}
```

2. **实现游戏逻辑**（`games/my-game/logic/index.ts`）

```typescript
import { BaseGameLogic, type GameMetadata, ... } from '@nexus/game-sdk';

class MyGameLogic extends BaseGameLogic<MyState> {
    getMetadata(): GameMetadata { /* ... */ }
    initState(ctx: InitContext): MyState { /* ... */ }
    getCurrentRole(state: MyState): string { /* ... */ }
    getLegalActions(state: MyState, roleId: string): ActionSpec { /* ... */ }
    applyAction(state: MyState, action: Action): ActionResult<MyState> { /* ... */ }
    isTerminal(state: MyState): boolean { /* ... */ }
    getWinners(state: MyState): string[] | null { /* ... */ }
    toRolePerspective(state, roleId, wholeHistory, diffHistory): RolePerspective { /* ... */ }
}

export default new MyGameLogic();
```

3. **创建游戏 UI**（`games/my-game/ui/`）— 编写 React 组件，构建为独立 JS/CSS

4. **创建 Game Worker**（`games/my-game/worker/`）— 参考 `games/gomoku/worker` 的结构

5. **部署**

```bash
make deploy-game G=my-game
```

详细的游戏接入规范请参考 [`game_integration_guide.md`](./docs/old/game_integration_guide.md)。

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [`game_integration_guide.md`](./docs/old/game_integration_guide.md) | 游戏接入与运行设计规范 |
| [`overview.md`](./docs/old/overview.md) | 项目总览与愿景 |
| [`platform_design.md`](./docs/old/platform_design.md) | 平台设计文档 |
| [`NEXUS_ENGINE_DESIGN.md`](./docs/old/NEXUS_ENGINE_DESIGN.md) | 游戏引擎设计文档 |
| [`AUTO_PLAYER_SYSTEM.md`](./docs/old/AUTO_PLAYER_SYSTEM.md) | 自动玩家系统详解 |
| [`LLM_EXECUTOR_GUIDE.md`](./docs/old/LLM_EXECUTOR_GUIDE.md) | LLM 执行器使用指南 |
| [`LLM_MEMORY_GUIDE.md`](./docs/old/LLM_MEMORY_GUIDE.md) | LLM 记忆系统指南 |

---

## 🎯 开发路线图

### ✅ 已完成

- [x] Cloudflare Workers + Vercel 全 Serverless 架构迁移
- [x] Durable Objects 游戏状态管理（GameDO）
- [x] WebSocket 实时通信协议
- [x] OAuth 2.0 + PKCE 认证集成
- [x] 游戏逻辑插件化（Game SDK + Game Worker）
- [x] 五子棋游戏完整实现（逻辑 + UI + Worker）
- [x] LLM 玩家自动执行（webhook 模式）
- [x] LLM 交互监控面板
- [x] 游戏 UI iframe 沙箱隔离
- [x] 房间管理（创建、加入、观战）

### 🚧 进行中

- [ ] 旧游戏迁移（井字棋、象棋、狼人杀）
- [ ] 游戏动态加载机制

### 🔮 未来计划

- [ ] 更多游戏（UNO、更多卡牌/策略游戏）
- [ ] LLM 游戏表现 Benchmark 平台
- [ ] 快照保存/加载与游戏回放
- [ ] 多房间并发扩容
- [ ] 管理后台

---

## 📄 License

MIT
