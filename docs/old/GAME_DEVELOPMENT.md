# Nexus Playground - 游戏开发指南

本指南将教你如何在Nexus Playground平台上开发新游戏。

## 🎯 核心概念

### USADL (Universal State and Action Description Language)

Nexus Playground基于USADL架构，三个核心概念：

1. **GlobalState (全局状态)**: 服务器端的唯一真实数据源
2. **RolePerspective (角色视角)**: 为每个角色生成的客户端视图
3. **RoleMapping (角色映射)**: 定义谁扮演哪个角色（人类/LLM）

### 游戏循环

所有游戏都遵循统一的循环：

```
初始化 → 回合开始 → 生成视角 → 等待行动 → 验证行动 → 执行行动 → 
检查结束条件 → 回合结束 → [继续/结束]
```

## 📁 项目结构

创建新游戏时，使用以下目录结构：

```
games/
└── your-game/
    ├── game-logic/          # 游戏逻辑（后端）
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── tsup.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts     # 游戏特定类型
    │       └── YourGame.ts  # 游戏类（继承GameLoop）
    └── ui/                  # 游戏UI（前端）
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── Dockerfile
        ├── nginx.conf
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── pages/
            └── components/
```

## 🛠️ 步骤1：定义游戏类型

在 `game-logic/src/types.ts` 中定义游戏特定的类型：

```typescript
import type {
  GlobalState,
  RolePerspective,
  PlayerAction,
  GameResult,
} from '@nexus/shared-types';

// 1. 定义全局状态
export interface YourGameGlobalState extends GlobalState {
  game_rules: string;
  history: YourGameAction[];
  current_state: {
    // 游戏特定的状态字段
    board: any;
    current_player: string;
    turn: number;
    status: 'waiting' | 'playing' | 'finished';
  };
}

// 2. 定义行动类型
export interface YourGameAction extends PlayerAction {
  action_type: 'move' | 'pass' | ...;
  parameters: {
    // 行动特定的参数
    position: number;
  };
}

// 3. 定义角色视角
export interface YourGameRolePerspective extends RolePerspective {
  global_rules: string;
  whole_history: YourGameAction[];
  diff_history: YourGameAction[];
  current_state: {
    // 根据游戏信息类型过滤状态
    // 完美信息：返回所有状态
    // 不完美信息：只返回该角色应知道的状态
  };
  your_role: {
    role_id: string;
    description: string;
    goal: string;
  };
  action_space_definition: {
    mode: 'explicit_list' | 'template';
    available_actions?: Array<{
      action_type: string;
      parameters: any;
      description: string;
    }>;
  };
}

// 4. 定义游戏结果
export interface YourGameResult extends GameResult {
  winner: string | 'draw';
  // 其他结果信息
}
```

## 🎮 步骤2：实现游戏逻辑

在 `game-logic/src/YourGame.ts` 中实现游戏类：

