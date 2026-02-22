import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { logic: 'logic/index.ts' },
    format: ['esm'],
    dts: false,
    clean: true,
    external: ['@nexus/game-sdk'],
    outDir: 'dist',
    target: 'node18',
    noExternal: [],
    outExtension() {
        return {
            js: '.mjs',
        };
    },
});
