import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { simulationRoutes } from '../routes/simulation.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Simulation Routes Integration Tests', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/simulation', simulationRoutes);
  });

  describe('POST /api/v1/simulation/tick', () => {
    it('should process a single simulation tick successfully', async () => {
      const res = await app.request('/api/v1/simulation/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'node-1',
              data: {
                componentType: 'client',
                category: 'entry',
                config: { rps: 100 },
              },
            },
            {
              id: 'node-2',
              data: {
                componentType: 'app_server',
                category: 'compute',
                config: { maxRpsPerReplica: 200 },
              },
            },
          ],
          edges: [{ id: 'e1', source: 'node-1', target: 'node-2' }],
          tick: 1,
          globalTrafficScale: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalRps).toBeDefined();
      expect(data.updatedMetrics).toBeDefined();
      expect(data.bottlenecks).toBeDefined();
    });

    it('should return 400 Bad Request for malformed tick input', async () => {
      const res = await app.request('/api/v1/simulation/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: 'invalid' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/simulation/batch', () => {
    it('should process a batch simulation of multiple ticks', async () => {
      const res = await app.request('/api/v1/simulation/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'n1',
              data: { componentType: 'client', category: 'entry', config: {} },
            },
          ],
          edges: [],
          ticksCount: 5,
          globalTrafficScale: 100,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ticks).toBe(5);
      expect(data.history).toHaveLength(5);
    });

    it('should return 400 Bad Request if ticksCount exceeds maximum limit (300)', async () => {
      const res = await app.request('/api/v1/simulation/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [],
          edges: [],
          ticksCount: 500,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/simulation/validate', () => {
    it('should validate graph architecture and return validity status', async () => {
      const res = await app.request('/api/v1/simulation/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              id: 'n1',
              data: { componentType: 'client', category: 'entry', config: {} },
            },
            {
              id: 'n2',
              data: { componentType: 'app_server', category: 'compute', config: {} },
            },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('valid');
      expect(data).toHaveProperty('warnings');
    });
  });

  describe('POST /api/v1/simulation/capacity', () => {
    it('should calculate capacity metrics based on input parameters', async () => {
      const res = await app.request('/api/v1/simulation/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dau: 100000,
          readRatio: 0.8,
          writeRatio: 0.2,
          avgReadPayloadKb: 10,
          avgWritePayloadKb: 50,
          retentionDays: 30,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });
});
