# 星枢沙盒 (Nexus Playground)

**可扩展的 LLM 原生游戏平台 · 让 AI 与人类共同游戏**

---

## 📖 项目简介

星枢沙盒是一个高度可扩展的在线游戏平台，将大型语言模型（LLM）作为原生玩家深度集成到游戏逻辑中。平台采用"运行时 + 纯逻辑插件"的架构，让开发者能够快速将新游戏规则转化为可供人类与 AI 共同参与的在线游戏。

### 核心特性

- 🎮 **游戏逻辑插件化**：游戏开发者只需提供纯函数式的游戏逻辑，平台接管所有运行时服务
- 🤖 **LLM 原生适配**：AI 玩家通过标准化的"角色视角"无缝理解并参与任何游戏
- 🔄 **完全可复现**：支持从任意游戏状态启动，允许玩家在任意时刻无缝接管或切换角色
- 🔐 **企业级鉴权**：基于 AutoLab SDK 族的 OAuth 2.0 + PKCE 认证与多服务鉴权链
- 🎯 **信息完整性**：原生支持不完美信息游戏，严格隔离权威状态与角色视角

---

## 🏗️ 架构设计

### 技术栈

#### 前端
- **React 18** + **TypeScript**：MPA（多页应用）架构，每页独立挂载认证上下文
- **Vite**：快速开发与构建
- **AutoLab SDK 前端族**：
  - `@autolabz/oauth-sdk`：OAuth 2.0 认证与会话管理
  - `@autolabz/llmapi-sdk`：LLM 调用（非流式/SSE 流式）

#### 后端
- **Node.js 20** + **Fastify**：高性能 API 服务
- **TypeScript**：类型安全与开发体验
- **AutoLab SDK 后端族**：
  - `@autolabz/service-auth-middleware`：统一鉴权中间件（SIMPLE JWT + OAuth userinfo 回落）
  - `@autolabz/llmapi-sdk`：后端调用 LLM（代 AI 玩家决策）

#### 数据层
- **Redis 7**：星枢（房间）实时状态、玩家列表、角色映射、游戏状态缓存
- **PostgreSQL 15**：持久化数据（用户→星枢映射、保存的游戏快照、历史记录、审计日志）

#### 基础设施
- **Nginx**：静态资源服务 + 反向代理 + 统一网关
- **Docker Compose**：一键编排所有服务
- **Makefile**：标准化开发与部署命令

---

## 🗂️ 项目结构

