import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

export const SaveIndicator: React.FC = () => {
  const saveStatus = useProjectStore((s) => s.saveStatus);

  if (saveStatus === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        key={saveStatus}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          zIndex: 100,
          background: saveStatus === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(17,24,39,0.9)',
          border: `1px solid ${saveStatus === 'error' ? 'rgba(239,68,68,0.3)' : '#1e293b'}`,
          color: saveStatus === 'error' ? '#fca5a5' : saveStatus === 'saved' ? '#4ade80' : '#94a3b8',
          backdropFilter: 'blur(8px)',
        }}
      >
        {saveStatus === 'saving' && <Loader2 size={14} className="spin" />}
        {saveStatus === 'saved' && <Check size={14} />}
        {saveStatus === 'error' && <AlertTriangle size={14} />}
        {saveStatus === 'saving' && 'Salvando...'}
        {saveStatus === 'saved' && 'Salvo ✓'}
        {saveStatus === 'error' && 'Erro ao salvar'}
      </motion.div>
    </AnimatePresence>
  );
};
