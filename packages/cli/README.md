# @nexusgame/cli

Nexus Game Engine 的本地开发辅助工具。通过该 CLI，游戏开发者可以快速生成游戏脚手架，并在本地环境中进行调试。

## 快速开始

我们推荐使用 `npx` 直接运行 CLI，这样可以确保你始终使用的是最新版本，且无需在全局安装任何包。

### 1. 创建新游戏

在你的工作目录下运行以下命令：

```bash
npx @nexusgame/cli create-game
```

按照提示输入游戏 ID、展示名称等信息，CLI 将会自动为你生成完整的游戏开发脚手架。

### 2. 开发与调试

进入生成的游戏目录并安装依赖：

```bash
cd <your-game-id>
pnpm install
```

#### 启动调试引擎

在开发过程中，你可以启动一个轻量级的本地引擎来模拟游戏运行环境。

1. **在一个终端启动引擎**:
   ```bash
   npx @nexusgame/cli start
   ```

2. **在另一个终端快捷设置游戏项目**:
   ```bash
   # 首先启动你的游戏 Worker (通常是 pnpm run dev)
   # 然后运行 setup 命令连接到本地引擎
   npx @nexusgame/cli setup --worker-url http://localhost:8788
   ```

3. **查看与交互**:
   ```bash
   # 查看房间全局状态
   npx @nexusgame/cli state
   
   # 查看特定角色的视角 （在返回json状态的同时也会返回一个用于调试ui的url）
   npx @nexusgame/cli perspective player_1
   
   # 以指定角色执行行动
   npx @nexusgame/cli action player_1 '{"action_id":"example_action","params":{}}'
   ```

### 3. 构建与部署

当游戏开发完成后，可以通过以下命令进行部署：

```bash
pnpm run deploy
```

> [!TIP]
> 部署过程会根据 `worker/wrangler.toml` 中的配置，将你的游戏逻辑发布到 Cloudflare Workers。