```
nexus-playground/
├── frontend/                 # React 前端（MPA）
│   ├── src/
│   │   ├── pages/           # 页面：首页、星枢、房间、回调
│   │   │   ├── index/       # 登录引导页（未登录）
│   │   │   ├── my-nexus/    # 我的星枢（主人视角）：游戏选择、玩家管理、角色映射、游戏区
│   │   │   ├── room/        # 他人星枢（访客视角）：观战、加入、游戏区
│   │   │   └── callback/    # OAuth 统一回调页
│   │   ├── components/      # 通用组件：AuthAvatar、RoomCard
│   │   ├── hooks/           # React Hooks：useRoom、usePerspective
│   │   ├── lib/             # 工具：API 客户端封装、桥接、游戏 UI 加载
│   │   │   ├── game-ui-loader.ts   # 动态加载游戏 UI 插件（与注册映射）
│   │   │   └── game-ui-types.ts    # 前端 GameUIPlugin 与 Props 定义
│   │   └── main.tsx         # 各页面入口（由 Vite 多页配置生成）
│   ├── public/              # 静态资源
│   ├── vite.config.ts       # Vite 多页配置
│   ├── .env.example         # 环境变量模板
│   └── package.json
│
├── backend/                  # Fastify 后端
│   ├── src/
│   │   ├── index.ts         # 入口：注册插件、启动服务
│   │   ├── plugins/         # Fastify 插件
│   │   │   ├── auth.ts      # 鉴权插件（@autolabz/service-auth-middleware）
│   │   │   ├── redis.ts     # Redis 客户端插件
│   │   │   └── postgres.ts  # PostgreSQL 客户端插件
│   │   ├── routes/          # API 路由
│   │   │   ├── my-nexus.ts  # 我的星枢：自动创建、游戏选择、玩家管理、角色映射、开始/暂停
│   │   │   ├── rooms.ts     # 星枢访问：查询他人星枢、加入、观战
│   │   │   ├── actions.ts   # 行动提交与验证（通用，适用于自己或他人星枢）
│   │   │   ├── perspectives.ts # 视角拉取与 SSE 订阅
│   │   │   └── snapshots.ts # 快照保存与加载
│   │   ├── runtime/         # 游戏运行时核心
│   │   │   ├── state-manager.ts      # 权威状态管理（Redis + 版本控制）
│   │   │   ├── action-processor.ts   # 行动队列与串行执行
│   │   │   ├── perspective-generator.ts # 视角生成与缓存
│   │   │   ├── event-bus.ts          # 事件总线（SSE/WS 推送）
│   │   │   └── llm-executor.ts       # LLM 玩家执行器
│   │   ├── games/           # （平台侧文件，仅注册与类型定义）
│   │   │   ├── registry.ts  # 游戏注册表（从顶层 games/*/logic 导入）
│   │   │   └── types.ts     # GameLogic/ActionSpec 接口定义
│   │   ├── db/              # 数据库访问层
│   │   │   ├── schema.sql   # PostgreSQL 表结构
│   │   │   ├── rooms.ts     # 房间持久化 DAO
│   │   │   └── snapshots.ts # 快照 DAO
│   │   └── utils/           # 工具函数
│   ├── .env.example
│   └── package.json
│
├── games/                    # 顶层游戏目录（与平台前后端解耦）
│   └── tic-tac-toe/
│       ├── logic/           # 后端纯逻辑实现（被后端注册表导入）
│       │   └── index.ts
│       └── ui/              # 前端纯渲染 UI 插件（由前端动态加载）
│           ├── ui.tsx
│           └── ui.module.css
│
├── e2e/                      # 端到端测试（Playwright 等，若使用）
│   └── README.md            # 测试说明（可选）
│
├── nginx/                    # Nginx 配置
│   ├── nginx.conf           # 主配置：统一网关 + 静态服务
│   └── Dockerfile
│
├── database/                 # 数据库初始化
│   └── init.sql             # PostgreSQL 初始化脚本
│
├── docker-compose.yml        # 服务编排
├── Makefile                  # 开发与部署命令
├── .env.example              # 全局环境变量模板
├── game_integration_guide.md # 游戏接入与运行设计文档（规范与示例）
├── platform_design.md        # 平台设计文档
├── frontend_best_practices.md # 前端集成最佳实践
├── backend_best_practices.md  # 后端鉴权最佳实践
└── README.md                 # 本文档
```

---

## 🚀 快速开始

### 前置要求

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Make** 工具（macOS/Linux 自带，Windows 可用 WSL）
- **Node.js** >= 20（本地开发时需要，Docker 内已包含）

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/nexus-playground.git
cd nexus-playground
```

### 2. 配置环境变量

```bash
# 复制模板并编辑
cp .env.example .env

# 关键配置项（示例）
# AUTH_BASE_URL=http://114.132.91.247/api              # AutoLab 认证服务地址
# LLMAPI_BASE_URL=http://114.132.91.247/llmapi        # LLM API 服务地址
# OAUTH_CLIENT_ID=your-assigned-client-id              # 由 AutoLab 组织分配
# REDIS_URL=redis://redis:6379                         # Redis 连接
# DATABASE_URL=postgresql://nexus:password@postgres:5432/nexus # PostgreSQL 连接
```

### 3. 一键启动

```bash
# 构建所有镜像并启动服务
make build
make up

# 或一步完成
make build up
```

服务启动后访问：
- **前端首页**：http://localhost（OAuth 登录后自动跳转到 `/my-nexus`）
- **我的星枢**：http://localhost/my-nexus（需登录）
- **访问他人星枢**：http://localhost/room/{roomId}（示例：`http://localhost/room/abc123xy`）
- **API 文档**：http://localhost/api/docs（Fastify Swagger，若启用）
- **健康检查**：http://localhost/api/health

### 4. 开发模式（热重载）

