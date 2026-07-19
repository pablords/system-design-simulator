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

  for (const node of nodes) {
    const prev = node.data.metrics;
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
  }

  // Step 1: Nominal BFS propagation of load/RPS
  const inboundRpsMap: Record<string, number> = {};
  const edgeRpsMap: Record<string, number> = {};

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    if (def.isSource) {
      inboundRpsMap[node.id] = (node.data.config.maxRps ?? 0) * (node.data.config.replicas ?? 1) * (globalTrafficScale / 100);
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
    const inbound = inboundRpsMap[currentId] ?? 0;
    const effectiveMaxRps = (currentNode.data.config.maxRps ?? 0) * (currentNode.data.config.replicas ?? 1);

    let outboundRps: number;
    if (crashedNodesSet.has(currentId)) {
      outboundRps = 0;
    } else if (currentNode.data.config.cacheHitRate !== undefined) {
      outboundRps = inbound * (1 - currentNode.data.config.cacheHitRate);
    } else if (def.isSink) {
      outboundRps = 0;
    } else {
      // Propagation logic:
      // If Semaphore (Rate Limiter) is enabled, limit the outbound RPS.
      // Otherwise, pass 100% of incoming RPS to allow downstream bottlenecks to be visible.
      if (currentNode.data.config.rateLimiterEnabled) {
        outboundRps = Math.min(inbound, effectiveMaxRps);
      } else {
        outboundRps = inbound;
      }
    }

    const outEdges = outboundEdges[currentId] ?? [];
    if (outEdges.length > 0) {
      const rpsPerEdge = outboundRps / outEdges.length;
      for (const edge of outEdges) {
        edgeRpsMap[edge.id] = rpsPerEdge;
        inboundRpsMap[edge.target] = (inboundRpsMap[edge.target] ?? 0) + rpsPerEdge;
        if (!visited.has(edge.target)) queue.push(edge.target);
      }
    }
  }

  // Step 2: Connection Pool and Timeout calculations per target node
  const updatedEdgeMetrics: Record<string, EdgeMetrics> = {};
  const edgeTimeoutsMap: Record<string, number> = {};
  const edgeQueuesMap: Record<string, number> = {};
  const edgeWaitTimeMap: Record<string, number> = {};

  // Initialize edge wait times to 0
  for (const edge of edges) {
    edgeWaitTimeMap[edge.id] = 0;
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
        edgeTimeoutsMap[edge.id] = edgeRpsMap[edge.id] ?? 0; // 100% timeouts
        edgeQueuesMap[edge.id] = 0;
        edgeWaitTimeMap[edge.id] = 0;
        edgeRpsMap[edge.id] = 0; // no successful requests flow through
      }
      continue;
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

          edgeRpsMap[edge.id] = Math.max(0, edgeRps - timeoutsPerSecond);
        }
      }
    }
  }

  // Recalculate node inbound RPS based on successful requests
  const finalInboundRpsMap: Record<string, number> = {};
  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    if (def.isSource) {
      finalInboundRpsMap[node.id] = (node.data.config.maxRps ?? 0) * (node.data.config.replicas ?? 1) * (globalTrafficScale / 100);
    } else {
      finalInboundRpsMap[node.id] = 0;
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
      finalInboundRpsMap[edge.target] = (finalInboundRpsMap[edge.target] ?? 0) + finalEdgeRps;
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

    // Check if currently crashed/restarting
    if (crashedNodesSet.has(node.id)) {
      const cooldown = crashCooldowns[node.id];
      const snapshot: MetricSnapshot = {
        tick,
        cpuPct: 10,
        ramPct: 20,
        latencyMs: 0,
        rps: 0,
      };
      const history = [...(prevMetrics?.history ?? []), snapshot].slice(-MAX_HISTORY);

      updatedMetrics[node.id] = {
        inboundRps: 0,
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
        // This is bounded naturally: can't drain more than exists
        const excessCapacity = effectiveMaxRps - inbound;
        queueDepth = Math.max(0, prevQueue - excessCapacity);
      }

      // Hard cap at 50x capacity to prevent runaway numbers
      queueDepth = Math.min(Math.max(0, queueDepth), effectiveMaxRps * 50);

      // Proportional expiry: each tick, requests whose implied wait exceeds
      // timeoutMs are shed from the back of the queue as timeout errors.
      // queuingDelay = queueDepth / serviceRate * 1000 (ms)
      // The "safe" window that won't timeout = timeoutMs * serviceRate / 1000
      if (effectiveMaxRps > 0) {
        const safeSlots = (nodeTimeoutMs / 1000) * effectiveMaxRps;
        if (queueDepth > safeSlots) {
          // Only expire a fraction per tick so the decay is visible over several ticks
          const expiredThisTick = (queueDepth - safeSlots) * 0.4;
          queueTimeouts = Math.round(expiredThisTick);
          queueDepth = queueDepth - expiredThisTick;
        }
      }
    }
    queueDepth = Math.round(Math.max(0, queueDepth));

    // Realistic queuing delay: W = L / lambda (Little's Law)
    const queuingDelayMs = (queueDepth > 0 && effectiveMaxRps > 0) ? (queueDepth / effectiveMaxRps) * 1000 : 0;
    const latencyMs = def.baseLatencyMs * (1 + overloadFactor * 3) + queuingDelayMs;

    // Storage growth
    const prevStoragePct = prevMetrics?.storagePct ?? 0;
    let storagePct = prevStoragePct;
    if (def.accumulatesStorage && cfg.storageGb && cfg.storageGb > 0) {
      const storageGrowthPerTick = (inbound * 0.0001) / cfg.storageGb;
      storagePct = clamp(prevStoragePct + storageGrowthPerTick, 0, 100);
    }

    // Determine outbound RPS
    const outboundTargets = outboundEdges[node.id] ?? [];
    let outboundRps: number;
    if (cfg.cacheHitRate !== undefined) {
      outboundRps = inbound * (1 - cfg.cacheHitRate);
    } else if (def.isSink) {
      outboundRps = 0;
    } else {
      if (cfg.rateLimiterEnabled) {
        outboundRps = Math.min(inbound, effectiveMaxRps);
      } else {
        outboundRps = inbound;
      }
    }
    if (outboundTargets.length === 0) outboundRps = 0;

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

    const snapshot: MetricSnapshot = {
      tick,
      cpuPct: Math.round(cpuPct),
      ramPct: Math.round(ramPct),
      latencyMs: Math.round(latencyMs * 10) / 10,
      rps: Math.round(inbound),
    };
    const history = [...(prevMetrics?.history ?? []), snapshot].slice(-MAX_HISTORY);

    updatedMetrics[node.id] = {
      inboundRps: Math.round(inbound),
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
      const targetE2E = getE2ELatency(edge.target);
      weightedLatencySum += edgeRps * (waitTime + targetE2E);
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

  // Step 4: Populate edge metrics
  for (const edge of edges) {
    const edgeRps = edgeRpsMap[edge.id] ?? 0;
    const queueSize = edgeQueuesMap[edge.id] ?? 0;
    const timeouts = edgeTimeoutsMap[edge.id] ?? 0;
    const targetNode = nodeMap.get(edge.target);
    const targetLatency = updatedMetrics[edge.target]?.latencyMs ?? 0;
    const waitTime = edgeWaitTimeMap[edge.id] ?? 0;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (timeouts > 0) {
      status = 'critical';
      bottlenecks.push({
        nodeId: edge.source,
        nodeLabel: `${nodeMap.get(edge.source)?.data.config.label} ➜ ${targetNode?.data.config.label}`,
        type: 'rps',
        severity: 'critical',
        value: Math.round(timeouts),
        limit: 0,
        message: `${Math.round(timeouts).toLocaleString()} reqs timing out per second on connection`,
      });
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

    updatedEdgeMetrics[edge.id] = {
      rps: Math.round(edgeRps),
      queueSize: Math.round(queueSize * 10) / 10,
      latencyMs: Math.round((targetLatency + waitTime) * 10) / 10,
      timeoutsPerSecond: Math.round(timeouts * 10) / 10,
      status,
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
