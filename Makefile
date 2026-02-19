.PHONY: help build-games d1-migrate deploy-engine deploy-backend typecheck

.DEFAULT_GOAL := help

BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

##@ 帮助
help: ## 显示帮助信息
	@echo "$(BLUE)Nexus Playground - 常用命令$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "使用方法: make $(GREEN)<target>$(NC)\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ 构建与检查
build-games: ## 构建 Gomoku 游戏逻辑
	@echo "$(BLUE)🔨 构建游戏资产...$(NC)"
	cd games/gomoku && npm run build:logic

typecheck: ## 运行核心项目类型检查
	@echo "$(BLUE)🧪 Typecheck frontend...$(NC)"
	cd frontend && pnpm run typecheck
	@echo "$(BLUE)🧪 Typecheck hono_backend...$(NC)"
	cd hono_backend && pnpm run typecheck
	@echo "$(BLUE)🧪 Typecheck nexus-engine...$(NC)"
	cd nexus-engine && pnpm run build

##@ 部署
deploy-engine: ## 部署 nexus-engine 到 Cloudflare
	@echo "$(BLUE)🚀 部署 nexus-engine 到 Cloudflare...$(NC)"
	cd nexus-engine && pnpm run deploy

deploy-backend: ## 部署 hono_backend 到 Cloudflare
	@echo "$(BLUE)🚀 部署 hono-backend 到 Cloudflare...$(NC)"
	pnpm --filter ./hono_backend run deploy

##@ 数据库
d1-migrate: ## 应用 hono_backend 的 D1 迁移（本地）
	@echo "$(BLUE)🗄️ 应用 D1 迁移...$(NC)"
	cd hono_backend && pnpm exec wrangler d1 migrations apply np-hono-backend-db --local
