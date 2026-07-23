import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export type ApiDatabase = NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

function createDbClient(): ApiDatabase {
  const url = env.DATABASE_URL;
  if (url.includes('neon.tech') || url.includes('sslmode=require')) {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  } else {
    const queryClient = postgres(url);
    return drizzlePostgres(queryClient, { schema });
  }
}

export const db: ApiDatabase = createDbClient();
export { schema };

export async function initDb() {
  const url = env.DATABASE_URL;
  try {
    if (url.includes('neon.tech') || url.includes('sslmode=require')) {
      const sql = neon(url);
      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          name TEXT NOT NULL,
          avatar_url TEXT,
          provider TEXT NOT NULL DEFAULT 'email',
          provider_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          canvas JSONB NOT NULL,
          thumbnail TEXT,
          is_public BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
    } else {
      const sql = postgres(url);
      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          name TEXT NOT NULL,
          avatar_url TEXT,
          provider TEXT NOT NULL DEFAULT 'email',
          provider_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          canvas JSONB NOT NULL,
          thumbnail TEXT,
          is_public BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql.end();
    }
    console.log('✅ Database schema tables initialized/verified successfully.');
  } catch (err) {
    console.error('⚠️ Failed to initialize database schema tables:', err);
  }
}
