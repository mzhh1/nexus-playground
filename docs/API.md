# Nexus Playground - API文档

## 基础信息

- **Base URL**: `/api`
- **WebSocket URL**: `/ws`
- **认证方式**: OAuth 2.0 + Bearer Token

## 认证

所有需要认证的API都需要在请求头中包含Access Token：

```http
Authorization: Bearer <access_token>
```

Access Token由 `@autolabz/oauth-sdk` 自动管理，存储在 `localStorage` 中。

## REST API端点

### 健康检查

```http
GET /health
```

**响应**：
```json
{
  "status": "ok",
  "timestamp": "2025-10-21T10:30:00.000Z",
  "uptime": 3600
}
```

---

### 游戏管理

#### 获取游戏列表

```http
GET /api/games
```

**响应**：
```json
{
  "games": [
    {
      "id": "tic-tac-toe",
      "name": "Tic Tac Toe",
      "description": "Classic 3x3 Tic Tac Toe game",
      "minPlayers": 2,
      "maxPlayers": 2,
      "supportsAI": true,
      "gameType": "turn-based",
      "informationType": "perfect"
    }
  ]
}
```

#### 获取游戏详情

```http
GET /api/games/:gameId
```

**参数**：
- `gameId` (路径参数): 游戏ID

**响应**：
```json
{
  "id": "tic-tac-toe",
  "name": "Tic Tac Toe",
  "description": "Classic 3x3 Tic Tac Toe game...",
  "rules": "Players take turns placing X or O...",
  "minPlayers": 2,
  "maxPlayers": 2,
  "supportsAI": true
}
```

---

### 房间管理

#### 获取房间列表

```http
GET /api/rooms
```

**查询参数**：
- `gameId` (可选): 筛选特定游戏的房间
- `notFull` (可选): `true` 只返回未满的房间
- `isPrivate` (可选): `true`/`false` 筛选私有/公开房间

**响应**：
```json
{
  "rooms": [
    {
      "id": "room_abc123",
      "gameId": "tic-tac-toe",
      "hostId": "user_123",
      "players": [
        {
          "uid": "user_123",
          "nickname": "Player1",
          "ready": true
        }
      ],
      "maxPlayers": 2,
      "status": "waiting",
      "isPrivate": false,
      "createdAt": "2025-10-21T10:00:00.000Z"
    }
  ]
}
```

#### 获取特定房间

```http
GET /api/rooms/:roomId
```

**参数**：
- `roomId` (路径参数): 房间ID

**响应**：同上单个房间对象

#### 创建房间

```http
POST /api/rooms
```

**认证**: 必需

**请求体**：
```json
{
  "gameConfig": {
    "id": "tic-tac-toe",
    "name": "Tic Tac Toe",
    "minPlayers": 2,
    "maxPlayers": 2
  },
  "options": {
    "isPrivate": false,
    "maxPlayers": 2,
    "password": "optional_password"
  }
}
```

**响应**：
```json
{
  "id": "room_abc123",
  "gameId": "tic-tac-toe",
  "hostId": "user_123",
  "players": [...],
  "status": "waiting",
  "createdAt": "2025-10-21T10:30:00.000Z"
}
```

#### 加入房间

```http
POST /api/rooms/:roomId/join
```

**认证**: 必需

**请求体**：
```json
{
  "password": "optional_if_private"
}
```

**说明**：
- 允许加入状态为 `open` 或 `playing` 的房间
- 加入游戏中的房间不会自动分配角色，需由房主手动分配
- 玩家将被添加到玩家列表，但不会获得角色映射

**响应**：房间对象（包含更新后的玩家列表）

**错误响应**：
```json
{
  "error": "Room is full" | "Invalid password" | "Room not found" | "Room is not open for joining"
}
```

#### 离开房间

```http
POST /api/rooms/:roomId/leave
```

**认证**: 必需

**响应**：
```json
{
  "success": true
}
```

#### 设置准备状态

```http
POST /api/rooms/:roomId/ready
```

**认证**: 必需

**请求体**：
```json
{
  "ready": true
}
```

**响应**：
```json
{
  "success": true
}
```

---

## WebSocket API

### 连接

```javascript
const socket = io('/ws', {
  auth: {
    token: '<access_token>'
  }
});
```

### 事件

#### 客户端发送

##### 加入房间

```javascript
socket.emit('room:join', {
  roomId: 'room_abc123',
  roleId: 'player_X'
});
```

##### 离开房间

```javascript
socket.emit('room:leave', {
  roomId: 'room_abc123'
});
```

##### 提交行动

