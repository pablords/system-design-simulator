import { Hono } from 'hono';
import { z } from 'zod';
import { runSimulationTickCore, runSimulationBatchCore, calculateCapacity, validateGraph } from '@system-design/shared';

const tickInputSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      data: z.object({
        componentType: z.string(),
        category: z.string(),
        config: z.record(z.unknown()),
        metrics: z.record(z.unknown()).optional(),
      }),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      data: z.record(z.unknown()).optional(),
    })
  ),
  tick: z.number().default(1),
  globalTrafficScale: z.number().optional().default(100),
});

const batchInputSchema = tickInputSchema.extend({
  ticksCount: z.number().min(1).max(300).default(60),
});

const capacityInputSchema = z.object({
  dau: z.number().optional(),
  readRatio: z.number().optional(),
  writeRatio: z.number().optional(),
  avgReadPayloadKb: z.number().optional(),
  avgWritePayloadKb: z.number().optional(),
  retentionDays: z.number().optional(),
  targetLatencyMs: z.number().optional(),
});

export const simulationRoutes = new Hono();

// POST /tick — Process single simulation tick
simulationRoutes.post('/tick', async (c) => {
  const body = tickInputSchema.parse(await c.req.json());
  const result = runSimulationTickCore(body);
  return c.json(result);
});

// POST /batch — Process batch simulation (e.g. 60 ticks)
simulationRoutes.post('/batch', async (c) => {
  const body = batchInputSchema.parse(await c.req.json());
  const results = runSimulationBatchCore(body.nodes, body.edges, body.ticksCount, body.globalTrafficScale);
  return c.json({ ticks: results.length, history: results });
});

// POST /validate — Validate architecture graph
simulationRoutes.post('/validate', async (c) => {
  const body = tickInputSchema.pick({ nodes: true, edges: true }).parse(await c.req.json());
  const errors = validateGraph(body.nodes as any, body.edges as any);
  return c.json({ valid: errors.filter((e) => e.severity === 'error').length === 0, warnings: errors });
});

// POST /capacity — Capacity calculator estimates
simulationRoutes.post('/capacity', async (c) => {
  const body = capacityInputSchema.parse(await c.req.json());
  const result = calculateCapacity(body);
  return c.json(result);
});