```bash
# 前端开发（Vite HMR）
cd frontend
npm install
npm run dev  # 访问 http://localhost:5173

# 后端开发（nodemon）
cd backend
npm install
npm run dev  # 监听 http://localhost:3000
```

### 5. 停止与清理

```bash
# 停止所有容器
make down

# 清理容器 + 网络（保留数据卷）
make clean

# 完全清理（包括数据卷，谨慎使用）
make clean-all
```

---

## 🎮 核心概念

### 星枢（Nexus/Room）

星枢是与用户一一对应的游戏容器。每个用户首次登录后自动拥有一个专属星枢，用户主页即为自己的星枢。

- **用户访问自己的星枢**：登录后直接进入 `/my-nexus`（或首页）
- **访问他人的星枢**：通过 Room ID 访问 `/room/{roomId}`（如观战、加入游戏）

每个星枢具有：

| 属性 | 说明 | 存储位置 |
|------|------|----------|
| **Owner ID** | 星枢主人的 `uid`（唯一） | PostgreSQL |
| **Room ID** | 固定长度随机字符串，用于生成访问网址 `yourdomain.com/room/{roomId}`，**不等于 User ID** | PostgreSQL + Redis |
| **Player List** | 玩家列表（人类/LLM），包含 `room_player_id`、`type`、`display_name`、`status` | Redis (`room:{roomId}:players`) |
| **Room State** | `open`（开放阶段）或 `playing`（游戏中） | Redis (`room:{roomId}:meta`) |
| **Game ID** | 当前选择的游戏 ID | Redis + PostgreSQL |
| **Game State** | 权威游戏状态（上帝视角，**永不直接发送给客户端**） | Redis (`room:{roomId}:state`) |
| **Role Mapping** | 游戏角色 → 房间玩家的映射 | Redis (`room:{roomId}:roles`) |

### 状态与视角分离

- **Game State（权威状态）**：包含所有玩家手牌、私密信息，仅后端持有，是游戏的唯一真实数据源。
- **Role Perspective（角色视角）**：为特定角色过滤后的视图，包含该角色应知信息、合法行动空间、历史日志，发送给前端 UI 与 LLM。

### 游戏逻辑插件

游戏开发者提供的**无状态纯函数**集合（`GameLogic` 接口）：

```typescript
export interface GameMetadata {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  getStatusText?: (perspective: RolePerspective) => string;
}

export type ActionResult =
  | { success: true; nextState: GameState; events?: HistoryEvent[] }
  | { success: false; error: string; errorCode?: string };

export interface GameLogic {
  getMetadata(): GameMetadata;
  initState(ctx: { players: string[]; options?: any }): GameState;
  getCurrentRole(state: GameState): string;
  getLegalActions(state: GameState, roleId: string): ActionSpec;
  applyAction(state: GameState, action: Action): ActionResult;
  isTerminal(state: GameState): boolean;
  getWinners(state: GameState): string[] | null;
  toRolePerspective(state: GameState, roleId: string, wholeHistory: HistoryEvent[], diffHistory: HistoryEvent[]): RolePerspective;
}
```

平台调用这些函数完成状态推演，游戏逻辑本身**绝不持有任何长效状态**。

### 行动规范（ActionSpec）简述

- 固定选项：`params_schema: null`（无需参数，如“停一手”“弃牌”）
- 参数化模板：`params_schema: { ... }`（需要参数，如“落子(row,col)” “加注(amount)”）
- 统一以 `ActionSpec.actions` 列表表达，可自由组合；详情参见 `game_integration_guide.md` 第 4 章。

### 运行时核心摘要

- 状态管理器（State Manager）：Redis 持有权威 GameState，版本控制与乐观锁
- 行动处理器（Action Processor）：分布式锁、幂等校验、回合与合法性验证、应用行动与历史记录
- 视角生成器（Perspective Generator）：按角色生成 `RolePerspective`，并按版本缓存
- 事件总线（Event Bus）：SSE 广播视角更新与错误信息
- LLM 执行器（LLM Executor）：将 `RolePerspective` 适配为 Prompt，调用 LLM 并提交行动

