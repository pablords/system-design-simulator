import React from 'react';
import { X, Server, Cpu, HardDrive, Zap, Users, Clock, Activity, Layers } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { COMPONENT_DEFINITIONS } from '../../engine/models/ComponentModel';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ServiceIcon } from '../ui/ServiceIcon';

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit, onChange }) => {
  const [tempValue, setTempValue] = React.useState(String(value));

  React.useEffect(() => {
    setTempValue(String(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(e.target.value);
    const val = Number(e.target.value);
    if (!isNaN(val) && e.target.value !== '' && val >= min && val <= max) {
      onChange(val);
    }
  };

  const handleBlurOrEnter = () => {
    let val = Number(tempValue);
    if (isNaN(val) || tempValue === '') {
      val = value;
    }
    const clampedVal = Math.max(min, Math.min(max, val));
    onChange(clampedVal);
    setTempValue(String(clampedVal));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlurOrEnter();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="config-field">
      <div className="config-field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="config-label">{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={tempValue}
            onChange={handleInputChange}
            onBlur={handleBlurOrEnter}
            onKeyDown={handleKeyDown}
            style={{
              width: '64px',
              padding: '2px 6px',
              background: '#192231',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
            }}
          />
          <span className="config-unit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="config-slider"
      />
      <div className="config-range-labels">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

export const ConfigPanel: React.FC = () => {
  const { selectedNodeId, nodes, edges, updateNodeConfig, selectNode, connectNodes, disconnectNodes } = useSimulatorStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  const def = COMPONENT_DEFINITIONS[node.data.componentType];
  const { config, metrics } = node.data;

  const update = (key: string, value: number | string | boolean) => {
    updateNodeConfig(node.id, { [key]: value });
  };

  const generateSpans = () => {
    interface TraceSpan {
      id: string;
      label: string;
      componentType: string;
      startMs: number;
      durationMs: number;
      depth: number;
      status: 'ok' | 'error';
    }

    const spans: TraceSpan[] = [];
    const visited = new Set<string>();

    function buildTrace(nodeId: string, currentOffset: number, depth: number) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const currNode = nodes.find((n) => n.id === nodeId);
      if (!currNode) return;

      const currMetrics = currNode.data.metrics;
      const currCfg = currNode.data.config;

      const isError = currMetrics.cbState === 'OPEN' || (currMetrics.failedRps ?? 0) > ((currMetrics.inboundRps ?? 0) * 0.1) || currMetrics.status === 'critical';
      const nodeLatency = currMetrics.latencyMs || 1;

      const nodeOutEdges = edges.filter((e) => e.source === nodeId);
      const nextOffset = currentOffset + nodeLatency;
      let maxChildDuration = 0;

      let sequentialOffset = nextOffset;

      for (const edge of nodeOutEdges) {
        const edgeWait = (edge.data?.metrics as any)?.latencyMs ?? 0;
        const targetId = edge.target;
        
        const callStart = sequentialOffset;
        buildTrace(targetId, callStart + edgeWait, depth + 1);
        
        const targetNodeMetrics = nodes.find((n) => n.id === targetId)?.data.metrics;
        const targetLatency = targetNodeMetrics?.latencyMs ?? 0;
        const childTotalDuration = edgeWait + (targetNodeMetrics?.endToEndLatencyMs ?? targetLatency);
        
        sequentialOffset += childTotalDuration;
        maxChildDuration = Math.max(maxChildDuration, (callStart - nextOffset) + childTotalDuration);
      }

      const spanDuration = nodeLatency + maxChildDuration;

      spans.push({
        id: nodeId,
        label: currCfg.label,
        componentType: currNode.data.componentType,
        startMs: currentOffset,
        durationMs: spanDuration,
        depth,
        status: isError ? 'error' : 'ok',
      });
    }

    buildTrace(node.id, 0, 0);
    return spans.sort((a, b) => a.startMs - b.startMs || a.depth - b.depth);
  };

  const historyData = metrics.history.map((h) => ({
    tick: h.tick,
    CPU: h.cpuPct,
    RAM: h.ramPct,
    Lat: h.latencyMs,
    RPS: h.rps,
  }));

  return (
    <aside className="config-panel">
      {/* Header */}
      <div className="config-header">
        <div className="config-header-left">
          <ServiceIcon type={node.data.componentType} size={24} style={{ marginRight: 8 }} />
          <div>
            <div className="config-node-type">{def.label}</div>
            <div className="config-node-desc">{def.description}</div>
          </div>
        </div>
        <button className="config-close-btn" onClick={() => selectNode(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="config-body">
        {/* Label */}
        <div className="config-field">
          <label className="config-label">Label</label>
          <input
            type="text"
            value={config.label}
            onChange={(e) => update('label', e.target.value)}
            className="config-input"
          />
        </div>

        {/* Notes */}
        <div className="config-field" style={{ marginBottom: '14px' }}>
          <label className="config-label">Notas / Descrição</label>
          <textarea
            value={config.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Adicione observações sobre a arquitetura deste nó..."
            className="config-input"
            rows={2}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: '#192231',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              resize: 'vertical',
              minHeight: '48px',
              marginTop: '4px'
            }}
          />
        </div>

        {/* Capacity Section (Conditional) */}
        {(config.replicas !== undefined || config.maxRps !== undefined || config.connectionPool !== undefined || config.timeoutMs !== undefined) && (
          <>
            <div className="config-section-title">
              <Layers size={14} /> Capacity
            </div>
            {config.replicas !== undefined && (
              <Slider label="Replicas" value={config.replicas} min={1} max={200} step={1} unit="×" onChange={(v) => update('replicas', v)} />
            )}
            {config.maxRps !== undefined && (
              <Slider label="Max RPS / replica" value={config.maxRps} min={100} max={100000} step={100} unit=" rps" onChange={(v) => update('maxRps', v)} />
            )}
            {config.connectionPool !== undefined && (
              <Slider label="Connection Pool" value={config.connectionPool} min={5} max={5000} step={5} unit=" conns" onChange={(v) => update('connectionPool', v)} />
            )}
            {config.timeoutMs !== undefined && (
              <Slider label="Timeout" value={config.timeoutMs} min={50} max={10000} step={50} unit=" ms" onChange={(v) => update('timeoutMs', v)} />
            )}
            {config.writeRatio !== undefined && (
              <Slider label="Write Ratio (Carga Escrita)" value={Math.round(config.writeRatio * 100)} min={0} max={100} step={5} unit="%" onChange={(v) => update('writeRatio', v / 100)} />
            )}
            {!def.isSource && !def.isSink && config.maxRps !== undefined && (
              <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, padding: '4px 0' }}>
                <span className="config-label">Semáforo (Rate Limiter)</span>
                <input
                  type="checkbox"
                  checked={!!config.rateLimiterEnabled}
                  onChange={(e) => update('rateLimiterEnabled', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
              </div>
            )}
          </>
        )}

        {/* Resilience & Injected Errors Section */}
        <div className="config-section-title">
          <Zap size={14} /> Resilience & Errors
        </div>
        <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 8 }}>
          <span className="config-label">Circuit Breaker</span>
          <input
            type="checkbox"
            checked={!!config.circuitBreakerEnabled}
            onChange={(e) => update('circuitBreakerEnabled', e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
        </div>
        {config.circuitBreakerEnabled && (
          <>
            <Slider
              label="CB Failure Threshold"
              value={Math.round((config.cbFailureThreshold ?? 0.5) * 100)}
              min={10}
              max={100}
              step={5}
              unit="%"
              onChange={(v) => update('cbFailureThreshold', v / 100)}
            />
            <Slider
              label="CB Cooldown Window"
              value={config.cbSleepWindowTicks ?? 5}
              min={1}
              max={30}
              step={1}
              unit="s"
              onChange={(v) => update('cbSleepWindowTicks', v)}
            />
          </>
        )}
        <Slider
          label="Injected Error Rate"
          value={Math.round((config.errorRate ?? 0) * 100)}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => update('errorRate', v / 100)}
        />

        {/* Resources Section (Conditional) */}
        {(config.cpuCores !== undefined || config.ramGb !== undefined) && (
          <>
            <div className="config-section-title">
              <Server size={14} /> Resources
            </div>
            {config.cpuCores !== undefined && (
              <Slider label="CPU Cores" value={config.cpuCores} min={1} max={64} step={1} unit=" cores" onChange={(v) => update('cpuCores', v)} />
            )}
            {config.ramGb !== undefined && (
              <Slider label="RAM" value={config.ramGb} min={1} max={256} step={1} unit=" GB" onChange={(v) => update('ramGb', v)} />
            )}
          </>
        )}

        {def.accumulatesStorage && config.storageGb !== undefined && (
          <Slider label="Storage" value={config.storageGb} min={10} max={50000} step={10} unit=" GB" onChange={(v) => update('storageGb', v)} />
        )}

        {config.cacheHitRate !== undefined && (
          <>
            <div className="config-section-title">
              <Zap size={14} /> Cache
            </div>
            <Slider
              label="Hit Rate"
              value={Math.round(config.cacheHitRate * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => update('cacheHitRate', v / 100)}
            />
          </>
        )}

        {/* Conexões Rápidas */}
        <div className="config-section-title" style={{ marginTop: '16px' }}>
          <Layers size={14} /> Conexões Rápidas
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
          Ligue ou desligue este componente a outros nós do canvas sem precisar arrastar:
        </div>
        <div className="btn-connect-container" style={{ flexShrink: 0 }}>
          {nodes.filter(n => n.id !== node.id).length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
              Nenhum outro nó no canvas para conectar.
            </div>
          ) : (
            nodes.filter(n => n.id !== node.id).map(other => {
              const otherDef = COMPONENT_DEFINITIONS[other.data.componentType];
              
              // Direções possíveis baseadas nas definições de origem/destino
              const canConnectAsOutput = !def.isSink && !otherDef.isSource;
              const canConnectAsInput = !def.isSource && !otherDef.isSink;
              
              const isConnectedOutput = edges.some(e => e.source === node.id && e.target === other.id);
              const isConnectedInput = edges.some(e => e.source === other.id && e.target === node.id);
              
              return (
                <div 
                  key={other.id} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '10px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    alignItems: 'stretch'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>{otherDef.icon}</span>
                    <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '11px' }}>{other.data.config.label || otherDef.label}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    {canConnectAsOutput && (
                      <button 
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          border: '1px solid #334155',
                          background: isConnectedOutput ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                          borderColor: isConnectedOutput ? '#10b981' : '#334155',
                          color: isConnectedOutput ? '#10b981' : '#94a3b8',
                          textAlign: 'center'
                        }}
                        onClick={() => isConnectedOutput ? disconnectNodes(node.id, other.id) : connectNodes(node.id, other.id)}
                      >
                        {isConnectedOutput ? '🟢 Saída Ativa' : '⚪ Ligar Saída ➡️'}
                      </button>
                    )}
                    {canConnectAsInput && (
                      <button 
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          border: '1px solid #334155',
                          background: isConnectedInput ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                          borderColor: isConnectedInput ? '#10b981' : '#334155',
                          color: isConnectedInput ? '#10b981' : '#94a3b8',
                          textAlign: 'center'
                        }}
                        onClick={() => isConnectedInput ? disconnectNodes(other.id, node.id) : connectNodes(other.id, node.id)}
                      >
                        {isConnectedInput ? '🟢 Entrada Ativa' : '⚪ Ligar Entrada ⬅️'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live metrics */}
        {metrics.status !== 'idle' && (
          <>
            <div className="config-section-title">
              <Activity size={14} /> Live Metrics
            </div>
            <div className="metrics-grid">
              <div className="metric-card">
                <Users size={14} className="metric-card-icon" />
                <span className="metric-card-label">Inbound RPS</span>
                <span className="metric-card-value">
                  {metrics.inboundRps.toLocaleString()}
                  {(metrics.inboundReadRps !== undefined || metrics.inboundWriteRps !== undefined) && (
                    <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                      R: {Math.round(metrics.inboundReadRps ?? 0)} | W: {Math.round(metrics.inboundWriteRps ?? 0)}
                    </span>
                  )}
                </span>
              </div>
              <div className="metric-card">
                <Activity size={14} className="metric-card-icon" style={{ color: (metrics.failedRps ?? 0) > 0 ? '#ef4444' : '#22c55e' }} />
                <span className="metric-card-label">Success Rate</span>
                <span className="metric-card-value">
                  {metrics.inboundRps > 0
                    ? `${Math.round(((metrics.successRps ?? metrics.inboundRps) / metrics.inboundRps) * 1000) / 10}%`
                    : '100%'}
                  <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                    OK: {Math.round(metrics.successRps ?? metrics.inboundRps).toLocaleString()} | Err: {Math.round(metrics.failedRps ?? 0).toLocaleString()}
                  </span>
                </span>
              </div>
              {config.circuitBreakerEnabled && (
                <div className={`metric-card cb-state-${metrics.cbState || 'CLOSED'}`}>
                  <Zap size={14} className="metric-card-icon" />
                  <span className="metric-card-label">Circuit Breaker</span>
                  <span className="metric-card-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className={`cb-indicator cb-indicator-${metrics.cbState || 'CLOSED'}`} />
                    {metrics.cbState || 'CLOSED'}
                    {metrics.cbState === 'OPEN' && metrics.cbOpenTimer !== undefined && ` (${metrics.cbOpenTimer}s)`}
                  </span>
                </div>
              )}
              {config.cpuCores !== undefined && (
                <div className="metric-card">
                  <Cpu size={14} className="metric-card-icon" />
                  <span className="metric-card-label">CPU</span>
                  <span className="metric-card-value">{metrics.cpuPct}%</span>
                </div>
              )}
              {config.ramGb !== undefined && (
                <div className="metric-card">
                  <Server size={14} className="metric-card-icon" />
                  <span className="metric-card-label">RAM</span>
                  <span className="metric-card-value">{metrics.ramPct}%</span>
                </div>
              )}
              <div className="metric-card">
                <Clock size={14} className="metric-card-icon" />
                <span className="metric-card-label">Latency</span>
                <span className="metric-card-value">{metrics.latencyMs}ms</span>
              </div>
              {def.accumulatesStorage && config.storageGb !== undefined && (
                <div className="metric-card">
                  <HardDrive size={14} className="metric-card-icon" />
                  <span className="metric-card-label">Storage</span>
                  <span className="metric-card-value">{metrics.storagePct}%</span>
                </div>
              )}
              {metrics.queueDepth > 0 && (
                <div className="metric-card critical">
                  <Zap size={14} className="metric-card-icon" />
                  <span className="metric-card-label">Queue Depth</span>
                  <span className="metric-card-value">{metrics.queueDepth.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Distributed Trace Waterfall */}
            {(() => {
              const spans = generateSpans();
              if (spans.length === 0) return null;
              
              const totalDuration = Math.max(...spans.map(s => s.startMs + s.durationMs));
              const scale = totalDuration > 0 ? totalDuration : 1;
              
              return (
                <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                  <div className="config-section-title" style={{ marginBottom: '6px' }}>
                    <Zap size={14} style={{ color: '#818cf8' }} /> Distributed Trace Waterfall
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
                    Waterfall originating from this node:
                  </div>
                  <div className="trace-container" style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Timeline Header */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', paddingBottom: '4px', marginBottom: '4px', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ flex: 1 }}>Component / Span</div>
                      <div style={{ width: '120px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>0ms</span>
                        <span>{Math.round(totalDuration / 2)}ms</span>
                        <span>{Math.round(totalDuration)}ms</span>
                      </div>
                    </div>
                    
                    {/* Spans List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {spans.map((s) => {
                        const leftPct = (s.startMs / scale) * 100;
                        const widthPct = Math.max(1, (s.durationMs / scale) * 100);
                        const isErr = s.status === 'error';
                        
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', fontSize: '10px' }}>
                            {/* Name Label */}
                            <div style={{ flex: 1, paddingLeft: `${s.depth * 10}px`, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '8px', color: isErr ? '#ef4444' : '#818cf8' }}>
                                {s.depth > 0 ? '↳' : '●'}
                              </span>
                              <span style={{ fontWeight: 500, color: isErr ? '#fca5a5' : '#ffffff' }} title={s.label}>
                                {s.label}
                              </span>
                            </div>
                            
                            {/* Bar Timeline */}
                            <div style={{ width: '120px', height: '14px', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: isErr 
                                    ? 'linear-gradient(90deg, #ef4444, #b91c1c)' 
                                    : 'linear-gradient(90deg, #6366f1, #3b82f6)',
                                  borderRadius: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: '4px',
                                  boxSizing: 'border-box'
                                }}
                                title={`${s.label}: ${Math.round(s.durationMs)}ms`}
                              />
                              <span style={{ position: 'absolute', right: '4px', fontSize: '8px', fontFamily: 'var(--font-mono)', lineHeight: '14px', color: isErr ? '#fca5a5' : '#94a3b8', zIndex: 1 }}>
                                {Math.round(s.durationMs)}ms
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {historyData.length > 2 && (config.cpuCores !== undefined || config.ramGb !== undefined) && (
              <div className="chart-container">
                <div className="chart-title">CPU & RAM History</div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={historyData}>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={(l) => `Tick ${l}`}
                    />
                    {config.cpuCores !== undefined && (
                      <Line type="monotone" dataKey="CPU" stroke="#f59e0b" dot={false} strokeWidth={2} />
                    )}
                    {config.ramGb !== undefined && (
                      <Line type="monotone" dataKey="RAM" stroke="#6366f1" dot={false} strokeWidth={2} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  {config.cpuCores !== undefined && (
                    <span className="legend-item" style={{ color: '#f59e0b' }}>● CPU</span>
                  )}
                  {config.ramGb !== undefined && (
                    <span className="legend-item" style={{ color: '#6366f1' }}>● RAM</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {((config.maxRps !== undefined && config.replicas !== undefined) ||
          (config.ramGb !== undefined && config.replicas !== undefined) ||
          (def.accumulatesStorage && config.storageGb !== undefined && config.replicas !== undefined)) && (
          <div className="config-summary">
            {config.maxRps !== undefined && config.replicas !== undefined && (
              <div className="config-summary-row">
                <span>Total Capacity</span>
                <strong>{(config.maxRps * config.replicas).toLocaleString()} RPS</strong>
              </div>
            )}
            {config.ramGb !== undefined && config.replicas !== undefined && (
              <div className="config-summary-row">
                <span>Total RAM</span>
                <strong>{config.ramGb * config.replicas} GB</strong>
              </div>
            )}
            {def.accumulatesStorage && config.storageGb !== undefined && config.replicas !== undefined && (
              <div className="config-summary-row">
                <span>Total Storage</span>
                <strong>{config.storageGb >= 1000 ? `${(config.storageGb / 1000).toFixed(1)} TB` : `${config.storageGb} GB`}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
