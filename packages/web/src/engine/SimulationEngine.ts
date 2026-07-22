import type { Node, Edge } from '@xyflow/react';
import type { SimulatorNodeData, NodeMetrics, Bottleneck, EdgeMetrics } from '../types';
import { runSimulationTickCore } from '@system-design/shared';

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
  return runSimulationTickCore({
    nodes: nodes as any,
    edges: edges as any,
    tick,
    globalTrafficScale,
  }) as {
    updatedMetrics: Record<string, NodeMetrics>;
    updatedEdgeMetrics: Record<string, EdgeMetrics>;
    bottlenecks: Bottleneck[];
    totalRps: number;
  };
}