完整机制与生命周期请参考 `game_integration_guide.md` 第 6、7 章。

---

## 🔐 认证与鉴权流程

### 前端（MPA 模式）

1. **每页挂载** `OAuthProvider`，用于恢复/管理会话（依赖 localStorage/sessionStorage）
2. **统一回调页**：`/oauth/callback` 处理 `handleRedirect`，解析自定义 `state.returnTo` 并跳回来源页
3. **桥接下游 SDK**：使用 `createAuthBridgeFromContext(auth)` 创建 `llmapi-sdk`、`points-sdk` 客户端

```tsx
// 每页入口：PageShell.tsx
<OAuthProvider authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL} clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}>
  {children}
</OAuthProvider>

// 需要登录入口的页面：挂 AuthAvatar
<AuthAvatar
  redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
  scope="openid profile email llmapi"
  state={() => makeState({ returnTo: window.location.href })}
/>

// 桥接客户端
const auth = useOAuth();
const authBridge = useMemo(() => createAuthBridgeFromContext(auth), [auth]);
const llm = useMemo(() => createLLMClient({ baseURL: import.meta.env.VITE_LLMAPI_BASE_URL, auth: authBridge }), [authBridge]);
```

### 后端（统一鉴权中间件）

```typescript
import { authPlugin, makeAuthBridgeFromRequest } from '@autolabz/service-auth-middleware';
import { createLLMClient } from '@autolabz/llmapi-sdk';

// 注册鉴权插件（SIMPLE JWT 优先 + OAuth userinfo 回落）
app.register(authPlugin, {
  authConfig: {
    jwtAlg: 'HS256',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    authBaseUrl: process.env.AUTH_BASE_URL!,
    oauthUserinfoPath: '/oauth/userinfo',
    oauthUserinfoTimeoutMs: 2000,
  },
  clientId: {},
  enforce: { requiredScopes: ['llmapi'] }, // 根据服务需求调整
});

// 访问下游服务（透传鉴权）
app.post('/v1/rooms/:roomId/actions', async (req, reply) => {
  const auth = makeAuthBridgeFromRequest(req);
  const llm = createLLMClient({ baseURL: process.env.LLMAPI_BASE_URL!, auth });
  // ... 使用 llm 调用 LLM
});
```

---

## 📊 数据存储策略

### Redis（实时状态，支持 TTL）

| Key 模式 | 数据类型 | 内容 | TTL |
|----------|----------|------|-----|
| `room:{roomId}:meta` | Hash | 房间元数据（owner、gameId、status） | 7天（无活动） |
| `room:{roomId}:players` | Hash | 玩家列表（room_player_id → player JSON） | 同上 |
| `room:{roomId}:roles` | Hash | 角色映射（role_id → room_player_id） | 同上 |
| `room:{roomId}:state` | String | 权威 Game State（JSON） | 同上 |
| `room:{roomId}:version` | String | 状态版本号（自增整型） | 同上 |
| `room:{roomId}:perspective:{roleId}:v{version}` | String | 角色视角缓存（按版本自动失效） | 5分钟 |
| `room:{roomId}:history` | String | 历史事件列表（JSON） | 同上 |
| `room:{roomId}:lock` | String | 行动处理锁（防止并发冲突） | 30秒 |

### PostgreSQL（持久化，支持复杂查询）

#### 表结构

**rooms**
```sql
CREATE TABLE rooms (
  room_id VARCHAR(32) PRIMARY KEY,
  owner_uid VARCHAR(64) NOT NULL UNIQUE, -- 一个用户只能有一个星枢
  game_id VARCHAR(64),  -- NULL 表示未选择游戏
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_owner (owner_uid)
);
```

**snapshots**
```sql
CREATE TABLE snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(32) REFERENCES rooms(room_id),
  game_state JSONB NOT NULL,
  description TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_room (room_id)
);
```

**history**（可选：事件溯源）
```sql
CREATE TABLE history (
  event_id BIGSERIAL PRIMARY KEY,
  room_id VARCHAR(32) REFERENCES rooms(room_id),
  state_version INT NOT NULL,
  event_type VARCHAR(32) NOT NULL, -- 'action', 'turn_change', 'game_end'
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX idx_room_version (room_id, state_version)
);
```

