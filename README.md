# Nexus Playground - LLM原生游戏平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)

> 一个具有高度可扩展性的 LLM 原生在线游戏平台，让 AI 和人类玩家能够无缝协作，参与各类游戏。

## 📖 项目愿景

Nexus Playground 旨在构建一个生态系统，让开发者能够快速、低成本地将新游戏规则转化为可供人类与 AI 共同参与的在线游戏。通过将大型语言模型（LLM）作为原生参与者深度集成到游戏逻辑中，创造前所未有的动态、智能和拟人化的游戏体验。

## 🎯 核心设计原则

### 1. 快速开发 (Rapid Development)
开发者在理解一个新游戏的规则后，能迅速将其转化为平台上可运行的游戏项目，而无需关心底层通用服务的复杂性。

### 2. LLM原生适配性 (LLM-Native Adaptability)
LLM 能无缝地理解任何接入平台的游戏规则，并作为任何角色（玩家、NPC）参与其中，优雅地处理完美信息和不完美信息游戏。

### 3. 可复现与可介入性 (Reproducibility & Intervenability)
平台原生支持从任意一个有效的游戏局面启动一局游戏，并允许玩家（人类或 LLM）在游戏过程中的任意时刻无缝接管或切换角色。

## 🏗️ 核心架构

### USADL 体系 (Universal State and Action Description Language)

平台架构的核心是 USADL 统一描述体系，由三个核心数据实体驱动：

#### 1. **全局状态 (Global State)**
- 游戏在服务器端的唯一真实数据源（"上帝视角"）
- 包含游戏的所有权威信息
- 由平台后端的游戏状态管理器维护
- 永远不会直接发送给任何玩家

```json
{
  "game_rules": "游戏规则的自然语言描述",
  "history": ["历史行动日志"],
  "current_state": {
    "棋盘状态": "...",
    "玩家状态": "..."
  }
}
```

#### 2. **角色视角 (Role Perspective)**
- 根据全局状态为特定角色生成的"客户端视图"
- 只包含该角色应该知道的信息
- 平台与玩家（人类/LLM）之间通信的核心协议

```json
{
  "global_rules": "游戏规则描述",
  "whole_history": ["完整历史"],
  "diff_history": ["差异历史"],
  "current_state": {"角色视角下的游戏状态"},
  "your_role": {"角色身份和目标"},
  "action_space_definition": {"可执行动作定义"}
}
```

#### 3. **角色映射 (Role Mapping)**
- 定义游戏内每个逻辑角色由谁扮演
- 支持人类玩家和 LLM 玩家的动态绑定
- 实现人机协作、动态难度和无缝切换的关键

```json
{
  "role_mapping": {
    "player_1": { "type": "human", "uid": "user_12345" },
    "player_2": {
      "type": "llm",
      "model_name": "gemini-pro",
      "system_prompt": "你是一个谨慎的玩家..."
    }
  }
}
```

### 游戏核心流程

```
1. 游戏实例化 (全局状态 + 角色映射)
   ↓
2. 进入回合/阶段 (确定当前行动角色)
   ↓
3. 生成视角 (为当前角色生成专属视角)
   ↓
4. 路由与决策 (查询角色映射，确定扮演者)
   ↓
5. 提交行动 (玩家提交行动 JSON)
   ↓
6. 验证与执行 (验证合法性，更新全局状态)
   ↓
7. 广播更新 (为所有玩家重新生成最新视角)
   ↓
8. 检查结束条件 (判断游戏是否结束)
```

## 📁 项目结构

