import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

function createDbClient() {
  const url = env.DATABASE_URL;
  if (url.includes('neon.tech') || url.includes('sslmode=require')) {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  } else {
    const queryClient = postgres(url);
    return drizzlePostgres(queryClient, { schema });
  }
}

export const db = createDbClient() as any;
export { schema };
