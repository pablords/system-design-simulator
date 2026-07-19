import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import type { SimulatorNodeData, SimulationState, SimulationSpeed, ComponentConfig, NodeMetrics, SavedScenario } from '../types';
import type { ComponentType } from '../types';
import { COMPONENT_DEFINITIONS } from '../engine/models/ComponentModel';
import { runSimulationTick } from '../engine/SimulationEngine';

function createDefaultMetrics(): NodeMetrics {
  return {
    inboundRps: 0,
    outboundRps: 0,
    cpuPct: 0,
    ramPct: 0,
    storagePct: 0,
    latencyMs: 0,
    queueDepth: 0,
    status: 'idle',
    history: [],
  };
}

interface SimulatorStore {
  // Graph state
  nodes: Node<SimulatorNodeData>[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // Simulation
  simulation: SimulationState;
  simulationIntervalId: ReturnType<typeof setInterval> | null;

  // Actions - Graph
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: ComponentType, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  updateNodeConfig: (id: string, config: Partial<ComponentConfig>) => void;
  updateEdgeData: (id: string, dataUpdate: Record<string, any>) => void;

  // Actions - Simulation
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: SimulationSpeed) => void;
  tick: () => void;

  // Actions - Save/Load
  saveScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  getSavedScenarios: () => SavedScenario[];
  deleteScenario: (id: string) => void;

  // Actions - Presets
  loadPreset: (preset: 'ecommerce' | 'streaming' | 'simple-api') => void;
  clearCanvas: () => void;
  setGlobalTrafficScale: (scale: number) => void;
}

const SPEED_INTERVALS: Record<SimulationSpeed, number> = {
  slow: 2000,
  normal: 1000,
  fast: 400,
};

