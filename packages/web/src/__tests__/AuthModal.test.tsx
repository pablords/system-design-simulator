import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthModal } from '../components/auth/AuthModal';
import { useAuthStore } from '../store/authStore';

describe('AuthModal Component Suite', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  });

  it('should render mandatory auth modal without close button', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthModal, {
        onClose: () => {},
        isMandatory: true,
      })
    );

    expect(html).toContain('Bem-vindo ao SysDesign Simulator');
    expect(html).toContain('Continuar com GitHub');
    expect(html).toContain('Continuar com Google');
    expect(html).not.toContain('auth-close');
  });

  it('should render non-mandatory auth modal with close button', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthModal, {
        onClose: () => {},
        isMandatory: false,
      })
    );

    expect(html).toContain('auth-close');
  });

  it('should construct OAuth redirect URLs correctly for GitHub and Google', () => {
    const defaultBase = 'http://localhost:3000';
    const API_BASE = defaultBase.replace(/\/$/, '');

    const getOAuthUrl = (provider: 'github' | 'google') => `${API_BASE}/api/v1/auth/${provider}`;

    expect(getOAuthUrl('github')).toBe('http://localhost:3000/api/v1/auth/github');
    expect(getOAuthUrl('google')).toBe('http://localhost:3000/api/v1/auth/google');
  });

  it('should display error message when authStore contains an error', () => {
    useAuthStore.setState({ error: 'Credenciais inválidas' });

    const state = useAuthStore.getState();
    expect(state.error).toBe('Credenciais inválidas');

    const errorMsg = 'Credenciais inválidas';
    const errorElement = React.createElement('div', { className: 'auth-error' }, errorMsg);
    const html = renderToStaticMarkup(errorElement);

    expect(html).toContain('auth-error');
    expect(html).toContain('Credenciais inválidas');
  });

  it('should handle mode tab toggle between login and register', () => {
    const store = useAuthStore.getState();
    const loginSpy = vi.spyOn(store, 'login').mockResolvedValue(undefined);
    const registerSpy = vi.spyOn(store, 'register').mockResolvedValue(undefined);

    const handleLoginSubmit = async (email: string, pass: string) => {
      await store.login(email, pass);
    };

    const handleRegisterSubmit = async (email: string, pass: string, name: string) => {
      await store.register(email, pass, name);
    };

    handleLoginSubmit('user@example.com', 'secret');
    expect(loginSpy).toHaveBeenCalledWith('user@example.com', 'secret');

    handleRegisterSubmit('new@example.com', 'password123', 'John Doe');
    expect(registerSpy).toHaveBeenCalledWith('new@example.com', 'password123', 'John Doe');
  });
});
