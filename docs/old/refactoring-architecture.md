# 星枢沙盒 — 重构架构设计方案

> **核心哲学：游戏是资产，不是代码。**
>
> 游戏逻辑和 UI 是平台管理的数据资产（Asset），而非编译期依赖的源代码。
> Backend 是执行容器，Frontend 是渲染容器，两者都不需要知道具体游戏的存在。

---

## 1. 现状与问题

### 1.1 当前架构

```
Backend (TypeScript)
├── import GomokuLogic from '../../../games/gomoku/logic/index.js'    ← 静态导入
├── import TicTacToeLogic from '../../../games/tic-tac-toe/logic/index.js'
├── import WerewolfLogic from '../../../games/werewolf/logic/index.js'
└── import XiangqiLogic from '../../../games/xiangqi/logic/index.js'
```

### 1.2 核心问题

| 问题 | 影响 |
|:---|:---|
| **构建强耦合** | 任何一个游戏的 TS 类型错误 → 整个 Backend 编译失败 |
| **无法独立部署** | 更新一个小游戏 → 必须重新构建并重启整个后端服务 |
| **无法热插拔** | 添加新游戏 → 修改 `registry.ts` 源码 → 重新编译 → 重新部署 |
| **伪动态注册** | `registry.ts` 虽有"Dynamic Registry"字样，但所有游戏在编译时已确定 |

---

## 2. 目标架构

### 2.1 架构概览

```
┌─────────────────────────────────────┐
│         Game Developer / CI          │
│                                      │
│  pnpm build → logic.mjs + ui.mjs    │
│  pnpm test  → GameTestHarness       │
│           │                          │
│           ▼ upload                   │
│  ┌──────────────────────────┐       │
│  │  Asset Registry (DB)     │       │
│  │  game_versions 表        │       │
│  │  (元数据 + 文件指针)       │       │
│  └──────────┬───────────────┘       │
│             │                        │
│  ┌──────────▼───────────────┐       │
│  │  File Storage            │       │
│  │  /data/game-assets/      │       │
│  │  (或 MinIO / S3)          │       │
│  └──────────────────────────┘       │
└─────────────────┬───────────────────┘
           ┌──────┴──────┐
           ▼             ▼
    ┌────────────┐ ┌────────────┐
    │  Backend   │ │  Frontend  │
    │            │ │            │
    │ dynamic    │ │ import(url)│
    │ import()   │ │ from API   │
    │ from file  │ │            │
    │            │ │            │
    │ SDK 提供   │ │ SDK shared │
    │ 执行上下文  │ │ (单例)      │
    └────────────┘ └────────────┘
```

### 2.2 设计原则

1. **零编译依赖**：Backend 构建时不知道任何具体游戏的存在。
2. **无状态纯函数**：`GameLogic` 每个方法都是纯函数，State 完全外置于 DB。
3. **热替换安全**：因为无状态，新版本逻辑在下一次函数调用时自然生效。
4. **元数据先行**：DB 中的元数据足以展示游戏列表，无需加载代码。
5. **关注点分离**：`logic.mjs` (Node.js) 与 `ui.mjs` (Browser) 是两个独立产物。

---

## 3. 游戏构建规范

### 3.1 产物要求

每个游戏构建后产出**两个 Bundle**：

| 产物 | 目标环境 | 格式 | 作用 |
|:---|:---|:---|:---|
| `logic.mjs` | Node.js (Backend) | ESM | 实现 `GameLogic` 接口的所有方法 |
| `ui.mjs` | Browser (Frontend) | ESM | 导出 `React.FC<GameUIProps>` 组件 |

### 3.2 External 依赖（不打包进 Bundle）

构建时必须将以下依赖声明为 `external`，由宿主环境提供：

```javascript
// vite.config.ts 或 rollup.config.ts
export default {
  build: {
    rollupOptions: {
      external: [
        '@nexus/game-sdk',  // 类型、基类、工具函数
        'react',            // 仅 UI Bundle
        'react-dom',        // 仅 UI Bundle
      ]
    }
  }
}
```

