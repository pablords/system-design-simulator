import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyToken } from '../lib/jwt.js';

type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const { userId } = await verifyToken(token);
    c.set('userId', userId);
    await next();
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
});

export function getUserId(c: { get: (key: 'userId') => string }): string {
  return c.get('userId');
}
