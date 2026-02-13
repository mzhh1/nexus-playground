import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: resolve(__dirname, 'ui/ui.tsx'),
            name: 'GomokuUI',
            fileName: 'ui',
            formats: ['es'],
        },
        outDir: 'worker/public',
        emptyOutDir: false, // Don't empty, we might have other assets
        rollupOptions: {
            external: ['react', 'react-dom', '@nexus/game-sdk'],
            output: {
                // Ensure we get a single file named ui.js
                entryFileNames: 'ui.js',
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@nexus/game-sdk': 'NexusGameSDK',
                },
            },
        },
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});
