import { create } from 'zustand';
import { api } from '../api/client';
import type { ApiUser } from '../types';

interface AuthState {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: ApiUser; token: string }>('/api/v1/auth/login', { email, password });
      api.setToken(res.token);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const e = err as Error & { body?: { message?: string } };
      set({ error: e.body?.message || e.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: ApiUser; token: string }>('/api/v1/auth/register', { email, password, name });
      api.setToken(res.token);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const e = err as Error & { body?: { message?: string } };
      set({ error: e.body?.message || e.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    api.setToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  checkAuth: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.get<ApiUser>('/api/v1/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      api.setToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
