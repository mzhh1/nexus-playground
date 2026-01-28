import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
    plugins: [
        react(),
        federation({
            name: 'game_gomoku',
            filename: 'remoteEntry.js',
            exposes: {
                './UI': './ui/ui.tsx',
                './metadata': './metadata.ts',
            },
            shared: ['react', 'react-dom', '@nexus/game-sdk'],
        }),
    ],
    build: {
        target: 'esnext',
        minify: false,
        cssCodeSplit: false,
        outDir: 'dist',
        lib: {
            entry: './ui/ui.tsx',
            formats: ['es'],
            fileName: 'ui',
        },
        rollupOptions: {
            external: ['react', 'react-dom'],
            output: {
                format: 'esm',
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
            },
        },
    },
});