```javascript
socket.emit('game:action', {
  roomId: 'room_abc123',
  action: {
    action_type: 'place_mark',
    parameters: {
      row: 1,
      col: 1
    },
    role_id: 'player_X',
    timestamp: Date.now()
  }
});
```

##### 设置准备状态

```javascript
socket.emit('room:ready', {
  roomId: 'room_abc123',
  ready: true
});
```

#### 服务器推送

##### 连接成功

```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});
```

##### 加入房间成功

```javascript
socket.on('room:joined', (data) => {
  // data.room: 房间对象
});
```

##### 房间状态更新

```javascript
socket.on('room:updated', (data) => {
  // data.room: 更新后的房间对象
});
```

##### 准备开始游戏

```javascript
socket.on('room:ready-to-start', () => {
  // 所有玩家都已准备
});
```

##### 游戏状态更新

```javascript
socket.on('game:state-update', (data) => {
  // data.status: 游戏状态
  // data.perspective: 当前玩家的角色视角
});
```

##### 游戏结束

```javascript
socket.on('game:ended', (data) => {
  // data.result: 游戏结果
});
```

##### 错误

```javascript
socket.on('game:error', (data) => {
  // data.error: 错误信息
});
```

```javascript
socket.on('error', (data) => {
  // data.message: 错误信息
});
```

##### 断开连接

```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

---

## 数据模型

### GlobalState (全局状态)

```typescript
interface GlobalState {
  game_rules: string;           // 游戏规则描述
  history: PlayerAction[];      // 历史行动
  current_state: any;           // 当前状态（游戏特定）
}
```

### RolePerspective (角色视角)

```typescript
interface RolePerspective {
  global_rules: string;         // 游戏规则
  whole_history: PlayerAction[]; // 完整历史
  diff_history: PlayerAction[];  // 差异历史
  current_state: any;           // 当前状态（角色视角）
  your_role: {                  // 你的角色信息
    role_id: string;
    description: string;
    goal: string;
  };
  action_space_definition: {    // 可用行动空间
    mode: 'explicit_list' | 'template';
    available_actions?: any[];  // 显式列表模式
    action_template?: any;       // 模板模式
  };
}
```

### PlayerAction (玩家行动)

```typescript
interface PlayerAction {
  action_type: string;          // 行动类型
  parameters: Record<string, any>; // 行动参数
  role_id: string;              // 执行角色
  timestamp: number;            // 时间戳
}
```

### GameResult (游戏结果)

```typescript
interface GameResult {
  winner?: string | 'draw';     // 获胜者
  role_results: Record<string, {
    outcome: 'win' | 'loss' | 'draw';
  }>;
}
```

---

## 错误码

| HTTP状态码 | 说明 |
|----------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或Token无效 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 示例

### 完整游戏流程示例

```javascript
// 1. 创建房间
const createResponse = await fetch('/api/rooms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    gameConfig: {
      id: 'tic-tac-toe',
      name: 'Tic Tac Toe',
      minPlayers: 2,
      maxPlayers: 2
    },
    options: {
      isPrivate: false,
      maxPlayers: 2
    }
  })
});

const room = await createResponse.json();

// 2. 连接WebSocket
const socket = io('/ws', {
  auth: { token: accessToken }
});

// 3. 加入房间
socket.emit('room:join', {
  roomId: room.id,
  roleId: 'player_X'
});

// 4. 监听游戏状态更新
socket.on('game:state-update', (data) => {
  console.log('Game state:', data);
  // 更新UI显示棋盘
});

// 5. 提交行动
socket.emit('game:action', {
  roomId: room.id,
  action: {
    action_type: 'place_mark',
    parameters: { row: 0, col: 0 },
    role_id: 'player_X',
    timestamp: Date.now()
  }
});

// 6. 监听游戏结束
socket.on('game:ended', (data) => {
  console.log('Game over:', data.result);
});
```

---

## 开发工具

推荐使用以下工具测试API：

- **Postman**: REST API测试
- **Socket.IO Client**: WebSocket测试
- **curl**: 命令行快速测试

### curl示例

```bash
# 健康检查
curl http://localhost/health

# 获取游戏列表
curl http://localhost/api/games

# 获取房间列表
curl http://localhost/api/rooms

# 创建房间（需要Token）
curl -X POST http://localhost/api/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"gameConfig":{"id":"tic-tac-toe","name":"Tic Tac Toe","minPlayers":2,"maxPlayers":2}}'
```

---

**需要帮助？** 查看 [快速开始指南](./QUICK_START.md) 或 [GitHub Issues](https://github.com/your-repo/issues)


