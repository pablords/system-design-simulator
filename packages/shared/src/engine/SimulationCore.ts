import { COMPONENT_DEFINITIONS } from './ComponentModel.js';

const MAX_HISTORY = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeStatus(cpuPct: number, ramPct: number, utilization: number): 'idle' | 'ok' | 'warning' | 'critical' {
  const max = Math.max(cpuPct, ramPct, utilization * 100);
  if (max >= 95) return 'critical';
  if (max >= 80) return 'warning';
  if (max > 0) return 'ok';
  return 'idle';
}

export interface GraphNodeInput {
  id: string;
  data: {
    componentType: string;
    category: string;
    config: Record<string, any>;
    metrics?: any;
  };
}

export interface GraphEdgeInput {
  id: string;
  source: string;
  target: string;
  data?: Record<string, any>;
}

export interface SimulationTickInput {
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
  tick: number;
  globalTrafficScale?: number;
}

export interface SimulationTickResult {
  updatedMetrics: Record<string, any>;
  updatedEdgeMetrics: Record<string, any>;
  bottlenecks: Array<{
    nodeId: string;
    nodeLabel: string;
    type: 'cpu' | 'ram' | 'rps' | 'storage';
    severity: 'warning' | 'critical';
    value: number;
    limit: number;
    message: string;
  }>;
  totalRps: number;
}

