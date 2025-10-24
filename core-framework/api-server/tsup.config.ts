import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'node20',
  external: [
    '@nexus/shared-types',
    '@nexus/game-sdk',
    '@nexus/platform-core',
    'express',
    'socket.io',
    'pg',
    'redis',
  ],
});

