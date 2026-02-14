# 星枢引擎 (Nexus Engine) 方案设计 v1.0

## 1. 概述 (Overview)

**星枢引擎 (Nexus Engine)** 是 Nexus Playground 的核心游戏执行环境。它是一个**通用的、无状态的、基于 Cloudflare Durable Objects 的状态容器**。

其核心职责是将**通用的游戏逻辑**（作为外部 HTTP 服务存在）与**具体的用户会话**（WebSocket）解耦。引擎本身不包含任何特定游戏的规则，而是通过 **WebHook / HTTP RPC** 的方式调用外部的 **Game Worker** 来驱动游戏进程。

## 2. 核心架构 (Architecture)

### 2.1 组件试图

```mermaid
graph TD
    User[(用户/前端)]
    
    subgraph "Cloudflare Edge"
        Engine[Nexus Engine (Worker + DO)]
        GameWorker[Game Worker (Gomoku, etc.)]
    end
    
    subgraph "Business Backend"
        Platform[Nexus Platform (User/Room Mgmt)]
    end

    %% 连接流
    User <-->|WebSocket (Direct)| Engine
    Engine <-->|HTTP Post (RPC)| GameWorker
    
    %% 控制流
    User -->|HTTP (Login/Join)| Platform
    Platform -->|HTTP (Create)| Engine
```

### 2.2 关键变更点

与原设计相比，本方案做了以下简化以适应现有架构：
1.  **调用方式**: 暂时不使用 Service Bindings，而是直接使用 **HTTP URL** 调用 Game Worker。这使得 Game Worker 可以部署在任何地方（CF Workers, Vercel, 甚至本地），只要公网可达。
2.  **直连模式**: 前端跳过业务后端，直接 WebSocket 连接 DO，极大降低延迟。

## 3. 详细设计

### 3.1 引擎接口 (Engine Interface)

Engine Worker 暴露两类接口：

#### A. 管理接口 (Admin API)
供业务后端调用，用于创建/管理游戏容器。需要携带 `Authorization: Bearer <ADMIN_SECRET>`。

*   `POST /api/engine/create`
    *   **功能**: 创建一个新的游戏 DO 实例。
    *   **Body**:
        ```json
        {
          "gameWorkerUrl": "https://gomoku.nexus.com",
          "config": { "maxPlayers": 2, "turnTimeout": 30 },
          "context": { "ownerId": "user_123" } // 初始上下文
        }
        ```
    *   **Response**:
        ```json
        {
          "roomId": "room-uuid-123", // DO ID
          "connectUrl": "wss://engine.nexus.com/connect/room-uuid-123"
        }
        ```

#### B. 连接接口 (Connection API)
供前端调用，用于建立 WebSocket 连接。

*   `GET /connect/:roomId`
    *   **Protocol**: WebSocket
    *   **Query**: `?token=<JWT>` (由业务后端签发的 Capability Token)

### 3.2 游戏协议 (Game Worker Protocol)

Game Worker 必须实现以下标准的 HTTP 接口 (RESTful)。Engine 会将当前的 `GameState` 和 `Action` 序列化后 POST 给 Game Worker。

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/metadata` | 获取游戏元数据（名称、版本、最大人数等） |
| `POST` | `/init` | 初始化游戏状态。Input: `config`; Output: `initialState` |
| `POST` | `/act` | 执行动作。Input: `{ state, action }`; Output: `newState` |
| `POST` | `/legal-actions` | (可选) 获取合法动作列表。 |
| `POST` | `/check-terminal` | 检查游戏是否结束。 |
| `POST` | `/perspective` | 生成特定角色的视角数据（用于不完美信息游戏）。 |

**约定**:
*   Engine **完全信任** Game Worker 返回的新状态。
*   Engine 负责持久化存储 `state` (在 DO Storage 中)。
*   Game Worker 应该是**无状态**的纯函数。

### 3.3 鉴权与安全 (Auth & Security)

为了实现直连且安全，采用 **Capability Token (JWT)** 机制。

1.  **Token 签发**: 
    *   用户在平台端（Platform）请求加入房间。
    *   平台验证用户权限后，用**平台私钥**签发一个 JWT。
    *   Payload: `{ roomId: "abc", userId: "u1", role: "black", exp: 1710000000 }`。
2.  **Token 验证**:
    *   用户携带 JWT 连接 Engine WebSocket。
    *   Engine 使用预置的**平台公钥**验签。
    *   验证通过后，Engine 将 WebSocket 连接标记为该 `userId` 和 `role`。
    *   **注意**: Engine 只有公钥，无法伪造 Token。

### 3.4 状态流转 (State Flow)

1.  **Action**: 用户通过 WS 发送 `{"type": "ACT", "payload": "..."}`。
2.  **Verify**: Engine 检查 `Turn` 是否轮到该用户的 `role`（简单的轮次控制可在 Engine 做，复杂的在 Game Worker）。
3.  **RPC**: Engine 发起 `POST <GameWorkerUrl>/act`，带上 `{ state: currentState, action: payload }`。
4.  **Update**: 收到 `newState`，更新 DO Storage。
5.  **Broadcast**: 
    *   Engine 发起 `POST <GameWorkerUrl>/perspective` (并发) 为每个在线用户计算视角。
    *   或者对于完美信息游戏，直接广播 `newState`。

## 4. 实施路线图 (Implementation Roadmap)

1.  **Phase 1: 引擎脚手架 (Scaffolding)**
    *   建立 `nexus-engine` Cloudflare Worker 项目。
    *   实现 Hono + Durable Object 基础结构。
    *   实现 JWT 验签中间件。

2.  **Phase 2: 对接流程 (Integration)**
    *   实现 DO 的 `fetch` 逻辑，对接已有的 Gomoku Worker。
    *   跑通 "Init -> Action -> Update" 循环。

3.  **Phase 3: 客户端联调 (Client)**
    *   前端修改，支持直接连接 Engine WS。
    *   业务后端新增 "获取 Engine Token" 接口。

## 5. 优势总结

*   **解耦**: 游戏逻辑更新无需重启引擎，引擎更新不影响游戏逻辑。
*   **灵活性**: Game Worker 可以是任何语言编写的 HTTP 服务 (Python/FastAPI, Go/Gin, Node/Express)，甚至通过 ngrok 暴露的本地服务（极大方便调试）。
*   **性能**: 用户 -> Edge DO 的延迟极低。