export function runSimulationTickCore(input: SimulationTickInput): SimulationTickResult {
  const { nodes, edges, tick, globalTrafficScale = 100 } = input;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency
  const inboundEdges: Record<string, GraphEdgeInput[]> = {};
  const outboundEdges: Record<string, GraphEdgeInput[]> = {};
  for (const edge of edges) {
    if (!inboundEdges[edge.target]) inboundEdges[edge.target] = [];
    if (!outboundEdges[edge.source]) outboundEdges[edge.source] = [];
    inboundEdges[edge.target].push(edge);
    outboundEdges[edge.source].push(edge);
  }

  // Pre-calculate crash states from previous metrics
  const crashCooldowns: Record<string, number> = {};
  const overloadCounters: Record<string, number> = {};
  const crashedNodesSet = new Set<string>();

  // Circuit Breaker state variables
  const cbStateMap: Record<string, 'CLOSED' | 'OPEN' | 'HALF-OPEN'> = {};
  const cbOpenTimerMap: Record<string, number> = {};
  const cbOpenNodesSet = new Set<string>();
  const cbHalfOpenNodesSet = new Set<string>();

  for (const node of nodes) {
    const prev = node.data.metrics;
    const cfg = node.data.config;

    let cooldown = prev?.restartCooldownTicks ?? 0;
    let overload = prev?.consecutiveOverloadTicks ?? 0;

    if (cooldown > 0) {
      cooldown -= 1;
      crashCooldowns[node.id] = cooldown;
      if (cooldown > 0) {
        crashedNodesSet.add(node.id);
      }
    } else {
      crashCooldowns[node.id] = 0;
    }
    overloadCounters[node.id] = overload;

    if (cfg.circuitBreakerEnabled) {
      let state = prev?.cbState ?? 'CLOSED';
      let timer = prev?.cbOpenTimer ?? 0;

      if (state === 'OPEN') {
        if (timer > 0) timer -= 1;
        if (timer <= 0) state = 'HALF-OPEN';
      }

      cbStateMap[node.id] = state;
      cbOpenTimerMap[node.id] = timer;

      if (state === 'OPEN') cbOpenNodesSet.add(node.id);
      else if (state === 'HALF-OPEN') cbHalfOpenNodesSet.add(node.id);
    } else {
      cbStateMap[node.id] = 'CLOSED';
      cbOpenTimerMap[node.id] = 0;
    }
  }

  // Step 1: Nominal BFS propagation of load/RPS (Read & Write separated)
  const inboundRpsMap: Record<string, number> = {};
  const inboundReadRpsMap: Record<string, number> = {};
  const inboundWriteRpsMap: Record<string, number> = {};

  const edgeRpsMap: Record<string, number> = {};
  const edgeReadRpsMap: Record<string, number> = {};
  const edgeWriteRpsMap: Record<string, number> = {};

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (def?.isSource) {
      const totalRps = (node.data.config.maxRps ?? 0) * (node.data.config.replicas ?? 1) * (globalTrafficScale / 100);
      const ratio = node.data.config.writeRatio ?? 0.1;
      inboundRpsMap[node.id] = totalRps;
      inboundReadRpsMap[node.id] = totalRps * (1 - ratio);
      inboundWriteRpsMap[node.id] = totalRps * ratio;
    } else {
      inboundRpsMap[node.id] = 0;
      inboundReadRpsMap[node.id] = 0;
      inboundWriteRpsMap[node.id] = 0;
    }
  }

  const visited = new Set<string>();
  const queue = nodes.filter((n) => COMPONENT_DEFINITIONS[n.data.componentType as keyof typeof COMPONENT_DEFINITIONS]?.isSource).map((n) => n.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    const def = COMPONENT_DEFINITIONS[currentNode.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (!def) continue;

    const inboundRead = inboundReadRpsMap[currentId] ?? 0;
    const inboundWrite = inboundWriteRpsMap[currentId] ?? 0;
    const effectiveMaxRps = (currentNode.data.config.maxRps ?? 0) * (currentNode.data.config.replicas ?? 1);

    let outboundReadRps: number = 0;
    let outboundWriteRps: number = 0;

    if (crashedNodesSet.has(currentId)) {
      outboundReadRps = 0;
      outboundWriteRps = 0;
    } else if (currentNode.data.componentType === 'sql-database' || currentNode.data.componentType === 'nosql-db') {
      outboundReadRps = 0;
      outboundWriteRps = inboundWrite;
    } else if (def.isSink) {
      outboundReadRps = 0;
      outboundWriteRps = 0;
    } else {
      if (currentNode.data.config.cacheHitRate !== undefined) {
        let hitRate = currentNode.data.config.cacheHitRate;
        if (currentNode.data.componentType === 'cache') {
          const memoryLimit = currentNode.data.config.memoryLimitMb ?? 512;
          const policy = currentNode.data.config.evictionPolicy ?? 'lru';

          if (inboundWrite > 0 && memoryLimit > 0) {
            const loadRatio = inboundWrite / memoryLimit;
            let penalty = 0;
            if (policy === 'fifo') penalty = clamp(loadRatio * 2, 0, 0.6);
            else if (policy === 'lru') penalty = clamp(Math.log10(loadRatio + 1) * 0.5, 0, 0.3);
            else if (policy === 'lfu') penalty = clamp(Math.log10(loadRatio + 1) * 0.7, 0, 0.4);
            else if (policy === 'none') penalty = clamp(loadRatio * 5, 0, 0.95);
            hitRate = clamp(hitRate - penalty, 0.05, 1.0);
          }
        }
        outboundReadRps = inboundRead * (1 - hitRate);
        outboundWriteRps = inboundWrite;
      } else {
        outboundReadRps = inboundRead;
        outboundWriteRps = inboundWrite;
      }

      if (currentNode.data.config.rateLimiterEnabled) {
        const outboundTotalRaw = outboundReadRps + outboundWriteRps;
        if (outboundTotalRaw > effectiveMaxRps && outboundTotalRaw > 0) {
          const scale = effectiveMaxRps / outboundTotalRaw;
          outboundReadRps *= scale;
          outboundWriteRps *= scale;
        }
      }
    }

    const outEdges = outboundEdges[currentId] ?? [];
    if (outEdges.length > 0) {
      const businessEdges = outEdges.filter((e) => {
        const tgt = nodeMap.get(e.target);
        return tgt?.data.category !== 'observability';
      });
      const telemetryEdges = outEdges.filter((e) => {
        const tgt = nodeMap.get(e.target);
        return tgt?.data.category === 'observability';
      });

      const readEdges = businessEdges.filter((e) => !e.data?.trafficType || e.data.trafficType === 'all' || e.data.trafficType === 'read');
      const writeEdges = businessEdges.filter((e) => !e.data?.trafficType || e.data.trafficType === 'all' || e.data.trafficType === 'write');

      const isLeastConn = currentNode.data.componentType === 'load-balancer' && currentNode.data.config.lbAlgorithm === 'least-connections';

      let readRpsPerEdge = 0;
      let writeRpsPerEdge = 0;
      let totalReadWeight = 0;
      const readWeightsMap: Record<string, number> = {};
      let totalWriteWeight = 0;
      const writeWeightsMap: Record<string, number> = {};

      if (isLeastConn) {
        for (const edge of readEdges) {
          const tgtCpu = nodeMap.get(edge.target)?.data.metrics?.cpuPct ?? 15;
          const weight = 1 / (tgtCpu + 1);
          readWeightsMap[edge.id] = weight;
          totalReadWeight += weight;
        }
        for (const edge of writeEdges) {
          const tgtCpu = nodeMap.get(edge.target)?.data.metrics?.cpuPct ?? 15;
          const weight = 1 / (tgtCpu + 1);
          writeWeightsMap[edge.id] = weight;
          totalWriteWeight += weight;
        }
      } else {
        readRpsPerEdge = readEdges.length > 0 ? outboundReadRps / readEdges.length : 0;
        writeRpsPerEdge = writeEdges.length > 0 ? outboundWriteRps / writeEdges.length : 0;
      }

      for (const edge of businessEdges) {
        let edgeRead = 0;
        let edgeWrite = 0;

        const isReadAllowed = !edge.data?.trafficType || edge.data.trafficType === 'all' || edge.data.trafficType === 'read';
        const isWriteAllowed = !edge.data?.trafficType || edge.data.trafficType === 'all' || edge.data.trafficType === 'write';

        if (isReadAllowed) {
          if (isLeastConn) {
            edgeRead = totalReadWeight > 0 ? outboundReadRps * (readWeightsMap[edge.id] / totalReadWeight) : outboundReadRps / (readEdges.length || 1);
          } else {
            edgeRead = readRpsPerEdge;
          }
        }
        if (isWriteAllowed) {
          if (isLeastConn) {
            edgeWrite = totalWriteWeight > 0 ? outboundWriteRps * (writeWeightsMap[edge.id] / totalWriteWeight) : outboundWriteRps / (writeEdges.length || 1);
          } else {
            edgeWrite = writeRpsPerEdge;
          }
        }

        const edgeTotal = edgeRead + edgeWrite;
        edgeRpsMap[edge.id] = edgeTotal;
        edgeReadRpsMap[edge.id] = edgeRead;
        edgeWriteRpsMap[edge.id] = edgeWrite;

        inboundRpsMap[edge.target] = (inboundRpsMap[edge.target] ?? 0) + edgeTotal;
        inboundReadRpsMap[edge.target] = (inboundReadRpsMap[edge.target] ?? 0) + edgeRead;
        inboundWriteRpsMap[edge.target] = (inboundWriteRpsMap[edge.target] ?? 0) + edgeWrite;

        if (!visited.has(edge.target)) queue.push(edge.target);
      }

      for (const edge of telemetryEdges) {
        const tgt = nodeMap.get(edge.target);
        const tgtType = tgt?.data.componentType;

        let teleRps = 0;
        if (tgtType === 'metrics' || tgtType === 'logs') {
          teleRps = inboundRead + inboundWrite;
        } else if (tgtType === 'tracing') {
          teleRps = (inboundRead + inboundWrite) * 0.1;
        } else if (tgtType === 'alerting' || tgtType === 'health-check') {
          teleRps = 1;
        }

        const ratio = inboundRead + inboundWrite > 0 ? inboundWrite / (inboundRead + inboundWrite) : 0.1;
        const edgeWrite = teleRps * ratio;
        const edgeRead = teleRps * (1 - ratio);

        edgeRpsMap[edge.id] = teleRps;
        edgeReadRpsMap[edge.id] = edgeRead;
        edgeWriteRpsMap[edge.id] = edgeWrite;

        inboundRpsMap[edge.target] = (inboundRpsMap[edge.target] ?? 0) + teleRps;
        inboundReadRpsMap[edge.target] = (inboundReadRpsMap[edge.target] ?? 0) + edgeRead;
        inboundWriteRpsMap[edge.target] = (inboundWriteRpsMap[edge.target] ?? 0) + edgeWrite;

        if (!visited.has(edge.target)) queue.push(edge.target);
      }
    }
  }

  // Step 2: Connection Pool and Timeout calculations per target node
  const updatedEdgeMetrics: Record<string, any> = {};
  const edgeTimeoutsMap: Record<string, number> = {};
  const edgeFailuresMap: Record<string, number> = {};
  const edgeQueuesMap: Record<string, number> = {};
  const edgeWaitTimeMap: Record<string, number> = {};

  for (const edge of edges) {
    edgeWaitTimeMap[edge.id] = 0;
    edgeFailuresMap[edge.id] = 0;
    edgeTimeoutsMap[edge.id] = 0;
  }

  function getActiveReplicas(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 1;
    const cfg = node.data.config;
    const prevMetrics = node.data.metrics;
    const isComputeNode = node.data.componentType === 'app-server' || node.data.componentType === 'worker';
    let activeReplicas = prevMetrics?.activeReplicas ?? cfg.replicas ?? 1;

    if (cfg.autoscalingEnabled && isComputeNode) {
      const maxRep = cfg.maxReplicas ?? 10;
      const minRep = cfg.replicas ?? 1;
      const prevUtil = prevMetrics ? prevMetrics.inboundRps / ((cfg.maxRps ?? 500) * activeReplicas) : 0;

      if (prevUtil > 0.8 && activeReplicas < maxRep) {
        activeReplicas += 1;
      } else if (prevUtil < 0.3 && activeReplicas > minRep) {
        activeReplicas -= 1;
      }
    } else {
      activeReplicas = cfg.replicas ?? 1;
    }
    return activeReplicas;
  }

  function estimateNodeLatency(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (!def) return 0;
    const cfg = node.data.config;
    const inbound = inboundRpsMap[node.id] ?? 0;
    const effectiveMaxRps = (cfg.maxRps ?? 0) * (cfg.replicas ?? 1);
    const utilization = effectiveMaxRps > 0 ? clamp(inbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;
    return def.baseLatencyMs * (1 + overloadFactor * 3);
  }

  // Apply Bulkhead limit on connection links (edges)
  for (const edge of edges) {
    const bulkheadLimit = edge.data?.bulkheadLimit;
    if (edge.data?.bulkheadEnabled && bulkheadLimit !== undefined && bulkheadLimit > 0) {
      const sourceActiveReplicas = getActiveReplicas(edge.source);
      const effectiveBulkhead = bulkheadLimit * sourceActiveReplicas;

      const edgeRps = edgeRpsMap[edge.id] ?? 0;
      const targetLatency = estimateNodeLatency(edge.target);
      const callLatency = targetLatency + (edge.data?.networkLatencyMs ?? 0);
      const requestedConcurrency = edgeRps * (callLatency / 1000);

      if (requestedConcurrency > effectiveBulkhead) {
        const allowedRps = callLatency > 0 ? (effectiveBulkhead * 1000) / callLatency : edgeRps;
        const failures = Math.max(0, edgeRps - allowedRps);
        
        edgeRpsMap[edge.id] = allowedRps;
        edgeReadRpsMap[edge.id] = edgeRps > 0 ? (edgeReadRpsMap[edge.id] ?? 0) * (allowedRps / edgeRps) : 0;
        edgeWriteRpsMap[edge.id] = edgeRps > 0 ? (edgeWriteRpsMap[edge.id] ?? 0) * (allowedRps / edgeRps) : 0;
        edgeFailuresMap[edge.id] = (edgeFailuresMap[edge.id] ?? 0) + failures;
      }
    }
  }

  // Recalculate inbound maps based on bulkhead outcomes to protect target nodes
  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (def?.isSource) {
      // Keep source node inbound as is
    } else {
      inboundRpsMap[node.id] = 0;
      inboundReadRpsMap[node.id] = 0;
      inboundWriteRpsMap[node.id] = 0;
    }
  }

  for (const edge of edges) {
    const edgeTotal = edgeRpsMap[edge.id] ?? 0;
    const edgeRead = edgeReadRpsMap[edge.id] ?? 0;
    const edgeWrite = edgeWriteRpsMap[edge.id] ?? 0;

    inboundRpsMap[edge.target] = (inboundRpsMap[edge.target] ?? 0) + edgeTotal;
    inboundReadRpsMap[edge.target] = (inboundReadRpsMap[edge.target] ?? 0) + edgeRead;
    inboundWriteRpsMap[edge.target] = (inboundWriteRpsMap[edge.target] ?? 0) + edgeWrite;
  }

  for (const node of nodes) {
    const targetInEdges = inboundEdges[node.id] ?? [];
    if (targetInEdges.length === 0) continue;

    const cfg = node.data.config;
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (!def) continue;

    const inbound = inboundRpsMap[node.id] ?? 0;
    const effectiveMaxRps = (cfg.maxRps ?? 0) * (cfg.replicas ?? 1);
    const utilization = effectiveMaxRps > 0 ? clamp(inbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;
    const latencyMs = def.baseLatencyMs * (1 + overloadFactor * 3);

    if (crashedNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        edgeFailuresMap[edge.id] = edgeRpsMap[edge.id] ?? 0;
        edgeTimeoutsMap[edge.id] = 0;
        edgeQueuesMap[edge.id] = 0;
        edgeWaitTimeMap[edge.id] = 0;
        edgeRpsMap[edge.id] = 0;
        edgeReadRpsMap[edge.id] = 0;
        edgeWriteRpsMap[edge.id] = 0;
      }
      continue;
    }

    if (cbOpenNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        edgeFailuresMap[edge.id] = edgeRpsMap[edge.id] ?? 0;
        edgeTimeoutsMap[edge.id] = 0;
        edgeQueuesMap[edge.id] = 0;
        edgeWaitTimeMap[edge.id] = 0;
        edgeRpsMap[edge.id] = 0;
        edgeReadRpsMap[edge.id] = 0;
        edgeWriteRpsMap[edge.id] = 0;
      }
      continue;
    }

    if (cbHalfOpenNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        const edgeRps = edgeRpsMap[edge.id] ?? 0;
        edgeFailuresMap[edge.id] = edgeRps * 0.8;
        edgeRpsMap[edge.id] = edgeRps * 0.2;
        edgeReadRpsMap[edge.id] = (edgeReadRpsMap[edge.id] ?? 0) * 0.2;
        edgeWriteRpsMap[edge.id] = (edgeWriteRpsMap[edge.id] ?? 0) * 0.2;
      }
    }

    if (cfg.connectionPool !== undefined) {
      const dbMaxConns = cfg.connectionPool * (cfg.replicas ?? 1);
      
      const clientQueueSizes: Record<string, number> = {};
      const clientWaitTimes: Record<string, number> = {};
      const clientTimeouts: Record<string, number> = {};
      const attemptedConnsMap: Record<string, number> = {};
      const attemptedRpsMap: Record<string, number> = {};
      
      let totalAttemptedConns = 0;

      for (const edge of targetInEdges) {
        const source = nodeMap.get(edge.source);
        const sourceActiveReplicas = getActiveReplicas(edge.source);
        const clientPoolLimit = (source?.data.config.connectionPool ?? 100) * sourceActiveReplicas;

        const edgeRps = edgeRpsMap[edge.id] ?? 0;
        const requested = edgeRps * (latencyMs / 1000);

        let queueSize = 0;
        let waitTimeMs = 0;
        let timeoutsPerSecond = 0;

        if (requested > clientPoolLimit) {
          queueSize = Math.max(0, requested - clientPoolLimit);
          const waitSec = clientPoolLimit > 0 ? (queueSize * (latencyMs / 1000)) / clientPoolLimit : 0;
          waitTimeMs = waitSec * 1000;

          const sourceTimeoutMs = source?.data.config.timeoutMs ?? 1000;
          if (waitTimeMs > sourceTimeoutMs) {
            const timeoutRatio = Math.min(1, (waitTimeMs - sourceTimeoutMs) / waitTimeMs);
            timeoutsPerSecond = edgeRps * timeoutRatio;
          }
        }

        clientQueueSizes[edge.id] = queueSize;
        clientWaitTimes[edge.id] = waitTimeMs;
        clientTimeouts[edge.id] = timeoutsPerSecond;

        const attemptedRps = Math.max(0, edgeRps - timeoutsPerSecond);
        const attemptedConns = attemptedRps * (latencyMs / 1000);
        attemptedConnsMap[edge.id] = attemptedConns;
        attemptedRpsMap[edge.id] = attemptedRps;
        totalAttemptedConns += attemptedConns;
      }

      const saturationRatio = totalAttemptedConns > dbMaxConns ? dbMaxConns / totalAttemptedConns : 1.0;

      for (const edge of targetInEdges) {
        const attemptedRps = attemptedRpsMap[edge.id] ?? 0;
        const timeoutsPerSecond = clientTimeouts[edge.id] ?? 0;
        const originalEdgeRps = edgeRpsMap[edge.id] ?? 0;

        const successfulRps = attemptedRps * saturationRatio;
        const refusedRps = attemptedRps * (1 - saturationRatio);

        edgeQueuesMap[edge.id] = clientQueueSizes[edge.id] ?? 0;
        edgeTimeoutsMap[edge.id] = timeoutsPerSecond;
        edgeWaitTimeMap[edge.id] = clientWaitTimes[edge.id] ?? 0;
        edgeFailuresMap[edge.id] = (edgeFailuresMap[edge.id] ?? 0) + refusedRps;

        edgeRpsMap[edge.id] = successfulRps;

        if (originalEdgeRps > 0) {
          const scale = successfulRps / originalEdgeRps;
          edgeReadRpsMap[edge.id] = (edgeReadRpsMap[edge.id] ?? 0) * scale;
          edgeWriteRpsMap[edge.id] = (edgeWriteRpsMap[edge.id] ?? 0) * scale;
        }
      }
    }
  }

  // Recalculate node inbound RPS based on successful requests
  const finalInboundRpsMap: Record<string, number> = {};
  const finalInboundReadRpsMap: Record<string, number> = {};
  const finalInboundWriteRpsMap: Record<string, number> = {};

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (def?.isSource) {
      const totalRps = (node.data.config.maxRps ?? 0) * (node.data.config.replicas ?? 1) * (globalTrafficScale / 100);
      const ratio = node.data.config.writeRatio ?? 0.1;
      finalInboundRpsMap[node.id] = totalRps;
      finalInboundReadRpsMap[node.id] = totalRps * (1 - ratio);
      finalInboundWriteRpsMap[node.id] = totalRps * ratio;
    } else {
      finalInboundRpsMap[node.id] = 0;
      finalInboundReadRpsMap[node.id] = 0;
      finalInboundWriteRpsMap[node.id] = 0;
    }
  }

  const visited2 = new Set<string>();
  const queue2 = nodes.filter((n) => COMPONENT_DEFINITIONS[n.data.componentType as keyof typeof COMPONENT_DEFINITIONS]?.isSource).map((n) => n.id);

  while (queue2.length > 0) {
    const currentId = queue2.shift()!;
    if (visited2.has(currentId)) continue;
    visited2.add(currentId);

    const outEdges = outboundEdges[currentId] ?? [];
    for (const edge of outEdges) {
      const finalEdgeRps = edgeRpsMap[edge.id] ?? 0;
      const finalEdgeRead = edgeReadRpsMap[edge.id] ?? 0;
      const finalEdgeWrite = edgeWriteRpsMap[edge.id] ?? 0;

      finalInboundRpsMap[edge.target] = (finalInboundRpsMap[edge.target] ?? 0) + finalEdgeRps;
      finalInboundReadRpsMap[edge.target] = (finalInboundReadRpsMap[edge.target] ?? 0) + finalEdgeRead;
      finalInboundWriteRpsMap[edge.target] = (finalInboundWriteRpsMap[edge.target] ?? 0) + finalEdgeWrite;

      if (!visited2.has(edge.target)) queue2.push(edge.target);
    }
  }

  // Now compute final node metrics
  const updatedMetrics: Record<string, any> = {};
  const bottlenecks: SimulationTickResult['bottlenecks'] = [];
  let totalRps = 0;

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType as keyof typeof COMPONENT_DEFINITIONS];
    if (!def) continue;

    const cfg = node.data.config;
    const prevMetrics = node.data.metrics;

    if (crashedNodesSet.has(node.id)) {
      const cooldown = crashCooldowns[node.id];
      const nominalInbound = inboundRpsMap[node.id] ?? 0;
      const snapshot = {
        tick,
        cpuPct: 10,
        ramPct: 20,
        latencyMs: 0,
        rps: 0,
        successRps: 0,
        failedRps: Math.round(nominalInbound),
      };
      const history = [...(prevMetrics?.history ?? []), snapshot].slice(-MAX_HISTORY);

      updatedMetrics[node.id] = {
        inboundRps: 0,
        inboundReadRps: 0,
        inboundWriteRps: 0,
        outboundRps: 0,
        cpuPct: 10,
        ramPct: 20,
        storagePct: prevMetrics?.storagePct ?? 0,
        latencyMs: 0,
        queueDepth: 0,
        status: 'critical',
        history,
        consecutiveOverloadTicks: 0,
        restartCooldownTicks: cooldown,
        endToEndLatencyMs: 0,
        successRps: 0,
        failedRps: Math.round(nominalInbound),
        cbState: cbStateMap[node.id],
        cbOpenTimer: cbOpenTimerMap[node.id],
      };

      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'cpu',
        severity: 'critical',
        value: 100,
        limit: 100,
        message: `SERVER CRASHED: Restarting... Failover in progress (${cooldown} ticks left)`,
      });

      continue;
    }

    const inbound = finalInboundRpsMap[node.id] ?? 0;
    const inboundRead = finalInboundReadRpsMap[node.id] ?? 0;
    const inboundWrite = finalInboundWriteRpsMap[node.id] ?? 0;

    let partitionLimit = Infinity;
    let bottleneckQueueLabel = '';
    if (node.data.componentType === 'worker') {
      const inboundEdgesList = inboundEdges[node.id] ?? [];
      for (const edge of inboundEdgesList) {
        const srcNode = nodeMap.get(edge.source);
        if (srcNode && (srcNode.data.componentType === 'message-queue' || srcNode.data.componentType === 'kafka')) {
          const partitions = srcNode.data.config.partitionCount ?? 4;
          if (partitions < partitionLimit) {
            partitionLimit = partitions;
            bottleneckQueueLabel = srcNode.data.config.label;
          }
        }
      }
    }

    const isComputeNode = node.data.componentType === 'app-server' || node.data.componentType === 'worker';
    let activeReplicas = prevMetrics?.activeReplicas ?? cfg.replicas ?? 1;

    if (cfg.autoscalingEnabled && isComputeNode) {
      const maxRep = cfg.maxReplicas ?? 10;
      const minRep = cfg.replicas ?? 1;
      const prevUtil = prevMetrics ? prevMetrics.inboundRps / ((cfg.maxRps ?? 500) * activeReplicas) : 0;

      if (prevUtil > 0.8 && activeReplicas < maxRep) {
        activeReplicas += 1;
      } else if (prevUtil < 0.3 && activeReplicas > minRep) {
        activeReplicas -= 1;
      }
    } else {
      activeReplicas = cfg.replicas ?? 1;
    }

    let scaledReplicas = activeReplicas;
    if (partitionLimit < activeReplicas) {
      scaledReplicas = partitionLimit;

      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'cpu',
        severity: 'warning',
        value: activeReplicas,
        limit: partitionLimit,
        message: `Paralelismo limitado: ${activeReplicas} Workers ativos, mas a fila "${bottleneckQueueLabel}" possui apenas ${partitionLimit} partições. Os outros ${activeReplicas - partitionLimit} Workers estão ociosos!`,
      });
    }

    const effectiveMaxRps = (cfg.maxRps ?? 0) * scaledReplicas;

    const rateLimitFailures = cfg.rateLimiterEnabled && inbound > effectiveMaxRps ? Math.max(0, inbound - effectiveMaxRps) : 0;

    const effectiveInbound = cfg.rateLimiterEnabled ? Math.min(inbound, effectiveMaxRps) : inbound;

    const utilization = effectiveMaxRps > 0 ? clamp(effectiveInbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;

    let cpuPct = clamp(def.baseCpuPct * utilization + overloadFactor * 10, 0, 100);
    
    let ramPct = 0;
    let cacheOomWriteErrors = 0;
    let cacheThrashingHitRatePenalty = 0;

    if (node.data.componentType === 'cache') {
      const prevRam = prevMetrics?.ramPct ?? def.baseRamPct;
      const memLimit = cfg.memoryLimitMb ?? 512;
      const growth = (inboundWrite * 2.0 / memLimit) * 100;
      ramPct = clamp(prevRam + growth, def.baseRamPct, 100);

      if (ramPct >= 100) {
        ramPct = 100;
        if (cfg.evictionPolicy === 'none') {
          cacheOomWriteErrors = inboundWrite;
        } else {
          cacheThrashingHitRatePenalty = clamp((inboundWrite / memLimit) * 0.5, 0, 0.5);
        }
      }
    } else {
      ramPct = clamp(def.baseRamPct + utilization * (100 - def.baseRamPct) * 0.5, 0, 100);
    }

    const prevQueue = prevMetrics?.queueDepth ?? 0;
    const nodeTimeoutMs = cfg.timeoutMs ?? 5000;
    let queueDepth = 0;
    let queueTimeouts = 0;

    if (!def.isSource && !def.isSink) {
      if (utilization > 1) {
        const queueChange = effectiveInbound - effectiveMaxRps;
        queueDepth = prevQueue + queueChange;
      } else {
        const excessCapacity = effectiveMaxRps - effectiveInbound;
        queueDepth = Math.max(0, prevQueue - excessCapacity);
      }

      queueDepth = Math.min(Math.max(0, queueDepth), effectiveMaxRps * 50);

      if (effectiveMaxRps > 0) {
        const safeSlots = (nodeTimeoutMs / 1000) * effectiveMaxRps;
        if (queueDepth > safeSlots) {
          const expiredThisTick = (queueDepth - safeSlots) * 0.4;
          queueTimeouts = Math.round(expiredThisTick);
          queueDepth = queueDepth - expiredThisTick;
        }
      }
    }
    queueDepth = Math.round(Math.max(0, queueDepth));

    const queuingDelayMs = queueDepth > 0 && effectiveMaxRps > 0 ? (queueDepth / effectiveMaxRps) * 1000 : 0;
    const baseLatency = def.isSource && cfg.clientLatencyMs !== undefined ? cfg.clientLatencyMs : def.baseLatencyMs;
    const latencyMs = baseLatency * (1 + overloadFactor * 3) + queuingDelayMs;

    const prevStoragePct = prevMetrics?.storagePct ?? 0;
    let storagePct = prevStoragePct;
    if (def.accumulatesStorage && cfg.storageGb && cfg.storageGb > 0) {
      const storageGrowthPerTick = (inboundWrite * 5.0) / cfg.storageGb;
      storagePct = clamp(prevStoragePct + storageGrowthPerTick, 0, 100);
    }

    const outboundTargets = outboundEdges[node.id] ?? [];
    let outboundRead: number;
    let outboundWrite: number;

    if (def.isSink) {
      outboundRead = 0;
      outboundWrite = 0;
    } else {
      if (cfg.cacheHitRate !== undefined) {
        let hitRate = cfg.cacheHitRate;
        if (node.data.componentType === 'cache') {
          const memoryLimit = cfg.memoryLimitMb ?? 512;
          const policy = cfg.evictionPolicy ?? 'lru';

          if (inboundWrite > 0 && memoryLimit > 0) {
            const loadRatio = inboundWrite / memoryLimit;
            let penalty = cacheThrashingHitRatePenalty;
            if (policy === 'fifo') penalty += clamp(loadRatio * 2, 0, 0.6);
            else if (policy === 'lru') penalty += clamp(Math.log10(loadRatio + 1) * 0.5, 0, 0.3);
            else if (policy === 'lfu') penalty += clamp(Math.log10(loadRatio + 1) * 0.7, 0, 0.4);
            else if (policy === 'none') penalty += clamp(loadRatio * 5, 0, 0.95);
            hitRate = clamp(hitRate - penalty, 0.05, 1.0);
          }
        }
        outboundRead = inboundRead * (1 - hitRate);
        outboundWrite = inboundWrite;
      } else {
        outboundRead = inboundRead;
        outboundWrite = inboundWrite;
      }
    }

    const injectedErrorRate = cfg.errorRate ?? 0;
    const injectedErrors = inbound * injectedErrorRate;
    const overloadFailureRate = utilization > 1 && !cfg.rateLimiterEnabled ? clamp((utilization - 1) * 0.5, 0, 0.8) : 0;
    const overloadErrors = inbound * overloadFailureRate;

    let deliveryErrors = 0;
    if (node.data.componentType === 'message-queue' || node.data.componentType === 'kafka') {
      const guarantee = cfg.deliveryGuarantee ?? 'at-least-once';
      if (guarantee === 'at-most-once' && inbound > 1000) {
        deliveryErrors = inbound * 0.01;
      }
    }

    const isDbReplicated = cfg.dbReplication === 'master-replica' && cfg.readWriteSplittingEnabled;

    let localFailures = 0;
    let localSuccess = 0;

    if (crashedNodesSet.has(node.id)) {
      if (isDbReplicated) {
        localFailures = inboundWrite;
        localSuccess = inboundRead;
        outboundRead = inboundRead;
        outboundWrite = 0;
      } else {
        localFailures = inbound;
        localSuccess = 0;
        outboundRead = 0;
        outboundWrite = 0;
      }
    } else {
      localFailures = Math.min(inbound, injectedErrors + overloadErrors + queueTimeouts + rateLimitFailures + deliveryErrors);
      localSuccess = Math.max(0, inbound - localFailures);
    }

    if (!crashedNodesSet.has(node.id) && storagePct >= 100) {
      const baseFailures = localFailures;
      localFailures = Math.min(inbound, baseFailures + inboundWrite);
      localSuccess = Math.max(0, inbound - localFailures);
      outboundWrite = 0;
    }

    if (!crashedNodesSet.has(node.id) && cacheOomWriteErrors > 0) {
      const baseFailures = localFailures;
      localFailures = Math.min(inbound, baseFailures + cacheOomWriteErrors);
      localSuccess = Math.max(0, inbound - localFailures);
      outboundWrite = 0;
    }

    const processSuccessRatio = inbound > 0 ? localSuccess / inbound : 1.0;

    if (!crashedNodesSet.has(node.id) || !isDbReplicated) {
      outboundRead *= processSuccessRatio;
      outboundWrite *= processSuccessRatio;
    }
    let outboundRps = outboundRead + outboundWrite;
    if (outboundTargets.length === 0) outboundRps = 0;

    let cbState = cbStateMap[node.id];
    let cbOpenTimer = cbOpenTimerMap[node.id];

    if (cfg.circuitBreakerEnabled) {
      const nodeInboundEdges = inboundEdges[node.id] ?? [];
      const incomingTimeouts = nodeInboundEdges.reduce((sum: number, edge: GraphEdgeInput) => sum + (edgeTimeoutsMap[edge.id] ?? 0), 0);

      if (cbState === 'CLOSED') {
        const totalRequests = inbound + incomingTimeouts;
        const totalFailures = localFailures + incomingTimeouts;
        const failureRate = totalRequests > 0 ? totalFailures / totalRequests : 0;

        if (totalRequests >= 10 && failureRate > (cfg.cbFailureThreshold ?? 0.5)) {
          cbState = 'OPEN';
          cbOpenTimer = cfg.cbSleepWindowTicks ?? 5;
          cbOpenTimerMap[node.id] = cbOpenTimer;
        }
      } else if (cbState === 'HALF-OPEN') {
        if (inbound > 0) {
          const trialFailRate = localFailures / inbound;
          if (trialFailRate > (cfg.cbFailureThreshold ?? 0.5) || localFailures > 0) {
            cbState = 'OPEN';
            cbOpenTimer = cfg.cbSleepWindowTicks ?? 5;
            cbOpenTimerMap[node.id] = cbOpenTimer;
          } else {
            cbState = 'CLOSED';
            cbOpenTimer = 0;
          }
        }
      }
      cbStateMap[node.id] = cbState;
    }

    let overloadTicks = overloadCounters[node.id] ?? 0;
    let isNowCrashing = false;
    let restartCooldown = 0;

    const isOverloaded = cpuPct >= 99 || ramPct >= 99;
    if (isOverloaded && !def.isSource && !def.isSink) {
      overloadTicks += 1;
      if (overloadTicks >= 3) {
        isNowCrashing = true;
        restartCooldown = 3;
        cpuPct = 10;
        ramPct = 20;
        overloadTicks = 0;
      }
    } else {
      overloadTicks = 0;
    }

    let status = isNowCrashing ? 'critical' : computeStatus(cpuPct, ramPct, utilization);
    if (storagePct >= 100) {
      status = 'critical';
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'storage',
        severity: 'critical',
        value: 100,
        limit: 100,
        message: `STORAGE FULL: ${cfg.label} atingiu 100% da capacidade (${cfg.storageGb} GB). Todas as novas escritas estão sendo rejeitadas!`,
      });
    } else if (storagePct >= 80) {
      status = 'warning';
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'storage',
        severity: 'warning',
        value: Math.round(storagePct),
        limit: 100,
        message: `Espaço em disco reduzido: ${cfg.label} está com ${Math.round(storagePct)}% do armazenamento ocupado.`,
      });
    }

    if (node.data.componentType === 'cache') {
      if (ramPct >= 100) {
        status = 'critical';
        if (cfg.evictionPolicy === 'none') {
          bottlenecks.push({
            nodeId: node.id,
            nodeLabel: cfg.label,
            type: 'ram',
            severity: 'critical',
            value: 100,
            limit: 100,
            message: `CACHE OOM: ${cfg.label} sem política de evicção atingiu 100% de memória. Novas escritas estão sendo rejeitadas!`,
          });
        } else {
          bottlenecks.push({
            nodeId: node.id,
            nodeLabel: cfg.label,
            type: 'ram',
            severity: 'warning',
            value: 100,
            limit: 100,
            message: `CACHE SATURADO: ${cfg.label} atingiu 100% de memória. Evicção ativa (${cfg.evictionPolicy?.toUpperCase()}) gerando degradação de Hit Rate (cache thrashing).`,
          });
        }
      } else if (ramPct >= 80) {
        status = 'warning';
        bottlenecks.push({
          nodeId: node.id,
          nodeLabel: cfg.label,
          type: 'ram',
          severity: 'warning',
          value: Math.round(ramPct),
          limit: 100,
          message: `Uso de memória alto no Cache: ${cfg.label} está com ${Math.round(ramPct)}% da memória ocupada.`,
        });
      }
    }

    const jitter = utilization > 1 ? (utilization - 1) * 0.4 : 0.05;
    const p50 = Math.round(latencyMs * 0.9 * 10) / 10;
    const p95 = Math.round(latencyMs * (1.2 + jitter * 2) * 10) / 10;
    const p99 = Math.round(latencyMs * (1.5 + jitter * 5) * 10) / 10;

    const snapshot = {
      tick,
      cpuPct: Math.round(cpuPct),
      ramPct: Math.round(ramPct),
      latencyMs: Math.round(latencyMs * 10) / 10,
      p50,
      p95,
      p99,
      rps: Math.round(inbound),
      successRps: Math.round(localSuccess),
      failedRps: Math.round(localFailures),
    };
    const history = [...(prevMetrics?.history ?? []), snapshot].slice(-MAX_HISTORY);

    updatedMetrics[node.id] = {
      inboundRps: Math.round(inbound),
      inboundReadRps: Math.round(inboundRead),
      inboundWriteRps: Math.round(inboundWrite),
      outboundRps: Math.round(outboundRps),
      cpuPct: Math.round(cpuPct),
      ramPct: Math.round(ramPct),
      storagePct: Math.round(storagePct * 10) / 10,
      latencyMs: Math.round(latencyMs * 10) / 10,
      queueDepth,
      status,
      history,
      consecutiveOverloadTicks: overloadTicks,
      restartCooldownTicks: restartCooldown,
      successRps: Math.round(localSuccess),
      failedRps: Math.round(localFailures),
      cbState,
      cbOpenTimer,
      p50,
      p95,
      p99,
      activeReplicas: scaledReplicas,
    };

    if (def.isSource) {
      totalRps += inbound;
    }
  }

  // Backward failure propagation (Cascading Failures from Sinks/Targets to Sources/Callers)
  const nodeTotalFailures: Record<string, number> = {};
  const nodeTotalSuccess: Record<string, number> = {};

  for (const node of nodes) {
    nodeTotalFailures[node.id] = updatedMetrics[node.id]?.failedRps ?? 0;
    nodeTotalSuccess[node.id] = updatedMetrics[node.id]?.successRps ?? 0;
  }

  const reverseOrder = Array.from(visited).reverse();
  for (const nodeId of reverseOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const inbound = inboundRpsMap[nodeId] ?? 0;
    const failures = nodeTotalFailures[nodeId] ?? 0;
    const failureRatio = inbound > 0 ? clamp(failures / inbound, 0, 1) : 0;

    if (failureRatio > 0) {
      const nodeInEdges = inboundEdges[nodeId] ?? [];
      for (const edge of nodeInEdges) {
        const edgeRps = edgeRpsMap[edge.id] ?? 0;
        const additionalFailures = edgeRps * failureRatio;

        edgeFailuresMap[edge.id] = (edgeFailuresMap[edge.id] ?? 0) + additionalFailures;
        edgeRpsMap[edge.id] = Math.max(0, edgeRps - additionalFailures);

        if (nodeTotalFailures[edge.source] !== undefined) {
          nodeTotalFailures[edge.source] += additionalFailures;
          nodeTotalSuccess[edge.source] = Math.max(0, nodeTotalSuccess[edge.source] - additionalFailures);
        }
      }
    }
  }

  // Update node final metrics and history with cascading failure results
  for (const node of nodes) {
    if (updatedMetrics[node.id]) {
      const finalFailures = Math.round(nodeTotalFailures[node.id]);
      const finalSuccess = Math.round(nodeTotalSuccess[node.id]);
      updatedMetrics[node.id].failedRps = finalFailures;
      updatedMetrics[node.id].successRps = finalSuccess;

      const history = updatedMetrics[node.id].history;
      if (history && history.length > 0) {
        const lastSnapshot = history[history.length - 1];
        if (lastSnapshot) {
          lastSnapshot.failedRps = finalFailures;
          lastSnapshot.successRps = finalSuccess;
        }
      }
    }
  }

  // Compute end-to-end latency for each node
  const e2eCache = new Map<string, number>();
  const visiting = new Set<string>();

  function getEndToEndLatency(nodeId: string): number {
    if (e2eCache.has(nodeId)) return e2eCache.get(nodeId)!;
    if (visiting.has(nodeId)) {
      return updatedMetrics[nodeId]?.latencyMs ?? 0;
    }
    visiting.add(nodeId);

    const nodeMetrics = updatedMetrics[nodeId];
    if (!nodeMetrics || (nodeMetrics.restartCooldownTicks ?? 0) > 0) {
      visiting.delete(nodeId);
      e2eCache.set(nodeId, 0);
      return 0;
    }

    const baseLat = nodeMetrics.latencyMs ?? 0;
    const outEdges = outboundEdges[nodeId] ?? [];
    const businessOutEdges = outEdges.filter((e) => {
      const tgt = nodeMap.get(e.target);
      return tgt?.data.category !== 'observability';
    });

    if (businessOutEdges.length === 0) {
      visiting.delete(nodeId);
      e2eCache.set(nodeId, baseLat);
      return baseLat;
    }

    let maxDownstream = 0;
    const activeEdges = businessOutEdges.filter((e) => (edgeRpsMap[e.id] ?? 0) > 0);
    const edgesToTrace = activeEdges.length > 0 ? activeEdges : businessOutEdges;

    for (const edge of edgesToTrace) {
      const edgeNetwork = edge.data?.networkLatencyMs ?? 0;
      const edgeWait = edgeWaitTimeMap[edge.id] ?? 0;
      const targetE2E = getEndToEndLatency(edge.target);
      const pathLatency = edgeNetwork + edgeWait + targetE2E;
      if (pathLatency > maxDownstream) {
        maxDownstream = pathLatency;
      }
    }

    const totalE2E = baseLat + maxDownstream;
    visiting.delete(nodeId);
    e2eCache.set(nodeId, totalE2E);
    return totalE2E;
  }

  for (const node of nodes) {
    if (updatedMetrics[node.id]) {
      const e2e = getEndToEndLatency(node.id);
      const roundedE2E = Math.round(e2e * 10) / 10;
      updatedMetrics[node.id].endToEndLatencyMs = roundedE2E;
      
      const history = updatedMetrics[node.id].history;
      if (history && history.length > 0) {
        const lastSnapshot = history[history.length - 1];
        if (lastSnapshot) {
          (lastSnapshot as any).endToEndLatencyMs = roundedE2E;
        }
      }
    }
  }


  // Final Edge Metrics computation
  for (const edge of edges) {
    const rps = Math.round(edgeRpsMap[edge.id] ?? 0);
    const readRps = Math.round(edgeReadRpsMap[edge.id] ?? 0);
    const writeRps = Math.round(edgeWriteRpsMap[edge.id] ?? 0);
    const queueSize = Math.round(edgeQueuesMap[edge.id] ?? 0);
    const timeouts = Math.round((edgeTimeoutsMap[edge.id] ?? 0) * 10) / 10;
    const failures = Math.round((edgeFailuresMap[edge.id] ?? 0) * 10) / 10;
    const waitTime = Math.round((edgeWaitTimeMap[edge.id] ?? 0) * 10) / 10;

    const targetNode = nodeMap.get(edge.target);
    const targetStatus = targetNode ? updatedMetrics[targetNode.id]?.status ?? 'idle' : 'idle';

    let edgeStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (targetStatus === 'critical' || failures > 0 || timeouts > 5) {
      edgeStatus = 'critical';
    } else if (targetStatus === 'warning' || queueSize > 10 || timeouts > 0) {
      edgeStatus = 'warning';
    }

    updatedEdgeMetrics[edge.id] = {
      rps,
      readRps,
      writeRps,
      queueSize,
      latencyMs: Math.round(((targetNode ? updatedMetrics[targetNode.id]?.latencyMs ?? 0 : 0) + (edge.data?.networkLatencyMs ?? 0)) * 10) / 10,
      timeoutsPerSecond: timeouts,
      failuresPerSecond: failures,
      queueWaitTimeMs: waitTime,
      status: edgeStatus,
    };
  }

  return {
    updatedMetrics,
    updatedEdgeMetrics,
    bottlenecks,
    totalRps: Math.round(totalRps),
  };
}

export function runSimulationBatchCore(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  ticksCount: number = 60,
  globalTrafficScale: number = 100
): SimulationTickResult[] {
  const results: SimulationTickResult[] = [];
  let currentNodes = [...nodes];

  for (let t = 1; t <= ticksCount; t++) {
    const res = runSimulationTickCore({ nodes: currentNodes, edges, tick: t, globalTrafficScale });
    results.push(res);
    currentNodes = currentNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        metrics: res.updatedMetrics[n.id] || n.data.metrics,
      },
    }));
  }
  return results;
}
