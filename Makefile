##
## Nexus Playground - Makefile 最佳实践
##
## 用法：
##   - 仅输入 `make`：显示帮助（不执行任何目标）
##   - 追加参数覆盖：`make up SERVICE=portal PROFILE=dev`
##   - 可覆盖变量：PROJECT_NAME, SERVICE, PROFILE, COMPOSE, COMPOSE_FILES, TAIL, CMD, SCALE
##

# 默认工具与参数
COMPOSE ?= docker compose
PROJECT_NAME ?= nexus-playground
SERVICE ?=
PROFILE ?=
COMPOSE_FILES ?=
TAIL ?= 200
CMD ?= sh
SCALE ?=
# 使用 Buildx Bake 加速构建（Compose 将委托给 bake）
COMPOSE_BAKE ?= true
export COMPOSE_BAKE

# 组合命令参数
PFLAGS := $(if $(PROJECT_NAME),-p $(PROJECT_NAME),)
CFFLAGS := $(foreach f,$(COMPOSE_FILES),-f $(f))
PROF_FLAGS := $(if $(PROFILE),--profile $(PROFILE),)
DC := $(COMPOSE) $(PFLAGS) $(CFFLAGS) $(PROF_FLAGS)
SCALE_OPT := $(if $(SCALE),--scale $(SCALE),)

# 默认目标：只展示帮助，不执行任何命令
.DEFAULT_GOAL := help

.PHONY: help env up up-build ps start stop restart logs logs-all build pull down clean config exec sh bash

# 参数校验：使用示例 guard-SERVICE
guard-%:
	@if [ -z "$(${*})" ]; then echo "缺少参数: $*（例如：make $@ SERVICE=portal）"; exit 1; fi

help: ## 显示可用命令与参数说明
	@echo "Nexus Playground - 常用命令（仅显示，不自动运行）"
	@echo
	@echo "变量: PROJECT_NAME=$(PROJECT_NAME)  SERVICE=$(SERVICE)  PROFILE=$(PROFILE)  TAIL=$(TAIL)  COMPOSE_BAKE=$(COMPOSE_BAKE)"
	@echo "可覆盖: PROJECT_NAME, SERVICE, PROFILE, COMPOSE, COMPOSE_FILES, TAIL, CMD, SCALE, COMPOSE_BAKE"
	@echo
	@awk 'BEGIN {FS":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

env: ## 输出当前 Makefile 有效参数
	@echo COMPOSE=$(COMPOSE)
	@echo PROJECT_NAME=$(PROJECT_NAME)
	@echo COMPOSE_FILES=$(COMPOSE_FILES)
	@echo PROFILE=$(PROFILE)
	@echo SERVICE=$(SERVICE)
	@echo TAIL=$(TAIL)
	@echo CMD=$(CMD)
	@echo SCALE=$(SCALE)
	@echo COMPOSE_BAKE=$(COMPOSE_BAKE)

up: ## 后台启动服务（可选 SERVICE、PROFILE、SCALE）
	$(DC) up -d $(SCALE_OPT) $(SERVICE)

up-build: ## 构建并启动（等价于 --build）
	$(DC) up -d --build $(SCALE_OPT) $(SERVICE)

ps: ## 查看容器状态
	$(DC) ps

start: ## 启动已创建的容器（可选 SERVICE）
	$(DC) start $(SERVICE)

stop: ## 停止容器（可选 SERVICE）
	$(DC) stop $(SERVICE)

restart: ## 重启容器（可选 SERVICE）
	$(DC) restart $(SERVICE)

logs: ## 跟随日志（可选 SERVICE，默认 tail=$(TAIL)）
	$(DC) logs -f --tail=$(TAIL) $(SERVICE)

logs-all: ## 跟随所有服务日志
	$(DC) logs -f --tail=$(TAIL)

build: ## 构建镜像（可选 SERVICE）
	$(DC) build $(SERVICE)

pull: ## 拉取镜像（可选 SERVICE）
	$(DC) pull $(SERVICE)

down: ## 停止并移除容器、网络
	$(DC) down

clean: ## 完全清理（含卷、孤儿容器）
	$(DC) down -v --remove-orphans

config: ## 验证并展开 Compose 配置
	$(DC) config

exec: guard-SERVICE ## 进入容器执行命令（需 SERVICE，默认 CMD=sh）
	$(DC) exec $(SERVICE) $(CMD)

sh: guard-SERVICE ## 进入容器 sh（需 SERVICE）
	$(MAKE) exec SERVICE=$(SERVICE) CMD=sh

bash: guard-SERVICE ## 进入容器 bash（需 SERVICE）
	$(MAKE) exec SERVICE=$(SERVICE) CMD=bash

