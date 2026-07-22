import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, User, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './auth-modal.css';

interface AuthModalProps {
  onClose: () => void;
  isMandatory?: boolean;
}

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const defaultBase = isLocal
  ? 'http://localhost:3000'
  : 'https://system-designapi-production.up.railway.app';

const rawBase = import.meta.env.VITE_API_URL || defaultBase;
const API_BASE = rawBase.replace(/\/$/, '');

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, isMandatory = false }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [enableEmailAuth, setEnableEmailAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, register, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.enableEmailAuth === 'boolean') {
          setEnableEmailAuth(data.enableEmailAuth);
        }
      })
      .catch(() => {
        setEnableEmailAuth(false);
      });
  }, []);

  const handleOAuthLogin = (provider: 'github' | 'google') => {
    window.location.href = `${API_BASE}/api/v1/auth/${provider}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onClose();
    } catch {
      // error is handled by store
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    clearError();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="auth-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isMandatory ? undefined : onClose}
      >
        <motion.div
          className="auth-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {!isMandatory && (
            <button className="auth-close" onClick={onClose} title="Fechar">
              <X size={20} />
            </button>
          )}

          <h2 className="auth-title">
            {mode === 'login' ? 'Bem-vindo ao SysDesign Simulator' : 'Criar conta'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Entre com sua conta social para acessar o simulador e seus projetos'
              : 'Crie sua conta para começar a projetar'}
          </p>

          {error && <div className="auth-error">{error}</div>}

          {/* Social OAuth Buttons */}
          <div className="oauth-buttons">
            <button className="oauth-btn btn-github" onClick={() => handleOAuthLogin('github')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Continuar com GitHub</span>
            </button>

            <button className="oauth-btn btn-google" onClick={() => handleOAuthLogin('google')}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2.0 10.05.0 12c0 1.95.47 3.8 1.29 5.42l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continuar com Google</span>
            </button>
          </div>

          {enableEmailAuth && (
            <>
              <div className="auth-divider">
                <span>ou entre com e-mail</span>
              </div>

              {!showEmailForm ? (
                <button className="btn-toggle-email" onClick={() => setShowEmailForm(true)}>
                  <Mail size={16} />
                  {mode === 'login' ? 'Entrar com E-mail e Senha' : 'Cadastrar com E-mail e Senha'}
                </button>
              ) : (
                <>
                  <div className="auth-tabs">
                    <button
                      className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                      onClick={() => switchMode('login')}
                    >
                      <LogIn size={14} style={{ marginRight: 6 }} />
                      Entrar
                    </button>
                    <button
                      className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                      onClick={() => switchMode('register')}
                    >
                      <UserPlus size={14} style={{ marginRight: 6 }} />
                      Criar Conta
                    </button>
                  </div>

                  <form className="auth-form" onSubmit={handleSubmit}>
                    {mode === 'register' && (
                      <div className="auth-field">
                        <label htmlFor="auth-name">Nome</label>
                        <div className="input-wrapper">
                          <User size={16} style={{ color: '#64748b' }} />
                          <input
                            id="auth-name"
                            type="text"
                            placeholder="Seu nome"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="auth-field">
                      <label htmlFor="auth-email">E-mail</label>
                      <div className="input-wrapper">
                        <Mail size={16} style={{ color: '#64748b' }} />
                        <input
                          id="auth-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="auth-field">
                      <label htmlFor="auth-password">Senha</label>
                      <div className="input-wrapper">
                        <Lock size={16} style={{ color: '#64748b' }} />
                        <input
                          id="auth-password"
                          type="password"
                          placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={mode === 'register' ? 8 : undefined}
                        />
                      </div>
                    </div>

                    <button className="auth-submit" type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <><Loader2 size={16} className="spin" /> Aguarde...</>
                      ) : mode === 'login' ? (
                        <><LogIn size={16} /> Entrar com E-mail</>
                      ) : (
                        <><UserPlus size={16} /> Criar Conta com E-mail</>
                      )}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
