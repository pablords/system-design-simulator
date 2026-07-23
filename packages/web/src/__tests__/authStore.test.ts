import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct default state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Login Flow', () => {
    it('should authenticate user and store token on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'engineer@system-design.io',
        name: 'Lead Architect',
        avatarUrl: 'https://example.com/avatar.png',
        provider: 'local',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const mockResponse = { user: mockUser, token: 'mock-jwt-token-123' };

      const setTokenSpy = vi.spyOn(api, 'setToken').mockImplementation(() => {});
      const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValue(mockResponse);

      await useAuthStore.getState().login('engineer@system-design.io', 'securePass123!');

      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/auth/login', {
        email: 'engineer@system-design.io',
        password: 'securePass123!',
      });
      expect(setTokenSpy).toHaveBeenCalledWith('mock-jwt-token-123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error message when login fails', async () => {
      const errorObj = new Error('Invalid credentials');
      (errorObj as any).body = { message: 'Invalid credentials' };

      vi.spyOn(api, 'post').mockRejectedValue(errorObj);

      await expect(
        useAuthStore.getState().login('wrong@email.com', 'badpassword')
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });
  });

  describe('Registration Flow', () => {
    it('should register new user and set token', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'newuser@system-design.io',
        name: 'New Designer',
        avatarUrl: null,
        provider: 'local',
        createdAt: '2026-07-23T00:00:00.000Z',
      };
      const mockResponse = { user: mockUser, token: 'mock-jwt-token-456' };

      const setTokenSpy = vi.spyOn(api, 'setToken').mockImplementation(() => {});
      const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValue(mockResponse);

      await useAuthStore.getState().register('newuser@system-design.io', 'pass123456', 'New Designer');

      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/auth/register', {
        email: 'newuser@system-design.io',
        password: 'pass123456',
        name: 'New Designer',
      });
      expect(setTokenSpy).toHaveBeenCalledWith('mock-jwt-token-456');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle registration failure', async () => {
      const errorObj = new Error('Email already registered');
      vi.spyOn(api, 'post').mockRejectedValue(errorObj);

      await expect(
        useAuthStore.getState().register('existing@email.com', 'password123', 'Existing')
      ).rejects.toThrow('Email already registered');

      const state = useAuthStore.getState();
      expect(state.error).toBe('Email already registered');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Logout Flow', () => {
    it('should clear token and reset auth state on logout', () => {
      useAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'test@system-design.io',
          name: 'Test',
          avatarUrl: null,
          provider: 'local',
          createdAt: '',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const setTokenSpy = vi.spyOn(api, 'setToken').mockImplementation(() => {});

      useAuthStore.getState().logout();

      expect(setTokenSpy).toHaveBeenCalledWith(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Session Check (checkAuth)', () => {
    it('should finish loading without authenticating if no token exists', async () => {
      vi.spyOn(api, 'getToken').mockReturnValue(null);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should authenticate user if token exists and backend returns current user', async () => {
      const mockUser = {
        id: 'u-me',
        email: 'active@system-design.io',
        name: 'Active User',
        avatarUrl: null,
        provider: 'github',
        createdAt: '',
      };

      vi.spyOn(api, 'getToken').mockReturnValue('valid-jwt-token');
      vi.spyOn(api, 'get').mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });

    it('should clear token and remain unauthenticated if checkAuth fails', async () => {
      vi.spyOn(api, 'getToken').mockReturnValue('expired-jwt-token');
      vi.spyOn(api, 'get').mockRejectedValue(new Error('Unauthorized'));
      const setTokenSpy = vi.spyOn(api, 'setToken').mockImplementation(() => {});

      await useAuthStore.getState().checkAuth();

      expect(setTokenSpy).toHaveBeenCalledWith(null);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Error Management', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
