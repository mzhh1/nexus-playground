# SSE 认证机制详解

## 📋 问题背景

### EventSource API 的限制

浏览器原生的 `EventSource` API 用于建立 Server-Sent Events (SSE) 连接，但存在一个关键限制：

```javascript
// ❌ EventSource 不支持自定义 Headers
const eventSource = new EventSource(url);
// 无法添加 Authorization: Bearer <token>
```

这导致无法使用标准的 OAuth Bearer Token 来保护 SSE 端点。

### 不可行的替代方案

1. **使用 fetch + ReadableStream**
   - ✅ 可以携带自定义 Headers
   - ❌ 需要手动处理 SSE 协议解析（事件类型、重连逻辑）
   - ❌ 增加前端复杂度，容易出错

2. **修改 SDK 以支持 Headers**
   - ❌ `oauth-sdk` 和 `service-auth-middleware` 是通用 SDK，不应为特定场景修改
   - ❌ 破坏 SDK 的通用性和可维护性

3. **在 URL 中携带 Access Token**
   - ❌ 安全风险极高（URL 会被记录在日志、浏览器历史、Referer 等）
   - ❌ Token 有效期长（如 1 小时），泄露后影响范围大

---

## 🎯 解决方案：临时 Ticket 认证

### 核心设计

采用 **两步认证** 机制：

1. **第一步**：前端用标准 OAuth Token 换取临时 Ticket
2. **第二步**：前端用 Ticket（通过 URL 参数）建立 SSE 连接

```
┌──────────┐                           ┌──────────┐
│  前  端  │                           │  后  端  │
└──────────┘                           └──────────┘
     │                                      │
     │  POST /ticket                        │
     │  Authorization: Bearer <token>       │
     ├─────────────────────────────────────>│
     │                                      │
     │     验证 Token + 权限                 │
     │     生成 Ticket → Redis (TTL 5min)   │
     │                                      │
     │  { ticket: "xxx", expiresIn: 300 }   │
     │<─────────────────────────────────────┤
     │                                      │
     │  GET /stream?ticket=xxx              │
     ├─────────────────────────────────────>│
     │                                      │
     │     验证 Ticket (Redis)               │
     │     匹配 roomId/roleId                │
     │     建立 SSE 连接                     │
     │                                      │
     │  ← SSE Stream (实时推送) ←           │
     │<═════════════════════════════════════│
```

---

## 🔧 实现细节

### 后端实现

#### 1. Ticket 生成端点（`POST /ticket`）

**路由配置**：
```typescript
fastify.post<{
  Params: { roomId: string; roleId: string };
  Querystring: { player_id?: string };
}>('/rooms/:roomId/perspectives/:roleId/ticket', async (request, reply) => {
  const { roomId, roleId } = request.params;
  const { player_id } = request.query;
  const userId = (request as any).auth?.userId; // 从 authMiddleware 获取

  // 1️⃣ 验证用户身份（标准 Bearer Token）
  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // 2️⃣ 验证资源访问权限（房间、角色是否存在）
  const roomState = await stateManager.getRoomState(roomId);
  if (!roomState || !(roleId in roomState.role_mapping)) {
    return reply.code(404).send({ error: 'Resource not found' });
  }

  // TODO: 添加细粒度权限检查（owner/player/spectator）

  // 3️⃣ 生成临时 Ticket（256 位随机数）
  const ticket = crypto.randomBytes(32).toString('base64url');
  const ticketKey = `sse_ticket:${ticket}`;

  // 4️⃣ 存入 Redis，5 分钟 TTL
  await fastify.redis.setex(
    ticketKey,
    300,
    JSON.stringify({
      userId,
      roomId,
      roleId,
      playerId: player_id,
      createdAt: Date.now(),
    })
  );

  // 5️⃣ 返回 Ticket 和流式 URL
  return reply.send({
    ticket,
    expiresIn: 300,
    streamUrl: `/api/v1/rooms/${roomId}/perspectives/${roleId}/stream?ticket=${ticket}`,
  });
});
```

**关键点**：
- ✅ **启用** `authMiddleware`：此端点走标准鉴权流程
- ✅ 生成 256 位随机 Ticket（防止暴力猜测）
- ✅ Ticket 绑定到具体的 `userId`、`roomId`、`roleId`
- ✅ 使用 Redis TTL 自动过期（5 分钟）

---

#### 2. SSE Stream 端点（`GET /stream?ticket=xxx`）

