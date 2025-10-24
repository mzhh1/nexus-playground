import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // Generate JS bundles only; types are produced by tsc via script
  dts: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: [
    '@nexus/shared-types',
    '@autolabz/oauth-sdk',
    'react',
    'react-dom',
    'socket.io-client',
  ],
});

