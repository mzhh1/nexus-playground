.PHONY: help build up down restart logs ps clean rebuild rebuild-backend rebuild-frontend rebuild-nginx health test

# 默认目标
.DEFAULT_GOAL := help

# 加载 .env 文件（如果存在）
ifneq (,$(wildcard .env))
    include .env
    export
endif

# 颜色定义
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ 帮助

help: ## 显示帮助信息
	@echo "$(BLUE)Nexus Playground - 开发命令$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "使用方法: make $(GREEN)<target>$(NC)\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ 基础操作

build: ## 构建所有服务
	@echo "$(BLUE)🔨 构建所有服务...$(NC)"
	docker-compose build

build-no-cache: ## 构建所有服务（不使用缓存）
	@echo "$(BLUE)🔨 构建所有服务（无缓存）...$(NC)"
	docker-compose build --no-cache

up: ## 启动所有服务
	@echo "$(GREEN)🚀 启动所有服务...$(NC)"
	docker-compose up -d
	@$(MAKE) ps

down: ## 停止并删除所有服务
	@echo "$(YELLOW)⏹️  停止所有服务...$(NC)"
	docker-compose down

stop: ## 停止所有服务（不删除容器）
	@echo "$(YELLOW)⏸️  停止所有服务...$(NC)"
	docker-compose stop

restart: ## 重启所有服务
	@echo "$(YELLOW)🔄 重启所有服务...$(NC)"
	docker-compose restart
	@$(MAKE) ps

##@ 日志和状态

logs: ## 查看所有服务日志
	docker-compose logs -f

logs-backend: ## 查看后端日志
	docker-compose logs -f backend

logs-frontend: ## 查看前端日志
	docker-compose logs -f frontend

logs-nginx: ## 查看 Nginx 日志
	docker-compose logs -f nginx

ps: ## 查看服务状态
	@echo "$(BLUE)📊 服务状态:$(NC)"
	@docker-compose ps

health: ## 检查服务健康状态
	@echo "$(BLUE)🏥 健康检查:$(NC)"
	@echo ""
	@echo "$(GREEN)后端健康检查:$(NC)"
	@curl -s http://localhost:3000/api/v1/health | jq . || echo "$(RED)❌ 后端不可用$(NC)"
	@echo ""
	@echo "$(GREEN)通过 Nginx 访问:$(NC)"
	@curl -s http://localhost:51001/api/v1/health | jq . || echo "$(RED)❌ Nginx 不可用$(NC)"

##@ 重新构建服务

rebuild: down build up ## 完全重建所有服务（停止->构建->启动）

rebuild-backend: ## 重新构建后端服务
	@echo "$(BLUE)🔄 重新构建后端服务...$(NC)"
	@docker-compose stop backend
	@docker-compose rm -f backend
	@docker-compose build backend
	@docker-compose up -d backend
	@echo "$(GREEN)⏳ 等待服务启动...$(NC)"
	@sleep 5
	@$(MAKE) ps
	@echo ""
	@echo "$(GREEN)📝 最近日志:$(NC)"
	@docker-compose logs --tail=20 backend

rebuild-frontend: ## 重新构建前端服务
	@echo "$(BLUE)🔄 重新构建前端服务...$(NC)"
	@docker-compose stop frontend
	@docker-compose rm -f frontend
	@docker-compose build frontend
	@docker-compose up -d frontend
	@echo "$(GREEN)⏳ 等待服务启动...$(NC)"
	@sleep 3
	@$(MAKE) ps
	@echo ""
	@echo "$(GREEN)📝 最近日志:$(NC)"
	@docker-compose logs --tail=20 frontend

rebuild-nginx: ## 重新构建 Nginx 服务
	@echo "$(BLUE)🔄 重新构建 Nginx 服务...$(NC)"
	@docker-compose stop nginx
	@docker-compose rm -f nginx
	@docker-compose build nginx
	@docker-compose up -d nginx
	@echo "$(GREEN)⏳ 等待服务启动...$(NC)"
	@sleep 3
	@$(MAKE) ps
	@echo ""
	@echo "$(GREEN)📝 最近日志:$(NC)"
	@docker-compose logs --tail=20 nginx

##@ 清理操作

clean: ## 停止服务并清理容器、网络
	@echo "$(YELLOW)🧹 清理容器和网络...$(NC)"
	docker-compose down

clean-all: ## 停止服务并清理所有内容（包括 volumes）
	@echo "$(RED)🗑️  清理所有内容（包括数据卷）...$(NC)"
	@read -p "确定要删除所有数据吗？[y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)✅ 清理完成$(NC)"; \
	else \
		echo "$(YELLOW)❌ 已取消$(NC)"; \
	fi

clean-images: ## 删除项目相关的 Docker 镜像
	@echo "$(YELLOW)🗑️  删除项目镜像...$(NC)"
	docker-compose down
	docker images | grep nexus | awk '{print $$3}' | xargs -r docker rmi -f

##@ 开发工具

shell-backend: ## 进入后端容器 shell
	docker-compose exec backend sh

shell-postgres: ## 进入 PostgreSQL 容器
	docker-compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

shell-redis: ## 进入 Redis 容器
	docker-compose exec redis redis-cli -a $(REDIS_PASSWORD)

db-migrate: ## 执行数据库迁移 (使用: make db-migrate MIGRATION=001_add_is_public_to_rooms.sql)
	@if [ -z "$(MIGRATION)" ]; then \
		echo "$(RED)❌ 错误: 请指定迁移文件名$(NC)"; \
		echo "$(YELLOW)使用方法: make db-migrate MIGRATION=001_add_is_public_to_rooms.sql$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🔄 执行数据库迁移: $(MIGRATION)$(NC)"
	@docker cp database/migrations/$(MIGRATION) $$(docker-compose ps -q postgres):/tmp/migration.sql
	@docker-compose exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /tmp/migration.sql
	@echo "$(GREEN)✅ 迁移完成$(NC)"

db-migrate-all: ## 执行所有数据库迁移
	@echo "$(BLUE)🔄 执行所有数据库迁移...$(NC)"
	@for file in database/migrations/*.sql; do \
		if [ -f "$$file" ]; then \
			echo "$(YELLOW)执行: $$(basename $$file)$(NC)"; \
			docker cp "$$file" $$(docker-compose ps -q postgres):/tmp/migration.sql; \
			docker-compose exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -f /tmp/migration.sql || exit 1; \
		fi; \
	done
	@echo "$(GREEN)✅ 所有迁移完成$(NC)"

test: ## 运行测试（示例）
	@echo "$(BLUE)🧪 运行测试...$(NC)"
	@echo "$(YELLOW)TODO: 添加测试命令$(NC)"

##@ 快速启动

dev: build up health ## 开发环境快速启动（构建->启动->健康检查）
	@echo ""
	@echo "$(GREEN)✅ 开发环境已启动！$(NC)"
	@echo ""
	@echo "$(BLUE)访问地址:$(NC)"
	@echo "  前端: http://localhost:51001/"
	@echo "  后端: http://localhost:51001/api/v1/"
	@echo "  健康检查: http://localhost:51001/api/v1/health"
	@echo ""
	@echo "$(BLUE)查看日志:$(NC)"
	@echo "  make logs          # 所有服务"
	@echo "  make logs-backend  # 仅后端"
	@echo ""

prod: ## 生产环境启动（无缓存构建）
	@echo "$(BLUE)🚀 生产环境构建...$(NC)"
	@$(MAKE) build-no-cache
	@$(MAKE) up
	@$(MAKE) health
	@echo ""
	@echo "$(GREEN)✅ 生产环境已启动！$(NC)"
