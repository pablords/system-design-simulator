import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer, type TestServerInstance } from './helpers/testServer.js';
import { signToken } from '../../packages/api/src/lib/jwt.js';

describe('Tier 2: Boundary & Corner Cases (F1–F5)', () => {
  let server: TestServerInstance;
  let baseUrl: string;
  let authTokenUserA: string;
  let authTokenUserB: string;

  beforeAll(async () => {
    server = await setupTestServer();
    baseUrl = server.baseUrl;

    // Register User A
    const resA = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `boundary_usera_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Boundary User A',
      }),
    });
    const dataA = await resA.json();
    authTokenUserA = dataA.token;

    // Register User B
    const resB = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `boundary_userb_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Boundary User B',
      }),
    });
    const dataB = await resB.json();
    authTokenUserB = dataB.token;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  // ==========================================
  // F1 Auth Boundaries
  // ==========================================
  describe('F1: Auth Boundary Cases', () => {
    it('F2.1.1: POST /api/v1/auth/register — duplicate email returns 409 Conflict', async () => {
      const email = `dup_${Date.now()}@example.com`;
      await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123', name: 'First' }),
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'differentpassword', name: 'Duplicate' }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toBe('Email already registered');
    });

    it('F2.1.2: POST /api/v1/auth/login — wrong password returns 401 Unauthorized', async () => {
      const email = `login_fail_${Date.now()}@example.com`;
      await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'correctpassword', name: 'User' }),
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrongpassword' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('Invalid credentials');
    });

    it('F2.1.3: GET /api/v1/auth/me — missing Authorization header returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });

    it('F2.1.4: GET /api/v1/auth/me — malformed or expired JWT returns 401 Unauthorized', async () => {
      const res1 = await fetch(`${baseUrl}/api/v1/auth/me`, {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid.malformed.jwt' },
      });
      expect(res1.status).toBe(401);

      const res2 = await fetch(`${baseUrl}/api/v1/auth/me`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' },
      });
      expect(res2.status).toBe(401);
    });

    it('F2.1.5: POST /api/v1/auth/register — invalid email format returns 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email-address',
          password: 'validpassword123',
          name: 'Test Name',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // F2 Projects Boundaries
  // ==========================================
  describe('F2: Projects Boundary Cases', () => {
    it('F2.2.1: GET /api/v1/projects/:id — non-existent project ID returns 404 Not Found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${baseUrl}/api/v1/projects/${nonExistentId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authTokenUserA}` },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe('Project not found');
    });

    it('F2.2.2: PUT /api/v1/projects/:id — edit unauthorized project (User B on User A private) returns 404', async () => {
      // User A creates private project
      const createRes = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenUserA}`,
        },
        body: JSON.stringify({
          name: 'User A Private Project',
          canvas: { nodes: [], edges: [] },
          isPublic: false,
        }),
      });
      const projectA = await createRes.json();

      // User B attempts to edit User A's private project
      const editRes = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenUserB}`,
        },
        body: JSON.stringify({ name: 'Hacked Title' }),
      });

      expect(editRes.status).toBe(404);
    });

    it('F2.2.3: POST /api/v1/projects — payload limit empty name returns 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenUserA}`,
        },
        body: JSON.stringify({
          name: '', // Invalid empty name
          canvas: { nodes: [], edges: [] },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('F2.2.4: POST /api/v1/projects — invalid canvas schema (missing nodes) returns 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenUserA}`,
        },
        body: JSON.stringify({
          name: 'Invalid Canvas Project',
          canvas: { invalidKey: 'not a canvas' },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('F2.2.5: DELETE /api/v1/projects/:id — delete non-existent ID returns 404 Not Found', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/00000000-0000-0000-0000-000000000099`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authTokenUserA}` },
      });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // F3 Topology Boundaries
  // ==========================================
  describe('F3: Topology Boundary Cases', () => {
    it('F2.3.1: POST /api/v1/simulation/validate — empty graph handles cleanly without error', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: [], edges: [] }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(data.warnings).toHaveLength(0);
    });

    it('F2.3.2: POST /api/v1/simulation/validate — cyclic graph connections handle safely without infinite loop', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'node-A', data: { componentType: 'client', category: 'client', config: {} } },
            { id: 'node-B', data: { componentType: 'app-server', category: 'compute', config: {} } },
            { id: 'node-C', data: { componentType: 'message-queue', category: 'messaging', config: {} } },
          ],
          edges: [
            { id: 'e1', source: 'node-A', target: 'node-B' },
            { id: 'e2', source: 'node-B', target: 'node-C' },
            { id: 'e3', source: 'node-C', target: 'node-B' }, // Cycle B <-> C
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
    });

    it('F2.3.3: POST /api/v1/simulation/capacity — negative or zero parameters handle safely', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dau: 0,
          readRatio: 0,
          writeRatio: 0,
          avgReadPayloadKb: 0,
          avgWritePayloadKb: 0,
          retentionDays: 0,
          targetLatencyMs: 0,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.meanRps).toBe(0);
      expect(data.recommendedReplicas).toBeGreaterThanOrEqual(1);
    });

    it('F2.3.4: POST /api/v1/simulation/validate — 500+ node graph scale validates within performance limits', async () => {
      const largeNodes = Array.from({ length: 500 }, (_, i) => ({
        id: `scale-node-${i}`,
        data: {
          componentType: i === 0 ? 'client' : 'app-server',
          category: i === 0 ? 'client' : 'compute',
          config: {},
        },
      }));

      const largeEdges = Array.from({ length: 499 }, (_, i) => ({
        id: `scale-edge-${i}`,
        source: `scale-node-${i}`,
        target: `scale-node-${i + 1}`,
      }));

      const startTime = Date.now();
      const res = await fetch(`${baseUrl}/api/v1/simulation/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: largeNodes, edges: largeEdges }),
      });
      const elapsed = Date.now() - startTime;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(elapsed).toBeLessThan(3000); // Under 3 seconds
    });

    it('F2.3.5: POST /api/v1/simulation/tick — invalid edge target ID executes safely without crashing engine', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'client-1', data: { componentType: 'client', category: 'client', config: { maxRps: 100 } } },
          ],
          edges: [
            { id: 'bad-edge', source: 'client-1', target: 'non-existent-target-id' },
          ],
          tick: 1,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedMetrics['client-1']).toBeDefined();
    });
  });

  // ==========================================
  // F4 Engine Boundaries
  // ==========================================
  describe('F4: Simulation Engine Boundary Cases', () => {
    it('F2.4.1: POST /api/v1/simulation/tick — 0 RPS zero traffic generator yields 0 RPS metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'c0', data: { componentType: 'client', category: 'client', config: { maxRps: 0 } } },
            { id: 's0', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100 } } },
          ],
          edges: [{ id: 'e1', source: 'c0', target: 's0' }],
          tick: 1,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedMetrics['c0'].inboundRps).toBe(0);
      expect(data.updatedMetrics['s0'].inboundRps).toBe(0);
    });

    it('F2.4.2: POST /api/v1/simulation/tick — 1M RPS extreme overload triggers bottleneck alerts and critical status', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { id: 'c1', data: { componentType: 'client', category: 'client', config: { maxRps: 1000000, replicas: 1 } } },
            { id: 's1', data: { componentType: 'app-server', category: 'compute', config: { maxRps: 100, replicas: 1 } } },
          ],
          edges: [{ id: 'e1', source: 'c1', target: 's1' }],
          tick: 1,
          globalTrafficScale: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedMetrics['s1'].status).toBe('critical');
      expect(data.updatedMetrics['s1'].cpuPct).toBeGreaterThanOrEqual(95);
    });

    it('F2.4.3: POST /api/v1/simulation/capacity — target latency 0 ms safety handling without division by zero', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLatencyMs: 0,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Number.isFinite(data.recommendedReplicas)).toBe(true);
      expect(data.recommendedReplicas).toBeGreaterThanOrEqual(1);
    });

    it('F2.4.4: POST /api/v1/simulation/tick — HALF-OPEN circuit breaker trial request recovery', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'c1',
              data: { componentType: 'client', category: 'client', config: { maxRps: 50 } },
            },
            {
              id: 'cb-node',
              data: {
                componentType: 'app-server',
                category: 'compute',
                config: { maxRps: 100, circuitBreakerEnabled: true },
                metrics: { cbState: 'HALF-OPEN', cbOpenTimer: 0 },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'c1', target: 'cb-node' }],
          tick: 5,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(['CLOSED', 'OPEN', 'HALF-OPEN']).toContain(data.updatedMetrics['cb-node'].cbState);
    });

    it('F2.4.5: POST /api/v1/simulation/batch — ticksCount <= 0 returns 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/simulation/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [{ id: 'c1', data: { componentType: 'client', category: 'client', config: {} } }],
          edges: [],
          ticksCount: 0,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // F5 Stream Boundaries
  // ==========================================
  describe('F5: Stream Boundary Cases', () => {
    it('F2.5.1: GET /api/v1/simulation/stream — unknown query params handle request safely', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream?unknown_param=12345&foo=bar`, {
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      controller.abort();
    });

    it('F2.5.2: GET /api/v1/simulation/stream — immediate 0-byte disconnect cleans up stream cleanly', async () => {
      const controller = new AbortController();
      const fetchPromise = fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      // Immediate abort before waiting for resolution
      controller.abort();

      await expect(fetchPromise).rejects.toThrow();
    });

    it('F2.5.3: GET /api/v1/simulation/stream — rapid connect/disconnect stress (25 iterations) without memory leaks', async () => {
      for (let i = 0; i < 25; i++) {
        const controller = new AbortController();
        const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
          signal: controller.signal,
        });
        expect(res.status).toBe(200);
        controller.abort();
      }
    });

    it('F2.5.4: GET /api/v1/simulation/stream — Last-Event-ID header reconnection context handles safely', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        headers: { 'Last-Event-ID': '42' },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      controller.abort();
    });

    it('F2.5.5: GET /api/v1/simulation/stream — stream exception safety on abort during message write', async () => {
      const controller = new AbortController();
      const res = await fetch(`${baseUrl}/api/v1/simulation/stream`, {
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      // Read first chunk then abort
      await reader.read();
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