```typescript
import { GameLoop } from '@nexusgame/game-sdk';
import type {
  RoleMapping,
  ActionValidationResult,
  ActionExecutionResult,
} from '@nexus/shared-types';
import type {
  YourGameGlobalState,
  YourGameAction,
  YourGameRolePerspective,
  YourGameResult,
} from './types';

export class YourGame extends GameLoop<
  YourGameGlobalState,
  YourGameRolePerspective,
  YourGameAction,
  YourGameResult
> {
  constructor(roleMapping: RoleMapping) {
    super(roleMapping);
  }

  // 1. 初始化游戏状态
  protected initializeState(): YourGameGlobalState {
    return {
      game_rules: '游戏规则描述...',
      history: [],
      current_state: {
        board: /* 初始棋盘 */,
        current_player: 'player_1',
        turn: 1,
        status: 'playing',
      },
    };
  }

  // 2. 游戏开始钩子
  protected onGameStart(): void {
    console.log('[YourGame] 游戏开始');
    this.eventBus.emit('game:started', {
      timestamp: Date.now(),
    });
  }

  // 3. 回合开始钩子
  protected onTurnStart(roleId: string): void {
    console.log(`[YourGame] ${roleId} 的回合`);
  }

  // 4. 获取当前行动角色
  public getCurrentRole(): string {
    return this.getGlobalState().current_state.current_player;
  }

  // 5. 生成角色视角
  protected generatePerspective(roleId: string): YourGameRolePerspective {
    const state = this.getGlobalState();

    // 完美信息游戏：返回完整状态
    // 不完美信息游戏：过滤敏感信息
    
    return {
      global_rules: state.game_rules,
      whole_history: [...state.history],
      diff_history: [...state.history],
      current_state: {
        // 根据roleId过滤状态
        board: this.filterBoardForRole(state.current_state.board, roleId),
        current_player: state.current_state.current_player,
        turn: state.current_state.turn,
        status: state.current_state.status,
      },
      your_role: {
        role_id: roleId,
        description: `你是 ${roleId}`,
        goal: '获得胜利',
      },
      action_space_definition: {
        mode: 'explicit_list',
        available_actions: this.getAvailableActions(roleId),
      },
    };
  }

  // 6. 验证行动
  protected validateAction(
    action: YourGameAction,
    roleId: string
  ): ActionValidationResult {
    const state = this.getGlobalState();

    // 检查是否轮到该角色
    if (state.current_state.current_player !== roleId) {
      return { valid: false, error: '现在不是你的回合' };
    }

    // 检查行动是否合法
    if (!this.isValidMove(action)) {
      return { valid: false, error: '无效的行动' };
    }

    return { valid: true };
  }

  // 7. 执行行动
  protected executeAction(
    action: YourGameAction,
    roleId: string
  ): ActionExecutionResult {
    const state = this.getGlobalState();

    // 更新游戏状态
    // ... 修改 state.current_state

    // 添加到历史
    state.history.push({
      ...action,
      role_id: roleId,
      timestamp: Date.now(),
    });

    return {
      success: true,
      state_changes: {
        // 返回变更的状态
      },
    };
  }

  // 8. 回合结束钩子
  protected onTurnEnd(roleId: string): void {
    const state = this.getGlobalState();
    
    // 切换到下一个玩家
    state.current_state.current_player = this.getNextPlayer(roleId);
    state.current_state.turn += 1;
  }

  // 9. 检查游戏结束
  protected checkGameEnd(): YourGameResult | null {
    const state = this.getGlobalState();

    // 检查胜利条件
    const winner = this.checkWinner();
    if (winner) {
      return {
        winner,
        role_results: {
          /* 每个角色的结果 */
        },
      };
    }

    // 检查平局
    if (this.isDraw()) {
      return {
        winner: 'draw',
        role_results: {
          /* 每个角色的结果 */
        },
      };
    }

    return null; // 游戏继续
  }

  // 10. 游戏结束钩子
  protected onGameEnd(result: YourGameResult): void {
    const state = this.getGlobalState();
    state.current_state.status = 'finished';
    
    console.log(`[YourGame] 游戏结束: ${result.winner}`);
    this.eventBus.emit('game:ended', { result });
  }

  // 辅助方法
  private filterBoardForRole(board: any, roleId: string): any {
    // 完美信息游戏：直接返回
    // 不完美信息游戏：过滤隐藏信息
    return board;
  }

  private getAvailableActions(roleId: string): any[] {
    // 返回当前可用的行动列表
    return [];
  }

  private isValidMove(action: YourGameAction): boolean {
    // 检查行动是否合法
    return true;
  }

  private getNextPlayer(currentPlayer: string): string {
    // 返回下一个玩家
    return 'player_2';
  }

  private checkWinner(): string | null {
    // 检查是否有获胜者
    return null;
  }

  private isDraw(): boolean {
    // 检查是否平局
    return false;
  }
}
```

## 🎨 步骤3：实现游戏UI

### 3.1 创建package.json

```json
{
  "name": "@nexus/your-game-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@nexus/shared-types": "workspace:*",
    "@nexus/web-client": "workspace:*",
    "@nexus/your-game-logic": "workspace:*",
    "@autolabz/oauth-sdk": "latest",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  }
}
```

### 3.2 配置Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/games/your-game/',  // 重要：设置正确的base路径
  server: {
    port: 3002,
    host: '0.0.0.0',
  },
});
```

### 3.3 创建游戏组件

```typescript
// src/components/GameBoard.tsx
import { useEffect, useState } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import { WebSocketClient } from '@nexus/web-client';
import type { YourGameRolePerspective } from '@nexus/your-game-logic';

interface GameBoardProps {
  roomId: string;
}

