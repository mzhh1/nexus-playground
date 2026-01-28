import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const MONITOR_PORT = parseInt(
  process.env.LLM_MONITOR_PORT || process.env.FRONTEND_PORT || '5174',
  10
);

const BASE_PATH = process.env.VITE_MONITOR_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: MONITOR_PORT,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    allowedHosts: ['localhost', '.localhost', 'llm-monitor', 'nexus.mzhh.xyz'],
  },
  preview: {
    port: MONITOR_PORT,
  },
});

