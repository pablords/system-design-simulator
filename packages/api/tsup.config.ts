import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: ['@system-design/shared'],
  dts: true,
  clean: true,
});
