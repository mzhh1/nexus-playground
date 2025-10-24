# Nexus Playground - 快速开始指南

## 🚀 快速开始（Docker Compose）

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM推荐

### 1. 克隆项目

```bash
git clone <repository-url>
cd nexus-playground
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置：

```bash
# 必须配置的变量
VITE_OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
NEXUS_OAUTH_REDIRECT_URI=http://localhost/callback

# 可选：LLM API配置（如需AI玩家）
LLMAPI_API_KEY=your_llmapi_key
```

### 3. 启动所有服务

```bash
docker-compose up -d --build
```

这将启动：
- ✅ Nginx反向代理（端口80）
- ✅ PostgreSQL数据库
- ✅ Redis缓存
- ✅ API Server（WebSocket服务）
- ✅ 游戏门户
- ✅ 井字棋游戏

### 4. 验证服务状态

```bash
docker-compose ps
```

所有服务的STATUS应显示为 `Up`。

### 5. 访问应用

打开浏览器访问：

- **游戏门户（主入口）**: http://localhost
- **游戏大厅**: http://localhost/lobby
- **井字棋**: http://localhost/games/tic-tac-toe
- **API健康检查**: http://localhost/health

### 6. 运行测试

```bash
chmod +x scripts/test-e2e.sh
./scripts/test-e2e.sh
```

## 🛠️ 本地开发模式

如果你想进行开发而不是仅运行应用：

### 1. 安装依赖

```bash
# 确保已安装pnpm
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 2. 构建核心包

```bash
pnpm build
```

### 3. 启动基础服务

```bash
# 只启动数据库和Redis
docker-compose up -d postgres redis
```

### 4. 启动API Server（开发模式）

```bash
cd core-framework/api-server
pnpm dev
```

### 5. 启动门户（开发模式）

在新终端：

```bash
cd portal
pnpm dev
```

访问：http://localhost:3000

### 6. 启动井字棋游戏（开发模式）

在新终端：

```bash
cd games/tic-tac-toe/ui
pnpm dev
```

访问：http://localhost:3001

## 📖 开发工作流

### 修改核心包

如果修改了 `shared-types`、`game-sdk`、`platform-core` 或 `web-client`：

```bash
# 重新构建该包
pnpm --filter @nexus/shared-types build

# 或构建所有包
pnpm build
```

### 添加新游戏

1. 创建游戏目录：
```bash
mkdir -p games/my-game/{game-logic,ui}
```

2. 实现游戏逻辑（继承 `GameLoop`）
3. 实现游戏UI（使用 `@nexus/web-client`）
4. 在 `docker-compose.yml` 中添加游戏服务
5. 在 `nginx.conf` 中添加路由

详见：[游戏开发指南](./GAME_DEVELOPMENT.md)

## 🐛 故障排查

### 服务无法启动

```bash
# 查看日志
docker-compose logs -f [服务名]

# 例如：
docker-compose logs -f api-server
docker-compose logs -f portal
```

### 端口冲突

如果80端口被占用，修改 `.env`：

```bash
NEXUS_PORT=8080
```

然后重新启动：

```bash
docker-compose down
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查数据库是否健康
docker-compose ps postgres

# 重启数据库
docker-compose restart postgres

# 查看数据库日志
docker-compose logs -f postgres
```

### 清理并重启

```bash
# 停止所有服务
docker-compose down

# 删除数据卷（⚠️ 会清除所有数据）
docker-compose down -v

# 重新构建并启动
docker-compose up -d --build
```

## 📚 更多文档

- [API文档](./API.md)
- [游戏开发指南](./GAME_DEVELOPMENT.md)
- [架构设计](../design.md)
- [项目状态](../PROJECT_STATUS.md)

## 💡 提示

### OAuth配置

本项目使用 `@autolabz/oauth-sdk`。你需要：

1. 在OAuth服务提供商注册应用
2. 获取 `CLIENT_ID` 和 `CLIENT_SECRET`
3. 设置回调URI为 `http://localhost/callback`（或你的域名）

### LLM API配置

如果要启用AI玩家功能：

1. 获取LLM API密钥（支持OpenAI兼容API）
2. 在 `.env` 中配置 `LLMAPI_API_KEY`
3. 在游戏中选择"AI玩家"作为对手

### 生产部署

生产环境部署建议：

1. 使用强密码（数据库、Session密钥等）
2. 配置HTTPS（使用Let's Encrypt + Certbot）
3. 设置正确的CORS策略
4. 启用Redis持久化
5. 配置数据库备份

## 🆘 获取帮助

如遇问题：

1. 查看 [故障排查](#故障排查) 部分
2. 检查 [GitHub Issues](https://github.com/your-repo/issues)
3. 查看服务日志：`docker-compose logs -f`

---

**Happy Gaming! 🎮🤖**

