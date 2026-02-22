# 中国象棋 (Xiangqi)

中国象棋双人对弈游戏，按新版 `games/<game>/logic + ui + worker` 架构接入。

## 目录结构

```text
games/xiangqi/
├── logic/                 # 纯函数游戏逻辑（含将军/困毙判定）
├── ui/                    # iframe 内 React UI
├── worker/                # Cloudflare Worker API + 静态资源托管
└── dist/logic.mjs         # 逻辑构建产物
```

## 角色定义

- `player_red`: 红方（先手）
- `player_black`: 黑方（后手）

## 本地构建

```bash
cd games/xiangqi
pnpm run build
```

## 本地调试 Worker

```bash
cd games/xiangqi/worker
pnpm run dev
```