**原因**：确保游戏代码使用宿主提供的 SDK 实例（单例），避免类型不一致和重复加载。

### 3.3 游戏接口契约

#### 后端逻辑 (logic.mjs)

```typescript
// 每个游戏的 logic/index.ts 必须默认导出 GameLogic 实例
import { BaseGameLogic, z } from '@nexus/game-sdk';

class MyGameLogic extends BaseGameLogic<MyState> {
  getMetadata(): GameMetadata { ... }
  getActionSchema(): z.ZodSchema { ... }
  initState(ctx: InitContext): GameState { ... }
  getCurrentRole(state: GameState): string { ... }
  getLegalActions(state: GameState, roleId: string): ActionSpec { ... }
  applyAction(state: GameState, action: Action): ActionResult { ... }
  isTerminal(state: GameState): boolean { ... }
  getWinners(state: GameState): string[] | null { ... }
  toRolePerspective(state, roleId, wholeHistory, diffHistory): RolePerspective { ... }
  generateStatePrompt(perspective: RolePerspective): string { ... }
  
  // 可选：State 版本迁移
  migrateState?(state: GameState, fromVersion: number): GameState;
}

export default new MyGameLogic();
```

#### 前端 UI (ui.mjs)

```tsx
import type { GameUIProps } from '@nexus/game-sdk';

const GameUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  return <div>...</div>;
};

export default GameUI;
```

---

## 4. 数据库设计

### 4.1 Schema

```sql
CREATE TABLE game_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(50) NOT NULL,           -- 'gomoku', 'werewolf'
  version VARCHAR(20) NOT NULL,           -- '1.0.0', '1.2.3'
  
  -- 资产指针（指向文件存储中的实际路径）
  logic_bundle_key VARCHAR(255) NOT NULL, -- 'gomoku/1.0.0/logic.mjs'
  ui_bundle_key VARCHAR(255) NOT NULL,    -- 'gomoku/1.0.0/ui.mjs'
  
  -- 元数据（用于列表展示，不需要加载代码）
  metadata JSONB NOT NULL,
  -- {
  --   "name": "五子棋",
  --   "description": "...",
  --   "minPlayers": 2,
  --   "maxPlayers": 2,
  --   "icon": "gomoku.png"
  -- }
  
  sdk_version VARCHAR(20) NOT NULL,       -- 构建时使用的 SDK 版本
  
  -- 生命周期管理
  status VARCHAR(20) DEFAULT 'staging',   -- staging | active | deprecated | disabled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_by VARCHAR(100),
  
  UNIQUE(game_id, version)
);

-- 当前活跃版本视图
CREATE VIEW active_games AS
  SELECT DISTINCT ON (game_id) *
  FROM game_versions
  WHERE status = 'active'
  ORDER BY game_id, published_at DESC;
```

### 4.2 元数据与资产分离

| 存储位置 | 内容 | 原因 |
|:---|:---|:---|
| **PostgreSQL** | 元数据、版本号、文件指针、状态 | 需要查询、过滤、事务 |
| **文件存储** | `logic.mjs`、`ui.mjs` 实际文件 | 大二进制 blob，不需要 SQL 能力 |

**文件存储选型**（按规模递进）：

| 规模 | 方案 | 说明 |
|:---|:---|:---|
| 当前 | 本地目录 `/data/game-assets/` | Docker Volume 挂载，最简单 |
| 中等 | MinIO (S3 兼容) | 自托管对象存储 |
| 大规模 | S3 + CloudFront | CDN 全球分发 UI Bundle |

---

## 5. 后端动态加载

### 5.1 加载器设计

