# 井字棋 (Tic-Tac-Toe)

经典 3x3 双人井字棋游戏，已按新版 `games/<game>/logic + ui + worker` 架构接入。

## 目录结构

```text
games/tic-tac-toe/
├── logic/                 # 纯函数游戏逻辑
├── ui/                    # iframe 内 React UI
├── worker/                # Cloudflare Worker API + 静态资源托管
└── dist/logic.mjs         # 逻辑构建产物
```

## 角色与规则

- `player_X`: 先手
- `player_O`: 后手
- 胜利条件：横/竖/斜任意三连
- 平局条件：棋盘填满且无人获胜

## 本地构建

```bash
cd games/tic-tac-toe
pnpm run build
```

## 本地调试 Worker

```bash
cd games/tic-tac-toe/worker
pnpm run dev
```
