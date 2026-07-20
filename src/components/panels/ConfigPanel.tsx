import React from 'react';
import { X, Server, Cpu, HardDrive, Users, Clock, Activity, Trash, Radio } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { COMPONENT_DEFINITIONS } from '../../engine/models/ComponentModel';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ServiceIcon } from '../ui/ServiceIcon';
import type { EdgeMetrics } from '../../types';

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
    } else {
      val = Math.max(min, Math.min(max, val));
    }
    setTempValue(String(val));
    onChange(val);
  };

  return (
    <div className="config-slider-group">
      <div className="config-slider-header">
        <label className="config-label">{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="text"
            value={tempValue}
            onChange={handleInputChange}
            onBlur={handleBlurOrEnter}
            onKeyDown={(e) => e.key === 'Enter' && handleBlurOrEnter()}
            className="config-value-input"
          />
          <span className="config-unit">{unit}</span>
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
    </div>
  );
};

export const ConfigPanel: React.FC = () => {
  const {
    selectedNodeId,
    selectedEdgeId,
    nodes,
    edges,
    updateNodeConfig,
    updateEdgeData,
    selectNode,
    selectEdge,
    connectNodes,
    disconnectNodes,
  } = useSimulatorStore();

  const node = nodes.find((n) => n.id === selectedNodeId);
  const edge = edges.find((e) => e.id === selectedEdgeId);

  const [selectedTraceSourceId, setSelectedTraceSourceId] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'resources' | 'specific' | 'connections'>('dashboard');

  const incomingEdges = React.useMemo(() => {
    return node ? edges.filter(e => e.target === node.id) : [];
  }, [node, edges]);

  const incomingNodes = React.useMemo(() => {
    return incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter((n): n is typeof n & {} => !!n);
  }, [incomingEdges, nodes]);

  React.useEffect(() => {
    setActiveTab('dashboard');
    if (selectedNodeId) {
      const state = useSimulatorStore.getState();
      const currNode = state.nodes.find(n => n.id === selectedNodeId);
      if (currNode) {
        const incoming = state.edges
          .filter(e => e.target === selectedNodeId)
          .map(e => state.nodes.find(n => n.id === e.source))
          .filter((n): n is typeof n & {} => !!n);
        if (incoming.length > 0) {
          setSelectedTraceSourceId(incoming[0].id);
          return;
        }
      }
    }
    setSelectedTraceSourceId('');
  }, [selectedNodeId]);

  const update = (key: string, value: number | string | boolean) => {
    if (node) updateNodeConfig(node.id, { [key]: value });
  };

  if (!node && edge) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceLabel = sourceNode?.data.config.label || sourceNode?.id || 'Origem';
    const targetLabel = targetNode?.data.config.label || targetNode?.id || 'Destino';
    const metrics = edge.data?.metrics as EdgeMetrics | undefined;
    const trafficType = (edge.data?.trafficType as 'all' | 'read' | 'write') ?? 'all';
    const networkLatency = (edge.data?.networkLatencyMs as number) ?? 0;
    const connectionLabel = (edge.data?.label as string) ?? '';

    const updateEdge = (key: string, value: any) => {
      updateEdgeData(edge.id, { [key]: value });
    };

    const PRESETS = [
      { name: 'LAN / Same AZ', value: 1, desc: 'Datacenter local (0.5ms - 1ms)' },
      { name: 'Cross-AZ (VPC)', value: 2.5, desc: 'Diferentes zonas de disponibilidade' },
      { name: 'Cross-Region (WAN)', value: 15, desc: 'Mesmo continente (ex: Virgínia a Ohio)' },
      { name: 'Intercontinental', value: 120, desc: 'Longa distância (ex: EUA a Brasil)' },
      { name: 'Public Internet (Fiber)', value: 25, desc: 'Banda larga fixa residencial' },
      { name: 'Mobile 4G/5G Network', value: 50, desc: 'Última milha de telefonia celular' },
    ];

    const handleDeleteEdge = () => {
      disconnectNodes(edge.source, edge.target);
      selectEdge(null);
    };

    return (
      <div className="config-modal-overlay" onClick={() => selectEdge(null)}>
        <div className="config-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '560px' }}>
          {/* Header */}
          <div className="config-header" style={{ borderBottom: '1px solid var(--border-dim)', padding: '16px 20px' }}>
            <div className="config-header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>🔗</span>
              <div>
                <div className="config-node-type" style={{ fontSize: '15px', fontWeight: 600 }}>Conexão de Rede</div>
                <div className="config-node-desc" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Link entre <strong>{sourceLabel}</strong> e <strong>{targetLabel}</strong>
                </div>
              </div>
            </div>
            <button className="config-close-btn" onClick={() => selectEdge(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="config-modal-body" style={{ gap: '16px' }}>
            <div className="config-grid-layout" style={{ gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="config-section-title">Parâmetros do Link</div>
                <div className="config-field">
                  <label className="config-label">Nome da Conexão</label>
                  <input
                    type="text"
                    placeholder="Ex: Conexão WAN, Link DB..."
                    value={connectionLabel}
                    onChange={(e) => updateEdge('label', e.target.value)}
                    className="config-input"
                  />
                </div>

                <div className="config-field" style={{ marginTop: '4px' }}>
                  <label className="config-label">Filtro de Tráfego (Roteamento)</label>
                  <select
                    value={trafficType}
                    onChange={(e) => updateEdge('trafficType', e.target.value)}
                    className="config-input"
                    style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="all">🔄 Leitura & Escrita (Tudo)</option>
                    <option value="read">📖 Apenas Leitura (Read Query)</option>
                    <option value="write">✍️ Apenas Escrita (Write Command)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="config-section-title">Presets de Latência (RTT)</div>
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '5px', 
                    maxHeight: '180px', 
                    overflowY: 'auto',
                    paddingRight: '2px'
                  }}
                >
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => updateEdge('networkLatencyMs', p.value)}
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: networkLatency === p.value ? 'rgba(56, 189, 248, 0.15)' : '#131c2a',
                        border: '1px solid',
                        borderColor: networkLatency === p.value ? '#38bdf8' : '#1e293b',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#fff',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 600, color: networkLatency === p.value ? '#38bdf8' : '#ffffff' }}>
                        {p.name} ({p.value}ms)
                      </div>
                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {p.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Slider
              label="Latência de Rede Customizada"
              value={networkLatency}
              min={0}
              max={500}
              step={networkLatency < 10 ? 0.5 : 5}
              unit=" ms"
              onChange={(v) => updateEdge('networkLatencyMs', v)}
            />

            {metrics && (
              <>
                <div className="config-section-title" style={{ marginTop: '4px' }}>
                  <Activity size={14} /> Métricas de Tráfego do Link
                </div>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <Users size={12} className="metric-card-icon" />
                    <span className="metric-card-label">RPS Tráfego</span>
                    <span className="metric-card-value">
                      {metrics.rps.toLocaleString()}
                      {(metrics.readRps !== undefined || metrics.writeRps !== undefined) && (
                        <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                          R: {Math.round(metrics.readRps ?? 0)} | W: {Math.round(metrics.writeRps ?? 0)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="metric-card">
                    <Clock size={12} className="metric-card-icon" style={{ color: '#818cf8' }} />
                    <span className="metric-card-label">Latência Total</span>
                    <span className="metric-card-value">{metrics.latencyMs}ms</span>
                  </div>
                  <div className="metric-card">
                    <Radio size={12} className="metric-card-icon" style={{ color: '#38bdf8' }} />
                    <span className="metric-card-label">Atraso Rede (RTT)</span>
                    <span className="metric-card-value">{networkLatency}ms</span>
                  </div>
                  {metrics.queueWaitTimeMs !== undefined && metrics.queueWaitTimeMs > 0 && (
                    <div className="metric-card warning">
                      <Clock size={12} className="metric-card-icon" />
                      <span className="metric-card-label">Tempo Fila DB</span>
                      <span className="metric-card-value">{metrics.queueWaitTimeMs}ms</span>
                    </div>
                  )}
                  {metrics.timeoutsPerSecond > 0 && (
                    <div className="metric-card critical">
                      <Clock size={12} className="metric-card-icon" />
                      <span className="metric-card-label">Timeouts / s</span>
                      <span className="metric-card-value">{metrics.timeoutsPerSecond}</span>
                    </div>
                  )}
                  {metrics.failuresPerSecond !== undefined && metrics.failuresPerSecond > 0 && (
                    <div className="metric-card critical">
                      <Clock size={12} className="metric-card-icon" />
                      <span className="metric-card-label">Erros / s</span>
                      <span className="metric-card-value">{metrics.failuresPerSecond}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="config-modal-footer">
            <button 
              style={{
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '4px',
                color: '#fca5a5',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onClick={handleDeleteEdge}
            >
              Excluir Conexão
            </button>
            <button 
              style={{
                padding: '6px 18px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => selectEdge(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!node) return null;

  const def = COMPONENT_DEFINITIONS[node.data.componentType];
  const { config, metrics } = node.data;


  const historyData = metrics.history.map((h) => ({
    tick: h.tick,
    CPU: h.cpuPct,
    RAM: h.ramPct,
    Lat: h.latencyMs,
    RPS: h.rps,
  }));

  const renderObservabilityView = () => {
    if (!node) return null;
    const compType = node.data.componentType;

    if (compType === 'metrics') {
      return (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <div className="config-section-title" style={{ marginBottom: '8px' }}>
            <Activity size={14} /> Telemetria de Métricas Ingeridas
          </div>
          {incomingNodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
              Nenhuma entrada de telemetria conectada. Ligue servidores ou bancos a este coletor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '6px 4px' }}>Componente</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>RPS</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>CPU</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Lat Média</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>p99</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingNodes.map(n => {
                    const m = n!.data.metrics;
                    return (
                      <tr key={n!.id} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '6px 4px', fontWeight: 500, color: '#fff' }}>{n!.data.config.label}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Math.round(m.inboundRps)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.cpuPct}%</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.latencyMs}ms</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f87171' }}>{m.p99 ?? m.latencyMs}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (compType === 'logs') {
      const logsList = metrics.logs ?? [];
      return (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <div className="config-section-title" style={{ marginBottom: '8px' }}>
            <Activity size={14} /> Console de Logs do Sistema
          </div>
          <div 
            style={{
              background: '#040711',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              padding: '10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#34d399',
              maxHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              lineHeight: '1.4',
              textAlign: 'left'
            }}
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            {logsList.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                [Aguardando ticks de simulação... Ligue servidores na entrada]
              </span>
            ) : (
              logsList.map((log, idx) => {
                let color = '#34d399';
                if (log.includes('[ERROR]')) color = '#f87171';
                else if (log.includes('[WARN]')) color = '#fbbf24';
                return <span key={idx} style={{ color }}>{log}</span>;
              })
            )}
          </div>
        </div>
      );
    }

    if (compType === 'tracing') {
      const sourceToTrace = incomingNodes.find(n => n!.id === selectedTraceSourceId);

      const generateTelemetrySpans = (traceNodeId: string) => {
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

        function buildTrace(nId: string, currentOffset: number, depth: number) {
          if (visited.has(nId)) return;
          visited.add(nId);

          const currNode = nodes.find((n) => n.id === nId);
          if (!currNode) return;

          const currMetrics = currNode.data.metrics;
          const currCfg = currNode.data.config;

          const isError = currMetrics.cbState === 'OPEN' || (currMetrics.failedRps ?? 0) > ((currMetrics.inboundRps ?? 0) * 0.1) || currMetrics.status === 'critical';
          const nodeLatency = currMetrics.latencyMs || 0.1;

          const nodeOutEdges = edges.filter((e) => e.source === nId && e.target !== node?.id);
          const nextOffset = currentOffset + nodeLatency;
          let maxChildDuration = 0;

          let sequentialOffset = nextOffset;

          for (const edge of nodeOutEdges) {
            const edgeMetrics = edge.data?.metrics as any;
            const edgeWait = edgeMetrics?.queueWaitTimeMs ?? 0;
            const edgeNetwork = (edge.data?.networkLatencyMs as number) ?? 0;
            const connectionDelay = edgeWait + edgeNetwork;

            const targetId = edge.target;
            const callStart = sequentialOffset;
            
            buildTrace(targetId, callStart + connectionDelay, depth + 1);
            
            const targetNodeMetrics = nodes.find((n) => n.id === targetId)?.data.metrics;
            const targetE2E = targetNodeMetrics?.endToEndLatencyMs ?? targetNodeMetrics?.latencyMs ?? 0;
            const childTotalDuration = connectionDelay + targetE2E;
            
            sequentialOffset += childTotalDuration;
            maxChildDuration = Math.max(maxChildDuration, (callStart - nextOffset) + childTotalDuration);
          }

          const spanDuration = nodeLatency + maxChildDuration;

          spans.push({
            id: nId,
            label: currCfg.label,
            componentType: currNode.data.componentType,
            startMs: currentOffset,
            durationMs: spanDuration,
            depth,
            status: isError ? 'error' : 'ok',
          });
        }

        buildTrace(traceNodeId, 0, 0);
        return spans.sort((a, b) => a.startMs - b.startMs || a.depth - b.depth);
      };

      const spans = sourceToTrace ? generateTelemetrySpans(sourceToTrace.id) : [];
      const totalDuration = spans.length > 0 ? Math.max(...spans.map(s => s.startMs + s.durationMs)) : 0;
      const scale = totalDuration > 0 ? totalDuration : 1;

      return (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <div className="config-section-title" style={{ marginBottom: '8px' }}>
            <Activity size={14} /> Distributed Tracing Collector
          </div>
          {incomingNodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
              Nenhuma entrada de trace conectada. Ligue clientes ou APIs a este coletor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="config-field">
                <label className="config-label">Inspecionar Origem do Trace</label>
                <select
                  value={selectedTraceSourceId}
                  onChange={(e) => setSelectedTraceSourceId(e.target.value)}
                  className="config-input"
                  style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '11px', padding: '4px 8px' }}
                >
                  {incomingNodes.map(n => (
                    <option key={n!.id} value={n!.id}>{n!.data.config.label}</option>
                  ))}
                </select>
              </div>

              {sourceToTrace && spans.length > 0 && (
                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px', padding: '10px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', paddingBottom: '4px', marginBottom: '4px', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ flex: 1 }}>Span</div>
                    <div style={{ width: '100px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>0ms</span>
                      <span>{Math.round(totalDuration)}ms</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {spans.map((s) => {
                      const leftPct = (s.startMs / scale) * 100;
                      const widthPct = Math.max(1, (s.durationMs / scale) * 100);
                      const isErr = s.status === 'error';
                      
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                          <div style={{ flex: 1, paddingLeft: `${s.depth * 8}px`, display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '7px', color: isErr ? '#ef4444' : '#818cf8' }}>
                              {s.depth > 0 ? '↳' : '●'}
                            </span>
                            <span style={{ fontWeight: 500, color: isErr ? '#fca5a5' : '#ffffff' }}>
                              {s.label}
                            </span>
                          </div>
                          
                          <div style={{ width: '100px', height: '11px', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }}>
                            <div 
                              style={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                height: '100%',
                                background: isErr ? '#ef4444' : '#6366f1',
                                borderRadius: '1px',
                              }}
                            />
                            <span style={{ position: 'absolute', right: '2px', fontSize: '7px', fontFamily: 'var(--font-mono)', lineHeight: '11px', color: isErr ? '#fca5a5' : '#94a3b8', zIndex: 1 }}>
                              {Math.round(s.durationMs)}ms
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (compType === 'alerting') {
      const activeAlerts = incomingNodes
        .map(n => {
          const m = n!.data.metrics;
          const c = n!.data.config;
          if (m.status === 'critical') {
            return { label: c.label, severity: 'CRITICAL', msg: `Uso crítico de recursos no servidor: CPU em ${m.cpuPct}%, erros em ${Math.round(m.failedRps ?? 0)}/s` };
          }
          if (m.status === 'warning') {
            return { label: c.label, severity: 'WARNING', msg: `Uso elevado detectado: CPU em ${m.cpuPct}%` };
          }
          return null;
        })
        .filter(Boolean);

      return (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <div className="config-section-title" style={{ marginBottom: '8px' }}>
            <Activity size={14} /> Gerenciador de Alertas Ativos
          </div>
          {incomingNodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
              Nenhuma entrada conectada. Ligue servidores a este alerta.
            </div>
          ) : activeAlerts.length === 0 ? (
            <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid #22c55e', borderRadius: '6px', color: '#86efac', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
              <span>🟢</span>
              <span>Todos os sistemas operando normalmente. Nenhum alerta disparado.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              {activeAlerts.map((a, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    background: a!.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid',
                    borderColor: a!.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: a!.severity === 'CRITICAL' ? '#fca5a5' : '#fde047' }}>
                    <span>🚨 {a!.severity}: {a!.label}</span>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.8 }}>PagerDuty</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                    {a!.msg}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (compType === 'health-check') {
      return (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <div className="config-section-title" style={{ marginBottom: '8px' }}>
            <Activity size={14} /> Heartbeat Monitor (Saúde)
          </div>
          {incomingNodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
              Nenhuma entrada conectada. Ligue servidores a este monitor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              {incomingNodes.map(n => {
                const m = n!.data.metrics;
                const c = n!.data.config;
                const isHealthy = m.status !== 'critical';
                return (
                  <div 
                    key={n!.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'rgba(30, 41, 59, 0.3)',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '11px'
                    }}
                  >
                    <span style={{ fontWeight: 500, color: '#fff' }}>{c.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isHealthy ? '#22c55e' : '#ef4444' }} />
                      <span style={{ fontWeight: 600, color: isHealthy ? '#86efac' : '#fca5a5' }}>
                        {isHealthy ? 'HEALTHY' : 'DOWN / CRASHED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="config-modal-overlay" onClick={() => selectNode(null)}>
      <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="config-header" style={{ borderBottom: '1px solid var(--border-dim)', padding: '16px 20px' }}>
          <div className="config-header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ServiceIcon type={node.data.componentType} size={28} />
            <div>
              <div className="config-node-type" style={{ fontSize: '15px', fontWeight: 600 }}>
                {config.label} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>({def.label})</span>
              </div>
              <div className="config-node-desc" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {def.description}
              </div>
            </div>
          </div>
          <button className="config-close-btn" onClick={() => selectNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="config-modal-tabs">
          <button 
            className={`config-modal-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard & Telemetria
          </button>
          <button 
            className={`config-modal-tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
            onClick={() => setActiveTab('resources')}
          >
            ⚙️ Recursos de Servidor
          </button>
          <button 
            className={`config-modal-tab-btn ${activeTab === 'specific' ? 'active' : ''}`}
            onClick={() => setActiveTab('specific')}
          >
            🧩 Parâmetros do Nó
          </button>
          <button 
            className={`config-modal-tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            🔗 Conexões Rápidas
          </button>
        </div>

        {/* Modal Body */}
        <div className="config-modal-body">
          {activeTab === 'dashboard' && (
            <>
              {metrics.status !== 'idle' ? (
                <>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <Users size={14} className="metric-card-icon" />
                      <span className="metric-card-label">RPS Inbound</span>
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

                    <div className="metric-card">
                      <Clock size={14} className="metric-card-icon" />
                      <span className="metric-card-label">Latency</span>
                      <span className="metric-card-value">{metrics.latencyMs}ms</span>
                      {metrics.p50 !== undefined && (
                        <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 4, lineHeight: 1.3 }}>
                          p50: {metrics.p50}ms | p95: {metrics.p95}ms | p99: {metrics.p99}ms
                        </span>
                      )}
                    </div>

                    {config.cpuCores !== undefined && (
                      <div className="metric-card">
                        <Cpu size={14} className="metric-card-icon" />
                        <span className="metric-card-label">CPU (Processador)</span>
                        <span className="metric-card-value">{metrics.cpuPct}%</span>
                      </div>
                    )}

                    {config.ramGb !== undefined && (
                      <div className="metric-card">
                        <Server size={14} className="metric-card-icon" />
                        <span className="metric-card-label">RAM (Memória)</span>
                        <span className="metric-card-value">{metrics.ramPct}%</span>
                      </div>
                    )}

                    {def.accumulatesStorage && config.storageGb !== undefined && (
                      <div className="metric-card">
                        <HardDrive size={14} className="metric-card-icon" />
                        <span className="metric-card-label">Storage (Disco)</span>
                        <span className="metric-card-value">{metrics.storagePct}%</span>
                      </div>
                    )}

                    {metrics.activeReplicas !== undefined && metrics.activeReplicas !== config.replicas && (
                      <div className="metric-card" style={{ borderColor: 'var(--accent)' }}>
                        <Server size={14} className="metric-card-icon" style={{ color: 'var(--accent)' }} />
                        <span className="metric-card-label">Instâncias Ativas</span>
                        <span className="metric-card-value">
                          {metrics.activeReplicas} / {config.replicas}
                          <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                            Auto-scaling ativo
                          </span>
                        </span>
                      </div>
                    )}

                    {metrics.consumerLag !== undefined && (
                      <div className={`metric-card ${metrics.consumerLag > 5000 ? 'critical' : ''}`}>
                        <Activity size={14} className="metric-card-icon" style={{ color: metrics.consumerLag > 1000 ? '#f59e0b' : '#34d399' }} />
                        <span className="metric-card-label">Consumer Lag</span>
                        <span className="metric-card-value">
                          {metrics.consumerLag.toLocaleString()} msgs
                          <span style={{ fontSize: 9, display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                            {metrics.consumerLag === 0 
                              ? '🟢 Consumidores em dia' 
                              : metrics.consumerLag > 15000 
                                ? '🔴 Fila congestionada! Aumente os workers' 
                                : '🟡 Acumulando mensagens'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {renderObservabilityView()}

                  {historyData.length > 2 && (config.cpuCores !== undefined || config.ramGb !== undefined) && (
                    <div className="chart-container" style={{ marginTop: '16px' }}>
                      <div className="chart-title">Histórico de CPU & RAM</div>
                      <ResponsiveContainer width="100%" height={90}>
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
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-muted)' }}>
                  <Activity size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <span>A simulação está parada. Clique em Iniciar (Play) para ver as métricas ao vivo!</span>
                </div>
              )}
            </>
          )}

          {activeTab === 'resources' && (
            <div className="config-grid-layout">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="config-section-title">Dados Principais</div>
                <div className="config-field">
                  <label className="config-label">Nome do Componente</label>
                  <input
                    type="text"
                    value={config.label}
                    onChange={(e) => update('label', e.target.value)}
                    className="config-input"
                  />
                </div>
                <div className="config-field">
                  <label className="config-label">Notas de Arquitetura</label>
                  <textarea
                    value={config.notes ?? ''}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="Adicione observações sobre a arquitetura..."
                    className="config-input"
                    rows={4}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="config-section-title" style={{ marginTop: '8px' }}>Gargalo e Resiliência</div>
                <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
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
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="config-section-title">Capacidade de Processamento</div>
                {config.replicas !== undefined && (
                  <Slider label="Instâncias (Replicas)" value={config.replicas} min={1} max={100} step={1} unit="×" onChange={(v) => update('replicas', v)} />
                )}
                {config.maxRps !== undefined && (
                  <Slider label="Limite de RPS (por replica)" value={config.maxRps} min={100} max={100000} step={100} unit=" rps" onChange={(v) => update('maxRps', v)} />
                )}
                {config.connectionPool !== undefined && (
                  <Slider label="Pool de Conexões (Max)" value={config.connectionPool} min={5} max={5000} step={5} unit=" conns" onChange={(v) => update('connectionPool', v)} />
                )}
                {config.timeoutMs !== undefined && (
                  <Slider label="Timeout de Requisição" value={config.timeoutMs} min={50} max={10000} step={50} unit=" ms" onChange={(v) => update('timeoutMs', v)} />
                )}
                {config.writeRatio !== undefined && (
                  <Slider label="Percentual de Escrita (W)" value={Math.round(config.writeRatio * 100)} min={0} max={100} step={5} unit="%" onChange={(v) => update('writeRatio', v / 100)} />
                )}
                {def.isSource && config.clientLatencyMs !== undefined && (
                  <Slider label="Ping de Última Milha (Cliente)" value={config.clientLatencyMs} min={0} max={250} step={5} unit=" ms" onChange={(v) => update('clientLatencyMs', v)} />
                )}
                
                {!def.isSource && !def.isSink && config.maxRps !== undefined && (
                  <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="config-label">Semáforo (Rate Limiter)</span>
                    <input
                      type="checkbox"
                      checked={!!config.rateLimiterEnabled}
                      onChange={(e) => update('rateLimiterEnabled', e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                  </div>
                )}
                <Slider label="Injeção de Erro (Manual)" value={Math.round((config.errorRate ?? 0) * 100)} min={0} max={100} step={1} unit="%" onChange={(v) => update('errorRate', v / 100)} />
              </div>
            </div>
          )}

          {activeTab === 'specific' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="config-section-title">Comportamentos de Arquitetura</div>

              {/* Load Balancer */}
              {node.data.componentType === 'load-balancer' && (
                <div className="config-field">
                  <label className="config-label">Algoritmo de Roteamento</label>
                  <select
                    value={config.lbAlgorithm ?? 'round-robin'}
                    onChange={(e) => update('lbAlgorithm', e.target.value)}
                    className="config-input"
                    style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff', padding: '6px 10px' }}
                  >
                    <option value="round-robin">Round Robin (Divisão Igual)</option>
                    <option value="least-connections">Least Connections (Ponderado por CPU)</option>
                  </select>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    * Least Connections redireciona dinamicamente mais tráfego para os nós com menor processamento de CPU.
                  </span>
                </div>
              )}

              {/* Compute (App Server / Worker Auto-scaling) */}
              {(node.data.componentType === 'app-server' || node.data.componentType === 'worker') && (
                <>
                  <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="config-label">Habilitar Auto-scaling</span>
                    <input
                      type="checkbox"
                      checked={!!config.autoscalingEnabled}
                      onChange={(e) => update('autoscalingEnabled', e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                  </div>
                  {config.autoscalingEnabled && (
                    <Slider
                      label="Limite Máximo de Instâncias (maxReplicas)"
                      value={config.maxReplicas ?? 10}
                      min={config.replicas ?? 1}
                      max={200}
                      step={1}
                      unit="×"
                      onChange={(v) => update('maxReplicas', v)}
                    />
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    * O Auto-scaling escala réplicas de forma automática e dinâmica quando o servidor atinge &gt;80% de utilização.
                  </span>
                </>
              )}

              {/* Database Read Replicas */}
              {node.data.componentType === 'sql-database' && (
                <>
                  <div className="config-field">
                    <label className="config-label">Topologia de Banco de Dados</label>
                    <select
                      value={config.dbReplication ?? 'standalone'}
                      onChange={(e) => update('dbReplication', e.target.value)}
                      className="config-input"
                      style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff', padding: '6px 10px' }}
                    >
                      <option value="standalone">Standalone (Instância Única)</option>
                      <option value="master-replica">Master-Replica (1 Master Escrita + Replicas Leitura)</option>
                    </select>
                  </div>
                  {config.dbReplication === 'master-replica' && (
                    <>
                      <div className="config-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span className="config-label">Habilitar Read-Write Splitting</span>
                        <input
                          type="checkbox"
                          checked={!!config.readWriteSplittingEnabled}
                          onChange={(e) => update('readWriteSplittingEnabled', e.target.checked)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                        />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        * Com Read-Write Splitting ativo, leituras e escritas são separadas. Se o Master cair, escritas param, mas as leituras ainda funcionam!
                      </span>
                    </>
                  )}
                </>
              )}

              {/* Memory Cache Store */}
              {node.data.componentType === 'cache' && (
                <>
                  <div className="config-field">
                    <label className="config-label">Política de Despejo (Eviction Policy)</label>
                    <select
                      value={config.evictionPolicy ?? 'lru'}
                      onChange={(e) => update('evictionPolicy', e.target.value)}
                      className="config-input"
                      style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff', padding: '6px 10px' }}
                    >
                      <option value="lru">LRU (Least Recently Used)</option>
                      <option value="lfu">LFU (Least Frequently Used)</option>
                      <option value="fifo">FIFO (First In, First Out)</option>
                      <option value="none">None (Sem Evicção - Falha se encher)</option>
                    </select>
                  </div>
                  <Slider
                    label="Limite de Memória Cache"
                    value={config.memoryLimitMb ?? 512}
                    min={64}
                    max={8192}
                    step={64}
                    unit=" MB"
                    onChange={(v) => update('memoryLimitMb', v)}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    * Políticas de despejo otimizam a reciclagem de cache. Sob alta carga de escrita, memórias pequenas forçam a perda de hit rate dependendo da política.
                  </span>
                </>
              )}

              {/* Message Queue / Kafka */}
              {(node.data.componentType === 'message-queue' || node.data.componentType === 'kafka') && (
                <>
                  <div className="config-field">
                    <label className="config-label">Garantia de Entrega (Delivery Guarantee)</label>
                    <select
                      value={config.deliveryGuarantee ?? 'at-least-once'}
                      onChange={(e) => update('deliveryGuarantee', e.target.value)}
                      className="config-input"
                      style={{ background: '#192231', border: '1px solid #334155', borderRadius: '4px', color: '#fff', padding: '6px 10px' }}
                    >
                      <option value="at-least-once">At-least-once (Entrega Garantida - Duplicáveis)</option>
                      <option value="at-most-once">At-most-once (Rápido - Risco de Perdas)</option>
                      <option value="exactly-once">Exactly-once (Seguro - Transacional com Coordenação 2PC)</option>
                    </select>
                  </div>
                  <Slider
                    label="Número de Partições (Consumer Parallelism)"
                    value={config.partitionCount ?? 4}
                    min={1}
                    max={64}
                    step={1}
                    unit=" partições"
                    onChange={(v) => update('partitionCount', v)}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    * Exactly-once garante consistência absoluta ao custo de +15ms de latência de coordenação.
                    * O número de partições limita o paralelismo dos Workers conectados: réplicas extras ficarão ociosas se excederem as partições!
                  </span>
                </>
              )}

              {/* Fallback */}
              {node.data.componentType !== 'load-balancer' && 
               node.data.componentType !== 'app-server' && 
               node.data.componentType !== 'worker' && 
               node.data.componentType !== 'sql-database' && 
               node.data.componentType !== 'cache' && 
               node.data.componentType !== 'message-queue' && 
               node.data.componentType !== 'kafka' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                  Este componente não requer configurações específicas de arquitetura. Parâmetros gerais podem ser editados na aba "Recursos".
                </div>
              )}
            </div>
          )}

          {activeTab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="config-section-title">Gerenciar Conexões Ativas</div>
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  paddingRight: '4px' 
                }}
              >
                {nodes.filter((n) => n.id !== node.id).length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    Crie outros nós no Canvas para ligar conexões.
                  </div>
                ) : (
                  nodes
                    .filter((n) => n.id !== node.id)
                    .map((other) => {
                      const isConnectedOutput = edges.some((e) => e.source === node.id && e.target === other.id);
                      const isConnectedInput = edges.some((e) => e.source === other.id && e.target === node.id);
                      const otherDef = COMPONENT_DEFINITIONS[other.data.componentType];
                      
                      const canConnectAsOutput = !def.isSink && !otherDef.isSource;
                      const canConnectAsInput = !def.isSource && !otherDef.isSink;

                      if (!canConnectAsOutput && !canConnectAsInput) return null;

                      return (
                        <div 
                          key={other.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#192231',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <ServiceIcon type={other.data.componentType} size={18} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {other.data.config.label}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {otherDef.label}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canConnectAsOutput && (
                              <button 
                                style={{
                                  fontSize: '10px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  border: '1px solid #334155',
                                  background: isConnectedOutput ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                                  borderColor: isConnectedOutput ? '#10b981' : '#334155',
                                  color: isConnectedOutput ? '#10b981' : '#94a3b8',
                                }}
                                onClick={() => isConnectedOutput ? disconnectNodes(node.id, other.id) : connectNodes(node.id, other.id)}
                              >
                                {isConnectedOutput ? '🟢 Saída Ativa' : '⚪ Ligar Saída ➡️'}
                              </button>
                            )}
                            {canConnectAsInput && (
                              <button 
                                style={{
                                  fontSize: '10px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  border: '1px solid #334155',
                                  background: isConnectedInput ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                                  borderColor: isConnectedInput ? '#10b981' : '#334155',
                                  color: isConnectedInput ? '#10b981' : '#94a3b8',
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="config-modal-footer">
          <button 
            style={{
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              color: '#fca5a5',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => {
              const confirmDel = window.confirm(`Deseja mesmo excluir o componente "${config.label}"?`);
              if (confirmDel) {
                useSimulatorStore.getState().removeNode(node.id);
                selectNode(null);
              }
            }}
          >
            <Trash size={13} /> Excluir Nó
          </button>
          
          <button 
            style={{
              padding: '6px 18px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => selectNode(null)}
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
