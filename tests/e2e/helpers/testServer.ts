import { serve } from '@hono/node-server';
import type { Server } from 'node:http';

export interface TestServerInstance {
  baseUrl: string;
  port: number;
  close: () => Promise<void>;
}

let activeServer: TestServerInstance | null = null;

export async function setupTestServer(): Promise<TestServerInstance> {
  if (activeServer) {
    return activeServer;
  }

  process.env.ENABLE_EMAIL_AUTH = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890123456';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/system_design';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';

  // Import app after env vars are set
  const appModule = await import('../../../packages/api/src/index.ts');
  const app = appModule.default;

  return new Promise((resolve, reject) => {
    try {
      const server: Server = serve(
        {
          fetch: app.fetch,
          port: 0,
        },
        (info) => {
          const port = info.port;
          const baseUrl = `http://localhost:${port}`;

          activeServer = {
            baseUrl,
            port,
            close: () =>
              new Promise((res) => {
                server.close(() => {
                  activeServer = null;
                  res();
                });
              }),
          };

          resolve(activeServer);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}