**路由配置**：
```typescript
fastify.get<{
  Params: { roomId: string; roleId: string };
  Querystring: { player_id?: string; ticket?: string };
}>(
  '/rooms/:roomId/perspectives/:roleId/stream',
  {
    config: {
      skipAuth: true, // 🔑 关键：禁用 authMiddleware
    },
  },
  async (request, reply) => {
    const { roomId, roleId } = request.params;
    const { ticket } = request.query;

    // 1️⃣ 验证 Ticket 存在
    if (!ticket) {
      return reply.code(401).send({ error: 'Missing authentication ticket' });
    }

    // 2️⃣ 从 Redis 获取 Ticket 数据
    const ticketKey = `sse_ticket:${ticket}`;
    const ticketDataRaw = await fastify.redis.get(ticketKey);

    if (!ticketDataRaw) {
      return reply.code(401).send({ error: 'Invalid or expired ticket' });
    }

    let ticketData: {
      userId: string;
      roomId: string;
      roleId: string;
      playerId?: string;
      createdAt: number;
    };

    try {
      ticketData = JSON.parse(ticketDataRaw);
    } catch (error) {
      return reply.code(500).send({ error: 'Invalid ticket format' });
    }

    // 3️⃣ 验证 Ticket 匹配请求的资源
    if (ticketData.roomId !== roomId || ticketData.roleId !== roleId) {
      return reply.code(403).send({ error: 'Ticket does not match resource' });
    }

    // 4️⃣ 建立 SSE 连接（原有逻辑）
    const clientId = eventBus.registerClient(
      reply,
      roomId,
      roleId,
      player_id,
      ticketData.userId // 传递 userId 用于审计
    );

    // 发送初始视角并保持连接
    const perspective = await perspectiveGenerator.generatePerspective(roomId, roleId);
    if (perspective) {
      eventBus.sendEvent(clientId, 'perspective', perspective);
    }

    // 注意：不删除 Ticket，允许在 TTL 内重连（支持页面刷新）
  }
);
```

**关键点**：
- ✅ **禁用** `authMiddleware`：不走标准 Bearer Token 验证
- ✅ 通过 Redis 验证 Ticket 的有效性和匹配性
- ✅ 提取 `userId` 用于审计日志
- ✅ 保留 Ticket（不立即删除），支持断线重连

---

### 前端实现

#### Hook: `usePerspective.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';

