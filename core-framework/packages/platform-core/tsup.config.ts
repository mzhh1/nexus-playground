import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/llm-adapter/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: [
    '@nexus/shared-types',
    '@nexus/game-sdk',
    '@autolabz/oauth-sdk',
    '@autolabz/llmapi-sdk',
    'pg',
    'redis',
  ],
});

