# 房间公开属性功能说明

## 概述

为房间（Room）添加了 `is_public` 属性，用于标识房间是否公开。默认情况下，所有新创建的房间都是公开的（`is_public = true`）。

## 修改内容

### 1. 数据库层面

#### 修改的文件
- `database/init.sql`

#### 添加的字段
```sql
is_public BOOLEAN NOT NULL DEFAULT TRUE
```

#### 更新的视图
- `active_rooms` 视图现在包含 `is_public` 字段

### 2. 后端类型定义

#### 修改的文件
- `backend/src/db/rooms.ts` - Room 接口
- `backend/src/games/types.ts` - RoomState 接口

#### 添加的属性
```typescript
is_public: boolean;
```

### 3. 前端类型定义

#### 修改的文件
- `frontend/src/lib/types.ts` - RoomInfo 接口

#### 添加的属性
```typescript
is_public: boolean;
```

### 4. 运行时状态管理

#### 修改的文件
- `backend/src/runtime/state-manager.ts`

#### 修改的方法
- `initializeRoomState()` - 初始化房间时设置 `is_public: true`
- `getRoomState()` - 从 Redis 读取时提供默认值 `true`
- `resetGameState()` - 重置游戏时保留 `is_public` 状态

### 5. API 接口

#### 修改的文件
- `backend/src/routes/rooms.ts` - GET /api/v1/rooms/:roomId
- `backend/src/routes/my-nexus.ts` - GET /api/v1/my-nexus

#### 返回的数据
API 响应现在包含 `is_public` 字段：
```json
{
  "room_id": "ABC12345",
  "owner_uid": "user_123",
  "game_id": "tic-tac-toe",
  "room_status": "open",
  "is_public": true,
  "resume_locked": false,
  ...
}
```

## 数据库迁移

### 新数据库
新数据库会自动包含 `is_public` 字段，因为 `database/init.sql` 已更新。

### 现有数据库
对于已经运行的数据库，需要执行迁移脚本：

#### 方法 1: 使用 Make 命令（推荐）
```bash
make db-migrate MIGRATION=001_add_is_public_to_rooms.sql
```

#### 方法 2: 执行所有迁移
```bash
make db-migrate-all
```

#### 方法 3: 手动执行
```bash
# 进入 PostgreSQL 容器
make shell-postgres

# 执行迁移
\i /database/migrations/001_add_is_public_to_rooms.sql
```

## 默认行为

- **新创建的房间**: `is_public = true`（公开）
- **现有房间**（执行迁移后）: `is_public = true`（公开）
- **重置游戏后**: 保留原有的 `is_public` 值

## 未来扩展

目前 `is_public` 属性已添加到数据模型中，但暂时没有提供修改方式。未来可以添加以下功能：

1. **前端 UI**
   - 在房间设置中添加公开/私有切换开关
   - 在房间列表中只显示公开的房间（如果实现房间浏览功能）

2. **后端 API**
   ```typescript
   // 添加新的 API 端点
   PATCH /api/v1/rooms/:roomId/visibility
   Body: { is_public: boolean }
   ```

3. **权限控制**
   - 私有房间只允许所有者和受邀玩家访问
   - 公开房间允许任何人访问和加入

## 技术说明

### 数据一致性
- PostgreSQL（持久化存储）和 Redis（运行时状态）都包含 `is_public` 字段
- 房间初始化时从 PostgreSQL 创建记录（默认 `is_public = true`）
- StateManager 在 Redis 中初始化房间状态时也设置 `is_public = true`

### 向后兼容
- 使用 `IF NOT EXISTS` 确保迁移脚本可以安全地重复执行
- `getRoomState()` 方法为旧数据提供默认值，确保平滑过渡

## 测试建议

1. **新房间创建**
   ```bash
   # 创建新房间并验证 is_public 字段
   curl http://localhost:51001/api/v1/my-nexus
   ```

2. **现有房间迁移**
   ```bash
   # 执行迁移后查询现有房间
   curl http://localhost:51001/api/v1/rooms/{room_id}
   ```

3. **游戏重置**
   ```bash
   # 重置游戏后验证 is_public 保持不变
   ```

## 相关文件

- 数据库 Schema: `database/init.sql`
- 数据库迁移: `database/migrations/001_add_is_public_to_rooms.sql`
- 迁移文档: `database/migrations/README.md`
- 后端类型: `backend/src/db/rooms.ts`, `backend/src/games/types.ts`
- 前端类型: `frontend/src/lib/types.ts`
- 状态管理: `backend/src/runtime/state-manager.ts`
- API 路由: `backend/src/routes/rooms.ts`, `backend/src/routes/my-nexus.ts`
- 构建工具: `Makefile`

## 更新日期

2025-10-31

