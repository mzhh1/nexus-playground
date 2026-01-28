# 星枢沙盒架构设计文档

本文档详细说明 Nexus Playground 的 Module Federation 架构、共享 SDK 设计及构建部署流程。

---

## 🏗️ 1. 总体架构 (Module Federation)

项目采用 **微前端 (Micro-Frontend)** 架构，基于 **Vite Module Federation** 实现宿主应用 (Host) 与游戏模块 (Remote) 的解耦。

### 核心组件

1.  **Host App (Frontend)**:
    *   负责用户鉴权、路由管理、房间状态维护。
    *   提供游戏容器 (`GameContainer`) 和 SDK 上下文。
    *   通过 `game-ui-loader` 动态加载远程游戏组件。

2.  **Host Service (Backend)**:
    *   负责权威游戏状态管理 (`GameState`) 和行动处理。
    *   维护游戏注册表 (`Registry`)，支持动态配置加载。
    *   处理 SSE 实时推送和 LLM 玩家代理。

3.  **Shared SDK (`@nexus/game-sdk`)**:
    *   Monorepo 中的共享包，链接 Frontend、Backend 和 Games。
    *   提供统一的类型定义、逻辑基类和 UI 组件。

4.  **Remote Games (`games/*`)*:
    *   独立开发、构建、部署的游戏包。
    *   导出为 ES Module，通过 Federation 协议对外暴露 `UI` 和 `metadata`。

---

## 📦 2. 共享 SDK (@nexus/game-sdk)

SDK 是连接各组件的桥梁，位于 `packages/game-sdk`，通过 pnpm workspace 管理。

### 核心模块

*   **Types (`src/types/`)**:
    *   `GameLogic`: 游戏逻辑接口 (State, Action, Step)。
    *   `GameMetadata`: 游戏元数据 (版本, 描述, 规则)。
    *   `GameUI`: 前端组件 Props 定义 (`GameUIProps`)。
    *   `Room`: 房间与玩家类型。

*   **Logic (`src/logic/`)**:
    *   `BaseGameLogic`: 抽象基类，实现通用的序列化/反序列化。
    *   `utils`: 常用工具函数 (如 `isSpectator`, `validateAction`)。

*   **UI (`src/ui/`)**:
    *   `BoardGrid`: 通用棋盘网格组件。
    *   `Piece`: 通用棋子组件。
    *   `ActionPanel`: 统一行动面板。

*   **Testing (`src/testing/`)**:
    *   `GameTestHarness`: 游戏逻辑单元测试工具。

---

## 🧩 3. 游戏包结构 (Module Federation Remote)

每个游戏 (如 `games/gomoku`) 是一个独立的包，拥有自己的 `package.json` 和构建配置。

### 目录结构

```
games/gomoku/
├── package.json        # 依赖定义 (引用 @nexus/game-sdk)
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Federation 导出配置
├── metadata.ts         # 版本握手元数据
├── logic/
│   └── index.ts        # 核心逻辑 (实现 GameLogic 接口)
└── ui/
    ├── ui.tsx          # UI 组件 (实现 React.FC<GameUIProps>)
    └── ui.module.css   # 样式隔离
```

### 构建产物

构建生成 `dist` 目录，包含：
*   `assets/remoteEntry.js`: Federation 入口文件。
*   `__federation_expose_UI.js`: 暴露的 UI 组件。
*   `__federation_shared_...js`: 共享依赖 (React, SDK)。

### 版本握手协议

前端加载游戏时执行版本检查：
1.  Frontend 加载 Remote `metadata.ts`。
2.  获取 `logicVersion` 和 `minClientVersion`。
3.  Host 检查自身版本与 Backend 逻辑版本是否兼容。
4.  若版本不匹配，Host 拒绝加载并提示刷新。

---

## 🔌 4. 后端插件系统 (Registry)

后端通过 `backend/src/games/registry.ts` 管理游戏。

### 混合加载机制

1.  **动态配置 (`config/games.json`)**:
    *   优先读取 `GAMES_CONFIG_PATH` 指定的 JSON 配置。
    *   支持动态启用/禁用游戏，无需重新编译后端。

2.  **静态回退 (Static Fallback)**:
    *   代码中硬编码导入所有核心作为默认回落。
    *   确保在无配置文件或构建环境下仍能运行。

---

## 🛠️ 5. 构建与部署

### Docker 多阶段构建

由于 `games/*` 依赖 `packages/game-sdk`，构建过程需要特殊处理：

**Frontend Dockerfile**:
1.  复制并构建 `packages/game-sdk`。
2.  构建 Frontend。
3.  Nginx 阶段：将 `games/*/dist` 挂载到 `/games` 路径，供前端动态加载。

**Backend Dockerfile**:
1.  复制并构建 `packages/game-sdk`。
2.  使用 `npm link` 将 SDK 链接到 Backend 和 Games 目录。
3.  编译 Backend 代码 (TypeScript)。
4.  运行时：SDK 代码打包在 `dist` 中，无需额外链接。

### 环境变量

*   `VITE_GAME_CDN_BASE`: 游戏静态资源 CDN 地址 (开发环境为 `/games`)。
*   `VITE_ENABLED_GAMES`: 启用的游戏列表 (逗号分隔)。

### 游戏开发流程

1.  **新建游戏**: 复制 `games/gomoku` 为模板。
2.  **实现逻辑**: 修改 `logic/index.ts`。
3.  **实现 UI**: 修改 `ui/ui.tsx`。
4.  **注册**: 在 `config/games.json` 添加条目。
5.  **构建**: `npm run build` 生成 Federation artifacts。
