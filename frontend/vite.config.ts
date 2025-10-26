import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 从环境变量读取端口配置
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);
const NGINX_PORT = parseInt(process.env.NGINX_PORT || '80', 10);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
      ],
      strict: false, // 在开发环境中放宽文件系统限制
    },
    // 允许从nginx代理访问
    hmr: {
      clientPort: NGINX_PORT, // 使用nginx端口进行HMR
    },
  },
  build: {
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