```
nexus-playground/
├── portal/                     # 游戏门户入口（主应用）
│   ├── src/
│   │   ├── pages/
│   │   │   ├── home/          # 首页
│   │   │   ├── lobby/         # 游戏大厅
│   │   │   └── game-list/     # 游戏列表
│   │   ├── components/        # 共享组件
│   │   └── layouts/           # 布局组件
│   ├── Dockerfile
│   └── nginx.conf
│
├── core-framework/              # 主框架
│   ├── packages/
│   │   ├── game-sdk/           # 游戏开发套件
│   │   │   ├── state-manager/  # 统一状态管理器
│   │   │   ├── event-bus/      # 事件总线
│   │   │   ├── game-loop/      # 游戏循环模板
│   │   │   └── types/          # 核心类型定义
│   │   ├── platform-core/      # 平台核心服务
│   │   │   ├── auth/           # 用户认证（基于 oauth-sdk）
│   │   │   ├── matchmaking/    # 匹配系统
│   │   │   ├── room/           # 房间管理
│   │   │   ├── llm-adapter/    # LLM 适配器（基于 llmapi-sdk）
│   │   │   └── storage/        # 数据存储
│   │   └── shared-types/       # 共享类型定义
│   ├── api-server/             # API 服务器
│   ├── websocket-server/       # WebSocket 服务器
│   └── web-client/             # 通用 Web 客户端框架
│
├── games/                      # 游戏子项目
│   ├── tic-tac-toe/           # 示例：井字棋
│   ├── card-battle/           # 示例：暗牌对战
│   └── go/                    # 示例：围棋
│
├── oauth-example-app/          # OAuth 和 LLM API 使用示例
│
├── docker-compose.yml          # Docker Compose 配置
├── nginx.conf                  # 主 Nginx 配置（路由分发）
├── design.md                   # 详细设计文档
└── README.md                   # 本文件
```

## 🌐 统一门户架构

