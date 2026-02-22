# 开发指南

## 🚀 快速开始

### 首次启动

```bash
# 开发环境快速启动（推荐）
make dev

# 或者分步执行
make build
make up
make health
```

### 日常开发

```bash
# 查看服务状态
make ps

# 查看日志
make logs              # 所有服务
make logs-backend      # 仅后端
make logs-frontend     # 仅前端

# 重启服务
make restart
```

## 🔄 为什么需要 `rebuild` 而不是简单的 `restart`？

### 问题场景

当你修改了以下内容时，简单的 `docker-compose restart` **不会生效**：

1. ✅ **Dockerfile 内容**（如 CMD、HEALTHCHECK、WORKDIR）
2. ✅ **package.json 依赖**（需要重新 `npm install`）
3. ✅ **TypeScript 配置**（tsconfig.json）
4. ✅ **构建产物**（需要重新编译）
5. ✅ **容器配置**（environment、volumes、ports）

### 原因分析

```
docker-compose restart  ➜  只重启容器进程
                           ❌ 不重新构建镜像
                           ❌ 不重新创建容器
                           ❌ 不更新容器配置

docker-compose stop/rm  ➜  删除旧容器
+ docker-compose build  ➜  重新构建镜像
+ docker-compose up     ➜  创建新容器
                           ✅ 使用最新代码
                           ✅ 使用最新配置
                           ✅ 使用最新依赖
```

## 📋 最佳实践

### 1. 修改源代码（挂载的 volume）

```bash
# 无需重建，热重载会自动生效
# 只需查看日志确认
make logs-backend
```

**原因**：开发模式下源代码目录已挂载到容器内：
```yaml
volumes:
  - ./backend/src:/app/src  # 源代码实时同步
```

### 2. 修改 Dockerfile 或依赖

```bash
# 推荐：重建单个服务（快速）
make rebuild-backend

# 或者：重建所有服务（彻底）
make rebuild
```

**原因**：需要重新构建镜像和创建容器。

### 3. 修改 docker-compose.yml 配置

```bash
# 方式 A：重建特定服务
make rebuild-backend

# 方式 B：重建所有服务
make rebuild
```

**原因**：容器配置（环境变量、端口、健康检查）在创建时固定。

### 4. 清理并重新开始

```bash
# 清理容器和网络（保留数据）
make clean
make dev

# 完全清理（包括数据库数据）⚠️
make clean-all
make dev
```

## 🎯 常用命令对比

| 场景 | ❌ 错误方式 | ✅ 正确方式 |
|------|-----------|-----------|
| 修改 `.ts` 文件 | `make rebuild-backend` | 无需操作（热重载） |
| 修改 `Dockerfile` | `make restart` | `make rebuild-backend` |
| 修改 `package.json` | `make restart` | `make rebuild-backend` |
| 修改健康检查 | `docker-compose up -d` | `make rebuild-backend` |
| 修改环境变量 | `make restart` | `make rebuild-backend` |
| 数据库迁移 | `make restart` | `make rebuild` |

## 🛠️ 开发工具命令

### 进入容器调试

```bash
# 进入后端容器
make shell-backend

# 进入数据库
make shell-postgres

# 进入 Redis
make shell-redis
```

### 健康检查

```bash
# 检查所有服务健康状态
make health

# 输出示例：
# 🏥 健康检查:
# 
# 后端健康检查:
# {
#   "status": "healthy",
#   "services": {
#     "redis": "healthy",
#     "postgres": "healthy"
#   }
# }
```

## 📊 服务状态说明

```bash
make ps
```

**状态解释**：

- `Up (healthy)` ✅ - 服务运行正常且健康检查通过
- `Up (unhealthy)` ⚠️ - 服务运行但健康检查失败
- `Up` ℹ️ - 服务运行但没有配置健康检查
- `Exit 1` ❌ - 服务启动失败

## 🔍 故障排查

### 1. 服务启动失败

```bash
# 查看详细日志
make logs-backend

# 查看最近 50 行
docker-compose logs --tail=50 backend

# 实时跟踪日志
make logs-backend
```

### 2. 健康检查失败

```bash
# 检查健康状态
make health

# 进入容器手动测试
make shell-backend
curl http://localhost:3000/api/v1/health
```

### 3. 端口冲突

```bash
# 停止所有服务
make down

# 检查端口占用
netstat -tlnp | grep -E '3000|5173|51001|5432|6379'

# 修改 .env 文件中的端口配置
vim .env

# 重新启动
make up
```

### 4. 数据库连接失败

```bash
# 检查数据库是否健康
docker-compose ps postgres

# 测试数据库连接
make shell-postgres

# 查看数据库日志
docker-compose logs postgres
```

## 🎓 Makefile vs Shell Script

### 为什么选择 Makefile？

| 特性 | Makefile | Shell Script |
|------|----------|--------------|
| **依赖管理** | ✅ 自动处理依赖 | ❌ 需要手动编写 |
| **并行执行** | ✅ 支持 `-j` 参数 | ❌ 需要手动实现 |
| **增量构建** | ✅ 只构建变更部分 | ❌ 需要手动判断 |
| **跨平台** | ✅ 标准工具 | ⚠️ 需要适配 |
| **IDE 集成** | ✅ 广泛支持 | ⚠️ 有限支持 |
| **自文档化** | ✅ `make help` | ❌ 需要单独文档 |
| **社区标准** | ✅ 行业标准 | ⚠️ 各有不同 |

### Makefile 优势示例

```makefile
# 自动依赖管理
dev: build up health  # dev 依赖于 build、up、health

# 条件执行
rebuild-backend:
    @docker-compose stop backend
    @docker-compose rm -f backend    # -f 强制删除
    @docker-compose build backend
    @docker-compose up -d backend
    @sleep 5                         # 等待启动
    @$(MAKE) ps                      # 调用其他目标
```

## 📝 环境变量管理

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置
vim .env

# 重新加载配置（需要重建）
make rebuild
```

**重要**：修改 `.env` 后必须 `rebuild`，因为环境变量在容器创建时注入。

## 🚀 生产部署

```bash
# 生产环境构建（无缓存，确保最新）
make prod

# 或者手动控制
make build-no-cache
make up
make health
```

## 📚 更多资源

- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Makefile 教程](https://makefiletutorial.com/)
- [项目 README](../README.md)

