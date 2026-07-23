import { describe, it, expect } from 'vitest';
import { runSimulationTickCore, runSimulationBatchCore, type GraphNodeInput, type GraphEdgeInput } from '../engine/SimulationCore.js';

function verifyNoNaNOrInfinity(obj: any, path: string = ''): { invalidKeys: string[] } {
  const invalidKeys: string[] = [];

  function check(val: any, currentPath: string) {
    if (val === null || val === undefined) return;
    if (typeof val === 'number') {
      if (Number.isNaN(val) || !Number.isFinite(val)) {
        invalidKeys.push(`${currentPath}: ${val}`);
      }
    } else if (typeof val === 'object') {
      for (const key of Object.keys(val)) {
        check(val[key], `${currentPath}.${key}`);
      }
    }
  }

  check(obj, path);
  return { invalidKeys };
}

describe('SimulationCore Empirical Stress Tests', () => {
  // =========================================================================
  // 1. Large Topologies (100+ to 1000+ Nodes)
  // =========================================================================
  describe('Large Topologies (100+ to 1000 Nodes)', () => {
    it('executes simulation tick on 100-node complex graph', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000, replicas: 1, writeRatio: 0.2 } } },
        { id: 'gw-1', data: { componentType: 'api-gateway', category: 'traffic-edge', config: { maxRps: 2000, replicas: 2 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
      ];

      // Add 98 app servers and databases
      for (let i = 1; i <= 49; i++) {
        const appNodeId = `app-${i}`;
        const dbNodeId = `db-${i}`;
        nodes.push({
          id: appNodeId,
          data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100, replicas: 1 } },
        });
        nodes.push({
          id: dbNodeId,
          data: { componentType: 'sql-database', category: 'storage', config: { maxRps: 50, storageGb: 100 } },
        });

        edges.push({ id: `e-gw-app-${i}`, source: 'gw-1', target: appNodeId });
        edges.push({ id: `e-app-db-${i}`, source: appNodeId, target: dbNodeId });
      }

      expect(nodes.length).toBe(100);

      const start = performance.now();
      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const durationMs = performance.now() - start;

      console.log(`[Perf] 100-node tick took ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(1000);

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
      expect(res.totalRps).toBe(1000);
      expect(Object.keys(res.updatedMetrics).length).toBe(100);
    });

    it('executes simulation tick on 500-node graph', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 5000, replicas: 1 } } },
      ];
      const edges: GraphEdgeInput[] = [];

      for (let i = 1; i < 500; i++) {
        const prevId = i === 1 ? 'client-1' : `node-${i - 1}`;
        const currId = `node-${i}`;
        const compType = i % 2 === 0 ? 'app-server' : 'cache';
        nodes.push({
          id: currId,
          data: { componentType: compType, category: i % 2 === 0 ? 'compute' : 'storage', config: { maxRps: 1000 } },
        });
        edges.push({ id: `e-${i}`, source: prevId, target: currId });
      }

      expect(nodes.length).toBe(500);

      const start = performance.now();
      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const durationMs = performance.now() - start;

      console.log(`[Perf] 500-node tick took ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(2000);

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('executes simulation tick on 1000-node graph', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 10000, replicas: 1 } } },
      ];
      const edges: GraphEdgeInput[] = [];

      for (let i = 1; i < 1000; i++) {
        const currId = `node-${i}`;
        nodes.push({
          id: currId,
          data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } },
        });
        edges.push({ id: `e-${i}`, source: 'client-1', target: currId });
      }

      expect(nodes.length).toBe(1000);

      const start = performance.now();
      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const durationMs = performance.now() - start;

      console.log(`[Perf] 1000-node tick took ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(3000);

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Deep Pipelines (50 to 100 Nodes in Series)
  // =========================================================================
  describe('Deep Pipelines (50 to 100 nodes chain)', () => {
    it('propagates traffic along a 100-node linear chain without overflow or breakdown', () => {
      const depth = 100;
      const nodes: GraphNodeInput[] = [
        { id: 'node-0', data: { componentType: 'client', category: 'client', config: { maxRps: 500, writeRatio: 0.1 } } },
      ];
      const edges: GraphEdgeInput[] = [];

      for (let i = 1; i <= depth; i++) {
        nodes.push({
          id: `node-${i}`,
          data: { componentType: 'app-server', category: 'compute', config: { maxRps: 1000, replicas: 1 } },
        });
        edges.push({ id: `e-${i}`, source: `node-${i - 1}`, target: `node-${i}` });
      }

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);

      // Node at depth 100 should receive full 500 RPS
      expect(res.updatedMetrics[`node-${depth}`]).toBeDefined();
      expect(res.updatedMetrics[`node-${depth}`].inboundRps).toBe(500);
    });
  });

  // =========================================================================
  // 3. Multiple Consumers / Fan-out & Fan-in
  // =========================================================================
  describe('Fan-out & Fan-in Topologies', () => {
    it('handles 1 source fanning out to 100 workers and fanning in to 1 database', () => {
      const fanOutCount = 100;
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 10000 } } },
        { id: 'queue-1', data: { componentType: 'message-queue', category: 'messaging', config: { maxRps: 20000, partitionCount: 16 } } },
        { id: 'db-1', data: { componentType: 'sql-database', category: 'storage', config: { maxRps: 5000, connectionPool: 100 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e-cq', source: 'client-1', target: 'queue-1' },
      ];

      for (let i = 1; i <= fanOutCount; i++) {
        const workerId = `worker-${i}`;
        nodes.push({
          id: workerId,
          data: { componentType: 'worker', category: 'compute', config: { maxRps: 200, replicas: 1 } },
        });
        edges.push({ id: `e-qw-${i}`, source: 'queue-1', target: workerId });
        edges.push({ id: `e-wd-${i}`, source: workerId, target: 'db-1' });
      }

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);

      // DB should aggregate traffic from all 100 workers
      expect(res.updatedMetrics['db-1']).toBeDefined();
      expect(res.updatedMetrics['db-1'].inboundRps).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Cyclical Graphs (Cycles & Feedback Loops)
  // =========================================================================
  describe('Cyclical Graphs & Feedback Loops', () => {
    it('handles simple 3-node cycle (A -> B -> C -> A) without infinite loop or crash', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'node-A', data: { componentType: 'client', category: 'client', config: { maxRps: 100 } } },
        { id: 'node-B', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 200 } } },
        { id: 'node-C', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 200 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e1', source: 'node-A', target: 'node-B' },
        { id: 'e2', source: 'node-B', target: 'node-C' },
        { id: 'e3', source: 'node-C', target: 'node-A' },
      ];

      const start = performance.now();
      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const durationMs = performance.now() - start;

      console.log(`[Cycle Test] 3-node cycle completed in ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(100);

      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('handles self-loop (A -> A) without infinite recursion', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'node-A', data: { componentType: 'client', category: 'client', config: { maxRps: 100 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e1', source: 'node-A', target: 'node-A' },
      ];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('handles microservice retry feedback loop (Gateway -> SvcA -> SvcB -> SvcA)', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client', data: { componentType: 'client', category: 'client', config: { maxRps: 500 } } },
        { id: 'svcA', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 1000 } } },
        { id: 'svcB', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 1000 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e1', source: 'client', target: 'svcA' },
        { id: 'e2', source: 'svcA', target: 'svcB' },
        { id: 'e3', source: 'svcB', target: 'svcA' },
      ];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('handles isolated disconnected cycle without source (X -> Y -> X)', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'node-X', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } } },
        { id: 'node-Y', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e1', source: 'node-X', target: 'node-Y' },
        { id: 'e2', source: 'node-Y', target: 'node-X' },
      ];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      expect(res.totalRps).toBe(0);
      expect(res.updatedMetrics['node-X'].inboundRps).toBe(0);
      expect(res.updatedMetrics['node-Y'].inboundRps).toBe(0);
    });
  });

  // =========================================================================
  // 5. Zero RPS & Boundary Edge Cases
  // =========================================================================
  describe('Zero RPS & Boundary Edge Cases', () => {
    it('handles zero traffic scale (globalTrafficScale = 0)', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000 } } },
        { id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 500 } } },
      ];
      const edges: GraphEdgeInput[] = [{ id: 'e1', source: 'client-1', target: 'app-1' }];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 0 });
      expect(res.totalRps).toBe(0);
      expect(res.updatedMetrics['app-1'].inboundRps).toBe(0);
      // Status is 'ok' due to baseRamPct = 50% in COMPONENT_DEFINITIONS
      expect(res.updatedMetrics['app-1'].status).toBe('ok');
    });

    it('handles zero maxRps or zero replicas on source and compute nodes', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 0, replicas: 0 } } },
        { id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 0, replicas: 0 } } },
      ];
      const edges: GraphEdgeInput[] = [{ id: 'e1', source: 'client-1', target: 'app-1' }];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      expect(res.totalRps).toBe(0);
      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('handles edge referencing non-existent nodes', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 100 } } },
      ];
      const edges: GraphEdgeInput[] = [
        { id: 'e1', source: 'client-1', target: 'ghost-target' },
        { id: 'e2', source: 'ghost-source', target: 'client-1' },
      ];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
    });

    it('reveals flaw when node has zero connection pool limit (connectionPool: 0)', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000 } } },
        { id: 'db-1', data: { componentType: 'sql-database', category: 'storage', config: { maxRps: 500, connectionPool: 0 } } },
      ];
      const edges: GraphEdgeInput[] = [{ id: 'e1', source: 'client-1', target: 'db-1' }];

      const res = runSimulationTickCore({ nodes, edges, tick: 1, globalTrafficScale: 100 });
      console.log('connectionPool=0 edge metrics:', res.updatedEdgeMetrics['e1']);
      const { invalidKeys } = verifyNoNaNOrInfinity(res);
      expect(invalidKeys).toEqual([]);
      // EMPIRICAL BUG OBSERVED: when connectionPool is 0, allocated is 0, so waitSec defaults to 0 and 0 timeouts occur!
      expect(res.updatedEdgeMetrics['e1'].timeoutsPerSecond).toBe(0);
    });
  });

  // =========================================================================
  // 6. Memory & Multi-Tick Batch Performance Test
  // =========================================================================
  describe('Memory & Multi-Tick Batch Stress Test', () => {
    it('executes 1,200 total ticks (20 batches of 60 ticks) on a 100-node graph', () => {
      const nodes: GraphNodeInput[] = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000 } } },
      ];
      const edges: GraphEdgeInput[] = [];

      for (let i = 1; i < 100; i++) {
        const currId = `node-${i}`;
        nodes.push({ id: currId, data: { componentType: 'app-server', category: 'compute', config: { maxRps: 200 } } });
        edges.push({ id: `e-${i}`, source: i === 1 ? 'client-1' : `node-${i - 1}`, target: currId });
      }

      const initialMemory = process.memoryUsage().heapUsed;
      const start = performance.now();

      const batchCount = 20; // 20 batches of 60 ticks = 1,200 ticks
      for (let b = 0; b < batchCount; b++) {
        runSimulationBatchCore(nodes, edges, 60, 100);
      }

      const durationMs = performance.now() - start;
      const finalMemory = process.memoryUsage().heapUsed;

      const memDiffMb = (finalMemory - initialMemory) / (1024 * 1024);
      console.log(`[Memory & Batch Test] ${batchCount * 60} ticks (20 batches) in ${durationMs.toFixed(2)}ms. Heap diff: ${memDiffMb.toFixed(2)} MB`);

      expect(durationMs).toBeLessThan(10000); // 1,200 ticks of 100 nodes in under 10 seconds
      expect(memDiffMb).toBeLessThan(200); // Heap growth under 200MB without GC
    });
  });
});
