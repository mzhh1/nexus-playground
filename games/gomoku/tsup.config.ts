import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { logic: 'logic/index.ts' },
    format: ['esm'],
    dts: false,
    clean: true,
    external: ['@nexusgame/game-sdk'], // SDK provided by host
    outDir: 'dist',
    target: 'node18',
    noExternal: [], // Bundle everything else EXCEPT external
    outExtension() {
        return {
            js: '.mjs',
        };
    },
});
