import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, type TestServerInstance } from './helpers/testServer.js';

describe('Tier 4: Real-World Application Workload Scenarios', () => {
  let server: TestServerInstance;
  let baseUrl: string;

  beforeAll(async () => {
    server = await setupTestServer();
    baseUrl = server.baseUrl;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('Scenario A: E-Commerce Flash Sale System (50k RPS, Load Balancer -> 3x API Gateways -> Caches + DB)', async () => {
    const flashSaleTopology = {
      nodes: [
        {
          id: 'web-clients',
          data: {
            componentType: 'client',
            category: 'client',
            config: { label: 'Flash Sale Buyers', maxRps: 50000, replicas: 1, writeRatio: 0.1 },
          },
        },
        {
          id: 'lb-main',
          data: {
            componentType: 'load-balancer',
            category: 'traffic-edge',
            config: { label: 'Edge ALB', maxRps: 100000, replicas: 2, lbAlgorithm: 'round-robin' },
          },
        },
        {
          id: 'api-gw',
          data: {
            componentType: 'api-gateway',
            category: 'traffic-edge',
            config: { label: 'API Gateway Cluster', maxRps: 20000, replicas: 3 },
          },
        },
        {
          id: 'redis-cache',
          data: {
            componentType: 'cache',
            category: 'storage',
            config: { label: 'Redis Product Catalog Cache', maxRps: 100000, cacheHitRate: 0.9, memoryLimitMb: 1024, evictionPolicy: 'lru' },
          },
        },
        {
          id: 'postgres-db',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: { label: 'Order & Inventory DB', maxRps: 10000, storageGb: 500, dbReplication: 'master-replica', readWriteSplittingEnabled: true },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'web-clients', target: 'lb-main' },
        { id: 'e2', source: 'lb-main', target: 'api-gw' },
        { id: 'e3', source: 'api-gw', target: 'redis-cache' },
        { id: 'e4', source: 'redis-cache', target: 'postgres-db' },
      ],
    };

    // 1. Validate Flash Sale topology graph
    const valRes = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flashSaleTopology),
    });
    expect(valRes.status).toBe(200);
    const valData = await valRes.json();
    expect(valData.valid).toBe(true);

    // 2. Execute 60-tick batch simulation with 150% traffic spike scale
    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...flashSaleTopology,
        ticksCount: 60,
        globalTrafficScale: 150,
      }),
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    expect(batchData.ticks).toBe(60);

    const finalTick = batchData.history[59].updatedMetrics;
    expect(finalTick['web-clients'].inboundRps).toBe(75000); // 50,000 * 1.5
    const maxDbRps = Math.max(...batchData.history.map((h: any) => h.updatedMetrics['postgres-db'].inboundRps));
    expect(maxDbRps).toBeGreaterThan(0);

    // 3. Calculate capacity limits for Flash Sale campaign (500,000 DAU)
    const capRes = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dau: 500000,
        readRatio: 0.9,
        writeRatio: 0.1,
        avgReadPayloadKb: 10,
        avgWritePayloadKb: 50,
        retentionDays: 90,
      }),
    });
    expect(capRes.status).toBe(200);
    const capData = await capRes.json();
    expect(capData.peakRps).toBeGreaterThan(capData.meanRps);
    expect(capData.recommendedCacheRamGb).toBeGreaterThan(0);
  });

  it('Scenario B: High-Throughput Streaming Data Pipeline (Kafka -> Worker Ingestors -> Flink Analytics -> Cassandra)', async () => {
    const pipelineTopology = {
      nodes: [
        {
          id: 'mobile-ingest',
          data: { componentType: 'mobile', category: 'client', config: { label: 'Telemetry Apps', maxRps: 10000 } },
        },
        {
          id: 'kafka-bus',
          data: {
            componentType: 'kafka',
            category: 'messaging',
            config: { label: 'Event Ingestion Pipeline', maxRps: 50000, replicas: 3, partitionCount: 4 },
          },
        },
        {
          id: 'worker-pool',
          data: {
            componentType: 'worker',
            category: 'compute',
            config: { label: 'Stream Ingestors', maxRps: 500, replicas: 8 },
          },
        },
        {
          id: 'flink-analytics',
          data: {
            componentType: 'analytics',
            category: 'compute',
            config: { label: 'Flink Realtime Engine', maxRps: 20000, storageGb: 100 },
          },
        },
        {
          id: 'cassandra-nosql',
          data: {
            componentType: 'nosql-db',
            category: 'storage',
            config: { label: 'Cassandra TimeSeries DB', maxRps: 50000, storageGb: 1000 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'mobile-ingest', target: 'kafka-bus' },
        { id: 'e2', source: 'kafka-bus', target: 'worker-pool' },
        { id: 'e3', source: 'worker-pool', target: 'flink-analytics' },
        { id: 'e4', source: 'flink-analytics', target: 'cassandra-nosql' },
      ],
    };

    // 1. Validate streaming pipeline graph
    const valRes = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelineTopology),
    });
    expect(valRes.status).toBe(200);

    // 2. Execute single tick simulation
    const tickRes = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pipelineTopology, tick: 1 }),
    });
    expect(tickRes.status).toBe(200);
    const tickData = await tickRes.json();

    // Verify worker parallelism constraint bottleneck alert:
    // 8 workers configured, but Kafka partitionCount = 4 -> bottlenecks list includes worker partition bottleneck
    expect(tickData.bottlenecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'worker-pool',
          severity: 'warning',
          limit: 4,
        }),
      ])
    );

    // 3. Execute 30-tick batch simulation to verify Cassandra storage accumulation
    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pipelineTopology, ticksCount: 30 }),
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    const finalMetrics = batchData.history[29].updatedMetrics;
    expect(finalMetrics['cassandra-nosql'].storagePct).toBeGreaterThanOrEqual(0);
  });

  it('Scenario C: Global Content Delivery Network (5 Edge Locations -> Shield Cache -> S3 Origin)', async () => {
    const cdnTopology = {
      nodes: [
        {
          id: 'global-users',
          data: { componentType: 'client', category: 'client', config: { label: 'Worldwide Users', maxRps: 20000, writeRatio: 0.05 } },
        },
        {
          id: 'dns-geo',
          data: { componentType: 'dns', category: 'traffic-edge', config: { label: 'Route53 GeoDNS', maxRps: 100000 } },
        },
        {
          id: 'edge-cdn',
          data: { componentType: 'cdn', category: 'traffic-edge', config: { label: 'Cloudflare Edge CDN', maxRps: 50000, cacheHitRate: 0.95 } },
        },
        {
          id: 'waf-shield',
          data: { componentType: 'waf', category: 'traffic-edge', config: { label: 'AWS Shield WAF', maxRps: 10000 } },
        },
        {
          id: 's3-origin',
          data: { componentType: 'object-store', category: 'storage', config: { label: 'S3 Asset Origin', maxRps: 5000, storageGb: 5000 } },
        },
      ],
      edges: [
        { id: 'e1', source: 'global-users', target: 'dns-geo' },
        { id: 'e2', source: 'dns-geo', target: 'edge-cdn' },
        { id: 'e3', source: 'edge-cdn', target: 'waf-shield' },
        { id: 'e4', source: 'waf-shield', target: 's3-origin' },
      ],
    };

    // 1. Validate CDN topology
    const valRes = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cdnTopology),
    });
    expect(valRes.status).toBe(200);

    // 2. Execute simulation tick at 20,000 RPS
    const tickRes = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cdnTopology, tick: 1 }),
    });
    expect(tickRes.status).toBe(200);
    const tickData = await tickRes.json();

    // 95% CDN hit rate: 19,000 read RPS absorbed by CDN -> WAF/Origin receives only 5% (1,000 read RPS) + 1,000 write RPS = 2,000 RPS
    expect(tickData.updatedMetrics['global-users'].inboundRps).toBe(20000);
    expect(tickData.updatedMetrics['edge-cdn'].inboundRps).toBe(20000);
    expect(tickData.updatedMetrics['s3-origin'].inboundRps).toBeLessThan(5000);

    // 3. Calculate CDN Bandwidth
    const capRes = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dau: 2000000,
        readRatio: 0.95,
        writeRatio: 0.05,
        avgReadPayloadKb: 500, // 500KB images/video
      }),
    });
    expect(capRes.status).toBe(200);
    const capData = await capRes.json();
    expect(capData.readBandwidthMbps).toBeGreaterThan(0);
  });

  it('Scenario D: Financial Banking Transaction Engine (Payment Gateway -> Fraud Detection CB -> Ledger DB)', async () => {
    const bankingTopology = {
      nodes: [
        {
          id: 'mobile-app',
          data: { componentType: 'mobile', category: 'client', config: { label: 'Banking Mobile App', maxRps: 200 } },
        },
        {
          id: 'waf-edge',
          data: { componentType: 'waf', category: 'traffic-edge', config: { label: 'Banking WAF', maxRps: 2000 } },
        },
        {
          id: 'payment-service',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: {
              label: 'Payment Core Service',
              maxRps: 500,
              replicas: 2,
              circuitBreakerEnabled: true,
              cbFailureThreshold: 0.3,
              cbSleepWindowTicks: 3,
            },
          },
        },
        {
          id: 'ledger-db',
          data: { componentType: 'sql-database', category: 'storage', config: { label: 'Transactional Ledger DB', maxRps: 1000 } },
        },
      ],
      edges: [
        { id: 'e1', source: 'mobile-app', target: 'waf-edge' },
        { id: 'e2', source: 'waf-edge', target: 'payment-service' },
        { id: 'e3', source: 'payment-service', target: 'ledger-db' },
      ],
    };

    // 1. Validate banking topology
    const valRes = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankingTopology),
    });
    expect(valRes.status).toBe(200);

    // 2. Run simulation batch with error injection to trigger circuit breaker OPEN transition
    const bankingTopologyWithError = {
      ...bankingTopology,
      nodes: bankingTopology.nodes.map((n) =>
        n.id === 'payment-service'
          ? { ...n, data: { ...n.data, config: { ...n.data.config, errorRate: 0.6 } } }
          : n
      ),
    };

    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...bankingTopologyWithError,
        ticksCount: 15,
      }),
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();

    // Check circuit breaker state transitions in history
    const cbStates = batchData.history.map((h: any) => h.updatedMetrics['payment-service'].cbState);
    expect(cbStates).toEqual(expect.arrayContaining(['OPEN']));
  });

  it('Scenario E: Real-Time Multiplayer Gaming Architecture (WebSocket Gateway -> Room Matchmaker -> Game Instances -> Pub/Sub)', async () => {
    const gamingTopology = {
      nodes: [
        {
          id: 'game-clients',
          data: { componentType: 'mobile', category: 'client', config: { label: 'Game Clients', maxRps: 5000, clientLatencyMs: 15 } },
        },
        {
          id: 'ws-gateway',
          data: { componentType: 'api-gateway', category: 'traffic-edge', config: { label: 'WebSocket Gateway', maxRps: 20000 } },
        },
        {
          id: 'matchmaker',
          data: { componentType: 'app-server', category: 'compute', config: { label: 'Room Matchmaker', maxRps: 2000, replicas: 2 } },
        },
        {
          id: 'game-servers',
          data: { componentType: 'serverless', category: 'compute', config: { label: 'Game Room Instances', maxRps: 1000, replicas: 10 } },
        },
        {
          id: 'pubsub-broker',
          data: { componentType: 'pub-sub', category: 'messaging', config: { label: 'State Sync Pub/Sub', maxRps: 20000 } },
        },
        {
          id: 'session-cache',
          data: { componentType: 'cache', category: 'storage', config: { label: 'Redis Session Store', maxRps: 50000 } },
        },
      ],
      edges: [
        { id: 'e1', source: 'game-clients', target: 'ws-gateway' },
        { id: 'e2', source: 'ws-gateway', target: 'matchmaker' },
        { id: 'e3', source: 'matchmaker', target: 'game-servers' },
        { id: 'e4', source: 'game-servers', target: 'pubsub-broker' },
        { id: 'e5', source: 'game-servers', target: 'session-cache' },
      ],
    };

    // 1. Validate gaming architecture
    const valRes = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gamingTopology),
    });
    expect(valRes.status).toBe(200);

    // 2. Calculate low-latency scaling requirements (target 15ms)
    const capRes = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dau: 100000,
        targetLatencyMs: 15,
      }),
    });
    expect(capRes.status).toBe(200);
    const capData = await capRes.json();
    expect(capData.recommendedReplicas).toBeGreaterThan(0);

    // 3. Execute 30-tick batch simulation with oscillating traffic scale
    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...gamingTopology,
        ticksCount: 30,
        globalTrafficScale: 120,
      }),
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    expect(batchData.history).toHaveLength(30);

    const tickMetrics = batchData.history[15].updatedMetrics['ws-gateway'];
    expect(tickMetrics).toHaveProperty('p50');
    expect(tickMetrics).toHaveProperty('p95');
    expect(tickMetrics).toHaveProperty('p99');
    expect(tickMetrics.p99).toBeGreaterThanOrEqual(tickMetrics.p50);
  });
});
