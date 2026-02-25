import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output goes to worker/public/ for serving via the Worker
    outDir: 'worker/public',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'ui/iframe-entry.tsx'),
      output: {
        entryFileNames: '_ui.js',
        assetFileNames: 'style.css',
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: true
  }
});
