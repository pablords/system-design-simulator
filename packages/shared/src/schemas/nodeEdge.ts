import { z } from 'zod';
import { ComponentCategorySchema, ComponentTypeSchema, ComponentConfigSchema } from './component.js';

export const NodeStatusSchema = z.enum(['idle', 'ok', 'warning', 'critical']);

export const EdgeMetricsSchema = z.object({
  rps: z.number(),
  readRps: z.number().optional(),
  writeRps: z.number().optional(),
  queueSize: z.number(),
  latencyMs: z.number(),
  timeoutsPerSecond: z.number(),
  failuresPerSecond: z.number().optional(),
  status: z.enum(['ok', 'warning', 'critical']),
  queueWaitTimeMs: z.number().optional(),
});

export const SimulatorEdgeDataSchema = z
  .object({
    metrics: EdgeMetricsSchema.optional(),
    trafficType: z.enum(['all', 'read', 'write']).optional(),
    networkLatencyMs: z.number().optional(),
    label: z.string().optional(),
    bulkheadEnabled: z.boolean().optional(),
    bulkheadLimit: z.number().optional(),
  })
  .passthrough();

export const MetricSnapshotSchema = z.object({
  tick: z.number(),
  cpuPct: z.number(),
  ramPct: z.number(),
  latencyMs: z.number(),
  endToEndLatencyMs: z.number().optional(),
  p50: z.number().optional(),
  p95: z.number().optional(),
  p99: z.number().optional(),
  rps: z.number(),
  successRps: z.number().optional(),
  failedRps: z.number().optional(),
});

export const NodeMetricsSchema = z.object({
  inboundRps: z.number(),
  inboundReadRps: z.number().optional(),
  inboundWriteRps: z.number().optional(),
  outboundRps: z.number(),
  cpuPct: z.number(),
  ramPct: z.number(),
  storagePct: z.number(),
  latencyMs: z.number(),
  queueDepth: z.number(),
  status: NodeStatusSchema,
  history: z.array(MetricSnapshotSchema),
  endToEndLatencyMs: z.number().optional(),
  consecutiveOverloadTicks: z.number().optional(),
  restartCooldownTicks: z.number().optional(),
  successRps: z.number().optional(),
  failedRps: z.number().optional(),
  cbState: z.enum(['CLOSED', 'OPEN', 'HALF-OPEN']).optional(),
  cbOpenTimer: z.number().optional(),
  p50: z.number().optional(),
  p95: z.number().optional(),
  p99: z.number().optional(),
  logs: z.array(z.string()).optional(),
  activeReplicas: z.number().optional(),
  consumerLag: z.number().optional(),
});

export const SimulatorNodeDataSchema = z
  .object({
    componentType: ComponentTypeSchema,
    category: ComponentCategorySchema,
    config: ComponentConfigSchema,
    metrics: NodeMetricsSchema,
    isSelected: z.boolean().optional(),
  })
  .passthrough();
