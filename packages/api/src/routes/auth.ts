import { Hono } from 'hono';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schema } from '../db/index.js';
import { signToken } from '../lib/jwt.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { env } from '../config/env.js';

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

function getApiRedirectUri(c: any, provider: 'github' | 'google'): string {
  const host = c.req.header('host') || `localhost:${env.PORT}`;
  const protocol = c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/api/v1/auth/${provider}/callback`;
}

export const authRoutes = new Hono();

// GET /config — Public auth feature flags configuration
authRoutes.get('/config', (c) => {
  return c.json({
    enableEmailAuth: env.enableEmailAuth,
    hasGithub: Boolean(env.GITHUB_CLIENT_ID || env.GIT_CLIENT_ID),
    hasGoogle: Boolean(env.GOOGLE_CLIENT_ID),
  });
});

// POST /register
authRoutes.post('/register', async (c) => {
  if (!env.enableEmailAuth) {
    return c.json({ error: 'Forbidden', message: 'Cadastro por e-mail e senha está temporariamente desativado.', statusCode: 403 }, 403);
  }

  const body = registerSchema.parse(await c.req.json());

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
      provider: 'email',
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
      provider: schema.users.provider,
      createdAt: schema.users.createdAt,
    });

  const token = await signToken(user.id);

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    },
    201
  );
});

// POST /login
authRoutes.post('/login', async (c) => {
  if (!env.enableEmailAuth) {
    return c.json({ error: 'Forbidden', message: 'Login por e-mail e senha está temporariamente desativado.', statusCode: 403 }, 403);
  }

  const body = loginSchema.parse(await c.req.json());

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (!user || !user.passwordHash) {
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
      avatarUrl: user.avatarUrl,
      provider: user.provider,
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
      avatarUrl: schema.users.avatarUrl,
      provider: schema.users.provider,
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
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /logout (stateless JWT — just acknowledge)
authRoutes.post('/logout', async (c) => {
  return c.json({ message: 'Logged out successfully' });
});

// --- OAUTH PROVIDERS ---

// GET /github — Redirect to GitHub OAuth Authorization
authRoutes.get('/github', (c) => {
  const clientId = env.GITHUB_CLIENT_ID || env.GIT_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: 'NotConfigured', message: 'GITHUB_CLIENT_ID/GIT_CLIENT_ID is not configured in API environment', statusCode: 500 }, 500);
  }
  const redirectUri = getApiRedirectUri(c, 'github');
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return c.redirect(url);
});

// GET /github/callback
authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.redirect(`${env.APP_FRONTEND_URL}/?error=MissingCode`);
  }

  const clientId = env.GITHUB_CLIENT_ID || env.GIT_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET || env.GIT_CLIENT_SECRET;

  try {
    const redirectUri = getApiRedirectUri(c, 'github');
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return c.redirect(`${env.APP_FRONTEND_URL}/?error=GitHubAuthFailed`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'System-Design-Simulator' },
    });
    const ghUser = await userRes.json();

    let email = ghUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'System-Design-Simulator' },
      });
      const emails = await emailRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e: any) => e.primary) || emails[0];
        email = primary?.email;
      }
    }

    if (!email) {
      return c.redirect(`${env.APP_FRONTEND_URL}/?error=NoEmailFromGitHub`);
    }

    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      await db
        .update(schema.users)
        .set({
          avatarUrl: ghUser.avatar_url || existing[0].avatarUrl,
          provider: 'github',
          providerId: String(ghUser.id),
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    } else {
      const [inserted] = await db
        .insert(schema.users)
        .values({
          email,
          name: ghUser.name || ghUser.login || 'GitHub User',
          avatarUrl: ghUser.avatar_url || null,
          provider: 'github',
          providerId: String(ghUser.id),
        })
        .returning({ id: schema.users.id });
      userId = inserted.id;
    }

    const token = await signToken(userId);
    return c.redirect(`${env.APP_FRONTEND_URL}/?token=${token}`);
  } catch (err) {
    console.error('GitHub OAuth Callback Error:', err);
    return c.redirect(`${env.APP_FRONTEND_URL}/?error=OAuthServerError`);
  }
});

// GET /google — Redirect to Google OAuth Authorization
authRoutes.get('/google', (c) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return c.json({ error: 'NotConfigured', message: 'GOOGLE_CLIENT_ID is not configured in API environment', statusCode: 500 }, 500);
  }
  const redirectUri = getApiRedirectUri(c, 'google');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile`;
  return c.redirect(url);
});

// GET /google/callback
authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.redirect(`${env.APP_FRONTEND_URL}/?error=MissingCode`);
  }

  try {
    const redirectUri = getApiRedirectUri(c, 'google');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return c.redirect(`${env.APP_FRONTEND_URL}/?error=GoogleAuthFailed`);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();

    if (!gUser.email) {
      return c.redirect(`${env.APP_FRONTEND_URL}/?error=NoEmailFromGoogle`);
    }

    const existing = await db.select().from(schema.users).where(eq(schema.users.email, gUser.email)).limit(1);

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      await db
        .update(schema.users)
        .set({
          avatarUrl: gUser.picture || existing[0].avatarUrl,
          provider: 'google',
          providerId: String(gUser.id || gUser.sub || ''),
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    } else {
      const [inserted] = await db
        .insert(schema.users)
        .values({
          email: gUser.email,
          name: gUser.name || 'Google User',
          avatarUrl: gUser.picture || null,
          provider: 'google',
          providerId: String(gUser.id || gUser.sub || ''),
        })
        .returning({ id: schema.users.id });
      userId = inserted.id;
    }

    const token = await signToken(userId);
    return c.redirect(`${env.APP_FRONTEND_URL}/?token=${token}`);
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    return c.redirect(`${env.APP_FRONTEND_URL}/?error=OAuthServerError`);
  }
});
