import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { SimulatorNodeData, NodeStatus } from '../../types';
import { COMPONENT_DEFINITIONS } from '../../engine/models/ComponentModel';
import { useSimulatorStore } from '../../store/simulatorStore';
import { ServiceIcon } from '../ui/ServiceIcon';

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '#475569',
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const STATUS_GLOW: Record<NodeStatus, string> = {
  idle: 'none',
  ok: '0 0 12px rgba(34, 197, 94, 0.4)',
  warning: '0 0 12px rgba(245, 158, 11, 0.5)',
  critical: '0 0 16px rgba(239, 68, 68, 0.7)',
};

interface MiniSparklineProps {
  data: number[];
  color: string;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, color }) => {
  if (data.length < 2) return <div style={{ height: 20 }} />;
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 20;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
};

export const ComponentNode = memo(({ id, data: rawData, selected }: NodeProps) => {
  const data = rawData as SimulatorNodeData;
  const { selectNode, removeNode } = useSimulatorStore();
  const def = COMPONENT_DEFINITIONS[data.componentType];
  const { metrics, config } = data;
  const status = metrics.status;
  const statusColor = STATUS_COLORS[status];
  const statusGlow = STATUS_GLOW[status];
  const cpuHistory = metrics.history.map((h) => h.cpuPct);

  const handleSelect = () => selectNode(id);
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <div
      className={`component-node ${selected ? 'selected' : ''}`}
      onClick={handleSelect}
      style={{
        '--node-color': def.color,
        '--status-color': statusColor,
        boxShadow: selected
          ? `0 0 0 2px ${def.color}, ${statusGlow}`
          : `0 4px 24px rgba(0,0,0,0.4), ${statusGlow}`,
      } as React.CSSProperties}
    >
      {!def.isSource && (
        <Handle type="target" position={Position.Left} id="target" className="node-handle node-handle-in" />
      )}

      <div className="node-header" style={{ borderColor: def.color }}>
        <ServiceIcon type={data.componentType} size={18} style={{ marginRight: 6 }} />
        <span className="node-label">{config.label}</span>
        <button className="node-delete-btn" onClick={handleDelete} title="Remove">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="node-status-bar" style={{ backgroundColor: statusColor }} />

      <div className="node-metrics">
        {status === 'idle' ? (
          <div className="node-idle-msg">Idle — press Simulate</div>
        ) : (metrics.restartCooldownTicks ?? 0) > 0 ? (
          <div className="node-crashed-alert animate-flash-fast">
            <span className="node-crashed-label">🔴 CRASHED</span>
            <span className="node-crashed-countdown">Rebooting... ({metrics.restartCooldownTicks}t)</span>
          </div>
        ) : (
          <>
            <div className="node-metric-row">
              <span className="metric-key">RPS</span>
              <span className="metric-val">{metrics.inboundRps.toLocaleString()}</span>
            </div>
            {def.isSource && metrics.endToEndLatencyMs !== undefined && metrics.endToEndLatencyMs > 0 && (
              <div className="node-metric-row">
                <span className="metric-key" style={{ color: '#818cf8' }}>E2E Lat</span>
                <span className="metric-val" style={{ color: '#818cf8', fontWeight: 600 }}>{metrics.endToEndLatencyMs}ms</span>
              </div>
            )}
            <div className="node-metric-row">
              <span className="metric-key">CPU</span>
              <div className="metric-bar-wrap">
                <div className="metric-bar" style={{ width: `${metrics.cpuPct}%`, backgroundColor: statusColor }} />
              </div>
              <span className="metric-val">{metrics.cpuPct}%</span>
            </div>
            <div className="node-metric-row">
              <span className="metric-key">RAM</span>
              <div className="metric-bar-wrap">
                <div className="metric-bar" style={{ width: `${metrics.ramPct}%`, backgroundColor: '#6366f1' }} />
              </div>
              <span className="metric-val">{metrics.ramPct}%</span>
            </div>
            {!def.isSource && metrics.latencyMs > 0 && (
              <div className="node-metric-row">
                <span className="metric-key">Lat</span>
                <span className="metric-val">{metrics.latencyMs}ms</span>
              </div>
            )}
            <div className="node-sparkline">
              <MiniSparkline data={cpuHistory} color={statusColor} />
            </div>
          </>
        )}
      </div>

      {config.replicas !== undefined && config.replicas > 1 && (
        <div className="node-replicas-badge" style={{ borderColor: def.color }}>
          ×{config.replicas}
        </div>
      )}

      {config.notes && (
        <div className="node-notes-preview" title={config.notes}>
          📝 {config.notes.length > 22 ? config.notes.substring(0, 19) + '...' : config.notes}
        </div>
      )}

      {!def.isSink && (
        <Handle type="source" position={Position.Right} id="source" className="node-handle node-handle-out" />
      )}
    </div>
  );
});

ComponentNode.displayName = 'ComponentNode';
