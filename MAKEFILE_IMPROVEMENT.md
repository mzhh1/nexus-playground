# Makefile 改进 - 从 .env 读取配置


## 📅 日期
2025-10-31

## 🎯 改进目标
将 Makefile 中硬编码的数据库配置改为从 `.env` 文件读取，提高配置的灵活性和可维护性。

## ✅ 完成的改进

### 1. 自动加载 .env 文件
在 Makefile 开头添加了 `.env` 文件加载逻辑：

```makefile
# 加载 .env 文件（如果存在）
ifneq (,$(wildcard .env))
    include .env
    export
endif
```

### 2. 更新数据库相关命令
将所有硬编码的数据库配置替换为环境变量：

#### 修改前：
```makefile
shell-postgres: ## 进入 PostgreSQL 容器
	docker-compose exec postgres psql -U $${POSTGRES_USER:-nexus} -d $${POSTGRES_DB:-nexus_playground}

shell-redis: ## 进入 Redis 容器
	docker-compose exec redis redis-cli -a $${REDIS_PASSWORD:-nexus_redis_pass}

db-migrate:
	@docker-compose exec -T postgres psql -U $${POSTGRES_USER:-nexus} -d $${POSTGRES_DB:-nexus} -f /tmp/migration.sql
```

#### 修改后：
```makefile
shell-postgres: ## 进入 PostgreSQL 容器
	docker-compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

shell-redis: ## 进入 Redis 容器
	docker-compose exec redis redis-cli -a $(REDIS_PASSWORD)

db-migrate:
	@docker-compose exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /tmp/migration.sql
```

### 3. 统一变量引用方式
- 使用 `$(VARIABLE_NAME)` 而不是 `$${VARIABLE_NAME:-default}`
- 移除了硬编码的默认值
- 依赖 `.env` 文件提供正确的配置

## 📊 影响范围

### 受影响的 Make 命令
- `make shell-postgres` - 进入 PostgreSQL 容器
- `make shell-redis` - 进入 Redis 容器
- `make db-migrate` - 执行单个数据库迁移
- `make db-migrate-all` - 执行所有数据库迁移

### 环境变量依赖
从 `.env` 文件读取以下变量：
- `POSTGRES_USER` - PostgreSQL 用户名
- `POSTGRES_DB` - PostgreSQL 数据库名
- `POSTGRES_PASSWORD` - PostgreSQL 密码（未在 Makefile 中使用，但被 docker-compose 使用）
- `REDIS_PASSWORD` - Redis 密码

## 🎉 优势

1. **配置集中管理**：所有配置都在 `.env` 文件中，易于维护
2. **环境隔离**：不同环境可以使用不同的 `.env` 文件
3. **安全性提升**：避免在 Makefile 中硬编码敏感信息
4. **一致性保证**：Makefile 和 docker-compose 使用相同的配置源
5. **易于扩展**：添加新的环境变量时只需更新 `.env` 文件

## 📝 使用说明

### 前置要求
确保项目根目录有 `.env` 文件，包含必要的配置：

```bash
# 数据库配置
POSTGRES_USER=nexus
POSTGRES_DB=nexus
POSTGRES_PASSWORD=nexus_password_2024

# Redis 配置
REDIS_PASSWORD=your_redis_password
```

### 执行迁移示例
```bash
# 单个迁移
make db-migrate MIGRATION=001_add_is_public_to_rooms.sql

# 所有迁移
make db-migrate-all
```

## ⚠️ 注意事项

1. 如果 `.env` 文件不存在，Make 命令会失败
2. 确保 `.env` 文件中的变量名与 docker-compose.yml 中保持一致
3. `.env` 文件应该在 `.gitignore` 中，不要提交到版本控制
4. 团队成员需要根据 `.env.example`（如果有）创建自己的 `.env` 文件

## 🔗 相关文件

- `/home/ubuntu/code/nexus-playground/Makefile`
- `/home/ubuntu/code/nexus-playground/.env`
- `/home/ubuntu/code/nexus-playground/docker-compose.yml`
- `/home/ubuntu/code/nexus-playground/database/migrations/README.md`

## ✨ 测试结果

已成功测试以下命令：
- ✅ `make db-migrate MIGRATION=001_add_is_public_to_rooms.sql`
- ✅ 正确从 `.env` 读取 `POSTGRES_USER=nexus` 和 `POSTGRES_DB=nexus`
- ✅ 迁移脚本成功执行，视图更新完成

---

**改进完成时间**: 2025-10-31  
**改进人员**: AI Assistant