export function GameBoard({ roomId }: GameBoardProps) {
  const { user } = useOAuth();
  const [ws, setWs] = useState<WebSocketClient | null>(null);
  const [perspective, setPerspective] = useState<YourGameRolePerspective | null>(null);

  useEffect(() => {
    const wsClient = new WebSocketClient(
      import.meta.env.VITE_WS_URL || '/ws',
      localStorage.getItem('autolab_oauth_access_token') || ''
    );

    wsClient.on('connect', () => {
      wsClient.send('room:join', { roomId, roleId: 'player_1' });
    });

    wsClient.on('game:state-update', (data: any) => {
      setPerspective(data.perspective);
    });

    wsClient.connect();
    setWs(wsClient);

    return () => wsClient.disconnect();
  }, [roomId]);

  const handleAction = (action: any) => {
    if (!ws) return;

    ws.send('game:action', {
      roomId,
      action: {
        ...action,
        role_id: perspective?.your_role.role_id,
        timestamp: Date.now(),
      },
    });
  };

  if (!perspective) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* 渲染游戏界面 */}
      <h2>你的回合: {perspective.your_role.role_id}</h2>
      
      {/* 根据perspective渲染棋盘 */}
      {/* 根据available_actions渲染可用操作 */}
      
      <button onClick={() => handleAction({
        action_type: 'move',
        parameters: { position: 0 }
      })}>
        执行行动
      </button>
    </div>
  );
}
```

## 🐳 步骤4：配置Docker

### 4.1 创建Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY games/your-game/ui/package.json ./games/your-game/ui/
COPY core-framework/packages/shared-types ./core-framework/packages/shared-types
COPY core-framework/packages/web-client ./core-framework/packages/web-client
COPY games/your-game/game-logic ./games/your-game/game-logic

RUN pnpm install --frozen-lockfile

COPY games/your-game/ui ./games/your-game/ui
COPY tsconfig.json ./

RUN pnpm --filter @nexus/shared-types build
RUN pnpm --filter @nexus/web-client build
RUN pnpm --filter @nexus/your-game-logic build

ARG VITE_API_BASE_URL=/api
ARG VITE_WS_URL=/ws

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

RUN pnpm --filter @nexus/your-game-ui build

FROM nginx:alpine
COPY --from=builder /app/games/your-game/ui/dist /usr/share/nginx/html
COPY games/your-game/ui/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.2 添加到docker-compose.yml

```yaml
game-your-game:
  build:
    context: .
    dockerfile: ./games/your-game/ui/Dockerfile
    args:
      VITE_API_BASE_URL: /api
      VITE_WS_URL: /ws
  container_name: nexus-game-your-game
  networks:
    - nexus-playground-network
```

### 4.3 更新nginx.conf（主配置）

```nginx
location /games/your-game/ {
    proxy_pass http://game_your_game/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

## ✅ 步骤5：注册游戏

在API Server中注册游戏（`core-framework/api-server/src/routes/games.ts`）：

```typescript
const games = [
  // ... 现有游戏
  {
    id: 'your-game',
    name: 'Your Game',
    description: 'Your game description',
    minPlayers: 2,
    maxPlayers: 4,
    supportsAI: true,
    gameType: 'turn-based',
    informationType: 'imperfect',
  },
];
```

## 🧪 步骤6：测试

### 6.1 本地测试

```bash
# 启动API Server
cd core-framework/api-server
pnpm dev

# 启动游戏UI
cd games/your-game/ui
pnpm dev
```

### 6.2 Docker测试

```bash
docker-compose up -d --build
./scripts/test-e2e.sh
```

## 📚 参考示例

查看井字棋实现作为参考：

- 游戏逻辑: `games/tic-tac-toe/game-logic/`
- 游戏UI: `games/tic-tac-toe/ui/`

## 💡 最佳实践

### 1. 状态管理
- 全局状态只在服务器端维护
- 客户端通过角色视角获取状态
- 使用EventBus广播重要事件

### 2. 不完美信息处理
```typescript
protected generatePerspective(roleId: string): YourGameRolePerspective {
  const state = this.getGlobalState();
  
  // 过滤其他玩家的手牌
  const visibleCards = state.current_state.cards.filter(
    card => card.owner === roleId || card.revealed
  );
  
  return {
    // ... 只返回该角色应该看到的信息
    current_state: {
      myCards: visibleCards.filter(c => c.owner === roleId),
      opponentCardCount: state.current_state.cards.filter(
        c => c.owner !== roleId
      ).length,
    },
  };
}
```

### 3. 行动空间
```typescript
// 显式列表模式（适合小行动空间）
action_space_definition: {
  mode: 'explicit_list',
  available_actions: [
    { action_type: 'move', parameters: { position: 0 }, description: '移动到0' },
    { action_type: 'move', parameters: { position: 1 }, description: '移动到1' },
  ]
}

// 模板模式（适合大行动空间）
action_space_definition: {
  mode: 'template',
  action_template: {
    action_type: 'move',
    parameters: {
      row: { type: 'integer', min: 0, max: 18 },
      col: { type: 'integer', min: 0, max: 18 }
    }
  }
}
```

### 4. LLM适配
- 提供清晰的规则描述
- 使用自然语言描述可用行动
- 在行动验证中提供详细的错误信息

## 🆘 常见问题

### Q: 如何处理多人游戏的回合顺序？
A: 在`current_state`中维护`current_player`字段，在`onTurnEnd`中更新。

### Q: 如何实现观战功能？
A: 为观察者角色生成特殊的`RolePerspective`，不包含在`RoleMapping`的活跃玩家中。

### Q: 如何支持AI玩家？
A: 在`RoleMapping`中将角色类型设置为`llm`，平台会自动调用LLM API。

---

**需要帮助？** 查看 [API文档](./API.md) 或 [加入讨论](https://github.com/your-repo/discussions)


