import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { EdgeMetrics } from '../../types';
import { AlertTriangle, Clock } from 'lucide-react';

export const ConnectionEdge: React.FC<EdgeProps> = ({
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

  // Customize edge style based on metric health status
  const getEdgeStyle = (): React.CSSProperties => {
    const baseStyle = { ...style };
    if (status === 'critical') {
      return {
        ...baseStyle,
        stroke: '#ef4444',
        strokeWidth: 4,
      };
    }
    if (status === 'warning') {
      return {
        ...baseStyle,
        stroke: '#f59e0b',
        strokeWidth: 3,
      };
    }
    return {
      ...baseStyle,
      stroke: '#6366f1',
      strokeWidth: 2,
    };
  };

  const hasMetrics = metrics && metrics.rps > 0;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={getEdgeStyle()} />
      {hasMetrics && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label-badge status-${status}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
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
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
