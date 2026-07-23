import { Hono } from 'hono';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { DrizzleUserRepository, type IUserRepository } from '../repositories/user.repository.js';
import { signToken } from '../lib/jwt.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { env } from '../config/env.js';

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

function getFrontendUrl(c: any): string {
  if (env.APP_FRONTEND_URL && !env.APP_FRONTEND_URL.includes('localhost')) {
    return env.APP_FRONTEND_URL.replace(/\/$/, '');
  }
  if (env.CORS_ORIGIN && !env.CORS_ORIGIN.includes('localhost')) {
    return env.CORS_ORIGIN.replace(/\/$/, '');
  }
  const referer = c.req.header('referer') || c.req.header('origin');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }
  return env.APP_FRONTEND_URL.replace(/\/$/, '');
}

export function createAuthRoutes(customAuthService?: AuthService, customUserRepo?: IUserRepository) {
  const userRepo = customUserRepo || new DrizzleUserRepository();
  const authService = customAuthService || new AuthService(userRepo);

  const authRoutes = new Hono();

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

    try {
      const user = await authService.register(body.email, body.password, body.name);
      const token = await signToken(user.id);

      const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();

      return c.json(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            provider: user.provider,
            createdAt: createdAtStr,
          },
          token,
        },
        201
      );
    } catch (err: any) {
      if (err instanceof Error && err.message === 'User already exists') {
        return c.json({ error: 'Conflict', message: 'Email already registered', statusCode: 409 }, 409);
      }
      throw err;
    }
  });

  // POST /login
  authRoutes.post('/login', async (c) => {
    if (!env.enableEmailAuth) {
      return c.json({ error: 'Forbidden', message: 'Login por e-mail e senha está temporariamente desativado.', statusCode: 403 }, 403);
    }

    const body = loginSchema.parse(await c.req.json());

    try {
      const user = await authService.authenticate(body.email, body.password);
      const token = await signToken(user.id);

      const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();

      return c.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          provider: user.provider,
          createdAt: createdAtStr,
        },
        token,
      });
    } catch (err: any) {
      if (err instanceof Error && err.message === 'Invalid credentials') {
        return c.json({ error: 'Unauthorized', message: 'Invalid credentials', statusCode: 401 }, 401);
      }
      throw err;
    }
  });

  // GET /me (protected)
  authRoutes.get('/me', authMiddleware, async (c) => {
    const userId = getUserId(c);
    const user = await userRepo.findById(userId);

    if (!user) {
      return c.json({ error: 'NotFound', message: 'User not found', statusCode: 404 }, 404);
    }

    const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      createdAt: createdAtStr,
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
    const frontendUrl = getFrontendUrl(c);
    const code = c.req.query('code');
    if (!code) {
      return c.redirect(`${frontendUrl}/?error=MissingCode`);
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
        const errReason = tokenData.error_description || tokenData.error || 'GitHubAuthFailed';
        return c.redirect(`${frontendUrl}/?error=${encodeURIComponent(errReason)}`);
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
        return c.redirect(`${frontendUrl}/?error=NoEmailFromGitHub`);
      }

      const user = await authService.handleSocialLogin(
        'github',
        String(ghUser.id),
        email,
        ghUser.name || ghUser.login || 'GitHub User',
        ghUser.avatar_url || ''
      );

      const token = await signToken(user.id);
      return c.redirect(`${frontendUrl}/?token=${token}`);
    } catch (err) {
      console.error('GitHub OAuth Callback Error:', err);
      const errReason = err instanceof Error ? err.message : 'OAuthServerError';
      return c.redirect(`${frontendUrl}/?error=${encodeURIComponent(errReason)}`);
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
    const frontendUrl = getFrontendUrl(c);
    const code = c.req.query('code');
    if (!code) {
      return c.redirect(`${frontendUrl}/?error=MissingCode`);
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
        const errReason = tokenData.error_description || tokenData.error || 'GoogleAuthFailed';
        return c.redirect(`${frontendUrl}/?error=${encodeURIComponent(errReason)}`);
      }

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const gUser = await userRes.json();

      if (!gUser.email) {
        return c.redirect(`${frontendUrl}/?error=NoEmailFromGoogle`);
      }

      const user = await authService.handleSocialLogin(
        'google',
        String(gUser.id || gUser.sub || ''),
        gUser.email,
        gUser.name || 'Google User',
        gUser.picture || ''
      );

      const token = await signToken(user.id);
      return c.redirect(`${frontendUrl}/?token=${token}`);
    } catch (err) {
      console.error('Google OAuth Callback Error:', err);
      const errReason = err instanceof Error ? err.message : 'OAuthServerError';
      return c.redirect(`${frontendUrl}/?error=${encodeURIComponent(errReason)}`);
    }
  });

  return authRoutes;
}

export const authRoutes = createAuthRoutes();
