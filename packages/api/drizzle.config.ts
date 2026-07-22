import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  schema: fileURLToPath(new URL('./src/db/schema.ts', import.meta.url)),
  out: fileURLToPath(new URL('./drizzle', import.meta.url)),
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/system_design',
  },
});
