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

## 🏗️ 架构设计 (详见 [architecture.md](./architecture.md))

### 技术栈

#### 前端 (Micro-Frontend)
- **React 18** + **TypeScript**：MPA 架构 + Module Federation
- **Vite 5**：集成 `@originjs/vite-plugin-federation`
- **Host App**：负责鉴权、路由、游戏容器、SDK 注入
- **Remote Games**：独立构建的微前端应用，动态加载

#### 后端 (Node.js Service)
- **Fastify** + **TypeScript**：高性能 API 服务
- **Docker Multi-stage**：集成 SDK 构建与链接
- **Dynamic Registry**：基于配置文件的游戏注册与版本握手
- **Shared Middleware**：`@autolabz/service-auth-middleware`

#### 共享核心 (Monorepo)
- **@nexus/game-sdk**：
  - 类型定义 (GameLogic, ActionSpec)
  - 逻辑基类 (BaseGameLogic)
  - UI 组件库 (BoardGrid, Piece)
  - 测试工具 (GameTestHarness)

#### 基础设施
- **Redis 7**：实时状态、分布式锁、SSE 票据
- **PostgreSQL 15**：持久化数据
- **Nginx**：统一网关
- **Docker Compose**：全栈编排
- **Make**：开发运维脚本

---

```
nexus-playground/
├── packages/                 # Monorepo 共享包
│   └── game-sdk/            # @nexus/game-sdk (通用类型/逻辑/UI)
│
├── games/                    # 独立游戏包 (Module Federation Remotes)
│   └── gomoku/              # 五子棋 (参考实现)
│       ├── logic/           # 游戏逻辑 (后端兼容)
│       ├── ui/              # 游戏 UI (前端兼容)
│       ├── package.json     # 独立依赖
│       └── vite.config.ts   # Remote 导出配置
│
├── frontend/                 # Host 应用 (React + Vite)
│   ├── src/lib/game-ui-loader.ts  # Federation 动态加载器
│   └── vite.config.ts       # Host Federation 配置
│
├── backend/                  # Host 服务 (Node.js + Fastify)
│   ├── src/games/registry.ts      # 混合注册表 (配置 + 静态)
│   └── Dockerfile           # 多阶段构建 (含 SDK 链接)
│
├── config/                   # 全局配置
│   └── games.json           # 动态游戏注册配置
│
├── deploy/                   # 部署相关 (Nginx)
│   └── ...
│
├── database/                 # 数据库初始化
├── docker-compose.yml        # 服务编排
├── Makefile                  # 开发命令
├── architecture.md           # 架构详解文档
└── README.md                 # 项目概览
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
# OAUTH_CLIENT_ID=your-assigned-client-id              # 由 AutoLab 组织分配（前端用）
# REDIS_URL=redis://redis:6379                         # Redis 连接
# DATABASE_URL=postgresql://nexus:password@postgres:5432/nexus # PostgreSQL 连接

# LLM 玩家功能所需（后端应用身份）
# OAUTH_APP_CLIENT_ID=your-app-client-id               # 后端应用 ID
# OAUTH_APP_CLIENT_SECRET=cs_live_your_secret          # 后端应用密钥（保密！）
# JWT_ACCESS_SECRET=your-jwt-secret                    # JWT 签名密钥
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
- **前端首页**：http://localhost（登录引导，自动跳转 `/my-nexus` → `/room?id=...`）
- **我的星枢**：http://localhost/my-nexus（定位当前用户的 roomId 并重定向）
- **访问他人星枢**：http://localhost/room?id={roomId}（示例：`http://localhost/room?id=abc123xy`）
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

- **状态管理器（State Manager）**：Redis 持有权威 GameState，版本控制与乐观锁
- **行动处理器（Action Processor）**：分布式锁、幂等校验、回合与合法性验证、应用行动与历史记录
- **视角生成器（Perspective Generator）**：按角色生成 `RolePerspective`，并按版本缓存
- **事件总线（Event Bus）**：SSE 广播视角更新与错误信息
- **自动玩家系统（Auto Player System）**：
  - **AutoPlayerExecutor 接口**：定义自动玩家执行器契约（`canHandle`、`executeTurn`）
  - **LLMPlayerExecutor**：LLM 玩家实现，将 `RolePerspective` 适配为 Prompt 并调用 LLM
  - **AutoPlayerCoordinator**：协调器，维护执行器注册表，责任链模式匹配并触发执行
  - 支持多种自动玩家类型（LLM、规则 AI、RL Agent 等），易于扩展

完整机制与生命周期请参考 `game_integration_guide.md` 第 6、7 章。  
自动玩家系统详解请参考 `AUTO_PLAYER_SYSTEM.md`。

---

## 🔐 认证与鉴权流程

### 前端（MPA 模式）

1. **每页挂载** `OAuthProvider`（页内会话恢复/管理）
2. **统一回调页**：`/oauth/callback` 处理 `handleRedirect`，按 `state.returnTo` 回跳
3. **页面职责**：
   - `index`：轻量展示与快速跳转到 `/my-nexus`
   - `my-nexus`：请求 `/api/v1/my-nexus`，定位/创建用户专属房间后重定向至 `/room?id=...`
   - `room`：基于 `?id=` 查询参数渲染房间（M0 以访客视角为主）
3. **桥接下游 SDK**：使用 `createAuthBridgeFromContext(auth)` 创建 `llmapi-sdk`、`points-sdk` 客户端

### SSE 流式连接特殊认证机制

由于浏览器原生 `EventSource` API **不支持自定义 HTTP Headers**（无法携带 `Authorization: Bearer <token>`），本平台采用 **临时 Ticket 认证** 机制来保护 SSE 端点。

#### 设计原理

