import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ComponentConfigSchema,
  ComponentCategorySchema,
  ComponentTypeSchema,
  SimulatorNodeDataSchema,
  SimulatorEdgeDataSchema,
  NodeMetricsSchema,
  MetricSnapshotSchema,
  EdgeMetricsSchema,
  NodeStatusSchema,
  SimulationStateSchema,
  BottleneckSchema,
  SimulationSpeedSchema,
  SavedScenarioSchema,
  ApiProjectSchema,
  CanvasDataSchema,
  ApiUserSchema,
  AuthResponseSchema,
  ApiErrorSchema,
  CapacityInputSchema,
  CapacityResultSchema,
} from '../schemas/index.js';

// Helper generators for valid sample payloads
function createValidComponentConfig() {
  return {
    label: 'App Server Node',
    notes: 'Primary web worker',
    replicas: 3,
    maxRps: 5000,
    cpuCores: 8,
    ramGb: 16,
    storageGb: 500,
    cacheHitRate: 0.85,
    connectionPool: 100,
    timeoutMs: 3000,
    rateLimiterEnabled: true,
    writeRatio: 0.2,
    errorRate: 0.01,
    circuitBreakerEnabled: true,
    cbFailureThreshold: 5,
    cbSleepWindowTicks: 10,
    clientLatencyMs: 50,
    lbAlgorithm: 'round-robin' as const,
    autoscalingEnabled: true,
    maxReplicas: 10,
    dbReplication: 'master-replica' as const,
    readWriteSplittingEnabled: true,
    evictionPolicy: 'lru' as const,
    memoryLimitMb: 4096,
    deliveryGuarantee: 'at-least-once' as const,
    partitionCount: 16,
  };
}

function createValidMetricSnapshot() {
  return {
    tick: 10,
    cpuPct: 45.5,
    ramPct: 60.2,
    latencyMs: 120,
    p50: 80,
    p95: 150,
    p99: 250,
    rps: 1200,
    successRps: 1190,
    failedRps: 10,
  };
}

function createValidNodeMetrics() {
  return {
    inboundRps: 1000,
    inboundReadRps: 800,
    inboundWriteRps: 200,
    outboundRps: 950,
    cpuPct: 55.0,
    ramPct: 40.0,
    storagePct: 30.0,
    latencyMs: 45.0,
    queueDepth: 5,
    status: 'ok' as const,
    history: [createValidMetricSnapshot()],
    endToEndLatencyMs: 95.0,
    consecutiveOverloadTicks: 0,
    restartCooldownTicks: 0,
    successRps: 990,
    failedRps: 10,
    cbState: 'CLOSED' as const,
    cbOpenTimer: 0,
    p50: 30,
    p95: 80,
    p99: 140,
    logs: ['Node initialized', 'Health check OK'],
    activeReplicas: 3,
    consumerLag: 0,
  };
}

function createValidSimulatorNodeData() {
  return {
    componentType: 'app-server' as const,
    category: 'compute' as const,
    config: createValidComponentConfig(),
    metrics: createValidNodeMetrics(),
    isSelected: false,
  };
}

function createValidSimulationState() {
  return {
    running: true,
    tick: 42,
    speed: 'normal' as const,
    totalRps: 1500,
    bottlenecks: [
      {
        nodeId: 'node-1',
        nodeLabel: 'Database DB-1',
        type: 'cpu' as const,
        severity: 'warning' as const,
        value: 88.5,
        limit: 80.0,
        message: 'CPU usage exceeded 80% threshold',
      },
    ],
    globalTrafficScale: 1.0,
  };
}

