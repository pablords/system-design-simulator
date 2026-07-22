import React from 'react';
import { AlertTriangle, XCircle, TrendingUp, Activity, Cpu, HardDrive, Server } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { Bottleneck } from '../../types';

const BottleneckItem: React.FC<{ b: Bottleneck }> = ({ b }) => {
  const icon = {
    cpu: <Cpu size={14} />,
    ram: <Server size={14} />,
    rps: <TrendingUp size={14} />,
    storage: <HardDrive size={14} />,
  }[b.type];

  return (
    <div className={`bottleneck-item ${b.severity}`}>
      <div className={`bottleneck-icon ${b.severity}`}>
        {b.severity === 'critical' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
      </div>
      <div className="bottleneck-body">
        <div className="bottleneck-node">{b.nodeLabel}</div>
        <div className="bottleneck-msg">{b.message}</div>
      </div>
      <div className="bottleneck-type">{icon}</div>
    </div>
  );
};

export const MetricsPanel: React.FC = () => {
  const { simulation, nodes } = useSimulatorStore();
  const { bottlenecks, totalRps, running } = simulation;

  const criticals = bottlenecks.filter((b) => b.severity === 'critical');
  const warnings = bottlenecks.filter((b) => b.severity === 'warning');

  const activeNodes = nodes.filter((n) => n.data.metrics.status !== 'idle').length;

  return (
    <footer className="metrics-panel">
      {/* Global stats */}
      <div className="metrics-stats">
        <div className="stat-item">
          <Activity size={14} className="stat-icon" style={{ color: running ? '#22c55e' : '#64748b' }} />
          <span className="stat-label">Status</span>
          <span className={`stat-value ${running ? 'running' : 'idle'}`}>
            {running ? `Running` : 'Paused'}
          </span>
        </div>
        <div className="stat-item">
          <TrendingUp size={14} className="stat-icon" />
          <span className="stat-label">Total RPS</span>
          <span className="stat-value highlight">{totalRps.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <Server size={14} className="stat-icon" />
          <span className="stat-label">Active Nodes</span>
          <span className="stat-value">{activeNodes} / {nodes.length}</span>
        </div>
        <div className="stat-item">
          <XCircle size={14} className="stat-icon" style={{ color: criticals.length > 0 ? '#ef4444' : '#64748b' }} />
          <span className="stat-label">Critical</span>
          <span className={`stat-value ${criticals.length > 0 ? 'critical' : ''}`}>{criticals.length}</span>
        </div>
        <div className="stat-item">
          <AlertTriangle size={14} className="stat-icon" style={{ color: warnings.length > 0 ? '#f59e0b' : '#64748b' }} />
          <span className="stat-label">Warnings</span>
          <span className={`stat-value ${warnings.length > 0 ? 'warning' : ''}`}>{warnings.length}</span>
        </div>
      </div>

      {/* Bottleneck list */}
      {bottlenecks.length > 0 && (
        <div className="bottleneck-list">
          {bottlenecks.slice(0, 6).map((b, i) => (
            <BottleneckItem key={`${b.nodeId}-${b.type}-${i}`} b={b} />
          ))}
          {bottlenecks.length > 6 && (
            <span className="bottleneck-more">+{bottlenecks.length - 6} more issues</span>
          )}
        </div>
      )}

      {bottlenecks.length === 0 && running && (
        <div className="bottleneck-ok">
          <span className="bottleneck-ok-dot" />
          All systems nominal
        </div>
      )}
    </footer>
  );
};