---

## 🔄 核心工作流程

### 1. 用户首次登录（自动创建星枢）

```
前端: 用户完成 OAuth 登录 → 跳转到首页/my-nexus
  ↓
后端: GET /api/v1/my-nexus
      1. 验证用户鉴权（req.auth.userId）
      2. 查询 PostgreSQL: SELECT * FROM rooms WHERE owner_uid = userId
      3. 若不存在：
         - 生成唯一 roomId（随机字符串，如 8 位 base62）
         - 插入 rooms 表（owner_uid、room_id、created_at）
         - Redis 初始化 room:{roomId}:meta（包含 owner、status="open"）
         - Redis 初始化 room:{roomId}:players（自动添加主人为第一个玩家）
      4. 返回 { roomId, ownerId, status, playerList, ... }
  ↓
前端: 渲染星枢主页（游戏选择、玩家列表、邀请链接）
```

### 2. 访问他人星枢与加入游戏

```
场景 A: 主人邀请其他玩家
  前端: 主人复制邀请链接 → https://yourdomain.com/room/{roomId}?invite=true
  
场景 B: 其他用户访问星枢
  前端: GET /room/{roomId}
    ↓
  后端: GET /api/v1/rooms/{roomId}
        1. 验证星枢存在（Redis/PostgreSQL）
        2. 检查当前用户是否已在玩家列表
        3. 若未加入且星枢状态为 "open"，允许加入
        4. 返回星枢信息（隐藏敏感数据，如其他玩家手牌）
    ↓
  前端: 渲染星枢页面（游戏区、玩家列表、加入/观战按钮）

场景 C: 用户请求加入
  前端: POST /api/v1/rooms/{roomId}/join
    ↓
  后端: 1. 验证用户鉴权
        2. 检查星枢状态（open 才能加入）
        3. 生成 room_player_id = {roomId}_{随机字符串}
        4. Redis HSET room:{roomId}:players
        5. 广播事件（SSE/WS 通知主人与其他玩家）
```

### 3. 选择游戏与开始

```
前端: 主人在星枢主页选择游戏
  POST /api/v1/my-nexus/select-game { gameId: "tic-tac-toe" }
    ↓
  后端: 1. 验证主人权限（req.auth.userId === room.owner）
        2. 验证星枢状态为 "open"
        3. 更新 PostgreSQL rooms.game_id
        4. Redis 更新 room:{roomId}:meta.gameId
        5. 返回游戏元数据（minPlayers、maxPlayers、规则描述）

前端: 主人配置角色映射并开始游戏
  POST /api/v1/my-nexus/start { roleMapping: { "player_X": "room_player_id_1", ... } }
    ↓
  后端: 1. 验证玩家数量满足 game.minPlayers
        2. 调用 game.initState() 生成初始 GameState
        3. Redis 更新 meta.status="playing"、roles、state
        4. 为所有角色生成初始视角并推送（SSE）
```

### 4. 提交行动

```
前端: POST /api/v1/rooms/{roomId}/actions { action_id: "place_1_1", roleId: "player_X", requestId: "uuid", expectedStateVersion: 5 }
  ↓
后端: 1. 获取分布式锁（Redis SETNX room:{roomId}:lock）
      2. 验证 roleId 是否当前行动方（game.getCurrentRole(state)）
      3. 验证 expectedStateVersion === state.version（可选：乐观锁）
      4. 幂等检查（requestId 是否已处理）
      5. 验证行动合法性（game.getLegalActions 包含该行动）
      6. 应用行动：result = game.applyAction(state, action)
      7. 更新 Redis state、version++、记录 history
      8. 释放锁
      9. 广播新视角给所有玩家（SSE/WS）
      10. 若游戏结束（game.isTerminal），广播结果
  ↓
前端: 收到新视角 → 重新渲染 UI
```

### 5. LLM 玩家自动执行

