import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        // Build as a self-contained app (not a library)
        // Output goes to worker/public/ for serving via the Worker
        outDir: 'worker/public',
        emptyOutDir: false,
        rollupOptions: {
            input: resolve(__dirname, 'ui/iframe-entry.tsx'),
            output: {
                // Single JS bundle for the iframe
                entryFileNames: '_ui.js',
                // Inline CSS into JS to keep things simple
                assetFileNames: 'style.css',
            },
        },
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});
