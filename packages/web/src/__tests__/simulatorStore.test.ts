const storageMap = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, value); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() { return storageMap.size; },
};

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: fakeStorage,
    writable: true,
  });
}

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSimulatorStore } from '../store/simulatorStore';
import { api } from '../api/client';

describe('simulatorStore', () => {
  beforeEach(() => {
    storageMap.clear();
    useSimulatorStore.getState().clearCanvas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Graph Node & Edge Mutations', () => {
    it('should initialize with default state', () => {
      const state = useSimulatorStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedEdgeId).toBeNull();
      expect(state.showMinimap).toBe(true);
      expect(state.simulation.running).toBe(false);
      expect(state.simulation.tick).toBe(0);
    });

    it('should add nodes with auto-incremented IDs and default metrics', () => {
      const store = useSimulatorStore.getState();
      store.addNode('client', { x: 100, y: 100 });

      const nodesAfterFirst = useSimulatorStore.getState().nodes;
      expect(nodesAfterFirst.length).toBe(1);
      expect(nodesAfterFirst[0].id).toBe('client-1');
      expect(nodesAfterFirst[0].data.componentType).toBe('client');
      expect(nodesAfterFirst[0].data.category).toBe('client');
      expect(nodesAfterFirst[0].data.metrics.status).toBe('idle');

      useSimulatorStore.getState().addNode('client', { x: 200, y: 100 });
      const nodesAfterSecond = useSimulatorStore.getState().nodes;
      expect(nodesAfterSecond.length).toBe(2);
      expect(nodesAfterSecond[1].id).toBe('client-2');
    });

    it('should connect nodes with default network latency', () => {
      const store = useSimulatorStore.getState();
      store.addNode('client', { x: 100, y: 100 });
      store.addNode('app-server', { x: 400, y: 100 });

      store.connectNodes('client-1', 'app-server-1');

      const edges = useSimulatorStore.getState().edges;
      expect(edges.length).toBe(1);
      expect(edges[0].source).toBe('client-1');
      expect(edges[0].target).toBe('app-server-1');
      expect(edges[0]?.data?.networkLatencyMs).toBe(35);

      store.connectNodes('client-1', 'app-server-1');
      expect(useSimulatorStore.getState().edges.length).toBe(1);
    });

    it('should disconnect nodes and clear selected edge if deleted', () => {
      const store = useSimulatorStore.getState();
      store.addNode('client', { x: 100, y: 100 });
      store.addNode('app-server', { x: 400, y: 100 });
      store.connectNodes('client-1', 'app-server-1');

      const edgeId = useSimulatorStore.getState().edges[0].id;
      store.selectEdge(edgeId);
      expect(useSimulatorStore.getState().selectedEdgeId).toBe(edgeId);

      store.disconnectNodes('client-1', 'app-server-1');
      expect(useSimulatorStore.getState().edges.length).toBe(0);
      expect(useSimulatorStore.getState().selectedEdgeId).toBeNull();
    });

    it('should remove node and clean up associated edges', () => {
      const store = useSimulatorStore.getState();
      store.addNode('client', { x: 100, y: 100 });
      store.addNode('app-server', { x: 400, y: 100 });
      store.connectNodes('client-1', 'app-server-1');
      store.selectNode('client-1');

      store.removeNode('client-1');

      const state = useSimulatorStore.getState();
      expect(state.nodes.length).toBe(1);
      expect(state.nodes[0].id).toBe('app-server-1');
      expect(state.edges.length).toBe(0);
      expect(state.selectedNodeId).toBeNull();
    });

    it('should update node configuration and edge data', () => {
      const store = useSimulatorStore.getState();
      store.addNode('app-server', { x: 100, y: 100 });
      store.addNode('cache', { x: 300, y: 100 });
      store.connectNodes('app-server-1', 'cache-1');

      store.updateNodeConfig('app-server-1', { replicas: 5, maxRps: 5000 });
      const node = useSimulatorStore.getState().nodes.find((n) => n.id === 'app-server-1');
      expect(node?.data.config.replicas).toBe(5);
      expect(node?.data.config.maxRps).toBe(5000);

      const edgeId = useSimulatorStore.getState().edges[0].id;
      store.updateEdgeData(edgeId, { trafficType: 'read' });
      const edge = useSimulatorStore.getState().edges[0];
      expect(edge?.data?.trafficType).toBe('read');
    });
  });

  describe('Zustand Simulation Tick & Local Engine', () => {
    it('should execute simulation tick and update node metrics using local engine', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      const initialTick = useSimulatorStore.getState().simulation.tick;
      expect(initialTick).toBe(0);

      useSimulatorStore.getState().tick();

      const state = useSimulatorStore.getState();
      expect(state.simulation.tick).toBe(1);
      expect(state.nodes.length).toBeGreaterThan(0);

      const clientNode = state.nodes.find((n) => n.data.componentType === 'client');
      expect(clientNode).toBeDefined();
      expect(clientNode?.data.metrics.outboundRps).toBeGreaterThan(0);
      expect(clientNode?.data.metrics.history.length).toBe(1);
    });

    it('should accumulate metrics history across multiple ticks', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      for (let i = 0; i < 5; i++) {
        useSimulatorStore.getState().tick();
      }

      const state = useSimulatorStore.getState();
      expect(state.simulation.tick).toBe(5);

      const clientNode = state.nodes.find((n) => n.data.componentType === 'client');
      expect(clientNode?.data.metrics.history.length).toBe(5);
    });
  });

  describe('20-Tick Backend Sync', () => {
    it('should trigger api.sendTick on tick 20 and update backendConnected status', async () => {
      const sendTickSpy = vi.spyOn(api, 'sendTick').mockResolvedValue({
        updatedMetrics: {},
        updatedEdgeMetrics: {},
        bottlenecks: [],
        totalRps: 100,
      });

      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      for (let i = 1; i <= 19; i++) {
        store.tick();
      }
      expect(sendTickSpy).not.toHaveBeenCalled();

      store.tick();
      expect(sendTickSpy).toHaveBeenCalledTimes(1);
      expect(sendTickSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tick: 20,
          globalTrafficScale: 100,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useSimulatorStore.getState().backendConnected).toBe(true);
    });

    it('should set backendConnected to false if backend sendTick fails on tick 20', async () => {
      vi.spyOn(api, 'sendTick').mockRejectedValue(new Error('Network error'));

      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      for (let i = 1; i <= 20; i++) {
        store.tick();
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useSimulatorStore.getState().backendConnected).toBe(false);
    });
  });

  describe('Presets, Scenarios and UI Controls', () => {
    it('should load preset ecommerce', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('ecommerce');

      const state = useSimulatorStore.getState();
      expect(state.nodes.length).toBe(10);
      expect(state.edges.length).toBe(9);
    });

    it('should save, load, and delete scenarios', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      store.saveScenario('Test Scenario');
      const scenarios = store.getSavedScenarios();
      expect(scenarios.length).toBe(1);
      expect(scenarios[0].name).toBe('Test Scenario');

      store.clearCanvas();
      expect(useSimulatorStore.getState().nodes.length).toBe(0);

      store.loadScenario(scenarios[0].id);
      expect(useSimulatorStore.getState().nodes.length).toBe(5);

      store.deleteScenario(scenarios[0].id);
      expect(store.getSavedScenarios().length).toBe(0);
    });

    it('should toggle minimap state', () => {
      const store = useSimulatorStore.getState();
      expect(store.showMinimap).toBe(true);
      store.toggleMinimap();
      expect(useSimulatorStore.getState().showMinimap).toBe(false);
      store.toggleMinimap();
      expect(useSimulatorStore.getState().showMinimap).toBe(true);
    });

    it('should update global traffic scale', () => {
      const store = useSimulatorStore.getState();
      store.setGlobalTrafficScale(250);
      expect(useSimulatorStore.getState().simulation.globalTrafficScale).toBe(250);
    });
  });
});
