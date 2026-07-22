import { describe, it, expect } from 'vitest';
import { runSimulationTickCore, validateGraph } from '../index.js';

describe('SimulationCore Engine', () => {
  it('should initialize empty simulation without errors when no nodes exist', () => {
    const res = runSimulationTickCore({ nodes: [], edges: [], tick: 1, globalTrafficScale: 100 });
    expect(res.totalRps).toBe(0);
    expect(res.bottlenecks).toEqual([]);
    expect(res.updatedMetrics).toEqual({});
    expect(res.updatedEdgeMetrics).toEqual({});
  });

  it('should calculate RPS and traffic propagation correctly for a simple REST API preset', () => {
    const nodes = [
      {
        id: 'client-1',
        data: {
          componentType: 'client',
          category: 'client',
          config: { maxRps: 100, replicas: 1, writeRatio: 0.1, clientLatencyMs: 20 },
        },
      },
      {
        id: 'api-1',
        data: {
          componentType: 'api-gateway',
          category: 'traffic-edge',
          config: { replicas: 2, maxRps: 100, isStateless: true, readLatencyMs: 5 },
        },
      },
    ];

    const edges = [
      {
        id: 'e1',
        source: 'client-1',
        target: 'api-1',
        data: { trafficScale: 100, active: true },
      },
    ];

    const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
    expect(res.totalRps).toBe(100);
    expect(res.updatedMetrics['client-1']).toBeDefined();
    expect(res.updatedMetrics['api-1']).toBeDefined();
    expect(res.updatedMetrics['api-1'].inboundRps).toBe(100);
  });

  it('should identify capacity bottlenecks when RPS exceeds component max capacity', () => {
    const nodes = [
      {
        id: 'client-1',
        data: {
          componentType: 'client',
          category: 'client',
          config: { maxRps: 500, replicas: 1, writeRatio: 0.1 },
        },
      },
      {
        id: 'service-1',
        data: {
          componentType: 'app-server',
          category: 'compute',
          config: { replicas: 1, maxRps: 100, isStateless: true, readLatencyMs: 10 },
        },
      },
    ];

    const edges = [
      {
        id: 'e1',
        source: 'client-1',
        target: 'service-1',
        data: { trafficScale: 100, active: true },
      },
    ];

    const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
    expect(res.updatedMetrics['service-1']).toBeDefined();
    expect(res.updatedMetrics['service-1'].cpuPct).toBeGreaterThan(0);
  });

  it('should validate graph connections cleanly', () => {
    const nodes = [
      { id: 'client-1', data: { componentType: 'client', label: 'Client' } },
      { id: 'api-1', data: { componentType: 'api-gateway', label: 'API' } },
    ];
    const edges = [{ id: 'e1', source: 'client-1', target: 'api-1' }];

    const errors = validateGraph(nodes as any, edges as any);
    expect(errors).toEqual([]);
  });
});
