import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_FRONTEND_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GIT_CLIENT_ID: z.string().optional(),
  GIT_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ENABLE_EMAIL_AUTH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  githubClientId?: string;
  githubClientSecret?: string;
  enableEmailAuth: boolean;
};

function loadEnv(): Env {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Ignore if .env doesn't exist
    }
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  const data = result.data;
  const githubClientId = data.GITHUB_CLIENT_ID || data.GIT_CLIENT_ID;
  const githubClientSecret = data.GITHUB_CLIENT_SECRET || data.GIT_CLIENT_SECRET;
  // Default to false as requested by feature flag
  const enableEmailAuth = data.ENABLE_EMAIL_AUTH === 'true' || data.ENABLE_EMAIL_AUTH === '1';

  return {
    ...data,
    GITHUB_CLIENT_ID: githubClientId,
    GITHUB_CLIENT_SECRET: githubClientSecret,
    githubClientId,
    githubClientSecret,
    enableEmailAuth,
  };
}

export const env = loadEnv();
