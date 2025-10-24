import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Generate JS only; types are not required for runtime
  dts: false,
  clean: true,
  sourcemap: true,
});

