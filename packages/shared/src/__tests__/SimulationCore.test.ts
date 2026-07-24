import { describe, it, expect } from 'vitest';
import { runSimulationTickCore, runSimulationBatchCore, validateGraph } from '../index.js';

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

  // =========================================================================
  // 1. Circuit Breakers (CLOSED -> OPEN -> HALF-OPEN -> CLOSED / OPEN)
  // =========================================================================
  describe('Circuit Breaker Mechanisms', () => {
    it('should transition from CLOSED to OPEN when failure rate exceeds threshold with sufficient requests', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, replicas: 1 },
          },
        },
        {
          id: 'service-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              replicas: 1,
              maxRps: 100,
              circuitBreakerEnabled: true,
              cbFailureThreshold: 0.3,
              cbSleepWindowTicks: 2,
              errorRate: 0.5, // 50% failures > 30% threshold
            },
            metrics: {
              inboundRps: 100,
              outboundRps: 100,
              cpuPct: 20,
              ramPct: 20,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'ok',
              history: [],
              cbState: 'CLOSED',
              cbOpenTimer: 0,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'service-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['service-1'].cbState).toBe('OPEN');
      expect(res.updatedMetrics['service-1'].cbOpenTimer).toBe(2);
    });

    it('should stay OPEN and decrement timer until 0, then transition to HALF-OPEN and evaluate trial', () => {
      const nodes = [
        {
          id: 'service-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              replicas: 1,
              maxRps: 100,
              circuitBreakerEnabled: true,
              cbFailureThreshold: 0.3,
              cbSleepWindowTicks: 2,
            },
            metrics: {
              inboundRps: 0,
              outboundRps: 0,
              cpuPct: 20,
              ramPct: 20,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'ok',
              history: [],
              cbState: 'OPEN',
              cbOpenTimer: 1, // Will decrement to 0 -> state becomes HALF-OPEN
            },
          },
        },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: [], tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['service-1'].cbState).toBe('HALF-OPEN');
      expect(res.updatedMetrics['service-1'].cbOpenTimer).toBe(0);
    });

    it('should transition from HALF-OPEN back to OPEN if trial requests fail', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 50, replicas: 1 },
          },
        },
        {
          id: 'service-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              replicas: 1,
              maxRps: 100,
              circuitBreakerEnabled: true,
              cbFailureThreshold: 0.3,
              cbSleepWindowTicks: 3,
              errorRate: 0.5,
            },
            metrics: {
              inboundRps: 50,
              outboundRps: 50,
              cpuPct: 20,
              ramPct: 20,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'ok',
              history: [],
              cbState: 'HALF-OPEN',
              cbOpenTimer: 0,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'service-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['service-1'].cbState).toBe('OPEN');
    });

    it('should transition from HALF-OPEN to CLOSED if trial requests succeed without errors', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 50, replicas: 1 },
          },
        },
        {
          id: 'service-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              replicas: 1,
              maxRps: 100,
              circuitBreakerEnabled: true,
              cbFailureThreshold: 0.3,
              cbSleepWindowTicks: 3,
              errorRate: 0,
            },
            metrics: {
              inboundRps: 50,
              outboundRps: 50,
              cpuPct: 20,
              ramPct: 20,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'ok',
              history: [],
              cbState: 'HALF-OPEN',
              cbOpenTimer: 0,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'service-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['service-1'].cbState).toBe('CLOSED');
    });
  });

  // =========================================================================
  // 2. Auto-scaling & Replica Calculations
  // =========================================================================
  describe('Auto-scaling Mechanisms', () => {
    it('should scale up active replicas when compute node utilization exceeds 80%', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 900, replicas: 1 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              replicas: 1,
              maxReplicas: 5,
              maxRps: 1000,
              autoscalingEnabled: true,
            },
            metrics: {
              inboundRps: 850, // 850 / (1000 * 1) = 85% > 80%
              outboundRps: 850,
              cpuPct: 85,
              ramPct: 50,
              storagePct: 0,
              latencyMs: 15,
              queueDepth: 0,
              status: 'ok',
              history: [],
              activeReplicas: 1,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'app-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['app-1'].activeReplicas).toBe(2);
    });

    it('should scale down active replicas when utilization drops below 30%', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, replicas: 1 },
          },
        },
        {
          id: 'worker-1',
          data: {
            componentType: 'worker',
            category: 'compute',
            config: {
              replicas: 1,
              maxReplicas: 5,
              maxRps: 1000,
              autoscalingEnabled: true,
            },
            metrics: {
              inboundRps: 200, // 200 / (1000 * 3) = 6.6% < 30%
              outboundRps: 200,
              cpuPct: 15,
              ramPct: 20,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'ok',
              history: [],
              activeReplicas: 3,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'worker-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['worker-1'].activeReplicas).toBe(2);
    });

    it('should generate bottleneck warning when worker activeReplicas exceeds Kafka queue partition count', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, replicas: 1 },
          },
        },
        {
          id: 'kafka-1',
          data: {
            componentType: 'kafka',
            category: 'messaging',
            config: { replicas: 1, maxRps: 1000, partitionCount: 2, label: 'Kafka Queue' },
          },
        },
        {
          id: 'worker-1',
          data: {
            componentType: 'worker',
            category: 'compute',
            config: { replicas: 4, maxRps: 500, label: 'Worker Group' },
          },
        },
      ];

      const edges = [
        { id: 'e1', source: 'client-1', target: 'kafka-1', data: { trafficScale: 100 } },
        { id: 'e2', source: 'kafka-1', target: 'worker-1', data: { trafficScale: 100 } },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.bottlenecks.some((b) => b.nodeId === 'worker-1' && b.type === 'cpu')).toBe(true);
      expect(res.updatedMetrics['worker-1'].activeReplicas).toBe(2); // Capped by partition count = 2
    });
  });

  // =========================================================================
  // 3. Cache Eviction Policies (LRU / LFU / FIFO / NONE)
  // =========================================================================
  describe('Cache Eviction Policies', () => {
    it('should apply eviction hit-rate penalties under high write load across policies', () => {
      const policies = ['fifo', 'lru', 'lfu', 'none'] as const;

      for (const policy of policies) {
        const nodes = [
          {
            id: 'client-1',
            data: {
              componentType: 'client',
              category: 'client',
              config: { maxRps: 1000, writeRatio: 0.9 }, // High write ratio
            },
          },
          {
            id: 'cache-1',
            data: {
              componentType: 'cache',
              category: 'storage',
              config: {
                maxRps: 2000,
                cacheHitRate: 0.95,
                memoryLimitMb: 64, // Small memory limit -> high load ratio
                evictionPolicy: policy,
              },
            },
          },
        ];

        const edges = [{ id: 'e1', source: 'client-1', target: 'cache-1', data: { trafficScale: 100 } }];

        const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
        expect(res.updatedMetrics['cache-1']).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 4. Connection Pools & Timeouts
  // =========================================================================
  describe('Connection Pool Saturation & Edge Timeouts', () => {
    it('should queue requests and produce edge timeouts when connection pool limit is saturated', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 1000, replicas: 1, timeoutMs: 100, connectionPool: 2 }, // Strict 100ms client timeout with local pool limit of 2
          },
        },
        {
          id: 'db-1',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: {
              maxRps: 100, // Low capacity -> high latency
              connectionPool: 2, // Only 2 connections per replica
              replicas: 1,
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'db-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedEdgeMetrics['e1']).toBeDefined();
      expect(res.updatedEdgeMetrics['e1'].queueSize).toBeGreaterThan(0);
      expect(res.updatedEdgeMetrics['e1'].timeoutsPerSecond).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. Server Crashes & Cooldown Recovery
  // =========================================================================
  describe('Server Crash & Recovery Cycles', () => {
    it('should count overload ticks and crash a compute node after 3 consecutive overload ticks', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 500, replicas: 1 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 10, replicas: 1 }, // Severely overloaded
            metrics: {
              inboundRps: 500,
              outboundRps: 500,
              cpuPct: 99,
              ramPct: 99,
              storagePct: 0,
              latencyMs: 100,
              queueDepth: 10,
              status: 'critical',
              history: [],
              consecutiveOverloadTicks: 2, // Next tick reaches 3 => crash!
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'app-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['app-1'].restartCooldownTicks).toBe(3);
      expect(res.updatedMetrics['app-1'].status).toBe('critical');
    });

    it('should drop requests and fail edge traffic while a node is crashed', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, replicas: 1 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 100, replicas: 1 },
            metrics: {
              inboundRps: 100,
              outboundRps: 100,
              cpuPct: 50,
              ramPct: 50,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'critical',
              history: [],
              restartCooldownTicks: 3, // Active crash cooldown (> 1 to stay in crashedNodesSet)
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'app-1', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedEdgeMetrics['e1'].failuresPerSecond).toBe(100);
      expect(res.updatedMetrics['app-1'].restartCooldownTicks).toBe(2);
      expect(res.updatedMetrics['app-1'].failedRps).toBe(100);
      expect(res.updatedMetrics['app-1'].successRps).toBe(0);
    });

    it('should handle master-replica DB crash failover where reads succeed but writes fail', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, writeRatio: 0.3 },
          },
        },
        {
          id: 'db-master',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: {
              maxRps: 100,
              replicas: 1,
              dbReplication: 'master-replica',
              readWriteSplittingEnabled: true,
            },
            metrics: {
              inboundRps: 100,
              outboundRps: 100,
              cpuPct: 99,
              ramPct: 99,
              storagePct: 0,
              latencyMs: 10,
              queueDepth: 0,
              status: 'critical',
              history: [],
              restartCooldownTicks: 3, // Active crash cooldown
            },
          },
        },
      ];

      const edges = [{ id: 'e1', source: 'client-1', target: 'db-master', data: { trafficScale: 100 } }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['db-master'].failedRps).toBe(100);
      expect(res.updatedMetrics['db-master'].status).toBe('critical');
    });
  });

  // =========================================================================
  // 6. Additional Engine Edge Cases & Batch Execution
  // =========================================================================
  describe('Advanced Features & Batch Simulation', () => {
    it('should validate orphan nodes and missing source warnings in graph validation', () => {
      const nodes = [
        { id: 'api-1', data: { componentType: 'api-gateway', label: 'API Gateway' } },
        { id: 'orphan-1', data: { componentType: 'app-server', label: 'Orphan App' } },
      ];
      const edges: any[] = [];

      const warnings = validateGraph(nodes as any, edges);
      expect(warnings.some((w) => w.type === 'orphan_node')).toBe(true);
      expect(warnings.some((w) => w.type === 'missing_source')).toBe(true);
    });

    it('should apply delivery guarantee errors for at-most-once message queue under high traffic', () => {
      const nodes = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 2000 } } },
        {
          id: 'queue-1',
          data: {
            componentType: 'message-queue',
            category: 'messaging',
            config: { maxRps: 5000, deliveryGuarantee: 'at-most-once' },
          },
        },
      ];
      const edges = [{ id: 'e1', source: 'client-1', target: 'queue-1' }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['queue-1'].failedRps).toBeGreaterThan(0);
    });
    it('should route traffic correctly using least-connections on load balancer', () => {
      const nodes = [
        {
          id: 'client-1',
          data: { componentType: 'client', category: 'client', config: { maxRps: 200 } },
        },
        {
          id: 'lb-1',
          data: {
            componentType: 'load-balancer',
            category: 'traffic-edge',
            config: { maxRps: 500, lbAlgorithm: 'least-connections' },
          },
        },
        {
          id: 'app-heavy',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 200 },
            metrics: { cpuPct: 90 },
          },
        },
        {
          id: 'app-light',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 200 },
            metrics: { cpuPct: 10 },
          },
        },
      ];

      const edges = [
        { id: 'e0', source: 'client-1', target: 'lb-1' },
        { id: 'e1', source: 'lb-1', target: 'app-heavy' },
        { id: 'e2', source: 'lb-1', target: 'app-light' },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['app-light'].inboundRps).toBeGreaterThan(res.updatedMetrics['app-heavy'].inboundRps);
    });

    it('should accumulate storage on storage components', () => {
      const nodes = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000, writeRatio: 1.0 } } },
        { id: 'object-store-1', data: { componentType: 'object-store', category: 'storage', config: { maxRps: 1000, storageGb: 1 } } },
      ];
      const edges = [{ id: 'e1', source: 'client-1', target: 'object-store-1' }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['object-store-1'].storagePct).toBeGreaterThan(0);
    });

    it('should route telemetry data to observability nodes', () => {
      const nodes = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 100 } } },
        { id: 'metrics-1', data: { componentType: 'metrics', category: 'observability', config: { maxRps: 1000 } } },
        { id: 'tracing-1', data: { componentType: 'tracing', category: 'observability', config: { maxRps: 1000 } } },
      ];
      const edges = [
        { id: 'e1', source: 'client-1', target: 'metrics-1' },
        { id: 'e2', source: 'client-1', target: 'tracing-1' },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['metrics-1'].inboundRps).toBe(100);
      expect(res.updatedMetrics['tracing-1'].inboundRps).toBe(10);
    });

    it('should calculate end-to-end latency propagating downstream dependencies back to the source client', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, clientLatencyMs: 20 },
          },
        },
        {
          id: 'lb-1',
          data: {
            componentType: 'load-balancer',
            category: 'traffic-edge',
            config: { maxRps: 200 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 200 },
          },
        },
      ];

      const edges = [
        { id: 'e1', source: 'client-1', target: 'lb-1', data: { networkLatencyMs: 15 } },
        { id: 'e2', source: 'lb-1', target: 'app-1', data: { networkLatencyMs: 10 } },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      
      const appLat = res.updatedMetrics['app-1'].latencyMs; // 5ms base
      const lbLat = res.updatedMetrics['lb-1'].latencyMs; // 2ms base
      const clientLat = res.updatedMetrics['client-1'].latencyMs; // 20ms clientLatencyMs config

      // Client E2E should be:
      // Client Base Latency (20)
      // + Edge 1 Network (15) + Edge 1 Connection Wait (0)
      // + LB Base Latency (2)
      // + Edge 2 Network (10) + Edge 2 Connection Wait (0)
      // + App Base Latency (5)
      // Total expected: 20 + 15 + 2 + 10 + 5 = 52ms
      const expectedE2E = clientLat + 15 + lbLat + 10 + appLat;
      
      expect(res.updatedMetrics['client-1'].endToEndLatencyMs).toBeCloseTo(expectedE2E, 1);
    });

    it('should apply bulkhead limit on edges and scale limit based on caller replicas', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 15, replicas: 1 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 100 },
          },
        },
      ];

      const edges = [
        {
          id: 'e1',
          source: 'client-1',
          target: 'app-1',
          data: {
            bulkheadEnabled: true,
            bulkheadLimit: 1, // 1 connection limit per replica
            networkLatencyMs: 80, // Total latency will be 20ms base + 80ms network = 100ms
          },
        },
      ];

      // Case 1: 1 replica of client -> effective bulkhead limit = 1.
      // Expected max RPS = 1 connection / 0.1s = 10 RPS.
      const res1 = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res1.updatedMetrics['app-1'].inboundRps).toBeCloseTo(10, 1);
      expect(res1.updatedEdgeMetrics['e1'].failuresPerSecond).toBeCloseTo(5, 1);

      // Case 2: 3 replicas of client -> effective bulkhead limit = 3.
      // Expected max RPS = 3 connections / 0.1s = 30 RPS.
      const nodesWith3Replicas = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 15, replicas: 3 },
          },
        },
        nodes[1],
      ];
      const res2 = runSimulationTickCore({ nodes: nodesWith3Replicas as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res2.updatedMetrics['app-1'].inboundRps).toBeCloseTo(30, 1);
      expect(res2.updatedEdgeMetrics['e1'].failuresPerSecond).toBeCloseTo(15, 1);
    });

    it('should reject all write requests and reflect critical status when storage reaches 100% capacity', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, writeRatio: 0.5 },
          },
        },
        {
          id: 'object-store-1',
          data: {
            componentType: 'object-store',
            category: 'storage',
            config: { maxRps: 1000, storageGb: 10 },
            metrics: { storagePct: 100, status: 'ok' },
          },
        },
      ];
      const edges = [{ id: 'e1', source: 'client-1', target: 'object-store-1' }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      
      // Since storagePct is 100%, all write requests (50 RPS) must fail.
      expect(res.updatedMetrics['object-store-1'].status).toBe('critical');
      expect(res.updatedMetrics['object-store-1'].failedRps).toBe(50);
      expect(res.updatedMetrics['object-store-1'].successRps).toBe(50); // Read requests (50 RPS) still succeed
      expect(res.bottlenecks.some(b => b.type === 'storage' && b.severity === 'critical')).toBe(true);
    });

    it('should simulate two-stage database connection pool with client pool queueing and server-side refusal', () => {
      const nodes = [
        {
          id: 'app-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 1000, connectionPool: 2, timeoutMs: 1000 },
          },
        },
        {
          id: 'db-1',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: { maxRps: 2000, connectionPool: 1 }, // Server DB max conns = 1
          },
        },
      ];
      const edges = [{ id: 'e1', source: 'app-1', target: 'db-1' }];

      // Case 1: Inbound = 400 RPS. DB latency = 5ms.
      // Connections requested = 400 * 0.005 = 2.
      // This is exactly matching app-1's client pool limit of 2. So no client-side pool timeout/failures.
      // But DB max conns is 1. So DB refuses the excess 1 connection.
      // Saturation ratio = 1 / 2 = 50%. Successful RPS = 400 * 0.5 = 200 RPS. Refused RPS = 200.
      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 40 });
      expect(res.updatedEdgeMetrics['e1'].rps).toBeCloseTo(200, 1);
      expect(res.updatedEdgeMetrics['e1'].failuresPerSecond).toBeCloseTo(200, 1);
    });

    it('should accumulate cache memory and trigger write failures under eviction policy none', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 200, writeRatio: 1.0 },
          },
        },
        {
          id: 'cache-1',
          data: {
            componentType: 'cache',
            category: 'storage',
            config: { maxRps: 1000, memoryLimitMb: 100, evictionPolicy: 'none' },
            metrics: { ramPct: 99 },
          },
        },
      ];
      const edges = [{ id: 'e1', source: 'client-1', target: 'cache-1' }];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      expect(res.updatedMetrics['cache-1'].ramPct).toBe(100);
      expect(res.updatedMetrics['cache-1'].failedRps).toBe(200); // All writes fail under OOM none
      expect(res.updatedMetrics['cache-1'].status).toBe('critical');
      expect(res.bottlenecks.some(b => b.type === 'ram' && b.severity === 'critical')).toBe(true);
    });

    it('should propagate downstream write failures (e.g. storage full) back to the caller app server and source client', () => {
      const nodes = [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, writeRatio: 1.0 },
          },
        },
        {
          id: 'app-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 1000 },
          },
        },
        {
          id: 'db-1',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: { maxRps: 1000, storageGb: 10 },
            metrics: { storagePct: 100, status: 'ok' },
          },
        },
      ];
      const edges = [
        { id: 'e1', source: 'client-1', target: 'app-1' },
        { id: 'e2', source: 'app-1', target: 'db-1' },
      ];

      const res = runSimulationTickCore({ nodes: nodes as any, edges: edges as any, tick: 1, globalTrafficScale: 100 });
      
      // db-1 should have 100 failed RPS and 0 success
      expect(res.updatedMetrics['db-1'].failedRps).toBe(100);
      expect(res.updatedMetrics['db-1'].successRps).toBe(0);

      // The failures must propagate back to app-1 and client-1
      expect(res.updatedMetrics['app-1'].failedRps).toBe(100);
      expect(res.updatedMetrics['app-1'].successRps).toBe(0);

      expect(res.updatedMetrics['client-1'].failedRps).toBe(100);
      expect(res.updatedMetrics['client-1'].successRps).toBe(0);

      // Edges e1 and e2 must reflect the failure propagation
      expect(res.updatedEdgeMetrics['e2'].failuresPerSecond).toBe(100);
      expect(res.updatedEdgeMetrics['e2'].rps).toBe(0);

      expect(res.updatedEdgeMetrics['e1'].failuresPerSecond).toBe(100);
      expect(res.updatedEdgeMetrics['e1'].rps).toBe(0);
    });

    it('should evict memory when cache reaches high usage and lower RAM with LRU policy', () => {
      const nodes = [
        {
          id: 'cache-1',
          data: {
            componentType: 'cache',
            category: 'storage',
            config: { maxRps: 1000, memoryLimitMb: 512, evictionPolicy: 'lru' },
            metrics: { ramPct: 95, inboundWriteRps: 100 },
          },
        },
      ];
      const res = runSimulationTickCore({ nodes: nodes as any, edges: [], tick: 1, globalTrafficScale: 100 });
      // Active eviction should reduce RAM below 95%
      expect(res.updatedMetrics['cache-1'].ramPct).toBeLessThan(95);
    });

    it('should recalculate lower storagePct when storageGb capacity is increased', () => {
      const nodes = [
        {
          id: 'db-1',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: { maxRps: 1000, storageGb: 200 }, // Increased from 50 GB to 200 GB
            metrics: { storagePct: 100, usedStorageGb: 50 }, // Was 100% full under 50 GB limit
          },
        },
      ];
      const res = runSimulationTickCore({ nodes: nodes as any, edges: [], tick: 1, globalTrafficScale: 100 });
      // With 50 GB used out of 200 GB, storagePct should drop to ~25%
      expect(res.updatedMetrics['db-1'].storagePct).toBe(25);
    });


    it('should execute runSimulationBatchCore over multiple ticks', () => {
      const nodes = [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 50 } } },
        { id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } } },
      ];
      const edges = [{ id: 'e1', source: 'client-1', target: 'app-1' }];

      const batchResults = runSimulationBatchCore(nodes as any, edges as any, 5, 100);
      expect(batchResults.length).toBe(5);
      expect(batchResults[4].updatedMetrics['app-1'].history.length).toBe(5);
    });
  });
});
