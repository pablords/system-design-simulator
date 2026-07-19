import type { Node, Edge } from '@xyflow/react';
import type { SimulatorNodeData, NodeMetrics, NodeStatus, Bottleneck, MetricSnapshot } from '../types';
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
  tick: number
): {
  updatedMetrics: Record<string, NodeMetrics>;
  bottlenecks: Bottleneck[];
  totalRps: number;
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency: for each node, which nodes send TO it?
  const inboundEdges: Record<string, string[]> = {};
  const outboundEdges: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!inboundEdges[edge.target]) inboundEdges[edge.target] = [];
    if (!outboundEdges[edge.source]) outboundEdges[edge.source] = [];
    inboundEdges[edge.target].push(edge.source);
    outboundEdges[edge.source].push(edge.target);
  }

  // Topological-ish propagation: sources first, then downstream
  const inboundRpsMap: Record<string, number> = {};

  // Initialize source nodes with their own RPS
  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    if (def.isSource) {
      const effectiveRps = node.data.config.maxRps * node.data.config.replicas;
      inboundRpsMap[node.id] = effectiveRps;
    }
  }

  // BFS propagation
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
    const effectiveMaxRps = currentNode.data.config.maxRps * currentNode.data.config.replicas;

    // For cache nodes, reduce outbound RPS by hit rate (cache absorbs hits)
    let outboundRps: number;
    if (currentNode.data.config.cacheHitRate !== undefined) {
      outboundRps = inbound * (1 - currentNode.data.config.cacheHitRate);
    } else if (def.isSink) {
      outboundRps = 0;
    } else {
      outboundRps = Math.min(inbound, effectiveMaxRps); // can only forward what it can handle
    }

    const targets = outboundEdges[currentId] ?? [];
    if (targets.length > 0) {
      const rpsPerTarget = outboundRps / targets.length;
      for (const targetId of targets) {
        inboundRpsMap[targetId] = (inboundRpsMap[targetId] ?? 0) + rpsPerTarget;
        if (!visited.has(targetId)) queue.push(targetId);
      }
    }
  }

  // Now compute metrics per node
  const updatedMetrics: Record<string, NodeMetrics> = {};
  const bottlenecks: Bottleneck[] = [];
  let totalRps = 0;

  for (const node of nodes) {
    const def = COMPONENT_DEFINITIONS[node.data.componentType];
    const cfg = node.data.config;
    const inbound = inboundRpsMap[node.id] ?? 0;
    const effectiveMaxRps = cfg.maxRps * cfg.replicas;

    const utilization = effectiveMaxRps > 0 ? clamp(inbound / effectiveMaxRps, 0, 2) : 0;
    const overloadFactor = utilization > 1 ? (utilization - 1) * 5 : 0;

    const cpuPct = clamp(def.baseCpuPct * utilization + overloadFactor * 10, 0, 100);
    const ramPct = clamp(def.baseRamPct + utilization * (100 - def.baseRamPct) * 0.5, 0, 100);
    const queueDepth = utilization > 1 ? Math.round((utilization - 1) * effectiveMaxRps * 0.5) : 0;
    const latencyMs = def.baseLatencyMs * (1 + overloadFactor * 3) + queueDepth * 0.01;

    // Storage: accumulate slightly each tick for storage-capable nodes
    const prevMetrics = node.data.metrics;
    const prevStoragePct = prevMetrics?.storagePct ?? 0;
    let storagePct = prevStoragePct;
    if (def.accumulatesStorage && cfg.storageGb > 0) {
      const storageGrowthPerTick = (inbound * 0.0001) / cfg.storageGb;
      storagePct = clamp(prevStoragePct + storageGrowthPerTick, 0, 100);
    }

    const outboundTargets = outboundEdges[node.id] ?? [];
    let outboundRps: number;
    if (cfg.cacheHitRate !== undefined) {
      outboundRps = inbound * (1 - cfg.cacheHitRate);
    } else if (def.isSink) {
      outboundRps = 0;
    } else {
      outboundRps = Math.min(inbound, effectiveMaxRps);
    }
    if (outboundTargets.length === 0) outboundRps = 0;

    const status = computeStatus(cpuPct, ramPct, utilization);

    // History
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
    };

    // Accumulate total RPS from source nodes
    if (def.isSource) totalRps += inbound;

    // Detect bottlenecks
    if (utilization > 1) {
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'rps',
        severity: utilization > 1.5 ? 'critical' : 'warning',
        value: Math.round(inbound),
        limit: effectiveMaxRps,
        message: `Receiving ${Math.round(inbound).toLocaleString()} RPS but max capacity is ${effectiveMaxRps.toLocaleString()} RPS`,
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
        message: `CPU at ${Math.round(cpuPct)}% — consider scaling horizontally`,
      });
    } else if (cpuPct >= 80) {
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'cpu',
        severity: 'warning',
        value: Math.round(cpuPct),
        limit: 100,
        message: `CPU at ${Math.round(cpuPct)}% — approaching saturation`,
      });
    }
    if (storagePct >= 90) {
      bottlenecks.push({
        nodeId: node.id,
        nodeLabel: cfg.label,
        type: 'storage',
        severity: storagePct >= 95 ? 'critical' : 'warning',
        value: Math.round(storagePct),
        limit: 100,
        message: `Storage at ${Math.round(storagePct)}% capacity`,
      });
    }
  }

  // Deduplicate bottlenecks (keep highest severity per node/type)
  const uniqueBottlenecks = bottlenecks.reduce<Bottleneck[]>((acc, b) => {
    const existing = acc.find((e) => e.nodeId === b.nodeId && e.type === b.type);
    if (!existing || b.severity === 'critical') {
      return [...acc.filter((e) => !(e.nodeId === b.nodeId && e.type === b.type)), b];
    }
    return acc;
  }, []);

  return { updatedMetrics, bottlenecks: uniqueBottlenecks, totalRps };
}