### 整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    nexus.example.com                        │
│                    (Nginx 反向代理)                          │
└─────────────────────────────────────────────────────────────┘
              │
              ├─── /                  → 游戏门户 (Portal)
              ├─── /lobby             → 游戏大厅
              ├─── /api/*             → API 服务器
              ├─── /ws                → WebSocket 服务器
              ├─── /games/tic-tac-toe → 井字棋应用
              ├─── /games/card-battle → 暗牌对战应用
              └─── /games/go          → 围棋应用
                     │
                     ├─ 共享登录状态（localStorage，由 oauth-sdk 管理）
                     ├─ 共享后端 API & WebSocket
                     └─ 可选：Redis Session（用于 WebSocket 等场景）
```

### 域名与路由设计

平台采用统一域名架构，通过 Nginx 反向代理实现路由分发：

```
nexus.example.com/                    → 游戏门户（首页、游戏列表）
nexus.example.com/lobby               → 游戏大厅
nexus.example.com/profile             → 用户资料
nexus.example.com/games/tic-tac-toe   → 井字棋游戏
nexus.example.com/games/card-battle   → 暗牌对战游戏
nexus.example.com/games/go            → 围棋游戏
nexus.example.com/api/*               → 后端 API
nexus.example.com/ws                  → WebSocket 连接
```

### 登录状态共享（基于 @autolabz/oauth-sdk）

**重要说明**：`@autolabz/oauth-sdk` 已经完整实现了登录状态管理，**无需手动实现 Session/Cookie 共享**！

#### SDK 自动管理的功能

所有应用（门户 + 子游戏）通过 `@autolabz/oauth-sdk` 自动共享登录状态：

1. **状态持久化到 localStorage**：
   - `access_token` → `autolab_oauth_access_token`
   - `refresh_token` → `autolab_oauth_refresh_token`
   - 用户信息 (`user`) → `autolab_oauth_state`

2. **同源策略自动共享**：
   - 所有应用部署在同一域名的不同路径下（如 `/`, `/games/tic-tac-toe`）
   - 根据浏览器同源策略，它们**共享同一个 `localStorage`**
   - 用户在任意应用登录，其他应用自动获得登录状态

3. **自动 Token 刷新**：
   - `OAuthAPIClient` 在 401 响应时自动刷新 token
   - 无需手动处理 token 过期

4. **跨标签页同步**：
   - 监听 `storage` 事件
   - 在一个标签页登录/登出，其他标签页实时同步

#### 前端集成示例

所有应用（Portal、Game 1、Game 2...）使用相同配置：

```tsx
// App.tsx - 每个应用的根组件
import { OAuthProvider, useOAuth, AuthAvatar } from '@autolabz/oauth-sdk';

function App() {
  return (
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}  
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <MainApp />
    </OAuthProvider>
  );
}

function MainApp() {
  const { isAuthenticated, user } = useOAuth();
  
  return (
    <div>
      {/* 自动登录/登出的头像组件 */}
      <AuthAvatar
        redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
        scope="openid profile email llmapi"
        profileUrl="/profile"
      />
      
      {isAuthenticated && <p>欢迎，{user?.nickname}</p>}
    </div>
  );
}
```

#### 登录状态共享原理

```
https://nexus.example.com/               ┐
https://nexus.example.com/lobby          │
https://nexus.example.com/games/xxx     ├─ 同源，共享 localStorage
https://nexus.example.com/profile        │
https://nexus.example.com/api/*          ┘
```

**用户体验**：
- ✅ 在门户登录 → 访问任意子游戏自动保持登录
- ✅ 在子游戏登出 → 返回门户自动退出
- ✅ 在一个标签页登录 → 其他标签页实时同步

#### 后端 Session 配置（可选）

**对于纯前端应用，oauth-sdk 的 localStorage 机制已经足够！**

如果需要后端 Session 支持（如 WebSocket 连接、服务端渲染等场景），可配置 Redis Session Store：

```typescript
// API Server - 用于 WebSocket/长连接场景
app.use(session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'nexus:session:'
  }),
  secret: process.env.SESSION_SECRET,
  cookie: {
    domain: '.nexus.example.com',  // 跨子域名共享（如有需要）
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
```

### Nginx 路由配置

```nginx
# 主 Nginx 配置结构
upstream portal {
    server portal:3000;
}

upstream api_server {
    server api-server:4000;
}

upstream game_tic_tac_toe {
    server game-tic-tac-toe:3001;
}

server {
    listen 80;
    server_name nexus.example.com;

    # 游戏门户（根路径）
    location / {
        proxy_pass http://portal;
    }

    # API 服务
    location /api/ {
        proxy_pass http://api_server;
    }

    # WebSocket 服务
    location /ws {
        proxy_pass http://api_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 子游戏路由
    location /games/tic-tac-toe/ {
        proxy_pass http://game_tic_tac_toe/;
    }

    location /games/card-battle/ {
        proxy_pass http://game_card_battle/;
    }

    location /games/go/ {
        proxy_pass http://game_go/;
    }
}
```

### 游戏门户功能

门户应用是用户的主入口，提供：

1. **首页**: 平台介绍、特色游戏展示
2. **游戏列表**: 展示所有可用游戏，支持搜索和筛选
3. **游戏大厅**: 在线房间列表、匹配队列(未来实现)

### 应用间导航

```typescript
// 从门户跳转到游戏
<Link to="/games/tic-tac-toe/room/abc123">
  进入井字棋房间
</Link>

// 从游戏返回门户
<Link to="/lobby">
  返回大厅
</Link>

// 登录状态自动同步，无需重新登录
```

## 🛠️ 技术栈

### 后端
- **运行时**: Node.js 20+
- **语言**: TypeScript 5.0+
- **框架**: Express.js / Fastify
- **WebSocket**: Socket.IO
- **数据库**: PostgreSQL / MongoDB
- **缓存**: Redis（可选，用于数据缓存和 WebSocket Session）
- **认证**: autolabsdk/oauth-sdk
- **LLM 集成**: autolabsdk/llmapi-sdk

### 前端
- **框架**: React 18+ / Vue 3+
- **构建工具**: Vite
- **状态管理**: Zustand / Pinia
- **UI 库**: TailwindCSS + shadcn/ui
- **实时通信**: Socket.IO Client

### 部署
- **容器化**: Docker & Docker Compose
- **反向代理**: Nginx（统一路由分发）
- **构建方式**: 多阶段构建（与 oauth-example-app 一致）
  - Stage 1: Node.js builder（pnpm/npm 构建）
  - Stage 2: Nginx alpine（静态资源服务）
- **CI/CD**: GitHub Actions

## 🔐 OAuth SDK 集成说明

### OAuth SDK 核心功能

`@autolabz/oauth-sdk` 提供了完整的 OAuth 2.0 + PKCE 登录解决方案，**无需手动管理登录状态**。

#### 已实现的功能

✅ **登录状态管理**：
- 自动持久化 `access_token`、`refresh_token` 和用户信息到 `localStorage`
- 应用启动时自动验证并恢复登录状态
- Token 过期时自动刷新

✅ **跨应用共享**：
- 基于同源策略，所有子路径应用自动共享 `localStorage`
- 在任意应用登录，其他应用自动同步
- 跨标签页实时状态同步（通过 `storage` 事件）

✅ **自动 Token 管理**：
- `OAuthAPIClient` 自动在请求中注入 `Authorization` header
- 401 响应时自动刷新 token 并重试
- 登出时自动撤销 token

✅ **开箱即用的 UI 组件**：
- `AuthAvatar`：头像组件（未登录时自动触发登录）
- `OAuthLoginButton`：登录按钮
- `useOAuth` Hook：访问登录状态和用户信息

### 快速集成

#### 1. 安装依赖

```bash
npm install @autolabz/oauth-sdk
```

#### 2. 配置环境变量

```bash
# .env
VITE_AUTH_API_BASE_URL=http://nexus.example.com/api
VITE_OAUTH_CLIENT_ID=your_client_id
VITE_OAUTH_REDIRECT_URI=http://nexus.example.com/callback
VITE_OAUTH_PROFILE_URL=http://nexus.example.com/profile
```

#### 3. 在应用根组件使用 OAuthProvider

```tsx
// App.tsx - 所有应用（Portal、各子游戏）都使用相同配置
import { OAuthProvider } from '@autolabz/oauth-sdk';

function App() {
  return (
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <YourApp />
    </OAuthProvider>
  );
}
```

#### 4. 使用 UI 组件或 Hook

```tsx
import { AuthAvatar, useOAuth } from '@autolabz/oauth-sdk';

function Header() {
  return (
    <AuthAvatar
      redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
      scope="openid profile email"
      profileUrl="/profile"
    />
  );
}

function UserGreeting() {
  const { isAuthenticated, user } = useOAuth();
  
  if (!isAuthenticated) return null;
  return <p>欢迎，{user?.nickname || user?.email}</p>;
}
```

#### 5. 处理 OAuth 回调

```tsx
// CallbackPage.tsx
import { useEffect } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import { useNavigate } from 'react-router-dom';

function CallbackPage() {
  const { handleRedirect } = useOAuth();
  const navigate = useNavigate();

  useEffect(() => {
    handleRedirect({
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      fetchUserinfo: true
    })
      .then(() => navigate('/'))
      .catch(err => console.error('登录失败:', err));
  }, [handleRedirect, navigate]);

  return <div>正在登录...</div>;
}
```

### localStorage 存储结构

SDK 自动管理以下数据：

```javascript
// localStorage keys
localStorage.getItem('autolab_oauth_access_token')   // Access Token
localStorage.getItem('autolab_oauth_refresh_token')  // Refresh Token
localStorage.getItem('autolab_oauth_state')          // { isAuthenticated, user }
```

**同源共享示例**：

```
https://nexus.example.com/               ┐
https://nexus.example.com/games/chess    ├─ 共享同一个 localStorage
https://nexus.example.com/profile        ┘
```

### 登录流程图

```
1. 用户点击登录按钮（任意应用）
   ↓
2. SDK 生成 PKCE verifier/challenge
   ↓
3. 跳转到 OAuth 授权端点
   ↓
4. 用户同意授权
   ↓
5. 回调到 redirect_uri
   ↓
6. SDK 使用 code + verifier 交换 token
   ↓
7. SDK 获取 userinfo 并存储到 localStorage
   ↓
8. 所有应用自动获得登录状态（同源策略）
```

### 注意事项

⚠️ **安全提示**：
- `refresh_token` 存储在 `localStorage`，存在 XSS 风险
- 生产环境建议配合 CSP（Content Security Policy）和其他安全措施
- 未来版本可能迁移到 httpOnly Cookie 方案

⚠️ **部署要求**：
- 所有应用必须部署在**同一域名**的不同路径下（如 `/`, `/games/*`）
- 如果使用子域名（如 `game1.nexus.com`），需要使用后端 Session 方案

## 🚀 开发路线图

### Phase 1: 核心框架开发 ✅ **已完成！**

#### 1.1 基础设施 ✅
- [x] 项目初始化与 monorepo 配置
- [x] Docker & Docker Compose 设置
- [x] Nginx 反向代理配置（统一域名路由）
- [x] 用户认证系统（基于 oauth-sdk，自动管理登录状态）
- [x] Redis 配置（可选，用于缓存和 WebSocket Session）
- [x] 数据库架构设计

#### 1.2 游戏门户开发 ✅
- [x] 门户应用架构搭建
- [x] 首页与游戏列表页面
- [x] 用户登录/注册界面
- [x] 游戏大厅（房间列表）
- [x] 用户中心（个人资料、游戏历史）
- [x] 统一导航与布局组件
- [x] 与各子游戏的路由集成

#### 1.3 Game SDK 开发 ✅
- [x] 核心类型定义（Global State, Role Perspective, Role Mapping）
- [x] 统一状态管理器
- [x] 事件总线系统
- [x] 游戏循环模板
- [x] 视角生成器 (Perspective Generator)
- [x] 行动验证器 (Action Validator)

#### 1.4 平台核心服务 ✅
- [x] 房间管理系统
- [x] 匹配系统
- [x] LLM 适配器（基于 llmapi-sdk）
- [x] WebSocket 实时通信
- [x] 游戏状态持久化

#### 1.5 通用客户端框架 ✅
- [x] React 组件库
- [x] 游戏渲染引擎
- [x] 实时状态同步
- [x] 行动提交接口

### Phase 2: 示例游戏开发 (部分完成)

#### 2.1 井字棋 (Tic-Tac-Toe) ✅
- [x] 游戏逻辑实现
- [x] UI 界面

#### 2.2 暗牌对战 (Card Battle) 🔜
- [ ] 不完美信息处理
- [ ] 游戏逻辑实现
- [ ] UI 界面
- [ ] 多种 AI 难度

#### 2.3 围棋 (Go) 🔜
- [ ] 巨大行动空间处理（模板模式）
- [ ] 游戏逻辑实现
- [ ] UI 界面
- [ ] AI 对手集成

### Phase 3: 高级功能 🔜

- [ ] 游戏回放系统
- [ ] 从任意局面启动游戏
- [ ] 中途切换玩家/AI
- [ ] 观战模式
- [ ] 游戏分析与统计
- [ ] 社交功能（聊天、好友）

### Phase 4: 生态系统 🔜

- [ ] 游戏市场
- [ ] 开发者文档与教程
- [ ] SDK 插件系统
- [ ] 社区贡献指南
- [ ] 示例游戏模板

## 🎮 快速开始

### 前置要求

- Docker & Docker Compose 2.0+
- Node.js 20+ (仅开发模式需要)
- pnpm 8+ (仅开发模式需要)

### 🚢 生产环境部署（推荐）

使用 Docker Compose 一键部署所有服务：

```bash
# 1. 克隆仓库
git clone <repository-url>
cd nexus-playground

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置（OAuth、数据库密码等）

# 3. 启动所有服务
docker-compose up -d --build

# 4. 检查服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

#### 访问应用

- **🏠 游戏门户（主入口）**: http://localhost
- **🎯 游戏大厅**: http://localhost/lobby
- **🎲 井字棋**: http://localhost/games/tic-tac-toe
- **📡 API服务**: http://localhost/api
- **💓 健康检查**: http://localhost/health

#### 运行测试

```bash
chmod +x scripts/test-e2e.sh
./scripts/test-e2e.sh
```

### 🛠️ 本地开发模式

```bash
# 1. 安装依赖
pnpm install

# 2. 构建核心包
pnpm build

# 3. 启动基础服务（PostgreSQL, Redis）
docker-compose up -d postgres redis

# 4. 启动API Server（终端1）
cd core-framework/api-server
pnpm dev

# 5. 启动门户（终端2）
cd portal
pnpm dev

# 6. 启动井字棋（终端3）
cd games/tic-tac-toe/ui
pnpm dev
```

本地开发访问地址：
- Portal: http://localhost:3000
- Tic-Tac-Toe: http://localhost:3001
- API Server: http://localhost:4000

### 📚 详细文档

- **快速开始**: [docs/QUICK_START.md](docs/QUICK_START.md)
- **API文档**: [docs/API.md](docs/API.md)
- **游戏开发指南**: [docs/GAME_DEVELOPMENT.md](docs/GAME_DEVELOPMENT.md)
- **架构设计**: [design.md](design.md)
- **项目状态**: [PROJECT_STATUS.md](PROJECT_STATUS.md)

## 🏗️ 部署架构详解

### Docker 多阶段构建

所有前端应用（门户和子游戏）采用与 oauth-example-app 一致的构建方式：

```dockerfile
# Stage 1: 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm ci

# 复制源代码并构建
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Stage 2: 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose 配置结构

```yaml
version: '3.8'

services:
  # 主反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - portal
      - api-server
      - game-tic-tac-toe

  # 游戏门户
  portal:
    build:
      context: .
      dockerfile: portal/Dockerfile
    environment:
      - VITE_API_BASE_URL=/api
      - VITE_WS_URL=/ws

  # API 服务器
  api-server:
    build:
      context: .
      dockerfile: core-framework/api-server/Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/nexus
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # 子游戏服务
  game-tic-tac-toe:
    build:
      context: .
      dockerfile: games/tic-tac-toe/Dockerfile

  # 数据库
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=nexus
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis（缓存和 WebSocket Session，可选）
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 环境变量配置

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:password@postgres:5432/nexus

# Redis 配置
REDIS_URL=redis://redis:6379

# OAuth 配置（autolabsdk/oauth-sdk）
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=http://localhost/auth/callback

# LLM API 配置（autolabsdk/llmapi-sdk）
LLMAPI_BASE_URL=https://api.example.com/llm
LLMAPI_API_KEY=your_api_key

# Session 密钥
SESSION_SECRET=your_session_secret

# JWT 密钥
JWT_SECRET=your_jwt_secret

# Cookie Domain（用于跨子路径共享登录状态）
COOKIE_DOMAIN=.localhost
```

## 📝 如何创建新游戏

### 1. 使用 CLI 创建游戏模板

```bash
pnpm create-game my-awesome-game
```

### 2. 定义游戏规则

```typescript
// games/my-awesome-game/rules.ts
export const gameRules = {
  name: "My Awesome Game",
  description: "游戏规则描述...",
  minPlayers: 2,
  maxPlayers: 4,
  // ...
};
```

### 3. 实现游戏逻辑

```typescript
// games/my-awesome-game/game.ts
import { GameSDK } from '@nexus/game-sdk';

export class MyAwesomeGame extends GameSDK {
  onGameStart() {
    // 游戏开始时的逻辑
  }
  
  onTurnStart(roleId: string) {
    // 回合开始时的逻辑
  }
  
  handleAction(action: Action) {
    // 处理玩家行动
  }
  
  generatePerspective(roleId: string): RolePerspective {
    // 生成角色视角
  }
  
  checkWinCondition(): GameResult | null {
    // 检查胜利条件
  }
}
```

### 4. 创建 UI 界面

```typescript
// games/my-awesome-game/ui/GameBoard.tsx
import { useGameState } from '@nexus/web-client';

export function GameBoard() {
  const { state, submitAction } = useGameState();
  
  return (
    <div>
      {/* 你的游戏界面 */}
    </div>
  );
}
```

### 5. 注册游戏

```typescript
// games/my-awesome-game/index.ts
import { registerGame } from '@nexus/platform-core';
import { MyAwesomeGame } from './game';

