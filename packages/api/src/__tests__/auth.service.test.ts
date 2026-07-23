import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../services/auth.service.js';
import { InMemoryUserRepository } from '../repositories/user.repository.js';

describe('AuthService Unit Tests (TDD + DIP)', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo);
  });

  it('should register a new user successfully with hashed password', async () => {
    const user = await authService.register('test@example.com', 'secret123', 'Test User');
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.passwordHash).not.toBe('secret123');
  });

  it('should throw an error when registering an existing email', async () => {
    await authService.register('test@example.com', 'secret123', 'Test User');
    await expect(authService.register('test@example.com', 'password', 'Duplicate')).rejects.toThrow(
      'User already exists'
    );
  });

  it('should authenticate user with valid credentials', async () => {
    await authService.register('user@test.com', 'correctpassword', 'Valid User');
    const user = await authService.authenticate('user@test.com', 'correctpassword');
    expect(user).toBeDefined();
    expect(user.email).toBe('user@test.com');
  });

  it('should throw an error when authenticating with wrong password', async () => {
    await authService.register('user@test.com', 'correctpassword', 'Valid User');
    await expect(authService.authenticate('user@test.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
  });

  it('should handle social login for new user smoothly', async () => {
    const user = await authService.handleSocialLogin(
      'github',
      '123456',
      'dev@github.com',
      'GitHub Dev',
      'https://github.com/avatar.png'
    );
    expect(user.provider).toBe('github');
    expect(user.providerId).toBe('123456');
    expect(user.email).toBe('dev@github.com');
  });

  it('should return existing user when social login provider and providerId match', async () => {
    const u1 = await authService.handleSocialLogin('github', '123', 'a@test.com', 'A', 'img');
    const u2 = await authService.handleSocialLogin('github', '123', 'a@test.com', 'A', 'img');
    expect(u1.id).toBe(u2.id);
  });

  it('should link provider when user exists by email', async () => {
    await authService.register('existing@email.com', 'password', 'Existing');
    const linked = await authService.handleSocialLogin(
      'google',
      'g_456',
      'existing@email.com',
      'Existing',
      'google_pic'
    );
    expect(linked.provider).toBe('google');
    expect(linked.providerId).toBe('g_456');
  });
});