```typescript
// backend/src/games/asset-loader.ts

import path from 'path';
import { GameLogic } from '@nexus/game-sdk';

const ASSETS_DIR = process.env.GAME_ASSETS_DIR || '/data/game-assets';
const loadedGames = new Map<string, { logic: GameLogic; version: string }>();

/**
 * 加载游戏逻辑
 * 使用原生 ESM dynamic import()，不使用 vm 模块
 */
export async function loadGameLogic(gameId: string, bundleKey: string): Promise<GameLogic> {
  const modulePath = path.resolve(ASSETS_DIR, bundleKey);
  
  // 使用时间戳参数绕过 Node.js 模块缓存，支持热更新
  const module = await import(`${modulePath}?v=${Date.now()}`);
  const logic: GameLogic = module.default;
  
  // 验证接口完整性
  validateGameLogic(logic, gameId);
  
  loadedGames.set(gameId, { logic, version: bundleKey });
  return logic;
}

/**
 * 获取已加载的游戏逻辑
 */
export function getGameLogic(gameId: string): GameLogic {
  const entry = loadedGames.get(gameId);
  if (!entry) throw new Error(`Game not loaded: ${gameId}`);
  return entry.logic;
}

/**
 * 接口完整性验证（防止损坏的 Bundle 被加载）
 */
function validateGameLogic(logic: any, gameId: string): void {
  const required = [
    'getMetadata', 'initState', 'getCurrentRole',
    'getLegalActions', 'applyAction', 'isTerminal',
    'getWinners', 'toRolePerspective'
  ];
  for (const method of required) {
    if (typeof logic[method] !== 'function') {
      throw new Error(`Game ${gameId}: missing required method '${method}'`);
    }
  }
}
```

### 5.2 为什么用 `dynamic import()` 而不是 `vm`

| 维度 | `vm.runInContext` | `dynamic import()` |
|:---|:---|:---|
| 安全性 | Node.js 官方明确声明不安全 | 原生模块系统，与普通代码一致 |
| 性能 | 无法 JIT 优化 | V8 完整优化 |
| 调试 | 无 Source Map 支持 | 完整堆栈追踪 |
| 依赖解析 | 需手动注入 `require` | Node.js 自动解析 `@nexus/game-sdk` |
| 适用场景 | 第三方不可信代码 | 内部团队可信代码 ✅ |

> **注**：若未来开放第三方开发者，可升级为 `isolated-vm` 或 `Worker Threads` 提供真正的内存隔离。

### 5.3 注册表重构

```typescript
// backend/src/games/registry.ts (重构后)

import { loadGameLogic, getGameLogic } from './asset-loader.js';
import db from '../db.js';

// 启动时从数据库加载所有活跃游戏
export async function initializeRegistry(): Promise<void> {
  const rows = await db.query(`
    SELECT game_id, logic_bundle_key, metadata, sdk_version
    FROM active_games
  `);
  
  for (const row of rows) {
    await loadGameLogic(row.game_id, row.logic_bundle_key);
    logger.info({ gameId: row.game_id, version: row.logic_bundle_key }, 'Game loaded');
  }
}

// 热更新：监听数据库 NOTIFY 或轮询
export async function handleGameUpdate(gameId: string): Promise<void> {
  const row = await db.queryOne(`
    SELECT logic_bundle_key FROM active_games WHERE game_id = $1
  `, [gameId]);
  
  if (row) {
    await loadGameLogic(gameId, row.logic_bundle_key);
    logger.info({ gameId }, 'Game hot-reloaded');
  }
}
```

---

## 6. 前端加载

### 6.1 UI 加载器重构

```typescript
// frontend/src/lib/game-ui-loader.ts (核心变化)

export async function loadGameUI(gameId: string): Promise<GameUIComponent | null> {
  // 1. 从 Backend API 获取 UI Bundle 的 URL
  const res = await fetch(`/api/v1/games/${gameId}/ui-url`);
  const { url } = await res.json();
  // url = '/game-assets/gomoku/1.0.0/ui.mjs' 或 CDN 地址
  
  // 2. 动态导入
  const module = await import(/* @vite-ignore */ url);
  return module.default;
}
```

### 6.2 刷新即生效

前端 UI 是无状态渲染层，只接收 `RolePerspective` 并渲染。
- 用户刷新浏览器 → 加载新 `ui.mjs` → 新 UI 立即生效。
- 不影响其他在线用户（谁刷新谁更新）。

---

## 7. 热替换机制

### 7.1 为什么后端逻辑可以无缝热替换

