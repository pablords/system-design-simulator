import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, User, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './auth-modal.css';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, register, isLoading, error, clearError } = useAuthStore();

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
        onClick={onClose}
      >
        <motion.div
          className="auth-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="auth-close" onClick={onClose}>
            <X size={20} />
          </button>

          <h2 className="auth-title">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Entre para salvar seus projetos na nuvem'
              : 'Crie sua conta para começar a projetar'}
          </p>

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

          {error && <div className="auth-error">{error}</div>}

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
                <><LogIn size={16} /> Entrar</>
              ) : (
                <><UserPlus size={16} /> Criar Conta</>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
