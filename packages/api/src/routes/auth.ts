import { Hono } from 'hono';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schema } from '../db/index.js';
import { signToken } from '../lib/jwt.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authRoutes = new Hono();

// POST /register
authRoutes.post('/register', async (c) => {
  const body = registerSchema.parse(await c.req.json());

  // Check if user already exists
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Conflict', message: 'Email already registered', statusCode: 409 }, 409);
  }

  const passwordHash = await hash(body.password, SALT_ROUNDS);

  const [user] = await db
    .insert(schema.users)
    .values({
      email: body.email,
      passwordHash,
      name: body.name,
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    });

  const token = await signToken(user.id);

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    },
    201
  );
});

// POST /login
authRoutes.post('/login', async (c) => {
  const body = loginSchema.parse(await c.req.json());

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 }, 401);
  }

  const valid = await compare(body.password, user.passwordHash);

  if (!valid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 }, 401);
  }

  const token = await signToken(user.id);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// GET /me (protected)
authRoutes.get('/me', authMiddleware, async (c) => {
  const userId = getUserId(c);

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: 'NotFound', message: 'User not found', statusCode: 404 }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /logout (stateless JWT — just acknowledge)
authRoutes.post('/logout', async (c) => {
  return c.json({ message: 'Logged out successfully' });
});
