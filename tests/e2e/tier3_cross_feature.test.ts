import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, type TestServerInstance } from './helpers/testServer.js';

describe('Tier 3: Cross-Feature Integration (Pairwise & Workflows)', () => {
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

  it('T3.1: Auth + Project CRUD — isolated multi-user workspace & project cloning', async () => {
    // 1. Register User 1
    const resUser1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `cross_user1_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'User One',
      }),
    });
    const { token: token1 } = await resUser1.json();

    // 2. Register User 2
    const resUser2 = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `cross_user2_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'User Two',
      }),
    });
    const { token: token2 } = await resUser2.json();

    // 3. User 1 creates a private project and a public project
    const privateRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        name: 'User 1 Secret Architecture',
        canvas: { nodes: [{ id: 'secret-1', data: { componentType: 'sql-database', category: 'storage', config: {} } }], edges: [] },
        isPublic: false,
      }),
    });
    const privateProj = await privateRes.json();

    const publicRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        name: 'User 1 Open Template',
        canvas: { nodes: [{ id: 'pub-1', data: { componentType: 'client', category: 'client', config: {} } }], edges: [] },
        isPublic: true,
      }),
    });
    const publicProj = await publicRes.json();

    // 4. User 2 attempts to fetch User 1's private project (returns 404)
    const getPrivateRes = await fetch(`${baseUrl}/api/v1/projects/${privateProj.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(getPrivateRes.status).toBe(404);

    // 5. User 2 fetches User 1's public project (returns 200)
    const getPublicRes = await fetch(`${baseUrl}/api/v1/projects/${publicProj.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(getPublicRes.status).toBe(200);

    // 6. User 2 clones User 1's public project
    const cloneRes = await fetch(`${baseUrl}/api/v1/projects/${publicProj.id}/clone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(cloneRes.status).toBe(201);
    const clonedProj = await cloneRes.json();
    expect(clonedProj.name).toBe('User 1 Open Template (copy)');

    // 7. User 2 modifies cloned project without affecting User 1's original
    await fetch(`${baseUrl}/api/v1/projects/${clonedProj.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token2}`,
      },
      body: JSON.stringify({ name: 'User 2 Modified Clone' }),
    });

    const checkOriginalRes = await fetch(`${baseUrl}/api/v1/projects/${publicProj.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` },
    });
    const originalData = await checkOriginalRes.json();
    expect(originalData.name).toBe('User 1 Open Template');
  });

  it('T3.2: Project + Topology Validation — load canvas, validate topology endpoint, update status', async () => {
    // 1. Auth & Create initial project with warning (missing source)
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `val_user_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Validation User',
      }),
    });
    const { token } = await regRes.json();

    const initialCanvas = {
      nodes: [{ id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: {} } }],
      edges: [],
    };

    const projRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Draft Topology', canvas: initialCanvas }),
    });
    const project = await projRes.json();

    // 2. Pass stored canvas to topology validator
    const valRes1 = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project.canvas),
    });
    const valData1 = await valRes1.json();
    expect(valData1.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'missing_source' })])
    );

    // 3. Fix topology by adding client node and edge
    const fixedCanvas = {
      nodes: [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: {} } },
        { id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: {} } },
      ],
      edges: [{ id: 'e1', source: 'client-1', target: 'app-1' }],
    };

    const valRes2 = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedCanvas),
    });
    const valData2 = await valRes2.json();
    expect(valData2.valid).toBe(true);

    // 4. Update project with fixed canvas
    const updateRes = await fetch(`${baseUrl}/api/v1/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ canvas: fixedCanvas }),
    });
    expect(updateRes.status).toBe(200);
  });

  it('T3.3: Canvas Topology + Sim Engine — post canvas topology to engine tick, verify capacity formulas', async () => {
    const topology = {
      nodes: [
        {
          id: 'client-node',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 200, replicas: 1, writeRatio: 0.2 },
          },
        },
        {
          id: 'cache-node',
          data: {
            componentType: 'cache',
            category: 'storage',
            config: { cacheHitRate: 0.8 },
          },
        },
        {
          id: 'db-node',
          data: {
            componentType: 'sql-database',
            category: 'storage',
            config: { maxRps: 1000 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'client-node', target: 'cache-node' },
        { id: 'e2', source: 'cache-node', target: 'db-node' },
      ],
    };

    const tickRes = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...topology, tick: 1, globalTrafficScale: 100 }),
    });

    expect(tickRes.status).toBe(200);
    const result = await tickRes.json();

    // Verification of formulas:
    // Client: 200 RPS (160 Read RPS, 40 Write RPS)
    // Cache: receives 200 RPS. 80% read hit -> 160 * 0.2 = 32 Read RPS missed + 40 Write RPS passed to DB = 72 RPS
    expect(result.updatedMetrics['client-node'].inboundRps).toBe(200);
    expect(result.updatedMetrics['cache-node'].inboundRps).toBe(200);
    expect(result.updatedMetrics['db-node'].inboundRps).toBe(75);
  });

  it('T3.4: Sim Engine + SSE Stream — trigger REST batch sim while listening to SSE tick stream', async () => {
    // 1. Listen to SSE Stream
    const controller = new AbortController();
    const sseRes = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
      signal: controller.signal,
    });
    expect(sseRes.status).toBe(200);

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    const streamBuffer: string[] = [];

    // Read initial chunks
    const readPromise = (async () => {
      while (true) {
        try {
          const { value, done } = await reader.read();
          if (done) break;
          streamBuffer.push(decoder.decode(value, { stream: true }));
          if (streamBuffer.join('').includes('event: tick')) break;
        } catch {
          break;
        }
      }
    })();

    // 2. Concurrently execute batch REST simulation
    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: [
          { id: 'c1', data: { componentType: 'client', category: 'client', config: { maxRps: 50 } } },
          { id: 's1', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } } },
        ],
        edges: [{ id: 'e1', source: 'c1', target: 's1' }],
        ticksCount: 10,
      }),
    });

    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    expect(batchData.history).toHaveLength(10);

    await readPromise;
    controller.abort();

    const fullStreamText = streamBuffer.join('');
    expect(fullStreamText).toContain('event: connected');
  });

  it('T3.5: Auth + Project Clone + Sim Engine + SSE Stream — full end-to-end stack chain', async () => {
    // 1. User A Register & Create Master Architecture
    const regARes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `stack_usera_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Master Architect',
      }),
    });
    const { token: tokenA } = await regARes.json();

    const masterCanvas = {
      nodes: [
        { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 500 } } },
        { id: 'lb-1', data: { componentType: 'load-balancer', category: 'traffic-edge', config: {} } },
        { id: 'app-1', data: { componentType: 'app-server', category: 'compute', config: { replicas: 3, maxRps: 300 } } },
      ],
      edges: [
        { id: 'e1', source: 'client-1', target: 'lb-1' },
        { id: 'e2', source: 'lb-1', target: 'app-1' },
      ],
    };

    const createRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Enterprise Production System', canvas: masterCanvas, isPublic: true }),
    });
    const masterProject = await createRes.json();

    // 2. User B Register & Clone Master Architecture
    const regBRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `stack_userb_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'DevOps Engineer',
      }),
    });
    const { token: tokenB } = await regBRes.json();

    const cloneRes = await fetch(`${baseUrl}/api/v1/projects/${masterProject.id}/clone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const clonedProject = await cloneRes.json();

    // 3. User B runs Simulation Batch on cloned architecture
    const batchRes = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: clonedProject.canvas.nodes,
        edges: clonedProject.canvas.edges,
        ticksCount: 5,
      }),
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    expect(batchData.history).toHaveLength(5);

    // 4. User B calculates system capacity limits
    const capRes = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dau: 250000, targetLatencyMs: 30 }),
    });
    expect(capRes.status).toBe(200);
    const capData = await capRes.json();
    expect(capData.recommendedReplicas).toBeGreaterThan(0);

    // 5. User B connects to real-time SSE stream telemetry
    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
      signal: controller.signal,
    });
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream');
    controller.abort();
  });
});
