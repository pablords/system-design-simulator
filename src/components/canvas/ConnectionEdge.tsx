import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { EdgeMetrics } from '../../types';
import { AlertTriangle, Clock } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';

export const ConnectionEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const { updateEdgeData } = useSimulatorStore();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const metrics = data?.metrics as EdgeMetrics | undefined;
  const status = metrics?.status ?? 'ok';
  const trafficType = (data?.trafficType as 'all' | 'read' | 'write') ?? 'all';

  // Customize edge style based on metric health status and traffic type
  const getEdgeStyle = (): React.CSSProperties => {
    const baseStyle = { ...style };
    
    // Base colors for read/write separation
    let strokeColor = '#6366f1';
    let strokeWidth = 2;
    let isDashed = false;

    if (trafficType === 'read') {
      strokeColor = '#818cf8'; // Violet/Query Read
      isDashed = true;
    } else if (trafficType === 'write') {
      strokeColor = '#ec4899'; // Pink/Command Write
      strokeWidth = 2.5;
    }

    if (status === 'critical') {
      strokeColor = '#ef4444';
      strokeWidth = 4;
    } else if (status === 'warning') {
      strokeColor = '#f59e0b';
      strokeWidth = 3;
    }

    return {
      ...baseStyle,
      stroke: strokeColor,
      strokeWidth,
      strokeDasharray: isDashed ? '5,5' : undefined,
    };
  };

  const handleToggleTraffic = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextMap = {
      all: 'read',
      read: 'write',
      write: 'all',
    } as const;
    const nextType = nextMap[trafficType];
    updateEdgeData(id, { trafficType: nextType });
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={getEdgeStyle()} />
      <EdgeLabelRenderer>
        <div
          className={`edge-label-badge status-${status}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {/* Traffic filter click toggle */}
          <button
            onClick={handleToggleTraffic}
            title="Alternar filtro: Todos (R/W) -> Apenas Leitura (R) -> Apenas Escrita (W)"
            style={{
              background: 'transparent',
              border: 'none',
              color: trafficType === 'read' ? '#a78bfa' : trafficType === 'write' ? '#f472b6' : 'var(--text-secondary)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 4px',
              borderRadius: '4px',
              outline: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {trafficType === 'read' ? '📖 R' : trafficType === 'write' ? '✍️ W' : '🔄 R/W'}
          </button>

          {metrics && metrics.rps > 0 && (
            <>
              <div style={{ width: '1px', height: '12px', background: 'var(--border-dim)', margin: '0 3px' }} />
              
              <div className="edge-metric-group">
                <span className="edge-metric-label">RPS</span>
                <span className="edge-metric-value">{metrics.rps.toLocaleString()}</span>
              </div>

              {metrics.latencyMs > 0 && (
                <div className="edge-metric-group" style={{ color: '#818cf8' }}>
                  <Clock size={10} className="edge-icon" />
                  <span className="edge-metric-label" style={{ color: '#818cf8' }}>Lat</span>
                  <span className="edge-metric-value" style={{ color: '#818cf8', fontWeight: 700 }}>
                    {metrics.latencyMs >= 1000
                      ? `${(metrics.latencyMs / 1000).toFixed(1)}s`
                      : `${metrics.latencyMs}ms`}
                  </span>
                </div>
              )}

              {metrics.queueSize > 0 && (
                <div className="edge-metric-group warning-highlight animate-pulse-subtle">
                  <AlertTriangle size={10} className="edge-icon" />
                  <span className="edge-metric-label">Queue</span>
                  <span className="edge-metric-value">{metrics.queueSize}</span>
                </div>
              )}

              {metrics.timeoutsPerSecond > 0 && (
                <div className="edge-metric-group critical-highlight animate-flash-fast">
                  <AlertTriangle size={10} className="edge-icon" />
                  <span className="edge-metric-label">TO/s</span>
                  <span className="edge-metric-value">{metrics.timeoutsPerSecond}</span>
                </div>
              )}

              {metrics.failuresPerSecond !== undefined && metrics.failuresPerSecond > 0 && (
                <div className="edge-metric-group critical-highlight animate-flash-fast" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                  <AlertTriangle size={10} className="edge-icon" />
                  <span className="edge-metric-label">Err/s</span>
                  <span className="edge-metric-value">{metrics.failuresPerSecond}</span>
                </div>
              )}
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
