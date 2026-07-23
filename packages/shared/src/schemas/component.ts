import { z } from 'zod';

export const ComponentCategorySchema = z.enum([
  'client',
  'traffic-edge',
  'compute',
  'storage',
  'messaging',
  'observability',
  'network',
]);

export const ComponentTypeSchema = z.enum([
  // Clients
  'client',
  'mobile',
  // Traffic & Edge
  'dns',
  'cdn',
  'load-balancer',
  'waf',
  'api-gateway',
  'ingress',
  // Compute
  'app-server',
  'worker',
  'serverless',
  'auth-service',
  'search',
  'scheduler',
  'notifications',
  'analytics',
  // Storage
  'sql-database',
  'nosql-db',
  'cache',
  'object-store',
  'data-warehouse',
  'vector-db',
  // Messaging
  'message-queue',
  'pub-sub',
  'event-stream',
  'kafka',
  // Observability
  'metrics',
  'logs',
  'tracing',
  'alerting',
  'health-check',
  // Network
  'vpc',
  'subnet',
]);

export const ComponentConfigSchema = z.object({
  label: z.string(),
  notes: z.string().optional(),
  replicas: z.number().optional(),
  maxRps: z.number().optional(),
  cpuCores: z.number().optional(),
  ramGb: z.number().optional(),
  storageGb: z.number().optional(),
  cacheHitRate: z.number().optional(),
  connectionPool: z.number().optional(),
  timeoutMs: z.number().optional(),
  rateLimiterEnabled: z.boolean().optional(),
  writeRatio: z.number().optional(),
  errorRate: z.number().optional(),
  circuitBreakerEnabled: z.boolean().optional(),
  cbFailureThreshold: z.number().optional(),
  cbSleepWindowTicks: z.number().optional(),
  clientLatencyMs: z.number().optional(),
  lbAlgorithm: z.enum(['round-robin', 'least-connections']).optional(),
  autoscalingEnabled: z.boolean().optional(),
  maxReplicas: z.number().optional(),
  dbReplication: z.enum(['standalone', 'master-replica']).optional(),
  readWriteSplittingEnabled: z.boolean().optional(),
  evictionPolicy: z.enum(['lru', 'lfu', 'fifo', 'none']).optional(),
  memoryLimitMb: z.number().optional(),
  deliveryGuarantee: z.enum(['at-least-once', 'at-most-once', 'exactly-once']).optional(),
  partitionCount: z.number().optional(),
});