```
后端: 1. 检测当前 roleId 对应的 room_player 类型为 "llm"
      2. 调用 perspective-generator 生成视角
      3. 调用 llm-executor：
         - 构造 Prompt（系统提示 + 角色视角 JSON + 强约束合法行动）
         - llmapi-sdk.chat() 调用 LLM（自动计费）
         - 解析返回 JSON → Action
      4. 自动提交 Action（复用行动处理流程）
      5. 出错策略：重试 3 次（指数退避）→ 失败则暂停游戏并通知主
```

---

## 🛠️ Makefile 命令参考

| 命令 | 说明 |
|------|------|
| `make build` | 构建所有 Docker 镜像（frontend、backend、nginx） |
| `make up` | 启动所有服务（后台运行） |
| `make down` | 停止所有容器 |
| `make logs` | 查看所有容器日志（实时） |
| `make logs-frontend` | 查看前端容器日志 |
| `make logs-backend` | 查看后端容器日志 |
| `make restart` | 重启所有服务 |
| `make clean` | 停止并删除容器、网络（保留数据卷） |
| `make clean-all` | 完全清理（包括 Redis/PostgreSQL 数据卷，**谨慎使用**） |
| `make ps` | 查看容器状态 |
| `make shell-backend` | 进入后端容器 Shell |
| `make shell-db` | 进入 PostgreSQL 容器 |
| `make db-migrate` | 运行数据库迁移脚本 |
| `make db-seed` | 插入测试数据（开发用） |
| `make test-backend` | 运行后端单元测试 |
| `make test-frontend` | 运行前端单元测试 |

---

## 🧪 开发与测试

### 本地开发（不使用 Docker）

1. **启动依赖服务（仅 Redis + PostgreSQL）**

```bash
docker-compose up -d redis postgres
```

2. **前端开发**

```bash
cd frontend
npm install
cp .env.example .env.local
# 编辑 .env.local，设置 API 地址为 http://localhost:3000
npm run dev  # http://localhost:5173
```

3. **后端开发**

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env，设置数据库连接（localhost:5432、localhost:6379）
npm run dev  # http://localhost:3000
```

### 单元测试

```bash
# 后端测试（Jest）
cd backend
npm run test

# 前端测试（Vitest）
cd frontend
npm run test
```

### 集成测试

```bash
# 启动完整环境
make up

# 运行端到端测试（Playwright，可选）
cd e2e
npm run test
```

---

## 🌐 部署与生产

### 环境变量检查清单

- [ ] `AUTH_BASE_URL`：AutoLab 认证服务外部可达地址
- [ ] `LLMAPI_BASE_URL`：LLM API 服务地址
- [ ] `OAUTH_CLIENT_ID`：由 AutoLab 组织分配的固定 Client ID
- [ ] `JWT_ACCESS_SECRET`：生产强密钥（至少 32 字节随机字符串）
- [ ] `REDIS_URL`：生产 Redis 连接（建议启用 TLS 与密码）
- [ ] `DATABASE_URL`：生产 PostgreSQL 连接（建议启用 SSL）
- [ ] `NGINX_SERVER_NAME`：生产域名（用于 SSL 证书）

### 生产部署步骤

1. **在生产服务器克隆仓库**

```bash
git clone https://github.com/your-org/nexus-playground.git
cd nexus-playground
```

2. **配置生产环境变量**

```bash
cp .env.example .env
# 编辑 .env，填入生产配置
```

3. **启动服务**

```bash
make build
make up
```

4. **配置 SSL（Nginx）**

```bash
# 使用 Let's Encrypt（示例）
docker exec -it nexus-nginx certbot --nginx -d yourdomain.com
```

5. **监控与日志**

```bash
# 查看日志
make logs

# 设置日志轮转（生产建议）
# 编辑 docker-compose.yml，添加 logging 配置
```

### 备份与恢复

**PostgreSQL 备份**

```bash
docker exec nexus-postgres pg_dump -U nexus nexus > backup_$(date +%Y%m%d).sql
```

**Redis 备份**

```bash
docker exec nexus-redis redis-cli SAVE
docker cp nexus-redis:/data/dump.rdb ./backup_redis_$(date +%Y%m%d).rdb
```

**恢复**

```bash
# PostgreSQL
cat backup_20241024.sql | docker exec -i nexus-postgres psql -U nexus nexus