```
GameLogic 的每个方法都是纯函数：
  Input:  当前 GameState (从 DB 读取)
  Output: 新 GameState 或视角数据
  Side Effect: 无
```

```
时间线：一盘游戏正在进行中

  Step 15 → old_logic.applyAction(state_15, action) → state_16  ✓
  ─── 此时上传新版本逻辑，替换内存中的 GameLogic 实例 ───
  Step 16 → new_logic.applyAction(state_16, action) → state_17  ✓
```

新版本逻辑拿到的 `state_16` 是**完整的、自描述的游戏快照**，
新逻辑完全有能力从这个状态继续推演。

### 7.2 暂停/开始的使用场景

| 场景 | 需要暂停？ | 说明 |
|:---|:---|:---|
| 日常 Bug 修复 | **否** | 热替换，下一步操作自动生效 |
| 添加新 Action 类型 | **否** | 新逻辑识别新 action，旧 state 不受影响 |
| State 结构新增字段 | **否** | 在 `migrateState()` 中设置默认值即可 |
| State 结构破坏性变更 | **是** | 暂停 → 迁移 State → 加载新逻辑 → 开始 |
| 紧急下线 | **是** | 暂停该游戏所有房间 |

---

## 8. CI/CD 流水线

```
开发者 push 到 games/gomoku 分支
            │
            ▼
      CI Pipeline
            │
  ┌─────────┴──────────┐
  │ 1. pnpm install     │
  │ 2. pnpm build       │  → 产出 logic.mjs + ui.mjs
  │ 3. 单元测试           │  → GameTestHarness 自动验证
  │ 4. SDK 兼容性检查     │  → 检查构建时 SDK 版本 vs 线上 SDK
  │ 5. 上传 Bundle       │  → 复制到文件存储
  │ 6. 注册版本           │  → INSERT INTO game_versions (status='staging')
  └────────────────────┘
            │
            ▼
    管理后台 / CLI 激活
  UPDATE SET status='active'
            │
            ▼
    Backend 检测到新版本
    → dynamic import() 加载
    → 下一次 action 调用即用新代码
```

---

## 9. 迁移路径

### 第一阶段：构建解耦（最小改动）

- [ ] 为每个游戏添加独立的构建脚本，产出 `dist/logic.mjs`
- [ ] 重构 `registry.ts`：移除静态 `import`，改用 `dynamic import()` 从 `games/*/dist/` 加载
- [ ] Backend Dockerfile 不再编译游戏代码，仅复制预编译产物

**效果**：Backend 构建不再受游戏代码影响，一个游戏构建失败不影响后端。

### 第二阶段：资产化存储

- [ ] 创建 `game_versions` 数据库表
- [ ] 实现 CLI 工具 `nexus-cli publish <game-id>` 上传 Bundle + 注册版本
- [ ] Backend 启动时从 DB 查询活跃游戏并加载
- [ ] Frontend UI 加载器改为从 API 获取 URL

**效果**：游戏完全独立于 Backend 部署，支持版本管理和灰度发布。

### 第三阶段：平台化运营

- [ ] 管理后台：游戏版本管理界面（上传、激活、回滚、禁用）
- [ ] 热更新能力：PostgreSQL `LISTEN/NOTIFY` 推送版本变更
- [ ] 监控告警：游戏 Bundle 加载失败、接口验证失败时报警
- [ ] SDK 版本兼容矩阵：自动标记不兼容的游戏版本

---

## 10. 与现有架构的对比

| 维度 | 重构前 | 重构后 |
|:---|:---|:---|
| 游戏注册 | 修改 `registry.ts` 源码 | 向数据库 INSERT 一条记录 |
| Backend 构建 | 必须编译所有游戏 TS | 只编译 Backend 自身代码 |
| 添加新游戏 | 改代码 → 编译 → 部署 | 上传 Bundle → 激活 |
| 更新游戏逻辑 | 重启服务，中断所有对局 | 热替换, 正在进行的对局无感知 |
| 游戏代码错误 | 整个 Backend 炸掉 | 仅该游戏不可用，其他正常 |
| 版本回滚 | Git revert → 重新部署 | 切换 `status` 字段 |
