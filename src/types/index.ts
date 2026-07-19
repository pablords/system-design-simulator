export type ComponentCategory =
  | 'client'
  | 'network'
  | 'compute'
  | 'cache'
  | 'database'
  | 'messaging'
  | 'storage'
  | 'monitoring';

export type ComponentType =
  | 'web-client'
  | 'mobile-client'
  | 'load-balancer'
  | 'cdn'
  | 'api-gateway'
  | 'app-server'
  | 'microservice'
  | 'redis-cache'
  | 'memcached'
  | 'sql-db'
  | 'nosql-db'
  | 'timeseries-db'
  | 'message-queue'
  | 'event-bus'
  | 'object-storage'
  | 'metrics-collector';

export type NodeStatus = 'idle' | 'ok' | 'warning' | 'critical';

export interface ComponentConfig {
  replicas: number;
  maxRps: number;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  cacheHitRate?: number; // 0-1, only for cache nodes
  label: string;
}

export interface NodeMetrics {
  inboundRps: number;
  outboundRps: number;
  cpuPct: number;
  ramPct: number;
  storagePct: number;
  latencyMs: number;
  queueDepth: number;
  status: NodeStatus;
  history: MetricSnapshot[];
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
}

export interface SavedScenario {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  savedAt: string;
}