```
步骤 1: 前端获取 Ticket（使用标准 OAuth Token）
  POST /api/v1/rooms/{roomId}/perspectives/{roleId}/ticket
  Authorization: Bearer <access_token>
  ↓
  后端验证 Token → 生成临时 Ticket → 存入 Redis（TTL 5分钟）
  ↓
  返回 { ticket: "xxx", expiresIn: 300, streamUrl: "..." }

步骤 2: 前端使用 Ticket 建立 SSE 连接
  GET /api/v1/rooms/{roomId}/perspectives/{roleId}/stream?ticket=xxx
  ↓
  后端从 Redis 验证 Ticket → 匹配 roomId/roleId → 建立 SSE 流
  ↓
  推送实时视角更新

步骤 3: Ticket 过期自动刷新
  前端监听 Ticket 过期时间 → 自动重新获取 Ticket → 重连 SSE
```

#### 安全特性

- ✅ **Ticket 一次性生成**：需要有效的 OAuth Bearer Token 才能生成
- ✅ **自动过期**：5 分钟 TTL，防止长期泄露
- ✅ **资源绑定**：Ticket 只能用于指定的 `roomId` 和 `roleId`
- ✅ **审计日志**：Ticket 包含 `userId`，后端完整记录连接来源
- ✅ **允许重连**：Ticket 在 TTL 内可重复使用（支持页面刷新场景）

#### 实现细节

**后端路由配置**：
- `/api/v1/rooms/:roomId/perspectives/:roleId/ticket`：**启用** `authMiddleware`（验证 Bearer Token）
- `/api/v1/rooms/:roomId/perspectives/:roleId/stream`：**禁用** `authMiddleware`（通过 Ticket 验证）

**前端 Hook (`usePerspective.ts`)**：
```typescript
// 1. 获取 Ticket
const ticket = await fetch('/api/v1/rooms/.../ticket', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// 2. 使用 Ticket 建立 SSE
const eventSource = new EventSource(
  `/api/v1/rooms/.../stream?ticket=${ticket}`
);

// 3. 监听 Ticket 过期并自动重连
eventSource.onerror = () => {
  if (ticketExpiring) {
    // 获取新 Ticket 并重连
  }
};
```

#### 为何不修改 SDK？

本方案完全在**应用层**实现，无需修改 `@autolabz/oauth-sdk` 或 `@autolabz/service-auth-middleware`：
- SDK 保持通用性，适配所有标准 HTTP 请求场景
- SSE 流式场景的特殊需求通过应用层 Ticket 机制独立解决
- 其他项目可参考此模式，但不强制要求

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
| `sse_ticket:{ticket}` | String | SSE 认证票据（包含 userId、roomId、roleId、createdAt） | 5分钟 |

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
前端: 用户完成 OAuth 登录 → 首页 `/` 自动跳转到 `/my-nexus`
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
前端: `my-nexus` 定位后重定向至 `/room?id={roomId}`（统一房间页）
```

### 2. 访问他人星枢与加入游戏

```
场景 A: 主人邀请其他玩家
前端: 主人复制邀请链接 → https://yourdomain.com/room?id={roomId}&invite=true
  
场景 B: 其他用户访问星枢
前端: GET /room?id={roomId}
    ↓
  后端: GET /api/v1/rooms/{roomId}
        1. 验证星枢存在（Redis/PostgreSQL）
        2. 检查当前用户是否已在玩家列表
        3. 若未加入，允许加入（无论星枢状态为 "open" 或 "playing"）
        4. 返回星枢信息（隐藏敏感数据，如其他玩家手牌）
    ↓
  前端: 渲染星枢页面（游戏区、玩家列表、加入/观战按钮）

场景 C: 用户请求加入
  前端: POST /api/v1/rooms/{roomId}/join
    ↓
  后端: 1. 验证用户鉴权
        2. 检查星枢状态（允许加入 open 或 playing 状态的星枢）
        3. 生成 room_player_id = {roomId}_{随机字符串}
        4. Redis HSET room:{roomId}:players（添加到玩家列表，不分配角色映射）
        5. 广播事件（SSE/WS 通知主人与其他玩家）
        
  注：游戏中加入的玩家不会自动分配角色，需由主人在角色映射中手动分配
```

### 3. 选择游戏与开始（主人在 my-nexus 流程中完成）

```
前端: 主人在 my-nexus 定位后（自动跳至 `/room?id=...` 前）选择游戏
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

### 房间运维脚本

- `npm run room:admin -- --room-id <roomId>`：加载指定 Room 的 PostgreSQL 元数据与 Redis 状态。
- `npm run room:admin -- --owner <ownerUid>`：按房主 UID 定位房间（若一人一房）。
- `npm run room:admin -- --list [--limit <n>]`：按创建时间倒序列出最近的房间（默认最多 20 条，可叠加 `--owner` 过滤）。
- `npm run room:admin -- --room-id <roomId> --reset`：重新初始化 Redis 状态并将数据库状态重置为 `open`（交互式二次确认）。
- 追加 `--force` 可跳过确认，所有敏感操作会记录日志并在脚本结束时自动释放连接。

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

### 核心文档

- [平台设计文档](./platform_design.md)：完整的架构设计与游戏状态流转
- [SDK 接入理念](./sdk_concept.md)：关注点分离与核心哲学
- [前端集成最佳实践](./frontend_best_practices.md)：AutoLab SDK 前端族使用指南
- [后端鉴权最佳实践](./backend_best_practices.md)：统一鉴权中间件与服务间透传

### 新增功能文档

- [自动玩家系统架构](./AUTO_PLAYER_SYSTEM.md)：自动玩家系统设计、接口定义、扩展指南
- [LLM 执行器使用指南](./LLM_EXECUTOR_GUIDE.md)：LLM 玩家配置、Prompt 构造、参数验证

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

