import React from 'react';

interface SimulationBadgeProps {
  backendConnected: boolean;
}

export const SimulationBadge: React.FC<SimulationBadgeProps> = ({ backendConnected }) => {
  return (
    <span
      data-testid="simulation-badge"
      title={
        backendConnected
          ? 'Motor local otimizado (0ms de latência) com auditoria periódica no backend'
          : 'Motor local otimizado rodando no navegador'
      }
      style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '12px',
        marginLeft: '10px',
        fontWeight: 600,
        background: 'rgba(34, 197, 94, 0.15)',
        color: '#4ade80',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {backendConnected ? '⚡ Motor Otimizado (Sync Background)' : '⚡ Motor Local'}
    </span>
  );
};
