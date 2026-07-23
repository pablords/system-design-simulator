import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createAuthRoutes } from '../routes/auth.js';
import { AuthService } from '../services/auth.service.js';
import { InMemoryUserRepository } from '../repositories/user.repository.js';
import { signToken } from '../lib/jwt.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Auth Routes Integration Tests', () => {
  let app: Hono;
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo);
    const routes = createAuthRoutes(authService, userRepo);
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/auth', routes);
  });

  describe('GET /api/v1/auth/config', () => {
    it('should return public auth feature flags configuration', async () => {
      const res = await app.request('/api/v1/auth/config');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('enableEmailAuth');
      expect(data).toHaveProperty('hasGithub');
      expect(data).toHaveProperty('hasGoogle');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return user object with token', async () => {
      const res = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'securepassword123',
          name: 'New User',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.name).toBe('New User');
      expect(data.token).toBeDefined();
    });

    it('should return 409 Conflict when registering duplicate email', async () => {
      await authService.register('existing@example.com', 'password123', 'Existing User');

      const res = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'anotherpassword',
          name: 'Duplicate User',
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toBe('Email already registered');
    });

    it('should return 400 Bad Request for invalid email format', async () => {
      const res = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'short',
          name: '',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await authService.register('user@example.com', 'correctpassword', 'Test User');
    });

    it('should authenticate user with valid credentials', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'correctpassword',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe('user@example.com');
      expect(data.token).toBeDefined();
    });

    it('should return 401 Unauthorized for wrong password', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'wrongpassword',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('Invalid credentials');
    });

    it('should return 401 Unauthorized for non-existent email', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'somepassword',
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile when authenticated with valid token', async () => {
      const user = await authService.register('me@example.com', 'mypassword', 'Me User');
      const token = await signToken(user.id);

      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(user.id);
      expect(data.email).toBe('me@example.com');
      expect(data.name).toBe('Me User');
    });

    it('should return 401 Unauthorized when missing Authorization header', async () => {
      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 Unauthorized for invalid token', async () => {
      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(res.status).toBe(401);
    });

    it('should return 404 NotFound if user from token does not exist', async () => {
      const token = await signToken('non-existent-user-id');
      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should return logout success message', async () => {
      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Logged out successfully');
    });
  });

  describe('OAuth Endpoints', () => {
    it('should return error or redirect for GET /github', async () => {
      const res = await app.request('/api/v1/auth/github');
      expect([302, 500]).toContain(res.status);
    });

    it('should redirect with MissingCode on GET /github/callback without code', async () => {
      const res = await app.request('/api/v1/auth/github/callback');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=MissingCode');
    });

    it('should return error or redirect for GET /google', async () => {
      const res = await app.request('/api/v1/auth/google');
      expect([302, 500]).toContain(res.status);
    });

    it('should redirect with MissingCode on GET /google/callback without code', async () => {
      const res = await app.request('/api/v1/auth/google/callback');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=MissingCode');
    });
  });
});
