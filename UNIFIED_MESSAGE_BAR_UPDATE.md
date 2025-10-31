# 统一消息状态栏更新说明

**更新日期**: 2025-10-31

## 概述

本次更新引入了**统一消息状态栏**设计，旨在提升所有游戏的用户体验一致性，简化游戏开发流程。消息栏固定在页面底部，采用统一的简洁风格，与控制栏保持视觉一致性。

## 核心理念

**游戏提供内容，平台统一渲染**

### 设计优势

1. **用户体验一致性**
   - 所有游戏的状态提示使用统一的样式和位置
   - 用户在不同游戏间切换时有一致的体验
   - 平台可以统一管理主题、动画、国际化

2. **简化游戏开发**
   - 游戏开发者无需关心状态消息的样式和布局
   - 减少重复代码，专注游戏核心逻辑
   - 降低UI层复杂度

3. **灵活的平台控制**
   - 平台可以根据需求调整消息栏样式而不影响游戏
   - 支持暗黑/明亮主题切换
   - 便于添加新功能（如消息历史、通知等）

## 技术实现

### 1. 接口变更

在 `RolePerspective` 接口中添加了可选的 `message` 字段：

```typescript
export interface RolePerspective {
  global_rules: string;
  whole_history: HistoryEvent[];
  diff_history: HistoryEvent[];
  current_state: any;
  your_role: {
    identity: string;
    goal: string;
    is_current: boolean;
  };
  action_space_definition: ActionSpec;
  
  /**
   * 统一消息状态栏内容 (由平台渲染)
   * 用于向玩家显示当前游戏状态、提示信息等
   */
  message?: string;
  
  [key: string]: any;
}
```

### 2. 架构层次变更

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          平台前端 (Nexus Frontend)                    │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  NexusControlBar (平台组件)                    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  统一消息状态栏 (Message Bar - 平台渲染) ★NEW │  │  │
│  │  │  - 左侧显示当前角色 (your_role.identity)     │  │  │
│  │  │  - 中央显示游戏状态消息 (message)            │  │  │
│  │  │  - 固定在页面底部，统一风格                  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  游戏UI容器 (Game UI Container)                │  │  │
│  │  │  - 专注游戏核心内容渲染                       │  │  │
│  │  │  - 不再包含状态消息显示                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3. 职责划分

| 层次 | 变更前 | 变更后 |
|------|--------|--------|
| **平台控制层** | 房间管理、权限控制 | + 统一消息状态栏渲染 |
| **游戏逻辑层** | 规则定义、状态推演 | + 生成消息内容 (`message` 字段) |
| **游戏UI层** | 视角渲染、交互、状态消息显示 | 视角渲染、交互（不含状态消息） |

### 4. 消息栏布局

消息栏采用固定在页面底部的设计，包含以下元素：

```
┌─────────────────────────────────────────────────────────────┐
│  [角色标识]              状态消息文本                        │
│   (左对齐)                 (居中)                            │
└─────────────────────────────────────────────────────────────┘
```

**布局特性：**
- **角色标识** (`your_role.identity`)：
  - 位置：左下角
  - 样式：圆角徽章，灰色背景
  - 作用：让玩家清楚知道自己当前的角色
  
- **状态消息** (`message`)：
  - 位置：居中显示
  - 样式：统一字体和颜色
  - 作用：显示游戏当前状态和提示信息

- **响应式设计**：
  - 在小屏幕上自动调整字体大小和内边距
  - 保持与控制栏一致的视觉风格

## 消息内容规范

### 推荐的消息类型

| 场景 | 消息示例 | 建议 Emoji |
|------|---------|-----------|
| 轮到玩家 | "轮到你了，请选择你的行动" | ✨ 或 🎯 |
| 等待对手 | "等待玩家 X 行动..." | ⏳ 或 👀 |
| 玩家获胜 | "游戏结束 - 你获胜了！" | 🎉 或 👑 |
| 玩家失败 | "游戏结束 - 玩家 O 获胜" | 😔 或 💔 |
| 平局 | "游戏结束 - 平局" | 🤝 或 ⚖️ |
| 警告/错误 | "无效操作，请重新选择" | ⚠️ 或 ❌ |
| 特殊事件 | "触发特殊技能！" | ⚡ 或 🌟 |

