.PHONY: help build-engine build-backend build-frontend build-monitor build-game build-games d1-migrate deploy-engine deploy-backend deploy-frontend deploy-monitor deploy-game deploy-games typecheck set-engine-secret set-backend-secret

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
build-engine: ## 构建 nexus-engine
	@echo "$(BLUE)🔨 构建 nexus-engine...$(NC)"
	cd nexus-engine && pnpm run build

build-backend: ## 构建 hono_backend
	@echo "$(BLUE)🔨 构建 hono-backend...$(NC)"
	pnpm --filter ./hono_backend run build

build-frontend: ## 构建 frontend
	@echo "$(BLUE)🔨 构建 frontend...$(NC)"
	pnpm --filter ./frontend run build

build-monitor: ## 构建 monitor
	@echo "$(BLUE)🔨 构建 monitor...$(NC)"
	pnpm --filter ./monitor run build

build-game: ## 构建指定游戏 (用法: make build-game G=<game_dir>)
	@if [ -z "$(G)" ]; then \
		echo "$(YELLOW)⚠️ 请指定游戏目录名，例如: make build-game G=gomoku$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🔨 正在构建游戏: $(G)...$(NC)"
	cd games/$(G) && pnpm run build

build-games: ## 构建所有游戏
	@echo "$(BLUE)🔨 正在构建所有游戏...$(NC)"
	@for dir in games/*/; do \
		game=$$(basename $$dir); \
		$(MAKE) build-game G=$$game; \
	done

typecheck: ## 运行核心项目类型检查
	@echo "$(BLUE)🧪 Typecheck frontend...$(NC)"
	cd frontend && pnpm run typecheck
	@echo "$(BLUE)🧪 Typecheck hono_backend...$(NC)"
	cd hono_backend && pnpm run typecheck
	@echo "$(BLUE)🧪 Typecheck nexus-engine...$(NC)"
	cd nexus-engine && pnpm run build
	@echo "$(BLUE)🧪 Typecheck monitor...$(NC)"
	cd monitor && pnpm run typecheck

##@ 部署
deploy-engine: ## 部署 nexus-engine 到 Cloudflare
	@echo "$(BLUE)🚀 部署 nexus-engine 到 Cloudflare...$(NC)"
	cd nexus-engine && pnpm run deploy

deploy-backend: ## 部署 hono_backend 到 Cloudflare
	@echo "$(BLUE)🚀 部署 hono-backend 到 Cloudflare...$(NC)"
	pnpm --filter ./hono_backend run deploy

deploy-frontend: ## 部署 frontend 到 Vercel
	@echo "$(BLUE)🚀 部署 frontend 到 Vercel...$(NC)"
	vercel --prod --yes --token $$VERCEL_TOKENN

deploy-monitor: ## 部署 monitor 到 Vercel
	@echo "$(BLUE)🚀 部署 monitor 到 Vercel...$(NC)"
	cd monitor && vercel --prod --yes --token $$VERCEL_TOKENN

deploy-game: ## 部署指定游戏 (用法: make deploy-game G=<game_dir>)
	@if [ -z "$(G)" ]; then \
		echo "$(YELLOW)⚠️ 请指定游戏目录名，例如: make deploy-game G=gomoku$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🚀 正在构建并部署游戏: $(G)...$(NC)"
	cd games/$(G) && pnpm run build
	cd games/$(G) && pnpm run deploy

deploy-games: ## 部署所有游戏
	@echo "$(BLUE)🚀 正在部署所有游戏...$(NC)"
	@for dir in games/*/; do \
		game=$$(basename $$dir); \
		$(MAKE) deploy-game G=$$game; \
	done

set-engine-secret: ## 手动设置 nexus-engine 的 CF Worker 环境变量（secret）
	@echo "$(BLUE)🔐 设置 nexus-engine Secret$(NC)"
	@printf "变量名 (例如 LLM_WEBHOOK_SECRET): "; \
	read -r VAR_NAME; \
	cd nexus-engine && pnpm exec wrangler secret put "$$VAR_NAME"

set-backend-secret: ## 手动设置 hono_backend 的 CF Worker 环境变量（secret）
	@echo "$(BLUE)🔐 设置 hono_backend Secret$(NC)"
	@printf "变量名 (例如 OPENAI_API_KEY): "; \
	read -r VAR_NAME; \
	cd hono_backend && pnpm exec wrangler secret put "$$VAR_NAME"

##@ 数据库
d1-migrate: ## 应用 hono_backend 的 D1 迁移（本地）
	@echo "$(BLUE)🗄️ 应用 D1 迁移...$(NC)"
	cd hono_backend && pnpm exec wrangler d1 migrations apply np-hono-backend-db --local

d1-migrate-remote: ## 应用 hono_backend 的 D1 迁移（线上）
	@echo "$(BLUE)🗄️ 应用 D1 线上迁移...$(NC)"
	cd hono_backend && pnpm exec wrangler d1 execute np-hono-backend-db --remote --file=./migrations/0001_rooms.sql
