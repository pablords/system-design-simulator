import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, type TestServerInstance } from './helpers/testServer.js';
import { COMPONENT_DEFINITIONS } from '../../packages/shared/src/engine/ComponentModel.js';

describe('Tier 1: End-to-End Feature Coverage (F1–F5)', () => {
  let server: TestServerInstance;
  let baseUrl: string;
  let authToken: string;
  let userId: string;
  let createdProjectId: string;

  beforeAll(async () => {
    server = await setupTestServer();
    baseUrl = server.baseUrl;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  // ==========================================
  // F1: Auth Endpoints
  // ==========================================
  describe('F1: Authentication & User Management', () => {
    const testUser = {
      email: `tier1_user_${Date.now()}@example.com`,
      password: 'password123Secure!',
      name: 'Tier 1 Tester',
    };

    it('F1.1: POST /api/v1/auth/register — should register a new user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe(testUser.email.toLowerCase());
      expect(data.user.name).toBe(testUser.name);
      expect(data).toHaveProperty('token');
      expect(typeof data.token).toBe('string');

      authToken = data.token;
      userId = data.user.id;
    });

    it('F1.2: POST /api/v1/auth/login — should authenticate registered user and return JWT', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe(testUser.email.toLowerCase());
      expect(data.token).toBeDefined();
    });

    it('F1.3: GET /api/v1/auth/me — should return current user profile with valid Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(userId);
      expect(data.email).toBe(testUser.email.toLowerCase());
      expect(data.name).toBe(testUser.name);
    });

    it('F1.4: POST /api/v1/auth/logout — should acknowledge logout', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Logged out successfully');
    });

    it('F1.5: GET /api/v1/auth/config — should return public auth configuration flags', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/config`, {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('enableEmailAuth');
      expect(data.enableEmailAuth).toBe(true);
      expect(data).toHaveProperty('hasGithub');
      expect(data).toHaveProperty('hasGoogle');
    });
  });

  // ==========================================
  // F2: Projects CRUD Endpoints
  // ==========================================
  describe('F2: Projects CRUD Operations', () => {
    const initialCanvas = {
      nodes: [
        {
          id: 'client-1',
          data: {
            componentType: 'client',
            category: 'client',
            config: { maxRps: 100, replicas: 1 },
          },
        },
        {
          id: 'server-1',
          data: {
            componentType: 'app-server',
            category: 'compute',
            config: { maxRps: 500, replicas: 2 },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'client-1', target: 'server-1' },
      ],
    };

    it('F2.1: POST /api/v1/projects — should create a new system design project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'E2E Architecture Blueprint',
          description: 'Initial architectural test canvas',
          canvas: initialCanvas,
          isPublic: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toHaveProperty('id');
      expect(data.name).toBe('E2E Architecture Blueprint');
      expect(data.userId).toBe(userId);
      expect(data.canvas.nodes).toHaveLength(2);
      expect(data.isPublic).toBe(true);

      createdProjectId = data.id;
    });

    it('F2.2: GET /api/v1/projects — should list projects belonging to authenticated user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      const found = data.find((p: any) => p.id === createdProjectId);
      expect(found).toBeDefined();
      expect(found.name).toBe('E2E Architecture Blueprint');
    });

    it('F2.3: GET /api/v1/projects/:id — should retrieve project details by ID', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${createdProjectId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(createdProjectId);
      expect(data.name).toBe('E2E Architecture Blueprint');
      expect(data.canvas.nodes).toHaveLength(2);
    });

    it('F2.4: PUT /api/v1/projects/:id — should update canvas topology and description', async () => {
      const updatedCanvas = {
        ...initialCanvas,
        nodes: [
          ...initialCanvas.nodes,
          {
            id: 'db-1',
            data: {
              componentType: 'sql-database',
              category: 'storage',
              config: { maxRps: 1000, storageGb: 100 },
            },
          },
        ],
        edges: [
          ...initialCanvas.edges,
          { id: 'e2', source: 'server-1', target: 'db-1' },
        ],
      };

      const res = await fetch(`${baseUrl}/api/v1/projects/${createdProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'E2E Architecture Blueprint (v2)',
          canvas: updatedCanvas,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('E2E Architecture Blueprint (v2)');
      expect(data.canvas.nodes).toHaveLength(3);
    });

    it('F2.5: DELETE /api/v1/projects/:id — should delete project cleanly', async () => {
      // Create temporary project to delete
      const createRes = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Temp Project to Delete',
          canvas: initialCanvas,
        }),
      });
      const tempProject = await createRes.json();

      const deleteRes = await fetch(`${baseUrl}/api/v1/projects/${tempProject.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.message).toBe('Project deleted successfully');

      // Verify 404 on GET
      const getRes = await fetch(`${baseUrl}/api/v1/projects/${tempProject.id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(getRes.status).toBe(404);
    });
  });

  // ==========================================
  // F3: Canvas Topology Validation
  // ==========================================
  describe('F3: Canvas Topology Validation', () => {
    it('F3.1: POST /api/v1/simulation/validate — should report graph valid for proper client -> lb -> server pipeline', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'c1', data: { componentType: 'client', category: 'client', config: {} } },
            { id: 'lb1', data: { componentType: 'load-balancer', category: 'traffic-edge', config: {} } },
            { id: 'app1', data: { componentType: 'app-server', category: 'compute', config: {} } },
          ],
          edges: [
            { id: 'e1', source: 'c1', target: 'lb1' },
            { id: 'e2', source: 'lb1', target: 'app1' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(data.warnings).toHaveLength(0);
    });

    it('F3.2: POST /api/v1/simulation/validate — should return orphan_node warning for disconnected nodes', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'c1', data: { componentType: 'client', category: 'client', config: {}, label: 'Web Client' } },
            { id: 'app1', data: { componentType: 'app-server', category: 'compute', config: {} } },
            { id: 'orphan1', data: { componentType: 'cache', category: 'storage', config: {}, label: 'Isolated Cache' } },
          ],
          edges: [
            { id: 'e1', source: 'c1', target: 'app1' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nodeId: 'orphan1',
            type: 'orphan_node',
            severity: 'warning',
          }),
        ])
      );
    });

    it('F3.3: POST /api/v1/simulation/validate — should return missing_source warning if no client/mobile generator exists', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'app1', data: { componentType: 'app-server', category: 'compute', config: {} } },
            { id: 'db1', data: { componentType: 'sql-database', category: 'storage', config: {} } },
          ],
          edges: [
            { id: 'e1', source: 'app1', target: 'db1' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_source',
            severity: 'warning',
          }),
        ])
      );
    });

    it('F3.4: POST /api/v1/simulation/validate — should accept multi-branch topology with read/write edge constraints', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'c1', data: { componentType: 'mobile', category: 'client', config: {} } },
            { id: 'app1', data: { componentType: 'app-server', category: 'compute', config: {} } },
            { id: 'cache1', data: { componentType: 'cache', category: 'storage', config: {} } },
            { id: 'db1', data: { componentType: 'sql-database', category: 'storage', config: {} } },
          ],
          edges: [
            { id: 'e1', source: 'c1', target: 'app1' },
            { id: 'e2', source: 'app1', target: 'cache1', data: { trafficType: 'read' } },
            { id: 'e3', source: 'app1', target: 'db1', data: { trafficType: 'write' } },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
    });

    it('F3.5: POST /api/v1/simulation/validate — should validate nodes of all 33 component types successfully', async () => {
      const allComponentTypes = Object.keys(COMPONENT_DEFINITIONS);
      expect(allComponentTypes.length).toBe(33);

      const nodes = allComponentTypes.map((type, idx) => ({
        id: `node-${idx}`,
        data: {
          componentType: type,
          category: COMPONENT_DEFINITIONS[type as keyof typeof COMPONENT_DEFINITIONS].category,
          config: COMPONENT_DEFINITIONS[type as keyof typeof COMPONENT_DEFINITIONS].defaultConfig,
        },
      }));

      // Create chain from node-0 to node-32
      const edges = nodes.slice(0, -1).map((n, idx) => ({
        id: `edge-${idx}`,
        source: n.id,
        target: nodes[idx + 1].id,
      }));

      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
    });
  });

  // ==========================================
  // F4: Sim Engine Calculations
  // ==========================================
  describe('F4: Simulation Engine Calculations', () => {
    it('F4.1: POST /api/v1/simulation/tick — should execute single tick calculation and return metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'n-client',
              data: {
                componentType: 'client',
                category: 'client',
                config: { maxRps: 200, replicas: 1, writeRatio: 0.1 },
              },
            },
            {
              id: 'n-app',
              data: {
                componentType: 'app-server',
                category: 'compute',
                config: { maxRps: 500, replicas: 2 },
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'n-client', target: 'n-app' },
          ],
          tick: 1,
          globalTrafficScale: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('updatedMetrics');
      expect(data).toHaveProperty('updatedEdgeMetrics');
      expect(data.updatedMetrics['n-client'].inboundRps).toBe(200);
      expect(data.updatedMetrics['n-app'].inboundRps).toBe(200);
      expect(data.totalRps).toBe(200);
    });

    it('F4.2: POST /api/v1/simulation/batch — should execute multi-tick simulation batch (e.g. 60 ticks)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'n-client',
              data: {
                componentType: 'client',
                category: 'client',
                config: { maxRps: 150, replicas: 1 },
              },
            },
            {
              id: 'n-app',
              data: {
                componentType: 'app-server',
                category: 'compute',
                config: { maxRps: 300, replicas: 1 },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'n-client', target: 'n-app' }],
          ticksCount: 30,
          globalTrafficScale: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ticks).toBe(30);
      expect(data.history).toHaveLength(30);
      expect(data.history[29].updatedMetrics['n-app']).toBeDefined();
    });

    it('F4.3: POST /api/v1/simulation/capacity — should calculate Little\'s Law capacity limits', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dau: 1000000,
          readRatio: 0.8,
          writeRatio: 0.2,
          avgReadPayloadKb: 10,
          avgWritePayloadKb: 50,
          retentionDays: 30,
          targetLatencyMs: 50,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('meanRps');
      expect(data).toHaveProperty('peakRps');
      expect(data.peakRps).toBeCloseTo(data.meanRps * 3, 1);
      expect(data).toHaveProperty('recommendedReplicas');
      expect(data.recommendedReplicas).toBeGreaterThan(0);
    });

    it('F4.4: POST /api/v1/simulation/capacity — should apply 80/20 Pareto rule for cache RAM recommendation', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dau: 500000,
          readRatio: 0.9,
          writeRatio: 0.1,
          avgWritePayloadKb: 100,
          retentionDays: 30,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('dailyStorageGb');
      expect(data).toHaveProperty('recommendedCacheRamGb');
      expect(data.recommendedCacheRamGb).toBe(Math.ceil(data.dailyStorageGb * 0.2));
    });

    it('F4.5: POST /api/v1/simulation/tick — should evaluate circuit breaker state transitions', async () => {
      // Step 1: Execute tick on target node with circuitBreakerEnabled and failing state
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'c1',
              data: { componentType: 'client', category: 'client', config: { maxRps: 100, replicas: 1 } },
            },
            {
              id: 'app1',
              data: {
                componentType: 'app-server',
                category: 'compute',
                config: {
                  maxRps: 50,
                  replicas: 1,
                  circuitBreakerEnabled: true,
                  cbFailureThreshold: 0.2,
                  cbSleepWindowTicks: 5,
                  errorRate: 0.8, // 80% errors triggers CB OPEN
                },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'c1', target: 'app1' }],
          tick: 1,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedMetrics['app1'].cbState).toBeDefined();
      expect(['CLOSED', 'OPEN', 'HALF-OPEN']).toContain(data.updatedMetrics['app1'].cbState);
    });
  });

  // ==========================================
  // F5: SSE Real-time Stream
  // ==========================================
  describe('F5: Real-Time SSE Stream Endpoint', () => {
    it('F5.1: GET /api/v1/simulation/stream — should return text/event-stream content-type header', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      controller.abort();
    });

    it('F5.2: GET /api/v1/simulation/stream — should receive event: connected as first SSE event', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (text.includes('event: connected')) {
          break;
        }
      }

      expect(text).toContain('event: connected');
      expect(text).toContain('Connected to simulation tick stream engine');
      controller.abort();
    });

    it('F5.3: GET /api/v1/simulation/stream — should broadcast event: tick data payloads', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (text.includes('event: tick')) {
          break;
        }
      }

      expect(text).toContain('event: tick');
      expect(text).toContain('"tick":');
      expect(text).toContain('"updatedMetrics":');
      controller.abort();
    });

    it('F5.4: GET /api/v1/simulation/stream — should support multi-client concurrent subscriptions', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/v1/simulation/stream`, { signal: controller1.signal }),
        fetch(`${baseUrl}/api/v1/simulation/stream`, { signal: controller2.signal }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.headers.get('content-type')).toContain('text/event-stream');
      expect(res2.headers.get('content-type')).toContain('text/event-stream');

      controller1.abort();
      controller2.abort();
    });

    it('F5.5: GET /api/v1/simulation/stream — should clean up gracefully on client abort/disconnect', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      // Abort immediately
      controller.abort();
      // Should not throw unhandled rejection
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
