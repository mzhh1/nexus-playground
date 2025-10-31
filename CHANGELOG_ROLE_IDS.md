# 角色ID动态化改进 (Role IDs Dynamic Implementation)

## 改进概述

移除了前端硬编码的角色ID，实现了从游戏元数据动态获取角色列表的完整流程。

## 改动内容

### 1. 后端类型定义 (`backend/src/games/types.ts`)

在 `GameMetadata` 接口中添加了 `roleIds` 字段：

```typescript
export interface GameMetadata {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  
  /**
   * List of role IDs required by the game
   * Example: ["player_X", "player_O"] for tic-tac-toe
   * Example: ["player_1", "player_2", "player_3", "player_4"] for 4-player poker
   */
  roleIds: string[];
  
  getStatusText?: (perspective: RolePerspective) => string;
}
```

### 2. 游戏逻辑实现 (`games/tic-tac-toe/logic/index.ts`)

在 `TicTacToeLogic.getMetadata()` 中声明角色列表：

```typescript
getMetadata(): GameMetadata {
  return {
    id: 'tic-tac-toe',
    name: '井字棋 (Tic-Tac-Toe)',
    description: '在3x3棋盘上，两位玩家轮流下棋，先将自己的三个棋子连成一线者获胜。',
    minPlayers: 2,
    maxPlayers: 2,
    roleIds: ['player_X', 'player_O'], // 定义游戏所需角色
    getStatusText: (perspective: RolePerspective) => { ... }
  };
}
```

### 3. 前端类型定义 (`frontend/src/lib/types.ts`)

同步更新前端的 `GameMetadata` 接口：

```typescript
export interface GameMetadata {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * List of role IDs required by the game
   * Example: ["player_X", "player_O"] for tic-tac-toe
   */
  roleIds: string[];
}
```

### 4. 前端Room页面 (`frontend/src/pages/room/Room.tsx`)

**之前（硬编码）：**
```typescript
// Get role IDs from game logic (M0: hardcoded for tic-tac-toe)
const roleIds = hasGameSelected ? ['player_X', 'player_O'] : [];
```

**现在（动态获取）：**
```typescript
// Get role IDs dynamically from game metadata
const roleIds = useMemo(() => {
  if (!hasGameSelected || !room.game_id) return [];
  
  const gameMetadata = AVAILABLE_GAMES.find(game => game.id === room.game_id);
  return gameMetadata?.roleIds || [];
}, [hasGameSelected, room.game_id, AVAILABLE_GAMES]);
```

### 5. 设计文档更新 (`game_integration_guide.md`)

- 更新了 `GameMetadata` 接口定义
- 在所有示例代码中添加了 `roleIds` 字段
- 添加了"重要提示：角色ID的定义"章节

## 优势

✅ **可扩展性**：新游戏只需在元数据中声明角色列表，无需修改前端代码  
✅ **类型安全**：TypeScript 确保所有游戏必须提供 roleIds  
✅ **一致性**：后端定义，前端使用，单一数据源  
✅ **灵活性**：支持任意数量和命名的角色（2人游戏、4人游戏、多角色游戏等）

## 使用指南

### 为新游戏定义角色

在实现新游戏时，在 `getMetadata()` 中定义 `roleIds`：

```typescript
export class MyNewGameLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'my-new-game',
      name: '我的新游戏',
      description: '游戏规则...',
      minPlayers: 4,
      maxPlayers: 4,
      roleIds: ['north', 'south', 'east', 'west'], // 自定义角色名称
      // ...
    };
  }
  
  initState(ctx: InitContext): GameState {
    // ctx.players 将包含 ['north', 'south', 'east', 'west']
    // 确保角色ID与 roleIds 一致
  }
}
```

## 测试

```bash
# 启动后端
cd backend
npm run dev

# 启动前端
cd frontend
npm run dev

# 访问 /my-nexus
# 选择井字棋，观察角色映射界面应显示 player_X 和 player_O
```

## 迁移指南

如果您之前创建了自定义游戏，请：

1. 在游戏的 `getMetadata()` 中添加 `roleIds` 字段
2. 确保 `roleIds` 与 `initState()` 中使用的角色ID一致
3. 重新编译后端和前端

---

**日期**: 2025-10-31  
**影响范围**: Backend Types, Game Logic, Frontend Types, Frontend UI  
**破坏性更改**: 是（所有游戏必须添加 `roleIds` 字段）
