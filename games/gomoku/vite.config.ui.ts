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
            // Bundle everything to ensure it works in isolation
            // external: ['react', 'react-dom', '@nexus/game-sdk'],
            output: {
                // Ensure we get a single file named _ui.js to avoid static asset shadowing
                // This forces requests to /ui.js to go through our Worker (which adds CORS)
                entryFileNames: '_ui.js',
                // globals: {
                //     react: 'React',
                //     'react-dom': 'ReactDOM',
                //     '@nexus/game-sdk': 'NexusGameSDK',
                // },
            },
        },
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
});