registerGame({
  id: 'my-awesome-game',
  name: 'My Awesome Game',
  description: '一个精彩的游戏',
  thumbnail: '/assets/my-awesome-game-thumb.jpg',
  minPlayers: 2,
  maxPlayers: 4,
  gameClass: MyAwesomeGame,
  uiComponent: () => import('./ui/GameBoard'),
});
```

### 6. 集成到门户

注册后的游戏将自动出现在游戏门户的游戏列表中：

- **路由**: 游戏将在 `/games/my-awesome-game` 路径下可访问
- **游戏卡片**: 在门户首页和游戏列表页展示
- **房间创建**: 用户可以在大厅创建该游戏的房间
- **匹配系统**: 自动接入平台匹配系统

```typescript
// 门户会自动展示所有已注册的游戏
<GameGrid>
  {registeredGames.map(game => (
    <GameCard
      key={game.id}
      title={game.name}
      description={game.description}
      thumbnail={game.thumbnail}
      playersRange={`${game.minPlayers}-${game.maxPlayers}人`}
      onPlay={() => navigate(`/games/${game.id}`)}
    />
  ))}
</GameGrid>
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

### 贡献方式

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🎮 创建新游戏
- 🔧 改进核心框架

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关资源

- [详细设计文档](design.md)
- [API 文档](docs/api.md)
- [游戏开发指南](docs/game-development.md)
- [OAuth 示例应用](oauth-example-app/README.md)

## 📧 联系方式

- 项目主页: [GitHub Repository]
- 问题反馈: [GitHub Issues]
- 讨论区: [GitHub Discussions]

---

**让 AI 和人类一起玩耍！** 🎮🤖👨‍👩‍👧‍👦

