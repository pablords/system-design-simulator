import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { errorHandler } from '../middleware/error-handler.js';

describe('Global Error Handler Middleware', () => {
  it('should format HTTPException responses correctly', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/test-error', () => {
      throw new HTTPException(403, { message: 'Forbidden test error' });
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data).toEqual({
      error: 'HTTPException',
      message: 'Forbidden test error',
      statusCode: 403,
    });
  });

  it('should format unexpected errors as 500 InternalServerError', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/test-unhandled', () => {
      throw new Error('Unexpected crash');
    });

    const res = await app.request('/test-unhandled');
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  });
});