let nodeIdCounter = 1;

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  simulationIntervalId: null,
  simulation: {
    running: false,
    tick: 0,
    speed: 'normal',
    totalRps: 0,
    bottlenecks: [],
    globalTrafficScale: 100,
  },

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) as Node<SimulatorNodeData>[] }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge({ ...connection, type: 'connectionEdge', animated: true }, state.edges),
    }));
  },

  addNode: (type, position) => {
    const def = COMPONENT_DEFINITIONS[type];
    const id = `${type}-${nodeIdCounter++}`;
    const newNode: Node<SimulatorNodeData> = {
      id,
      type: 'simulatorNode',
      position,
      data: {
        componentType: type,
        category: def.category,
        config: { ...def.defaultConfig },
        metrics: createDefaultMetrics(),
      },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },

  selectNode: (id) => {
    set({ selectedNodeId: id });
  },

  updateNodeConfig: (id, configUpdate) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...configUpdate } } }
          : n
      ),
    }));
  },

  updateEdgeData: (id, dataUpdate) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id ? { ...e, data: { ...(e.data || {}), ...dataUpdate } } : e
      ),
    }));
  },

  tick: () => {
    const { nodes, edges, simulation } = get();
    if (nodes.length === 0) return;

    const newTick = simulation.tick + 1;
    const { updatedMetrics, updatedEdgeMetrics, bottlenecks, totalRps } = runSimulationTick(nodes, edges, newTick, simulation.globalTrafficScale);

    set((state) => ({
      nodes: state.nodes.map((n) =>
        updatedMetrics[n.id]
          ? { ...n, data: { ...n.data, metrics: updatedMetrics[n.id] } }
          : n
      ),
      edges: state.edges.map((e) =>
        updatedEdgeMetrics[e.id]
          ? { ...e, data: { ...(e.data || {}), metrics: updatedEdgeMetrics[e.id] } }
          : e
      ),
      simulation: {
        ...state.simulation,
        tick: newTick,
        totalRps,
        bottlenecks,
      },
    }));
  },

  startSimulation: () => {
    const { simulation, tick, simulationIntervalId } = get();
    if (simulation.running) return;

    if (simulationIntervalId) clearInterval(simulationIntervalId);

    const intervalMs = SPEED_INTERVALS[simulation.speed];
    const id = setInterval(() => {
      get().tick();
    }, intervalMs);

    set((state) => ({
      simulationIntervalId: id,
      simulation: { ...state.simulation, running: true },
    }));

    // Run first tick immediately
    tick();
  },

  pauseSimulation: () => {
    const { simulationIntervalId } = get();
    if (simulationIntervalId) clearInterval(simulationIntervalId);
    set((state) => ({
      simulationIntervalId: null,
      simulation: { ...state.simulation, running: false },
    }));
  },

  resetSimulation: () => {
    const { simulationIntervalId } = get();
    if (simulationIntervalId) clearInterval(simulationIntervalId);
    set((state) => ({
      simulationIntervalId: null,
      simulation: { running: false, tick: 0, speed: state.simulation.speed, totalRps: 0, bottlenecks: [], globalTrafficScale: 100 },
      nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data, metrics: createDefaultMetrics() } })),
    }));
  },

  setSimulationSpeed: (speed) => {
    const { simulation, simulationIntervalId, tick } = get();
    if (simulationIntervalId) clearInterval(simulationIntervalId);

    if (simulation.running) {
      const id = setInterval(() => {
        tick();
      }, SPEED_INTERVALS[speed]);
      set((state) => ({
        simulationIntervalId: id,
        simulation: { ...state.simulation, speed },
      }));
    } else {
      set((state) => ({ simulation: { ...state.simulation, speed } }));
    }
  },

  saveScenario: (name) => {
    const { nodes, edges } = get();
    const scenarios = get().getSavedScenarios();
    const newScenario: SavedScenario = {
      id: `scenario-${Date.now()}`,
      name,
      nodes,
      edges,
      savedAt: new Date().toISOString(),
    };
    const updated = [...scenarios, newScenario];
    localStorage.setItem('sds-scenarios', JSON.stringify(updated));
  },

  loadScenario: (id) => {
    const scenarios = get().getSavedScenarios();
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    get().pauseSimulation();
    set({
      nodes: (scenario.nodes as Node<SimulatorNodeData>[]).map((n) => ({
        ...n,
        data: { ...n.data, metrics: createDefaultMetrics() },
      })),
      edges: scenario.edges as Edge[],
      simulation: { running: false, tick: 0, speed: 'normal', totalRps: 0, bottlenecks: [], globalTrafficScale: 100 },
      selectedNodeId: null,
    });
  },

  getSavedScenarios: () => {
    try {
      const raw = localStorage.getItem('sds-scenarios');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  deleteScenario: (id) => {
    const scenarios = get().getSavedScenarios().filter((s: SavedScenario) => s.id !== id);
    localStorage.setItem('sds-scenarios', JSON.stringify(scenarios));
  },

  clearCanvas: () => {
    get().pauseSimulation();
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      simulation: { running: false, tick: 0, speed: 'normal', totalRps: 0, bottlenecks: [], globalTrafficScale: 100 },
    });
  },

  loadPreset: (preset) => {
    get().clearCanvas();
    const presets = buildPresets();
    const { nodes, edges } = presets[preset];
    set({ nodes, edges });
  },

  setGlobalTrafficScale: (scale) => {
    set((state) => ({
      simulation: { ...state.simulation, globalTrafficScale: scale },
    }));
  },
}));

