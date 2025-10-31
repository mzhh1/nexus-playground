# 更新日志 - 房间公开属性

## [2025-10-31] 添加房间公开属性

### ✨ 新增功能
- 为房间添加 `is_public` 属性，用于标识房间是否公开
- 默认所有房间为公开状态（`is_public = true`）

### 📝 修改的文件

#### 数据库
- ✅ `database/init.sql` - 添加 `is_public` 字段
- ✅ `database/migrations/001_add_is_public_to_rooms.sql` - 迁移脚本
- ✅ `database/migrations/README.md` - 迁移说明

#### 后端
- ✅ `backend/src/db/rooms.ts` - Room 接口添加 `is_public`
- ✅ `backend/src/games/types.ts` - RoomState 接口添加 `is_public`
- ✅ `backend/src/runtime/state-manager.ts` - 状态管理器支持 `is_public`
- ✅ `backend/src/routes/rooms.ts` - API 返回 `is_public`
- ✅ `backend/src/routes/my-nexus.ts` - API 返回 `is_public`

#### 前端
- ✅ `frontend/src/lib/types.ts` - RoomInfo 接口添加 `is_public`

#### 构建工具
- ✅ `Makefile` - 添加数据库迁移命令

#### 文档
- ✅ `docs/is_public_feature.md` - 详细功能说明

### 🔧 使用方法

#### 新部署的数据库
无需额外操作，`is_public` 字段会自动创建。

#### 现有数据库需要执行迁移
```bash
# 方法 1: 使用 Make 命令（推荐）
make db-migrate MIGRATION=001_add_is_public_to_rooms.sql

# 方法 2: 执行所有迁移
make db-migrate-all
```

### 📊 API 变化

所有房间相关的 API 响应现在都包含 `is_public` 字段：

```json
{
  "room_id": "ABC12345",
  "is_public": true,
  ...
}
```

### 🎯 下一步计划
- [ ] 添加修改房间公开状态的 API 接口
- [ ] 前端添加公开/私有切换开关
- [ ] 实现私有房间的访问权限控制
- [ ] 房间列表只显示公开的房间

### ⚠️ 注意事项
- 暂时没有提供修改 `is_public` 的方式，所有房间都是公开的
- 数据库迁移脚本是幂等的，可以安全地重复执行
- 所有现有房间会被设置为公开状态

