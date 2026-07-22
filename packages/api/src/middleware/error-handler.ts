import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: 'HTTPException',
        message: err.message,
        statusCode: err.status,
      },
      err.status
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        details: err.flatten().fieldErrors,
      },
      400
    );
  }

  return c.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      statusCode: 500,
    },
    500
  );
};
