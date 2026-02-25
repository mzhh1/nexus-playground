import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['worker/src/index.ts', 'logic/index.ts'],
  format: ['esm'],
  target: 'esnext',
  clean: false,
  dts: false,
  outDir: 'dist/logic',
});
