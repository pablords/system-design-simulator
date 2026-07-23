import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@system-design/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
});
