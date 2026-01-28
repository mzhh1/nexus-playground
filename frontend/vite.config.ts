import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';

// 从环境变量读取端口配置
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// 游戏 CDN 基础 URL（从环境变量读取）
const GAME_CDN_BASE = process.env.VITE_GAME_CDN_BASE || 'http://localhost:8080';

// 启用的游戏列表（从环境变量读取，逗号分隔）
const ENABLED_GAMES = (process.env.VITE_ENABLED_GAMES || 'tic-tac-toe,gomoku,xiangqi,werewolf').split(',');

// 动态生成 remotes 配置
const gameRemotes: Record<string, string> = {};
for (const gameId of ENABLED_GAMES) {
  const normalizedId = gameId.trim().replace(/-/g, '_');
  gameRemotes[`game_${normalizedId}`] = `${GAME_CDN_BASE}/${gameId}/remoteEntry.js`;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'nexus_host',
      // remotes 可以在运行时动态覆盖，这里是构建时默认值
      remotes: gameRemotes,
      shared: {
        react: {
          singleton: true,
          requiredVersion: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: false,
        },
        '@nexus/game-sdk': {
          singleton: true,
          requiredVersion: false,
          version: '0.1.0',
          packagePath: '../packages/game-sdk/package.json',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@games': path.resolve(__dirname, '../games'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    watch: {
      usePolling: true, // For Docker compatibility
    },
    fs: {
      // 允许访问node_modules和games目录
      allow: [
        // 允许访问整个项目目录
        path.resolve(__dirname),
        // 允许访问games目录
        path.resolve(__dirname, '../games'),
        // 允许访问packages目录（SDK）
        path.resolve(__dirname, '../packages'),
      ],
      strict: false, // 在开发环境中放宽文件系统限制
    },
    // 允许从nginx代理访问
    hmr: {
      // 只设置 clientPort，让客户端使用当前页面的主机名
      clientPort: 443,
    },
    // 允许的域名列表
    allowedHosts: [
      'nexus.mzhh.xyz',
      'localhost',
      '.localhost',
    ],
  },
  build: {
    target: 'esnext',
    minify: false,
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        'my-nexus': path.resolve(__dirname, 'my-nexus.html'),
        room: path.resolve(__dirname, 'room.html'),
        callback: path.resolve(__dirname, 'callback.html'),
      },
    },
  },
});