# Redis
docker cp backup_redis_20241024.rdb nexus-redis:/data/dump.rdb
docker restart nexus-redis
```

---

## 🎯 开发路线图

### ✅ M0：基础可运行（当前阶段）

- [ ] Docker Compose 编排（Redis + PostgreSQL + Nginx）
- [ ] OAuth 认证集成（MPA 模式 + 统一回调）
- [ ] 用户首次登录自动创建星枢（owner_uid → room_id 映射）
- [ ] 我的星枢页面（`/my-nexus`）：游戏选择、玩家管理
- [ ] 访问他人星枢页面（`/room/{roomId}`）：加入、观战
- [ ] 井字棋游戏逻辑插件（示例）
- [ ] 手动提交行动（人类 vs 人类）

### 🚧 M1：核心运行时（进行中）

- [ ] 行动队列与串行执行（Redis 分布式锁）
- [ ] 版本控制与幂等（`expectedStateVersion` + `requestId`）
- [ ] SSE 实时推送（视角更新 + 错误反馈）
- [ ] 角色映射 UI（拖拽连线交互）
- [ ] 暂停/推演状态机
- [ ] 事件历史分页查询

### 🔮 M2：LLM 玩家

- [ ] 视角 → Prompt 适配器
- [ ] LLM 执行器（非流式/流式两种模式）
- [ ] LLM 代打（定向到当前 roleId）
- [ ] 前端流式渲染（增量显示 AI 思考过程）
- [ ] 错误重试策略（指数退避 + 降级通知）

### 🌟 M3：进阶能力

- [ ] 快照保存/加载（PostgreSQL）
- [ ] 多房间并发扩容测试
- [ ] 可插拔多游戏（注册表 + 动态加载）
- [ ] 不完美信息游戏示例（暗牌对战）
- [ ] 游戏回放 UI（基于事件溯源）
- [ ] 管理后台（房间监控、日志审计、用户管理）

---

## 🤝 贡献指南

欢迎贡献新游戏、功能改进或 Bug 修复！

### 添加新游戏（顶层 games/ 目录）

1. 在 `games/<game-id>/logic/` 实现后端逻辑（`index.ts` 导出 `GameLogic`）
2. 在 `games/<game-id>/ui/` 实现前端 UI（`ui.tsx` 默认导出 `GameUIPlugin`）
3. 在 `backend/src/games/registry.ts` 中从 `@games/<game-id>/logic` 导入并注册
4. 在前端 `frontend/src/lib/game-ui-loader.ts` 中映射 `@games/<game-id>/ui`
5. 提交 PR 并附上游戏规则说明与测试用例

### 提交规范

```bash
# Commit 格式
<type>(<scope>): <subject>

# 类型
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具链

# 示例
feat(games): add chess game logic
fix(runtime): resolve race condition in action processor
docs(readme): update deployment section
```

---

## 📚 参考文档

- [平台设计文档](./platform_design.md)：完整的架构设计与游戏状态流转
- [SDK 接入理念](./sdk_concept.md)：关注点分离与核心哲学
- [前端集成最佳实践](./frontend_best_practices.md)：AutoLab SDK 前端族使用指南
- [后端鉴权最佳实践](./backend_best_practices.md)：统一鉴权中间件与服务间透传

### 路径别名建议

- 前端（Vite）：在 `frontend/tsconfig.json` 与 `vite.config.ts` 设置 `@games/*` 指向 `../games/*`
- 后端（ts-node/tsc）：在 `backend/tsconfig.json` 设置 `@games/*` 路径映射到 `../games/*`
- 这样即可在任意位置通过 `import { TicTacToeLogic } from '@games/tic-tac-toe/logic'` 与 `import ui from '@games/tic-tac-toe/ui'` 引入

---

## 📄 许可证

MIT License

---

## 💬 联系与支持

- **问题反馈**：[GitHub Issues](https://github.com/your-org/nexus-playground/issues)
- **讨论区**：[GitHub Discussions](https://github.com/your-org/nexus-playground/discussions)
- **邮件**：support@nexus-playground.dev

---

**让 AI 与人类共同游戏，探索 LLM 原生时代的游戏新范式 🎮✨**

