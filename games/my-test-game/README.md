# my-test-game

这是一个通过 `nexus-dev create-game` 生成的云原生桌游沙盒游戏项目。

## 目录结构

```
├── logic/
│   └── index.ts            # (你需要实现) 游戏逻辑层，必须为纯函数
├── ui/
│   ├── ui.tsx              # (你需要实现) 游戏核心 UI
│   ├── ui.module.css       # UI 样式
│   ├── iframe-entry.tsx    # (已生成) 自动处理平台通信的外壳
│   └── game-ui.html        # UI 承载页
└── worker/
    ├── src/index.ts        # (已生成) 提供平台底层对接 API 和资源路由
    └── wrangler.toml       # (已生成) Cloudflare Worker 部署配置
```

## 如何开发

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **本地调试**
   ```bash
   pnpm run dev
   ```
   启动本地 Worker 后，在 Nexus Admin 管理后台中将游戏的 `gameWorkerUrl` 指向本地地址即可全链路测试。

3. **打包发布**
   在根目录下执行：
   ```bash
   make deploy-game G=my-test-game
   ```
