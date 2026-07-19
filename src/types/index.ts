export type ComponentCategory =
  | 'client'
  | 'traffic-edge'
  | 'compute'
  | 'storage'
  | 'messaging'
  | 'observability'
  | 'network';

export type ComponentType =
  // Clients
  | 'client'
  | 'mobile'
  // Traffic & Edge
  | 'dns'
  | 'cdn'
  | 'load-balancer'
  | 'waf'
  | 'api-gateway'
  | 'ingress'
  // Compute
  | 'app-server'
  | 'worker'
  | 'serverless'
  | 'auth-service'
  | 'search'
  | 'scheduler'
  | 'notifications'
  | 'analytics'
  // Storage
  | 'sql-database'
  | 'nosql-db'
  | 'cache'
  | 'object-store'
  | 'data-warehouse'
  | 'vector-db'
  // Messaging
  | 'message-queue'
  | 'pub-sub'
  | 'event-stream'
  | 'kafka'
  // Observability
  | 'metrics'
  | 'logs'
  | 'tracing'
  | 'alerting'
  | 'health-check'
  // Network
  | 'vpc'
  | 'subnet';

export type NodeStatus = 'idle' | 'ok' | 'warning' | 'critical';

export interface ComponentConfig {
  label: string;
  replicas?: number;
  maxRps?: number;
  cpuCores?: number;
  ramGb?: number;
  storageGb?: number;
  cacheHitRate?: number; // 0-1, only for cache nodes
  connectionPool?: number; // max concurrent connections (e.g. for database, cache)
  timeoutMs?: number;      // source request timeout limit
  rateLimiterEnabled?: boolean; // semaphore / rate limiter active
  writeRatio?: number;     // 0-1, write ratio of generated traffic (sources only)
}

export interface EdgeMetrics {
  rps: number;
  readRps?: number;  // read component of traffic
  writeRps?: number; // write component of traffic
  queueSize: number;
  latencyMs: number;
  timeoutsPerSecond: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface SimulatorEdgeData extends Record<string, unknown> {
  metrics?: EdgeMetrics;
  trafficType?: 'all' | 'read' | 'write';
}

export interface NodeMetrics {
  inboundRps: number;
  inboundReadRps?: number;  // read component of inbound traffic
  inboundWriteRps?: number; // write component of inbound traffic
  outboundRps: number;
  cpuPct: number;
  ramPct: number;
  storagePct: number;
  latencyMs: number;
  queueDepth: number;
  status: NodeStatus;
  history: MetricSnapshot[];
  endToEndLatencyMs?: number;
  consecutiveOverloadTicks?: number;
  restartCooldownTicks?: number;
}

export interface MetricSnapshot {
  tick: number;
  cpuPct: number;
  ramPct: number;
  latencyMs: number;
  rps: number;
}

export interface Bottleneck {
  nodeId: string;
  nodeLabel: string;
  type: 'cpu' | 'ram' | 'rps' | 'storage';
  severity: 'warning' | 'critical';
  value: number;
  limit: number;
  message: string;
}

export interface SimulatorNodeData extends Record<string, unknown> {
  componentType: ComponentType;
  category: ComponentCategory;
  config: ComponentConfig;
  metrics: NodeMetrics;
  isSelected?: boolean;
}

export type SimulationSpeed = 'slow' | 'normal' | 'fast';

export interface SimulationState {
  running: boolean;
  tick: number;
  speed: SimulationSpeed;
  totalRps: number;
  bottlenecks: Bottleneck[];
  globalTrafficScale: number; // 0% to 500% traffic factor
}

export interface SavedScenario {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  savedAt: string;
}