### 实现示例

```typescript
toRolePerspective(state, roleId, wholeHistory, diffHistory): RolePerspective {
  let message = '';
  
  // 游戏结束消息
  if (state.winner) {
    if (state.winner === roleId) {
      message = '🎉 游戏结束 - 你获胜了！';
    } else {
      message = `😔 游戏结束 - 玩家 ${getOpponentName(state)} 获胜`;
    }
  }
  // 平局消息
  else if (state.isDraw) {
    message = '🤝 游戏结束 - 平局';
  }
  // 轮到当前玩家
  else if (this.getCurrentRole(state) === roleId) {
    message = '✨ 轮到你了，请选择你的行动';
  }
  // 等待其他玩家
  else {
    message = `⏳ 等待玩家 ${getCurrentPlayerName(state)} 行动...`;
  }
  
  return {
    // ... 其他字段
    message,
  };
}
```

## 迁移指南

### 对于新游戏

在 `toRolePerspective()` 方法中添加消息生成逻辑：

```typescript
toRolePerspective(state, roleId, wholeHistory, diffHistory) {
  // 1. 生成消息内容
  let message = '';
  if (/* 游戏结束 */) {
    message = /* 结束消息 */;
  } else if (/* 轮到玩家 */) {
    message = '✨ 轮到你了，请选择你的行动';
  } else {
    message = '⏳ 等待其他玩家行动...';
  }
  
  // 2. 返回视角（包含 message 字段）
  return {
    // ... 其他字段
    message,
  };
}
```

### 对于现有游戏（可选升级）

1. **游戏逻辑层**：在 `toRolePerspective()` 中添加 `message` 字段
2. **游戏UI层**：移除状态消息显示相关代码
3. **样式层**：移除状态消息相关 CSS

## 更新的文件

### 文档
- ✅ `game_integration_guide.md`
  - 更新架构图，添加统一消息状态栏
  - 新增第 3.3 节：统一消息状态栏设计
  - 更新接口定义，添加 `message` 字段说明
  - 更新所有示例代码

### 井字棋示例（参考实现）
- ✅ `games/tic-tac-toe/logic/index.ts`
  - 在 `toRolePerspective()` 中添加消息生成逻辑
  
- ✅ `games/tic-tac-toe/ui/ui.tsx`
  - 移除 `renderStatus()` 函数
  - 简化组件结构
  
- ✅ `games/tic-tac-toe/ui/ui.module.css`
  - 移除状态消息相关样式
  
- ✅ `games/tic-tac-toe/CHANGELOG.md`
  - 详细记录本次更新

## 向后兼容性

✅ **完全向后兼容**

- `message` 字段为可选，旧版本游戏可以继续正常工作
- 平台会为没有 `message` 字段的游戏提供默认消息
- 不影响现有游戏的任何功能

## 下一步工作

### 平台端（待实现）

1. **创建统一消息栏组件**
   ```tsx
   // frontend/src/components/GameMessageBar.tsx
   export function GameMessageBar({ perspective }: { perspective: RolePerspective }) {
     const message = perspective.message || '准备开始游戏...';
     const messageType = inferMessageType(message);
     
     return (
       <div className={`game-message-bar ${messageType}`}>
         <span className="message-content">{message}</span>
       </div>
     );
   }
   ```

2. **添加样式定义**
   ```css
   /* frontend/src/styles/game-message-bar.css */
   .game-message-bar {
     /* 统一样式 */
   }
   
   .game-message-bar.success { /* 获胜消息 */ }
   .game-message-bar.waiting { /* 等待消息 */ }
   .game-message-bar.info { /* 常规消息 */ }
   ```

3. **集成到房间页面**
   - 在 `Room.tsx` 中添加 `<GameMessageBar />` 组件
   - 位置：控制栏下方，游戏UI上方

### 游戏端（建议）

建议其他游戏也采用统一消息栏设计：
- 围棋 (Go)
- 德州扑克 (Poker)
- 其他棋牌游戏

## 参考资料

- 详细设计文档：`game_integration_guide.md` 第 3.3 节
- 完整示例：`game_integration_guide.md` 第 9.2 节
- 井字棋更新记录：`games/tic-tac-toe/CHANGELOG.md`

## 联系方式

如有问题或建议，请联系开发团队。

