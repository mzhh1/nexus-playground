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
      // Vercel build context might not have access to ../games if root is frontend
      // specific game import handling would be needed here or in monorepo config
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
      strict: false,
    },
    hmr: {
      clientPort: 443,
    },
    allowedHosts: [
      'nexus.mzhh.xyz',
      'localhost',
      '.localhost',
      '.vercel.app' // Allow Vercel preview URLs
    ],
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
      // Suppress game asset resolution errors for now if they are missing
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source.includes('@games')) {
          return;
        }
        warn(warning);
      }
    },
  },
});

