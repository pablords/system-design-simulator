import type { Node, Edge } from '@xyflow/react';
import type { SimulatorNodeData, NodeMetrics, NodeStatus, Bottleneck, MetricSnapshot, EdgeMetrics } from '../types';
import { COMPONENT_DEFINITIONS } from './models/ComponentModel';

const MAX_HISTORY = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeStatus(cpuPct: number, ramPct: number, utilization: number): NodeStatus {
  const max = Math.max(cpuPct, ramPct, utilization * 100);
  if (max >= 95) return 'critical';
  if (max >= 80) return 'warning';
  if (max > 0) return 'ok';
  return 'idle';
}

export function runSimulationTick(
  nodes: Node<SimulatorNodeData>[],
  edges: Edge[],
  tick: number,
  globalTrafficScale: number = 100
): {
  updatedMetrics: Record<string, NodeMetrics>;
  updatedEdgeMetrics: Record<string, EdgeMetrics>;
  bottlenecks: Bottleneck[];
  totalRps: number;
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency
  const inboundEdges: Record<string, Edge[]> = {};
  const outboundEdges: Record<string, Edge[]> = {};
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
    
    // Crashes
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

    // Circuit Breakers
    if (cfg.circuitBreakerEnabled) {
      let state = prev?.cbState ?? 'CLOSED';
      let timer = prev?.cbOpenTimer ?? 0;

      if (state === 'OPEN') {
        if (timer > 0) {
          timer -= 1;
        }
        if (timer <= 0) {
          state = 'HALF-OPEN';
        }
      }

      cbStateMap[node.id] = state;
      cbOpenTimerMap[node.id] = timer;

      if (state === 'OPEN') {
        cbOpenNodesSet.add(node.id);
      } else if (state === 'HALF-OPEN') {
        cbHalfOpenNodesSet.add(node.id);
      }
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
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    if (def.isSource) {
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
  const queue = nodes.filter((n) => COMPONENT_DEFINITIONS[n.data.componentType].isSource).map((n) => n.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = nodeMap.get(currentId);
    if (!currentNode) continue;

    const def = COMPONENT_DEFINITIONS[currentNode.data.componentType];
    const inboundRead = inboundReadRpsMap[currentId] ?? 0;
    const inboundWrite = inboundWriteRpsMap[currentId] ?? 0;
    const effectiveMaxRps = (currentNode.data.config.maxRps ?? 0) * (currentNode.data.config.replicas ?? 1);

    let outboundReadRps: number = 0;
    let outboundWriteRps: number = 0;

    if (crashedNodesSet.has(currentId)) {
      outboundReadRps = 0;
      outboundWriteRps = 0;
    } else if (currentNode.data.componentType === 'sql-database' || currentNode.data.componentType === 'nosql-db') {
      // Padrão CDC: Bancos de dados encerram tráfego de leitura, mas propagam as escritas (change capture log)
      outboundReadRps = 0;
      outboundWriteRps = inboundWrite;
    } else if (def.isSink) {
      outboundReadRps = 0;
      outboundWriteRps = 0;
    } else {
      // CDN / Cache Hit Rate only affects Read operations (Write Bypass)
      if (currentNode.data.config.cacheHitRate !== undefined) {
        outboundReadRps = inboundRead * (1 - currentNode.data.config.cacheHitRate);
        outboundWriteRps = inboundWrite; // Bypass cache for write operations
      } else {
        outboundReadRps = inboundRead;
        outboundWriteRps = inboundWrite;
      }

      // Rate Limiting (Semaphore) - applies proportionally to total traffic if enabled
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
      // Split into business edges and telemetry edges (to prevent telemetry from stealing business API RPS)
      const businessEdges = outEdges.filter(e => {
        const tgt = nodeMap.get(e.target);
        return tgt?.data.category !== 'observability';
      });
      const telemetryEdges = outEdges.filter(e => {
        const tgt = nodeMap.get(e.target);
        return tgt?.data.category === 'observability';
      });

      // Filter target edges based on allowed traffic types (CQRS routing)
      const readEdges = businessEdges.filter(e => !e.data?.trafficType || e.data.trafficType === 'all' || e.data.trafficType === 'read');
      const writeEdges = businessEdges.filter(e => !e.data?.trafficType || e.data.trafficType === 'all' || e.data.trafficType === 'write');

      const readRpsPerEdge = readEdges.length > 0 ? outboundReadRps / readEdges.length : 0;
      const writeRpsPerEdge = writeEdges.length > 0 ? outboundWriteRps / writeEdges.length : 0;

      // 1. Process business edges
      for (const edge of businessEdges) {
        let edgeRead = 0;
        let edgeWrite = 0;

        const isReadAllowed = !edge.data?.trafficType || edge.data.trafficType === 'all' || edge.data.trafficType === 'read';
        const isWriteAllowed = !edge.data?.trafficType || edge.data.trafficType === 'all' || edge.data.trafficType === 'write';

        if (isReadAllowed) edgeRead = readRpsPerEdge;
        if (isWriteAllowed) edgeWrite = writeRpsPerEdge;

        const edgeTotal = edgeRead + edgeWrite;
        edgeRpsMap[edge.id] = edgeTotal;
        edgeReadRpsMap[edge.id] = edgeRead;
        edgeWriteRpsMap[edge.id] = edgeWrite;

        inboundRpsMap[edge.target] = (inboundRpsMap[edge.target] ?? 0) + edgeTotal;
        inboundReadRpsMap[edge.target] = (inboundReadRpsMap[edge.target] ?? 0) + edgeRead;
        inboundWriteRpsMap[edge.target] = (inboundWriteRpsMap[edge.target] ?? 0) + edgeWrite;

        if (!visited.has(edge.target)) queue.push(edge.target);
      }

      // 2. Process telemetry edges (out-of-band metrics/logs/traces, do not steal business RPS)
      for (const edge of telemetryEdges) {
        const tgt = nodeMap.get(edge.target);
        const tgtType = tgt?.data.componentType;
        
        let teleRps = 0;
        if (tgtType === 'metrics' || tgtType === 'logs') {
          teleRps = inboundRead + inboundWrite; // 100% telemetry RPS
        } else if (tgtType === 'tracing') {
          teleRps = (inboundRead + inboundWrite) * 0.1; // 10% sampled tracing RTT
        } else if (tgtType === 'alerting' || tgtType === 'health-check') {
          teleRps = 1; // Constant ping
        }

        const ratio = (inboundRead + inboundWrite) > 0 ? inboundWrite / (inboundRead + inboundWrite) : 0.1;
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
  const updatedEdgeMetrics: Record<string, EdgeMetrics> = {};
  const edgeTimeoutsMap: Record<string, number> = {};
  const edgeFailuresMap: Record<string, number> = {};
  const edgeQueuesMap: Record<string, number> = {};
  const edgeWaitTimeMap: Record<string, number> = {};

  // Initialize edge wait times and failures to 0
  for (const edge of edges) {
    edgeWaitTimeMap[edge.id] = 0;
    edgeFailuresMap[edge.id] = 0;
    edgeTimeoutsMap[edge.id] = 0;
  }

  for (const node of nodes) {
    const targetInEdges = inboundEdges[node.id] ?? [];
    if (targetInEdges.length === 0) continue;

    const cfg = node.data.config;
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    const inbound = inboundRpsMap[node.id] ?? 0;
    const effectiveMaxRps = (cfg.maxRps ?? 0) * (cfg.replicas ?? 1);
    const utilization = effectiveMaxRps > 0 ? clamp(inbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;
    const latencyMs = def.baseLatencyMs * (1 + overloadFactor * 3);

    // If destination node is currently crashed/down
    if (crashedNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        edgeFailuresMap[edge.id] = edgeRpsMap[edge.id] ?? 0; // 100% fail-fast
        edgeTimeoutsMap[edge.id] = 0;
        edgeQueuesMap[edge.id] = 0;
        edgeWaitTimeMap[edge.id] = 0;
        edgeRpsMap[edge.id] = 0; // no successful requests flow through
        edgeReadRpsMap[edge.id] = 0;
        edgeWriteRpsMap[edge.id] = 0;
      }
      continue;
    }

    // If destination node has Circuit Breaker OPEN: fail fast immediately
    if (cbOpenNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        edgeFailuresMap[edge.id] = edgeRpsMap[edge.id] ?? 0; // 100% fail-fast
        edgeTimeoutsMap[edge.id] = 0;
        edgeQueuesMap[edge.id] = 0;
        edgeWaitTimeMap[edge.id] = 0;
        edgeRpsMap[edge.id] = 0;
        edgeReadRpsMap[edge.id] = 0;
        edgeWriteRpsMap[edge.id] = 0;
      }
      continue;
    }

    // If destination node is HALF-OPEN: fail-fast 80%, trial 20%
    if (cbHalfOpenNodesSet.has(node.id)) {
      for (const edge of targetInEdges) {
        const edgeRps = edgeRpsMap[edge.id] ?? 0;
        const failedPart = edgeRps * 0.8;
        const allowedPart = edgeRps * 0.2;

        edgeFailuresMap[edge.id] = failedPart;
        edgeRpsMap[edge.id] = allowedPart;
        edgeReadRpsMap[edge.id] = (edgeReadRpsMap[edge.id] ?? 0) * 0.2;
        edgeWriteRpsMap[edge.id] = (edgeWriteRpsMap[edge.id] ?? 0) * 0.2;
      }
    }

    // Connection pool logic
    if (cfg.connectionPool !== undefined) {
      const poolLimit = cfg.connectionPool * (cfg.replicas ?? 1);
      let totalRequestedConnections = 0;
      const requestedMap: Record<string, number> = {};

      for (const edge of targetInEdges) {
        const edgeRps = edgeRpsMap[edge.id] ?? 0;
        const requested = edgeRps * (latencyMs / 1000);
        requestedMap[edge.id] = requested;
        totalRequestedConnections += requested;
      }

      if (totalRequestedConnections > poolLimit) {
        const saturationRatio = poolLimit / totalRequestedConnections;

        for (const edge of targetInEdges) {
          const requested = requestedMap[edge.id] ?? 0;
          const allocated = requested * saturationRatio;
          const queueSize = Math.max(0, requested - allocated);
          const edgeRps = edgeRpsMap[edge.id] ?? 0;

          const waitSec = allocated > 0 ? queueSize * (latencyMs / 1000) / allocated : 0;
          const waitTimeMs = waitSec * 1000;

          const sourceNode = nodeMap.get(edge.source);
          const sourceTimeoutMs = sourceNode?.data.config.timeoutMs ?? 1000;

          let timeoutsPerSecond = 0;
          if (waitTimeMs > sourceTimeoutMs) {
            const timeoutRatio = Math.min(1, (waitTimeMs - sourceTimeoutMs) / waitTimeMs);
            timeoutsPerSecond = edgeRps * timeoutRatio;
          }

          edgeQueuesMap[edge.id] = queueSize;
          edgeTimeoutsMap[edge.id] = timeoutsPerSecond;
          edgeWaitTimeMap[edge.id] = waitTimeMs;

          const successfulRps = Math.max(0, edgeRps - timeoutsPerSecond);
          edgeRpsMap[edge.id] = successfulRps;

          // Scale down read/write components proportionally to successful RPS
          if (edgeRps > 0) {
            const scale = successfulRps / edgeRps;
            edgeReadRpsMap[edge.id] = (edgeReadRpsMap[edge.id] ?? 0) * scale;
            edgeWriteRpsMap[edge.id] = (edgeWriteRpsMap[edge.id] ?? 0) * scale;
          }
        }
      }
    }
  }

  // Recalculate node inbound RPS based on successful requests
  const finalInboundRpsMap: Record<string, number> = {};
  const finalInboundReadRpsMap: Record<string, number> = {};
  const finalInboundWriteRpsMap: Record<string, number> = {};

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    if (def.isSource) {
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

  // Re-run BFS with actual successful edge RPS
  const visited2 = new Set<string>();
  const queue2 = nodes.filter((n) => COMPONENT_DEFINITIONS[n.data.componentType].isSource).map((n) => n.id);

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
  const updatedMetrics: Record<string, NodeMetrics> = {};
  const bottlenecks: Bottleneck[] = [];
  let totalRps = 0;

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    const cfg = node.data.config;
    const prevMetrics = node.data.metrics;
    const targetInEdges = inboundEdges[node.id] ?? [];

    // Check if currently crashed/restarting
    if (crashedNodesSet.has(node.id)) {
      const cooldown = crashCooldowns[node.id];
      const nominalInbound = inboundRpsMap[node.id] ?? 0;
      const snapshot: MetricSnapshot = {
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
    const effectiveMaxRps = (cfg.maxRps ?? 0) * (cfg.replicas ?? 1);

    const utilization = effectiveMaxRps > 0 ? clamp(inbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;

    let cpuPct = clamp(def.baseCpuPct * utilization + overloadFactor * 10, 0, 100);
    let ramPct = clamp(def.baseRamPct + utilization * (100 - def.baseRamPct) * 0.5, 0, 100);

    // Stateful Server Queue Depth calculation
    const prevQueue = prevMetrics?.queueDepth ?? 0;
    const nodeTimeoutMs = cfg.timeoutMs ?? 5000;
    let queueDepth = 0;
    let queueTimeouts = 0;

    if (!def.isSource && !def.isSink) {
      if (utilization > 1) {
        // Under overload: backlog grows each tick by the unserviced requests
        const queueChange = inbound - effectiveMaxRps;
        queueDepth = prevQueue + queueChange;
      } else {
        // Capacity freed: drain backlog at excessCapacity per tick
        const excessCapacity = effectiveMaxRps - inbound;
        queueDepth = Math.max(0, prevQueue - excessCapacity);
      }

      // Hard cap at 50x capacity to prevent runaway numbers
      queueDepth = Math.min(Math.max(0, queueDepth), effectiveMaxRps * 50);

      // Proportional expiry: each tick, requests whose implied wait exceeds
      // timeoutMs are shed from the back of the queue as timeout errors.
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

    // Realistic queuing delay: W = L / lambda (Little's Law)
    const queuingDelayMs = (queueDepth > 0 && effectiveMaxRps > 0) ? (queueDepth / effectiveMaxRps) * 1000 : 0;
    const baseLatency = (def.isSource && cfg.clientLatencyMs !== undefined) ? cfg.clientLatencyMs : def.baseLatencyMs;
    const latencyMs = baseLatency * (1 + overloadFactor * 3) + queuingDelayMs;

    // Storage growth (DISK size grows ONLY based on write operations)
    const prevStoragePct = prevMetrics?.storagePct ?? 0;
    let storagePct = prevStoragePct;
    if (def.accumulatesStorage && cfg.storageGb && cfg.storageGb > 0) {
      const storageGrowthPerTick = (inboundWrite * 0.0002) / cfg.storageGb;
      storagePct = clamp(prevStoragePct + storageGrowthPerTick, 0, 100);
    }

    // Determine outbound RPS (distinguishing reads and writes for cache bypass)
    const outboundTargets = outboundEdges[node.id] ?? [];
    let outboundRead: number;
    let outboundWrite: number;

    if (def.isSink) {
      outboundRead = 0;
      outboundWrite = 0;
    } else {
      if (cfg.cacheHitRate !== undefined) {
        outboundRead = inboundRead * (1 - cfg.cacheHitRate);
        outboundWrite = inboundWrite; // Write Bypass
      } else {
        outboundRead = inboundRead;
        outboundWrite = inboundWrite;
      }

      if (cfg.rateLimiterEnabled) {
        const totalOutRaw = outboundRead + outboundWrite;
        if (totalOutRaw > effectiveMaxRps && totalOutRaw > 0) {
          const scale = effectiveMaxRps / totalOutRaw;
          outboundRead *= scale;
          outboundWrite *= scale;
        }
      }
    }

    // --- Resilience & Failure Calculations ---
    const injectedErrorRate = cfg.errorRate ?? 0;
    const injectedErrors = inbound * injectedErrorRate;

    // Overload error rate: if utilization is above 100%, we start shedding/failing requests
    const overloadFailureRate = (utilization > 1 && !cfg.rateLimiterEnabled) ? clamp((utilization - 1) * 0.5, 0, 0.8) : 0;
    const overloadErrors = inbound * overloadFailureRate;

    const localFailures = Math.min(inbound, injectedErrors + overloadErrors + queueTimeouts);
    const localSuccess = Math.max(0, inbound - localFailures);

    const processSuccessRatio = inbound > 0 ? localSuccess / inbound : 1.0;

    outboundRead *= processSuccessRatio;
    outboundWrite *= processSuccessRatio;
    let outboundRps = outboundRead + outboundWrite;
    if (outboundTargets.length === 0) outboundRps = 0;

    // Circuit Breaker state transitions
    let cbState = cbStateMap[node.id];
    let cbOpenTimer = cbOpenTimerMap[node.id];

    if (cfg.circuitBreakerEnabled) {
      // Sum connection timeouts targeting this node
      const incomingTimeouts = targetInEdges.reduce((sum, edge) => sum + (edgeTimeoutsMap[edge.id] ?? 0), 0);

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

    // Crash and failover check:
    // If CPU or RAM hits >= 99% for multiple consecutive ticks, trigger a restart.
    let overloadTicks = overloadCounters[node.id] ?? 0;
    let isNowCrashing = false;
    let restartCooldown = 0;

    const isOverloaded = cpuPct >= 99 || ramPct >= 99;
    if (isOverloaded && !def.isSource && !def.isSink) {
      overloadTicks += 1;
      if (overloadTicks >= 3) {
        isNowCrashing = true;
        restartCooldown = 3; // 3 ticks to boot
        cpuPct = 10;
        ramPct = 20;
        overloadTicks = 0;
      }
    } else {
      overloadTicks = 0;
    }

    const status = isNowCrashing ? 'critical' : computeStatus(cpuPct, ramPct, utilization);

    const jitter = utilization > 1 ? (utilization - 1) * 0.4 : 0.05;
    const p50 = Math.round(latencyMs * 0.9 * 10) / 10;
    const p95 = Math.round(latencyMs * (1.2 + jitter * 2) * 10) / 10;
    const p99 = Math.round(latencyMs * (1.5 + jitter * 5) * 10) / 10;

    const snapshot: MetricSnapshot = {
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
      p50,
      p95,
      p99,
      queueDepth,
      status,
      history,
      consecutiveOverloadTicks: overloadTicks,
      restartCooldownTicks: restartCooldown,
      successRps: Math.round(localSuccess),
      failedRps: Math.round(localFailures),
      cbState: cbStateMap[node.id],
      cbOpenTimer: cbOpenTimerMap[node.id],
    };

    if (def.isSource) totalRps += inbound;

    if (isNowCrashing) {
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'cpu',
        severity: 'critical',
        value: 100,
        limit: 100,
        message: `CRASHED: Server overloaded! Rebooting for failover...`,
      });
    } else {
      // Standard bottlenecks
      if (utilization > 1) {
        bottlenecks.push({
          nodeId: node.id,
          nodeLabel: cfg.label,
          type: 'rps',
          severity: utilization > 1.5 ? 'critical' : 'warning',
          value: Math.round(inbound),
          limit: effectiveMaxRps,
          message: `Receiving ${Math.round(inbound).toLocaleString()} RPS but capacity is ${effectiveMaxRps.toLocaleString()} RPS`,
        });
      }
      if (queueTimeouts > 0) {
        bottlenecks.push({
          nodeId: node.id,
          nodeLabel: cfg.label,
          type: 'rps',
          severity: 'critical',
          value: Math.round(queueTimeouts),
          limit: 0,
          message: `${Math.round(queueTimeouts).toLocaleString()} queued requests timed out (>${nodeTimeoutMs}ms wait) — lost even after scaling`,
        });
      }
      if (cpuPct >= 95) {
        bottlenecks.push({
          nodeId: node.id,
          nodeLabel: cfg.label,
          type: 'cpu',
          severity: 'critical',
          value: Math.round(cpuPct),
          limit: 100,
          message: `CPU at ${Math.round(cpuPct)}% — server is crashing soon!`,
        });
      }
    }
  }

  // Step 2.5: Observability log generation
  for (const node of nodes) {
    if (node.data.componentType === 'logs') {
      const targetInEdges = inboundEdges[node.id] ?? [];
      const connectedInwardNodes = targetInEdges
        .map((edge) => nodeMap.get(edge.source))
        .filter((n): n is Node<SimulatorNodeData> => !!n);
      
      const newLogs: string[] = [];
      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
      
      for (const srcNode of connectedInwardNodes) {
        const srcMetrics = updatedMetrics[srcNode.id];
        if (!srcMetrics) continue;

        const srcCfg = srcNode.data.config;
        const inboundVal = Math.round(srcMetrics.inboundRps);
        
        if (srcMetrics.status === 'critical') {
          newLogs.push(`[${timestamp}] [ERROR] [${srcCfg.label}] CRITICAL: CPU em ${srcMetrics.cpuPct}%, falhas: ${Math.round(srcMetrics.failedRps ?? 0)}/s`);
        } else if (srcMetrics.status === 'warning') {
          newLogs.push(`[${timestamp}] [WARN] [${srcCfg.label}] Sobrecarga: CPU em ${srcMetrics.cpuPct}%, latência média: ${srcMetrics.latencyMs}ms`);
        } else if (inboundVal > 0) {
          const successRate = srcMetrics.inboundRps > 0 
            ? Math.round(((srcMetrics.successRps ?? srcMetrics.inboundRps) / srcMetrics.inboundRps) * 100)
            : 100;
          newLogs.push(`[${timestamp}] [INFO] [${srcCfg.label}] RPS: ${inboundVal} | Sucesso: ${successRate}% | CPU: ${srcMetrics.cpuPct}%`);
        }
      }

      if (connectedInwardNodes.length === 0) {
        newLogs.push(`[${timestamp}] [WARN] Nenhum nó conectado à entrada para monitoramento de logs.`);
      }

      const prevMetrics = node.data.metrics;
      const prevLogs = prevMetrics?.logs ?? [];
      const updatedLogs = [...prevLogs, ...newLogs].slice(-55); // keep last 55 log lines
      
      if (updatedMetrics[node.id]) {
        updatedMetrics[node.id].logs = updatedLogs;
      }
    }
  }

  // Step 3: Compute Cumulative End-to-End Latency
  const memoE2E: Record<string, number> = {};
  function getE2ELatency(nodeId: string): number {
    if (memoE2E[nodeId] !== undefined) return memoE2E[nodeId];

    const nodeMetrics = updatedMetrics[nodeId];
    if (!nodeMetrics) {
      return 0;
    }
    const nodeLatency = nodeMetrics.latencyMs;

    const targets = outboundEdges[nodeId] ?? [];
    if (targets.length === 0) {
      memoE2E[nodeId] = nodeLatency;
      return nodeLatency;
    }

    let totalTargetRps = 0;
    let weightedLatencySum = 0;

    for (const edge of targets) {
      const edgeRps = edgeRpsMap[edge.id] ?? 0;
      const waitTime = edgeWaitTimeMap[edge.id] ?? 0;
      const edgeNetworkLatency = (edge.data?.networkLatencyMs as number) ?? 0;
      const targetE2E = getE2ELatency(edge.target);
      weightedLatencySum += edgeRps * (waitTime + edgeNetworkLatency + targetE2E);
      totalTargetRps += edgeRps;
    }

    const avgTargetLatency = totalTargetRps > 0 ? (weightedLatencySum / totalTargetRps) : 0;
    const result = nodeLatency + avgTargetLatency;
    memoE2E[nodeId] = Math.round(result * 10) / 10;
    return memoE2E[nodeId];
  }

  // Update E2E latency on all metrics
  for (const node of nodes) {
    if (updatedMetrics[node.id]) {
      updatedMetrics[node.id].endToEndLatencyMs = getE2ELatency(node.id);
    }
  }

  // Step 3.5: Compute Cumulative End-to-End Success Rate
  const memoSuccessRate: Record<string, number> = {};
  function getE2ESuccessRate(nodeId: string): number {
    if (memoSuccessRate[nodeId] !== undefined) return memoSuccessRate[nodeId];

    const nodeMetrics = updatedMetrics[nodeId];
    if (!nodeMetrics) return 1.0;

    const node = nodeMap.get(nodeId);
    if (!node) return 1.0;

    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    const targets = outboundEdges[nodeId] ?? [];

    const localInbound = nodeMetrics.inboundRps;
    const localSuccess = nodeMetrics.successRps ?? localInbound;
    const localSuccessRate = localInbound > 0 ? (localSuccess / localInbound) : 1.0;

    if (def.isSink || targets.length === 0) {
      memoSuccessRate[nodeId] = localSuccessRate;
      return localSuccessRate;
    }

    let totalEdgeRps = 0;
    let totalE2ESuccessRps = 0;

    for (const edge of targets) {
      const edgeRps = edgeRpsMap[edge.id] ?? 0;
      const timeouts = edgeTimeoutsMap[edge.id] ?? 0;
      const failFast = edgeFailuresMap[edge.id] ?? 0;

      const reachingTargetRps = Math.max(0, edgeRps - timeouts - failFast);
      const targetSuccessRate = getE2ESuccessRate(edge.target);

      totalE2ESuccessRps += reachingTargetRps * targetSuccessRate;
      totalEdgeRps += edgeRps;
    }

    const downstreamSuccessRate = totalEdgeRps > 0 ? (totalE2ESuccessRps / totalEdgeRps) : 1.0;
    const e2eSuccessRate = localSuccessRate * downstreamSuccessRate;
    memoSuccessRate[nodeId] = e2eSuccessRate;
    return e2eSuccessRate;
  }

  // Update E2E success/failed RPS for all nodes
  for (const node of nodes) {
    if (updatedMetrics[node.id]) {
      const rate = getE2ESuccessRate(node.id);
      const inbound = updatedMetrics[node.id].inboundRps;
      updatedMetrics[node.id].successRps = Math.round(inbound * rate * 10) / 10;
      updatedMetrics[node.id].failedRps = Math.round(inbound * (1 - rate) * 10) / 10;

      const history = updatedMetrics[node.id].history;
      if (history && history.length > 0) {
        const lastSnapshot = history[history.length - 1];
        lastSnapshot.successRps = updatedMetrics[node.id].successRps;
        lastSnapshot.failedRps = updatedMetrics[node.id].failedRps;
      }
    }
  }

  // Step 4: Populate edge metrics
  for (const edge of edges) {
    const edgeRps = edgeRpsMap[edge.id] ?? 0;
    const queueSize = edgeQueuesMap[edge.id] ?? 0;
    const timeouts = edgeTimeoutsMap[edge.id] ?? 0;
    const failFast = edgeFailuresMap[edge.id] ?? 0;
    const targetNode = nodeMap.get(edge.target);
    const targetLatency = updatedMetrics[edge.target]?.latencyMs ?? 0;
    const waitTime = edgeWaitTimeMap[edge.id] ?? 0;

    // E2E success rate of target node to compute downstream failures
    const targetSuccessRate = memoSuccessRate[edge.target] ?? 1.0;
    const reachingTargetRps = Math.max(0, edgeRps - timeouts - failFast);
    const downstreamFailures = reachingTargetRps * (1 - targetSuccessRate);
    const totalEdgeFailures = timeouts + failFast + downstreamFailures;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (totalEdgeFailures > 0) {
      status = 'critical';
      if (timeouts > 0) {
        bottlenecks.push({
          nodeId: edge.source,
          nodeLabel: `${nodeMap.get(edge.source)?.data.config.label} ➜ ${targetNode?.data.config.label}`,
          type: 'rps',
          severity: 'critical',
          value: Math.round(timeouts),
          limit: 0,
          message: `${Math.round(timeouts).toLocaleString()} reqs timing out per second on connection`,
        });
      }
      if (failFast > 0) {
        bottlenecks.push({
          nodeId: edge.source,
          nodeLabel: `${nodeMap.get(edge.source)?.data.config.label} ➜ ${targetNode?.data.config.label}`,
          type: 'rps',
          severity: 'critical',
          value: Math.round(failFast),
          limit: 0,
          message: `${Math.round(failFast).toLocaleString()} reqs failed fast (Circuit Breaker or Crash)`,
        });
      }
    } else if (queueSize > 0) {
      status = 'warning';
      bottlenecks.push({
        nodeId: edge.source,
        nodeLabel: `${nodeMap.get(edge.source)?.data.config.label} ➜ ${targetNode?.data.config.label}`,
        type: 'rps',
        severity: 'warning',
        value: Math.round(queueSize),
        limit: 0,
        message: `${Math.round(queueSize).toLocaleString()} connections waiting in database queue`,
      });
    }

    const edgeNetworkLatency = (edge.data?.networkLatencyMs as number) ?? 0;

    updatedEdgeMetrics[edge.id] = {
      rps: Math.round(edgeRps),
      readRps: Math.round(edgeReadRpsMap[edge.id] ?? 0),
      writeRps: Math.round(edgeWriteRpsMap[edge.id] ?? 0),
      queueSize: Math.round(queueSize * 10) / 10,
      latencyMs: Math.round((targetLatency + waitTime + edgeNetworkLatency) * 10) / 10,
      timeoutsPerSecond: Math.round(timeouts * 10) / 10,
      failuresPerSecond: Math.round(totalEdgeFailures * 10) / 10,
      status,
      queueWaitTimeMs: Math.round(waitTime * 10) / 10,
    };
  }

  const uniqueBottlenecks = bottlenecks.reduce<Bottleneck[]>((acc, b) => {
    const existing = acc.find((e) => e.nodeId === b.nodeId && e.type === b.type);
    if (!existing || b.severity === 'critical') {
      return [...acc.filter((e) => !(e.nodeId === b.nodeId && e.type === b.type)), b];
    }
    return acc;
  }, []);

  return { updatedMetrics, updatedEdgeMetrics, bottlenecks: uniqueBottlenecks, totalRps };
}