export function usePerspective(
  roomId: string | null,
  roleId: string | null,
  playerId?: string
) {
  const [perspective, setPerspective] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useOAuth();

  const eventSourceRef = useRef<EventSource | null>(null);
  const ticketRef = useRef<string | null>(null);
  const ticketExpiryRef = useRef<number | null>(null);

  // 🎫 步骤 1: 获取 Ticket
  const getTicket = async (): Promise<string | null> => {
    if (!roomId || !roleId) return null;

    try {
      const token = await auth.getAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const baseURL = import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1';
      const ticketUrl = `${baseURL}/rooms/${roomId}/perspectives/${roleId}/ticket`;

      const response = await fetch(ticketUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get ticket: ${response.status}`);
      }

      const data = await response.json();
      ticketExpiryRef.current = Date.now() + (data.expiresIn * 1000);

      return data.ticket;
    } catch (err) {
      console.error('Failed to get SSE ticket:', err);
      setError('Failed to authenticate SSE connection');
      return null;
    }
  };

  // 🔌 步骤 2: 建立 SSE 连接
  const connect = useCallback(async () => {
    if (!roomId || !roleId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setError(null);
    setConnected(false);

    try {
      // 获取 Ticket
      const ticket = await getTicket();
      if (!ticket) {
        setError('Failed to get authentication ticket');
        return;
      }

      ticketRef.current = ticket;

      // 构建 SSE URL（携带 Ticket）
      const baseURL = import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1';
      const url = new URL(
        `${baseURL}/rooms/${roomId}/perspectives/${roleId}/stream`,
        window.location.origin
      );
      url.searchParams.set('ticket', ticket);
      if (playerId) {
        url.searchParams.set('player_id', playerId);
      }

      // 建立 EventSource 连接
      const eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener('perspective', (event) => {
        const data = JSON.parse(event.data);
        setPerspective(data);
      });

      // 🔄 步骤 3: 处理错误与自动重连
      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setConnected(false);

        const now = Date.now();
        const ticketExpiry = ticketExpiryRef.current || 0;
        const ticketAge = ticketExpiry - now;

        // Ticket 即将过期（剩余不到 10 秒），获取新 Ticket 重连
        if (ticketAge < 10000) {
          console.log('Ticket expired, getting new ticket...');
          setError('Connection expired, reconnecting...');
          setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
              connect(); // 获取新 Ticket 并重连
            }
          }, 1000);
        } else {
          setError('Connection error');
          setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
              connect(); // 重试当前 Ticket（可能是网络抖动）
            }
          }, 3000);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect');
    }
  }, [roomId, roleId, playerId, auth]);

  // 🛑 断开连接
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
    ticketRef.current = null;
    ticketExpiryRef.current = null;
  }, []);

  // 自动连接与清理
  useEffect(() => {
    if (roomId && roleId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [roomId, roleId, playerId]);

  return {
    perspective,
    connected,
    error,
    connect,
    disconnect,
  };
}
```

---

## 🔒 安全性分析

### ✅ 优势

| 特性 | 说明 |
|------|------|
| **短生命周期** | Ticket 仅 5 分钟有效，大幅降低泄露风险 |
| **资源绑定** | Ticket 只能用于特定的 `roomId` + `roleId`，无法跨资源使用 |
| **高熵随机** | 256 位随机 Ticket，防止暴力猜测 |
| **审计日志** | Ticket 包含 `userId`，后端记录完整连接来源 |
| **防重放** | Ticket 由后端生成并存储，客户端无法伪造 |
| **优雅降级** | 若 Redis 故障，Ticket 验证失败，SSE 自动断开 |

### ⚠️ 潜在风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| **Ticket 被拦截** | • 强制 HTTPS 传输<br>• 短 TTL（5 分钟）<br>• 单资源绑定 |
| **URL 日志泄露** | • Ticket 短期失效，历史日志中的 Ticket 已无效<br>• 不存储 Access Token（避免长期风险） |
| **暴力枚举 Ticket** | • 256 位熵值（2^256 空间）<br>• Redis 单点查询（无批量验证入口） |
| **Redis 单点故障** | • 使用 Redis Sentinel/Cluster 高可用方案<br>• Ticket 失败自动触发前端重新认证 |

### 🔄 与标准 OAuth 对比

| 对比项 | 标准 Bearer Token | 临时 Ticket 方案 |
|--------|-------------------|------------------|
| **生命周期** | 长（如 1 小时） | 短（5 分钟） |
| **适用场景** | HTTP 请求（可携带 Headers） | SSE 流式连接（仅 URL 参数） |
| **泄露风险** | 高（长期有效） | 低（短期有效 + 单资源） |
| **生成成本** | 低（直接使用） | 中（需额外请求） |
| **SDK 兼容** | 完全兼容 | 应用层独立实现 |

---

## 🚀 最佳实践

### 1. Ticket TTL 调优

```typescript
// 场景 A: 高安全性场景（如金融交易）
const TICKET_TTL = 60; // 1 分钟

// 场景 B: 平衡体验与安全（推荐）
const TICKET_TTL = 300; // 5 分钟

// 场景 C: 弱实时场景（如公开直播）
const TICKET_TTL = 3600; // 1 小时
```

### 2. 自动刷新策略

```typescript
// 前端：在 Ticket 过期前 30 秒自动刷新
const AUTO_REFRESH_THRESHOLD = 30000; // 30 秒

eventSource.onerror = () => {
  const timeRemaining = ticketExpiryRef.current - Date.now();
  if (timeRemaining < AUTO_REFRESH_THRESHOLD) {
    // 主动刷新 Ticket
    refreshTicketAndReconnect();
  }
};
```

### 3. 监控与告警

```typescript
// 后端：记录 Ticket 验证失败次数
logger.warn(
  {
    ticketPrefix: ticket.substring(0, 8),
    roomId,
    roleId,
    errorType: 'expired', // 或 'invalid', 'mismatch'
  },
  'SSE ticket validation failed'
);

// 告警规则：5 分钟内超过 100 次失败 → 可能遭受攻击
```

### 4. 单点登出（可选）

```typescript
// 用户登出时，清除所有相关 Ticket
const ticketPattern = `sse_ticket:*${userId}*`;
const keys = await redis.keys(ticketPattern);
await redis.del(...keys);
```

---

## 🔧 故障排查

### 问题 1: `401 Invalid or expired ticket`

**原因**：
- Ticket 已过期（超过 5 分钟）
- Ticket 被手动删除（如 Redis flush）
- 前端使用了错误的 Ticket

**解决**：
```typescript
// 前端自动重试逻辑
if (response.status === 401) {
  console.log('Ticket expired, getting new ticket...');
  const newTicket = await getTicket();
  // 重新连接
}
```

### 问题 2: `403 Ticket does not match resource`

**原因**：
- 前端请求的 `roomId`/`roleId` 与 Ticket 中存储的不一致
- 可能是 URL 参数被手动篡改

**解决**：
- 检查前端传递的参数是否正确
- 确保 Ticket 是从当前页面的上下文生成的

### 问题 3: SSE 连接频繁断开

**原因**：
- Nginx/LB 超时设置过短
- Ticket TTL 设置过短

**解决**：
```nginx
# nginx.conf
location /api/v1/rooms/.*/perspectives/.*/stream {
    proxy_read_timeout 3600s;  # 1 小时
    proxy_send_timeout 3600s;
    proxy_buffering off;       # 关键：禁用缓冲
    proxy_set_header Connection '';
}
```

---

## 📚 参考资料

- [EventSource API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Redis TTL Best Practices](https://redis.io/docs/manual/keyspace-notifications/)

---

## 🎓 总结

本方案通过 **两步认证** 机制，在不修改通用 SDK 的前提下，优雅地解决了 EventSource API 无法携带自定义 Headers 的问题：

1. ✅ **保持 SDK 通用性**：`oauth-sdk` 和 `service-auth-middleware` 无需改动
2. ✅ **安全性高**：短生命周期 + 资源绑定 + 高熵随机
3. ✅ **用户体验好**：自动刷新、断线重连、无感知认证
4. ✅ **易于维护**：应用层独立实现，不影响其他模块

**适用场景**：
- ✅ SSE (Server-Sent Events) 实时推送
- ✅ WebSocket 初始握手（可选）
- ✅ 长轮询（Long Polling）需要 URL 认证的场景

**不适用场景**：
- ❌ 标准 HTTP 请求（直接使用 Bearer Token）
- ❌ 需要细粒度权限控制的场景（Ticket 仅绑定资源，不含 scope）

