# 星枢沙盒 v2.0 — 三支柱架构与重构路线图 (The Trinity Architecture & Roadmap)

本文档详细描述了 Nexus Playground 的下一代架构设计及其渐进式迁移路线图。

> **核心目标**：将系统从单体 Docker 容器迁移至 **Serverless 三支柱架构**，实现无限水平扩展、零运维成本与版本原子性发布。

---

## 🏛️ 第一部分：三支柱架构 v2.0 (The Trinity Architecture)

整个系统由三个物理隔离但逻辑紧密耦合的部分组成：

| 支柱 | 载体 | 职责 |
|:---|:---|:---|
| **A. 前台 (Interface)** | **Vercel** (Next.js) | **壳**：负责渲染大厅、登录、加载动态组件。 |
| **B. 主机 (Host)** | **Cloudflare** (Worker + DO) | **核**：负责连接维持、房间管理、状态存储、路由分发。 |
| **C. 卡带 (Cartridges)** | **Cloudflare** (Independent Workers) | **肉**：每个游戏一个独立 Worker，同时提供 **逻辑计算** 和 **UI 资源**。 |

### A. 星枢前台 (The Interface)

**部署**：Vercel
**定位**：哑终端 (Dumb Client)

用户访问 `nexus.com` 时，加载的是一个仅包含基础框架的 "空壳"。

**核心流程**：
1. **连接主机**：`ws.connect('wss://host.nexus.com/room/{roomId}')`
2. **接收指令**：收到 Host 消息 `INIT_GAME { gameId: 'gomoku', bundleUrl: 'https://gomoku.nexus.com/ui.mjs' }`。
3. **动态加载**：
   ```javascript
   // 浏览器端直接从卡带 Worker 加载 UI
   const { GameUI } = await import(msg.bundleUrl);
   render(<GameUI state={msg.state} />);
   ```
4. **交互**：用户操作 -> 生成 Action -> WS 发送给 Host。

### B. 星枢主机 (The Host)

**部署**：Cloudflare Worker + Durable Objects
**定位**：操作系统 (OS)

Host 不包含任何具体游戏的逻辑，它只负责调度。

**核心组件 (RoomDO)**：
- **WebSocket Server**：维持房间内 100+ 人的长连接。
- **State Storage**：持久化存储 `gamestate` (JSON)。
- **Dispatcher**：
  当收到 Action 时，Host 查找 `gameId` 对应的 **Service Binding**，发起 RPC 调用。

```typescript
// Host Worker 代码片段
async applyAction(action) {
  // 1. 找到卡带 (通过 Service Bindings)
  const cartridge = this.env.GOMOKU_SERVICE; 
  
  // 2. 调用卡带的纯函数 (RPC)
  const res = await cartridge.fetch('http://rpc/apply', {
    method: 'POST',
    body: JSON.stringify({ state: this.state, action })
  });
  
  // 3. 更新并广播
  this.state = await res.json();
  this.broadcast(this.state);
}
```

### C. 智能卡带 (Smart Cartridges)

**部署**：独立的 Cloudflare Worker (e.g., `nexus-cartridge-gomoku`)
**定位**：自包含微服务 (Self-contained Microservice)

每个卡带都是一个完整的游戏包。它对外暴露两个接口：

#### 接口 1: 逻辑计算 (RPC)
供 **Host** 内部调用。
- `POST /rpc/calculate`
- `POST /rpc/apply-action`
- `POST /rpc/get-initial-state`

#### 接口 2: 静态资源 (HTTP)
供 **Interface (浏览器)** 直接访问。
- `GET /ui.mjs` (返回 React 组件的 JS Bundle)
- `GET /assets/piece.png` (返回图片)

**实现方式**：
在构建 Cloudflare Worker 时，将前端构建产物 (`dist/ui.mjs`) 作为 **静态资产 (Worker Sites / Assets)** 包含在内，或者内联在 Worker 代码中。

### 架构优势

1. **原子化发布**：更新游戏逻辑的同时更新 UI，版本永远一致。
2. **极致性能**：Host -> Cartridge 走 Cloudflare 内部光纤 RPC (Zero Latency)。
3. **无限扩展**：新增游戏只需发布新 Worker 并绑定，无需重启 Host。

---

## 📅 第二部分：重构路线图 (The Roadmap)

> **原则**：渐进式迁移 (Incremental Migration)，每一步都必须保持系统可运行，对外功能零感知。

### 阶段一：前端独立部署 (Frontend Decoupling)

**目标**：将 `frontend` 部署到 Vercel，剥离对 Docker Nginx 的依赖。

- [ ] **环境变量适配**：创建 `.env.production.local` 适配 Vercel。
- [ ] **跨域配置 (CORS)**：修改后端插件，允许 Vercel 域名跨域与 Credentials。
- [ ] **部署验证**：确保 Vercel 前端能连接 Docker 后端 WebSocket。

### 阶段二：逻辑卡带抽离 (Cartridge Extraction)

**目标**：将 `games/` 目录下的游戏重构为独立的 npm 包，彻底与 `backend` 解耦。

- [ ] **Monorepo 重组**：引入 `pnpm-workspace`，将 `games/gomoku` 转化为 `@nexus-games/gomoku` 包。
- [ ] **统一构建标准**：
  - Output A: `dist/logic.js` (纯 JS)
  - Output B: `dist/ui.mjs` (React 组件)
- [ ] **后端改造**：`registry.ts` 改为从 `node_modules` 导入逻辑，不再依赖源码目录。

### 阶段三：主机迁移 (Host Migration)

**目标**：用 Cloudflare Workers + Durable Objects 替换 Docker 中的 `backend`。

- [ ] **新建 Host 项目**：基于 Hono 框架初始化 Worker。
- [ ] **移植核心运行时**：
  - `ActionProcessor` -> `RoomDO`
  - Redis Storage -> DO Internal Storage
  - SSE -> Native WebSockets
- [ ] **数据迁移**：PostgreSQL -> Cloudflare D1 (SQLite)。
- [ ] **验证**：本地 `wrangler dev` 启动 Host，对接 Vercel 前端。

### 阶段四：智能卡带实现 (Smart Cartridges)

**目标**：将游戏逻辑部署为独立 Worker，实现完全体 Trinity。

- [ ] **游戏 Worker 化**：为每个游戏创建 `wrangler.toml`。
- [ ] **实现双接口**：
  - `fetch` 处理 `/rpc/*` (逻辑)
  - `fetch` 处理 `/ui.mjs` (静态资源)
- [ ] **Host 集成**：配置 Service Bindings 连接 Host 与 Cartridge。
- [ ] **前端重构**：动态导入 URL 改为 `https://xyz.workers.dev/ui.mjs`。

---

## ✅ 最终形态架构图

```mermaid
graph TD
    User((User)) -->|1. HTTPS| Interface[Interface (Vercel)]
    User -->|2. WSS| Host[Host (CF Worker + DO)]
    
    Host -->|3. RPC| Cartridge[Smart Cartridge (Worker)]
    User -.->|4. Import UI| Cartridge
```
