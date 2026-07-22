import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Global error handler
app.onError(errorHandler);

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/projects', projectRoutes);

// Start server
console.log(`🚀 API server starting on port ${env.PORT}`);
serve({
  fetch: app.fetch,
  port: env.PORT,
});
console.log(`✅ API server running at http://localhost:${env.PORT}`);

export default app;
