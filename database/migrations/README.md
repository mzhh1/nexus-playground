# 数据库迁移脚本

此目录包含数据库迁移脚本，用于更新现有数据库schema。

## 前置要求

确保项目根目录下有 `.env` 文件，包含正确的数据库配置：
- `POSTGRES_USER` - 数据库用户名
- `POSTGRES_DB` - 数据库名称  
- `POSTGRES_PASSWORD` - 数据库密码

## 使用方法

### 方法 1: 使用 Make 命令（推荐）✨

Makefile 会自动从 `.env` 文件读取数据库配置。

```bash
# 执行单个迁移
make db-migrate MIGRATION=001_add_is_public_to_rooms.sql

# 执行所有迁移
make db-migrate-all
```

### 方法 2: 直接在 PostgreSQL 容器中执行

```bash
# 进入 PostgreSQL 容器
docker exec -it nexus-postgres psql -U nexus -d nexus

# 在 psql 中执行迁移脚本
\i /migrations/001_add_is_public_to_rooms.sql
```

### 方法 3: 从主机执行

```bash
# 使用 docker exec 执行 SQL 文件
docker exec -i nexus-postgres psql -U nexus -d nexus < database/migrations/001_add_is_public_to_rooms.sql
```

## 迁移历史

- `001_add_is_public_to_rooms.sql` (2025-10-31): 为 rooms 表添加 `is_public` 字段

## 注意事项

- 执行迁移前请确保备份数据库
- 迁移脚本使用 `IF NOT EXISTS` 确保可重复执行
- 所有现有房间默认设置为公开（`is_public = true`）