function createValidApiProject() {
  return {
    id: 'proj_12345',
    userId: 'usr_67890',
    name: 'E-Commerce Microservices Architecture',
    description: 'High throughput shopping cart system',
    canvas: {
      nodes: [{ id: '1', type: 'custom', data: createValidSimulatorNodeData() }],
      edges: [{ id: 'e1-2', source: '1', target: '2' }],
      viewport: { x: 100, y: 200, zoom: 1.5 },
    },
    thumbnail: 'https://example.com/thumb.png',
    isPublic: true,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

function createValidCapacityInput() {
  return {
    dau: 1_000_000,
    readRatio: 0.8,
    writeRatio: 0.2,
    avgReadPayloadKb: 10,
    avgWritePayloadKb: 50,
    retentionDays: 90,
    targetLatencyMs: 200,
  };
}

describe('Zod Schema Verification & Fuzzing Suite', () => {
  describe('1. ComponentConfigSchema Valid & Invalid Testing', () => {
    it('accepts fully populated valid ComponentConfig payload', () => {
      const valid = createValidComponentConfig();
      const result = ComponentConfigSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe('App Server Node');
        expect(result.data.replicas).toBe(3);
      }
    });

    it('accepts minimal valid ComponentConfig (only label)', () => {
      const minimal = { label: 'Minimal Component' };
      const result = ComponentConfigSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('rejects payload missing required string field label', () => {
      const invalid = { notes: 'No label provided', replicas: 2 };
      const result = ComponentConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('label');
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });

    it('rejects invalid enum values for lbAlgorithm, dbReplication, evictionPolicy, deliveryGuarantee', () => {
      const badEnums = [
        { label: 'test', lbAlgorithm: 'random-pick' },
        { label: 'test', dbReplication: 'master-slave' },
        { label: 'test', evictionPolicy: 'random-evict' },
        { label: 'test', deliveryGuarantee: 'at_most_once' },
      ];

      for (const payload of badEnums) {
        const result = ComponentConfigSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('rejects non-numeric values for numeric configuration fields', () => {
      const badTypes = {
        label: 'App',
        replicas: 'three', // string instead of number
        maxRps: true,
        cpuCores: null,
      };
      const result = ComponentConfigSchema.safeParse(badTypes);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('2. SimulatorNodeDataSchema Valid & Invalid Testing', () => {
    it('accepts fully valid SimulatorNodeData', () => {
      const valid = createValidSimulatorNodeData();
      const result = SimulatorNodeDataSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid componentType or category enum values', () => {
      const badCategory = {
        ...createValidSimulatorNodeData(),
        category: 'database-storage' as any, // invalid
      };
      expect(SimulatorNodeDataSchema.safeParse(badCategory).success).toBe(false);

      const badType = {
        ...createValidSimulatorNodeData(),
        componentType: 'super-computer' as any, // invalid
      };
      expect(SimulatorNodeDataSchema.safeParse(badType).success).toBe(false);
    });

    it('rejects missing required metrics or config', () => {
      const noMetrics = {
        componentType: 'app-server',
        category: 'compute',
        config: createValidComponentConfig(),
      };
      expect(SimulatorNodeDataSchema.safeParse(noMetrics).success).toBe(false);
    });

    it('allows unknown extra fields due to passthrough()', () => {
      const validWithExtra = {
        ...createValidSimulatorNodeData(),
        customAttribute: 'extra_val',
        uiPosition: { x: 50, y: 100 },
      };
      const result = SimulatorNodeDataSchema.safeParse(validWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).customAttribute).toBe('extra_val');
      }
    });
  });

  describe('3. SimulationStateSchema Valid & Invalid Testing', () => {
    it('accepts valid SimulationState payload', () => {
      const valid = createValidSimulationState();
      const result = SimulationStateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields (running, tick, speed, totalRps, etc)', () => {
      const missingFields = { running: true, tick: 5 };
      const result = SimulationStateSchema.safeParse(missingFields);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
      }
    });

    it('rejects invalid speed enum', () => {
      const badSpeed = { ...createValidSimulationState(), speed: 'ultra-fast' as any };
      const result = SimulationStateSchema.safeParse(badSpeed);
      expect(result.success).toBe(false);
    });

    it('rejects invalid Bottleneck structure in bottlenecks array', () => {
      const badBottleneck = {
        ...createValidSimulationState(),
        bottlenecks: [
          {
            nodeId: 'n1',
            nodeLabel: 'Label',
            type: 'gpu' as any, // invalid bottleneck type
            severity: 'critical',
            value: 90,
            limit: 80,
            message: 'GPU overload',
          },
        ],
      };
      const result = SimulationStateSchema.safeParse(badBottleneck);
      expect(result.success).toBe(false);
    });
  });

  describe('4. ApiProjectSchema Valid & Invalid Testing', () => {
    it('accepts valid ApiProject payload', () => {
      const valid = createValidApiProject();
      const result = ApiProjectSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts null for nullable fields (description, thumbnail)', () => {
      const validWithNulls = {
        ...createValidApiProject(),
        description: null,
        thumbnail: null,
      };
      const result = ApiProjectSchema.safeParse(validWithNulls);
      expect(result.success).toBe(true);
    });

    it('rejects null for non-nullable required fields (id, userId, name, isPublic)', () => {
      const nullId = { ...createValidApiProject(), id: null as any };
      expect(ApiProjectSchema.safeParse(nullId).success).toBe(false);

      const nullIsPublic = { ...createValidApiProject(), isPublic: null as any };
      expect(ApiProjectSchema.safeParse(nullIsPublic).success).toBe(false);
    });

    it('rejects invalid canvas structure', () => {
      const badCanvas = { ...createValidApiProject(), canvas: 'not an object' as any };
      expect(ApiProjectSchema.safeParse(badCanvas).success).toBe(false);
    });
  });

  describe('5. CapacityInputSchema Valid & Invalid Testing', () => {
    it('accepts valid CapacityInput with all parameters', () => {
      const valid = createValidCapacityInput();
      const result = CapacityInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts empty object because all fields are optional', () => {
      const empty = {};
      const result = CapacityInputSchema.safeParse(empty);
      expect(result.success).toBe(true);
    });

    it('rejects non-numeric values for dau, readRatio, etc.', () => {
      const invalidTypes = { dau: 'one million', readRatio: '80%' };
      const result = CapacityInputSchema.safeParse(invalidTypes);
      expect(result.success).toBe(false);
    });
  });

  describe('6. Semantic & Boundary Vulnerability Analysis (Defensive Edge Cases)', () => {
    it('audits missing numeric domain constraints (negative numbers & Infinity acceptance vs built-in NaN rejection)', () => {
      // Test if CapacityInputSchema accepts negative DAU
      const negativeCapacity = { dau: -500000, readRatio: -0.5, retentionDays: -10 };
      const resCap = CapacityInputSchema.safeParse(negativeCapacity);
      // Zod accepts negative numbers because .min(0) / .nonnegative() is omitted in schema definition
      expect(resCap.success).toBe(true);

      // Zod z.number() rejects NaN by default
      const nanCapacity = { dau: NaN };
      const resNaN = CapacityInputSchema.safeParse(nanCapacity);
      expect(resNaN.success).toBe(false);

      // Zod z.number() accepts Infinity unless .finite() is specified
      const infCapacity = { retentionDays: Infinity };
      const resInf = CapacityInputSchema.safeParse(infCapacity);
      expect(resInf.success).toBe(true);

      // Test if ComponentConfigSchema accepts negative replicas, negative CPU, negative RAM
      const negativeConfig = { label: 'Bad Config', replicas: -10, cpuCores: -4, ramGb: -32 };
      const resConfig = ComponentConfigSchema.safeParse(negativeConfig);
      expect(resConfig.success).toBe(true); // Zod accepts negative counts because no .min(0)
    });

    it('audits prototype pollution payloads', () => {
      const polluted = JSON.parse('{"label": "Test", "__proto__": {"polluted": true}}');
      const result = ComponentConfigSchema.safeParse(polluted);
      expect(result.success).toBe(true);
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });

  describe('7. High-Volume Random Adversarial Fuzzing Engine (10,000 Iterations)', () => {
    const MUTATION_TYPES = [
      'DELETE_FIELD',
      'CORRUPT_TYPE_STRING',
      'CORRUPT_TYPE_NUMBER',
      'CORRUPT_TYPE_BOOL',
      'CORRUPT_TYPE_ARRAY',
      'CORRUPT_TYPE_OBJECT',
      'INJECT_NULL',
      'INJECT_UNDEFINED',
      'INJECT_NAN',
      'INJECT_INFINITY',
      'INVALID_ENUM_STRING',
      'NEGATIVE_NUMBER',
      'HUGE_NUMBER',
      'EXTRA_KEYS',
    ];

    function getRandomMutation() {
      return MUTATION_TYPES[Math.floor(Math.random() * MUTATION_TYPES.length)];
    }

    function corruptValue(val: any, mutation: string) {
      switch (mutation) {
        case 'CORRUPT_TYPE_STRING':
          return 'INVALID_STRING_PAYLOAD';
        case 'CORRUPT_TYPE_NUMBER':
          return 999999;
        case 'CORRUPT_TYPE_BOOL':
          return true;
        case 'CORRUPT_TYPE_ARRAY':
          return [1, 2, 3];
        case 'CORRUPT_TYPE_OBJECT':
          return { unexpected: 'nested' };
        case 'INJECT_NULL':
          return null;
        case 'INJECT_UNDEFINED':
          return undefined;
        case 'INJECT_NAN':
          return NaN;
        case 'INJECT_INFINITY':
          return Infinity;
        case 'INVALID_ENUM_STRING':
          return 'UNSUPPORTED_ENUM_VARIANT_XYZ';
        case 'NEGATIVE_NUMBER':
          return -9999;
        case 'HUGE_NUMBER':
          return 1e308;
        default:
          return 'MUTATED_VAL';
      }
    }

    function mutateObject(obj: any): { mutated: any; isIntentionallyInvalid: boolean } {
      const copy = JSON.parse(JSON.stringify(obj));
      const keys = Object.keys(copy);
      if (keys.length === 0) return { mutated: copy, isIntentionallyInvalid: false };

      const targetKey = keys[Math.floor(Math.random() * keys.length)];
      const mutation = getRandomMutation();

      let isIntentionallyInvalid = true;

      if (mutation === 'DELETE_FIELD') {
        delete copy[targetKey];
      } else if (mutation === 'EXTRA_KEYS') {
        copy[`extra_fuzz_key_${Math.random()}`] = 'fuzz_data';
        isIntentionallyInvalid = false; // extra keys usually stripped or passed through
      } else {
        copy[targetKey] = corruptValue(copy[targetKey], mutation);
      }

      return { mutated: copy, isIntentionallyInvalid };
    }

    it('runs 10,000 randomized fuzzing iterations across all 5 key Zod schemas', () => {
      const schemasToFuzz = [
        { name: 'ComponentConfigSchema', schema: ComponentConfigSchema, generator: createValidComponentConfig },
        { name: 'SimulatorNodeDataSchema', schema: SimulatorNodeDataSchema, generator: createValidSimulatorNodeData },
        { name: 'SimulationStateSchema', schema: SimulationStateSchema, generator: createValidSimulationState },
        { name: 'ApiProjectSchema', schema: ApiProjectSchema, generator: createValidApiProject },
        { name: 'CapacityInputSchema', schema: CapacityInputSchema, generator: createValidCapacityInput },
      ];

      const TOTAL_ITERATIONS = 10000;
      let totalParsed = 0;
      let acceptedCount = 0;
      let rejectedCount = 0;
      let unexpectedCrashCount = 0;

      const statsPerSchema: Record<string, { total: number; accepted: number; rejected: number }> = {};

      for (const s of schemasToFuzz) {
        statsPerSchema[s.name] = { total: 0, accepted: 0, rejected: 0 };
      }

      for (let i = 0; i < TOTAL_ITERATIONS; i++) {
        const target = schemasToFuzz[i % schemasToFuzz.length];
        const baseValid = target.generator();

        // 20% clean valid, 80% mutated adversarial payloads
        let payload: any;
        if (Math.random() < 0.2) {
          payload = baseValid;
        } else {
          const { mutated } = mutateObject(baseValid);
          payload = mutated;
        }

        totalParsed++;
        statsPerSchema[target.name].total++;

        try {
          const res = target.schema.safeParse(payload);
          if (res.success) {
            acceptedCount++;
            statsPerSchema[target.name].accepted++;
          } else {
            rejectedCount++;
            statsPerSchema[target.name].rejected++;

            // Confirm error has valid issue formatting and clear error details
            expect(res.error.issues).toBeDefined();
            expect(res.error.issues.length).toBeGreaterThan(0);
            expect(typeof res.error.issues[0].message).toBe('string');
          }
        } catch (err) {
          unexpectedCrashCount++;
        }
      }

      console.log(`[Fuzzing Results] Total Iterations: ${totalParsed}`);
      console.log(`[Fuzzing Results] Accepted: ${acceptedCount}, Rejected: ${rejectedCount}, Crashes: ${unexpectedCrashCount}`);
      for (const [name, stats] of Object.entries(statsPerSchema)) {
        console.log(`  - ${name}: Total ${stats.total} (Accepted ${stats.accepted}, Rejected ${stats.rejected})`);
      }

      expect(unexpectedCrashCount).toBe(0); // Zod must never crash/throw unhandled exceptions on invalid JSON payloads
      expect(totalParsed).toBe(TOTAL_ITERATIONS);
      expect(rejectedCount).toBeGreaterThan(0);
      expect(acceptedCount).toBeGreaterThan(0);
    });
  });
});
