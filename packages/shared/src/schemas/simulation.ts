import { z } from 'zod';

export const BottleneckSchema = z.object({
  nodeId: z.string(),
  nodeLabel: z.string(),
  type: z.enum(['cpu', 'ram', 'rps', 'storage']),
  severity: z.enum(['warning', 'critical']),
  value: z.number(),
  limit: z.number(),
  message: z.string(),
});

export const SimulationSpeedSchema = z.enum(['slow', 'normal', 'fast']);

export const SimulationStateSchema = z.object({
  running: z.boolean(),
  tick: z.number(),
  speed: SimulationSpeedSchema,
  totalRps: z.number(),
  bottlenecks: z.array(BottleneckSchema),
  globalTrafficScale: z.number(),
});

export const SavedScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  savedAt: z.string(),
});
