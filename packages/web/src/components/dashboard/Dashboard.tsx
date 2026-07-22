import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Copy, LogOut, Folder, Clock, ArrowLeft, User } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import './dashboard.css';

interface DashboardProps {
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onBackToEditor: () => void;
}

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #1e3a5f, #0f2942)',
  'linear-gradient(135deg, #2d1b4e, #1a0f30)',
  'linear-gradient(135deg, #1b3d2f, #0f2a1e)',
  'linear-gradient(135deg, #3d2b1b, #2a1a0f)',
  'linear-gradient(135deg, #1b2d3d, #0f1a2a)',
  'linear-gradient(135deg, #3d1b2b, #2a0f1a)',
];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const Dashboard: React.FC<DashboardProps> = ({ onOpenProject, onNewProject, onBackToEditor }) => {
  const { projects, isLoadingProjects, fetchProjects, deleteProject, cloneProject } = useProjectStore();
  const { user, logout } = useAuthStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      await deleteProject(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const handleClone = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await cloneProject(id);
  };

  const handleLogout = () => {
    logout();
    onBackToEditor();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onBackToEditor} title="Voltar ao Editor Canvas">
            <ArrowLeft size={18} />
            <span>Voltar ao Editor</span>
          </button>
          <h1 className="dashboard-title">
            <Folder size={22} />
            Meus Projetos
          </h1>
        </div>

        <div className="dashboard-user">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <User size={18} style={{ color: '#94a3b8' }} />
          )}
          <span className="dashboard-user-name">{user?.name}</span>
          <button className="card-action-btn" onClick={handleLogout} title="Sair da Conta">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="dashboard-actions">
        <button className="new-project-btn" onClick={onNewProject}>
          <Plus size={18} />
          Novo Projeto
        </button>
      </div>

      {isLoadingProjects ? (
        <div className="empty-state">
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando projetos...</div>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📐</div>
          <div className="empty-state-title">Nenhum projeto ainda</div>
          <p>Crie seu primeiro projeto de system design!</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              className="project-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onOpenProject(project.id)}
              whileHover={{ y: -2 }}
            >
              <div
                className="project-card-banner"
                style={{ background: CARD_GRADIENTS[index % CARD_GRADIENTS.length] }}
              />
              <div className="project-card-body">
                <div className="project-card-name">{project.name}</div>
                <div className="project-card-date">
                  <Clock size={12} />
                  {dateFormatter.format(new Date(project.updatedAt))}
                </div>
                <div className="project-card-actions">
                  <button
                    className="card-action-btn"
                    onClick={(e) => handleClone(e, project.id)}
                    title="Clonar"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="card-action-btn danger"
                    onClick={(e) => handleDelete(e, project.id)}
                    title={deletingId === project.id ? 'Confirmar exclusão' : 'Excluir'}
                  >
                    <Trash2 size={14} />
                    {deletingId === project.id && (
                      <span style={{ fontSize: '11px', marginLeft: '4px' }}>Confirmar?</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