function buildPresets(): Record<string, { nodes: Node<SimulatorNodeData>[]; edges: Edge[] }> {
  const mkNode = (id: string, type: ComponentType, pos: { x: number; y: number }, configOverrides: Partial<ComponentConfig> = {}): Node<SimulatorNodeData> => {
    const def = COMPONENT_DEFINITIONS[type];
    return {
      id,
      type: 'simulatorNode',
      position: pos,
      data: {
        componentType: type,
        category: def.category,
        config: { ...def.defaultConfig, ...configOverrides },
        metrics: createDefaultMetrics(),
      },
    };
  };

  const mkEdge = (id: string, source: string, target: string): Edge => ({
    id,
    source,
    target,
    type: 'connectionEdge',
    animated: true,
  });

  return {
    'ecommerce': {
      nodes: [
        mkNode('wc1', 'client', { x: 100, y: 200 }, { maxRps: 5000, label: 'Web Users' }),
        mkNode('mc1', 'mobile', { x: 100, y: 380 }, { maxRps: 3000, label: 'Mobile Users' }),
        mkNode('cdn1', 'cdn', { x: 320, y: 200 }, { label: 'CDN' }),
        mkNode('lb1', 'load-balancer', { x: 560, y: 280 }, { label: 'Load Balancer' }),
        mkNode('as1', 'app-server', { x: 800, y: 160 }, { replicas: 3, maxRps: 2000, label: 'Product API' }),
        mkNode('as2', 'app-server', { x: 800, y: 360 }, { replicas: 2, maxRps: 1500, label: 'Order API' }),
        mkNode('rc1', 'cache', { x: 1040, y: 120 }, { label: 'Product Cache' }),
        mkNode('db1', 'sql-database', { x: 1040, y: 280 }, { label: 'Products DB' }),
        mkNode('db2', 'sql-database', { x: 1040, y: 440 }, { label: 'Orders DB' }),
        mkNode('mq1', 'message-queue', { x: 800, y: 540 }, { label: 'Order Events' }),
      ],
      edges: [
        mkEdge('e1', 'wc1', 'cdn1'),
        mkEdge('e2', 'mc1', 'lb1'),
        mkEdge('e3', 'cdn1', 'lb1'),
        mkEdge('e4', 'lb1', 'as1'),
        mkEdge('e5', 'lb1', 'as2'),
        mkEdge('e6', 'as1', 'rc1'),
        mkEdge('e7', 'rc1', 'db1'),
        mkEdge('e8', 'as2', 'db2'),
        mkEdge('e9', 'as2', 'mq1'),
      ],
    },
    'streaming': {
      nodes: [
        mkNode('wc1', 'client', { x: 80, y: 200 }, { maxRps: 20000, label: 'Viewers' }),
        mkNode('cdn1', 'cdn', { x: 320, y: 200 }, { label: 'Video CDN', cacheHitRate: 0.95 }),
        mkNode('ag1', 'api-gateway', { x: 560, y: 200 }, { label: 'API Gateway' }),
        mkNode('ms1', 'auth-service', { x: 800, y: 120 }, { label: 'Auth Service' }),
        mkNode('ms2', 'app-server', { x: 800, y: 280 }, { label: 'Catalog Service' }),
        mkNode('mq1', 'message-queue', { x: 800, y: 440 }, { label: 'Analytics Events' }),
        mkNode('rc1', 'cache', { x: 1040, y: 200 }, { label: 'Session Cache' }),
        mkNode('db1', 'nosql-db', { x: 1040, y: 380 }, { label: 'Content DB' }),
        mkNode('ob1', 'object-store', { x: 1040, y: 540 }, { label: 'Video Storage' }),
        mkNode('ts1', 'nosql-db', { x: 1040, y: 700 }, { label: 'Analytics DB' }),
      ],
      edges: [
        mkEdge('e1', 'wc1', 'cdn1'),
        mkEdge('e2', 'cdn1', 'ag1'),
        mkEdge('e3', 'ag1', 'ms1'),
        mkEdge('e4', 'ag1', 'ms2'),
        mkEdge('e5', 'ms1', 'rc1'),
        mkEdge('e6', 'ms2', 'db1'),
        mkEdge('e7', 'ms2', 'ob1'),
        mkEdge('e8', 'ag1', 'mq1'),
        mkEdge('e9', 'mq1', 'ts1'),
      ],
    },
    'simple-api': {
      nodes: [
        mkNode('wc1', 'client', { x: 100, y: 250 }, { maxRps: 1000, label: 'API Client' }),
        mkNode('lb1', 'load-balancer', { x: 360, y: 250 }, { label: 'Load Balancer' }),
        mkNode('as1', 'app-server', { x: 620, y: 160 }, { replicas: 2, label: 'API Server' }),
        mkNode('rc1', 'cache', { x: 880, y: 100 }, { label: 'Cache' }),
        mkNode('db1', 'sql-database', { x: 880, y: 300 }, { label: 'Database' }),
      ],
      edges: [
        mkEdge('e1', 'wc1', 'lb1'),
        mkEdge('e2', 'lb1', 'as1'),
        mkEdge('e3', 'as1', 'rc1'),
        mkEdge('e4', 'rc1', 'db1'),
      ],
    },
  };
}
