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
  notes?: string;
  replicas?: number;
  maxRps?: number;
  cpuCores?: number;
  ramGb?: number;
  storageGb?: number;
  cacheHitRate?: number;
  connectionPool?: number;
  timeoutMs?: number;
  rateLimiterEnabled?: boolean;
  writeRatio?: number;
  errorRate?: number;
  circuitBreakerEnabled?: boolean;
  cbFailureThreshold?: number;
  cbSleepWindowTicks?: number;
  clientLatencyMs?: number;
  lbAlgorithm?: 'round-robin' | 'least-connections';
  autoscalingEnabled?: boolean;
  maxReplicas?: number;
  dbReplication?: 'standalone' | 'master-replica';
  readWriteSplittingEnabled?: boolean;
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'none';
  memoryLimitMb?: number;
  deliveryGuarantee?: 'at-least-once' | 'at-most-once' | 'exactly-once';
  partitionCount?: number;
}

export interface EdgeMetrics {
  rps: number;
  readRps?: number;
  writeRps?: number;
  queueSize: number;
  latencyMs: number;
  timeoutsPerSecond: number;
  failuresPerSecond?: number;
  status: 'ok' | 'warning' | 'critical';
  queueWaitTimeMs?: number;
}

export interface SimulatorEdgeData extends Record<string, unknown> {
  metrics?: EdgeMetrics;
  trafficType?: 'all' | 'read' | 'write';
  networkLatencyMs?: number;
  label?: string;
}

export interface NodeMetrics {
  inboundRps: number;
  inboundReadRps?: number;
  inboundWriteRps?: number;
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
  successRps?: number;
  failedRps?: number;
  cbState?: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  cbOpenTimer?: number;
  p50?: number;
  p95?: number;
  p99?: number;
  logs?: string[];
  activeReplicas?: number;
  consumerLag?: number;
}

export interface MetricSnapshot {
  tick: number;
  cpuPct: number;
  ramPct: number;
  latencyMs: number;
  p50?: number;
  p95?: number;
  p99?: number;
  rps: number;
  successRps?: number;
  failedRps?: number;
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
  globalTrafficScale: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  savedAt: string;
}

// === API Types (used by both frontend and backend) ===

export interface ApiProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvas: CanvasData;
  thumbnail: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  provider?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
