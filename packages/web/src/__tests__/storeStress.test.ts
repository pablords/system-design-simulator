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
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

describe('Zustand Stores Empirical Stress Tests', () => {
  beforeEach(() => {
    storageMap.clear();
    useSimulatorStore.getState().clearCanvas();
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      currentProjectName: 'Untitled Project',
      saveStatus: 'idle',
      isLoadingProjects: false,
    });
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('simulatorStore - Rapid Tick Updates & Graph Stress', () => {
    it('handles 500 rapid tick updates without state corruption or metrics overflow', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('ecommerce');

      vi.spyOn(api, 'sendTick').mockResolvedValue({
        updatedMetrics: {},
        updatedEdgeMetrics: {},
        bottlenecks: [],
        totalRps: 5000,
      });

      const startTime = performance.now();
      const TICKS_COUNT = 500;

      for (let i = 0; i < TICKS_COUNT; i++) {
        useSimulatorStore.getState().tick();
      }

      const duration = performance.now() - startTime;
      const state = useSimulatorStore.getState();

      expect(state.simulation.tick).toBe(500);
      expect(state.nodes.length).toBe(10);
      expect(state.edges.length).toBe(9);

      // Verify metrics history is strictly bounded to max 60 entries (rolling window for memory safety)
      const appServer = state.nodes.find((n) => n.id === 'as1');
      expect(appServer).toBeDefined();
      expect(appServer?.data.metrics.history.length).toBe(60);
      expect(Number.isFinite(appServer?.data.metrics.cpuPct)).toBe(true);
      expect(Number.isFinite(appServer?.data.metrics.latencyMs)).toBe(true);
      expect(duration).toBeLessThan(5000); // 500 ticks executed efficiently under 5s
    });

    it('maintains consistency when graph topology changes concurrently during ticking', () => {
      const store = useSimulatorStore.getState();
      store.loadPreset('simple-api');

      vi.spyOn(api, 'sendTick').mockResolvedValue({
        updatedMetrics: {},
        updatedEdgeMetrics: {},
        bottlenecks: [],
        totalRps: 100,
      });

      for (let i = 0; i < 50; i++) {
        store.tick();
        if (i === 10) {
          store.addNode('cache', { x: 500, y: 500 });
        }
        if (i === 20) {
          const cacheNode = useSimulatorStore.getState().nodes.find((n) => n.data.componentType === 'cache' && n.id !== 'rc1');
          if (cacheNode) {
            store.connectNodes('as1', cacheNode.id);
          }
        }
        if (i === 30) {
          store.setGlobalTrafficScale(300);
        }
        if (i === 40) {
          store.removeNode('rc1');
        }
      }

      const finalState = useSimulatorStore.getState();
      expect(finalState.simulation.tick).toBe(50);
      expect(finalState.simulation.globalTrafficScale).toBe(300);
      expect(finalState.nodes.some((n) => n.id === 'rc1')).toBe(false);
      // Ensure remaining edges don't point to deleted node rc1
      const danglingEdge = finalState.edges.find((e) => e.source === 'rc1' || e.target === 'rc1');
      expect(danglingEdge).toBeUndefined();
    });
  });

  describe('projectStore - High Concurrency Mutations & Auto-Save Race Conditions', () => {
    it('handles overlapping concurrent save operations with auto-save status resolution', async () => {
      let putCallOrder: number[] = [];

      vi.spyOn(api, 'put').mockImplementation(async (_url, data: any) => {
        const version = data.version;
        // Simulate network delay inverse to call order to test race recovery
        await new Promise((resolve) => setTimeout(resolve, version === 1 ? 50 : 10));
        putCallOrder.push(version);
        return {};
      });

      // Fire save 1 (slow) then save 2 (fast)
      const save1 = useProjectStore.getState().saveProject('proj-1', { name: 'V1', version: 1 } as any);
      const save2 = useProjectStore.getState().saveProject('proj-1', { name: 'V2', version: 2 } as any);

      await Promise.all([save1, save2]);

      const state = useProjectStore.getState();
      expect(state.saveStatus).toBe('saved');
      expect(putCallOrder).toEqual([2, 1]); // Fast returned first, slow returned second
    });

    it('survives massive batch project creation, cloning, and deletion under load', async () => {
      let idCounter = 1;
      vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
        const newId = `proj-batch-${idCounter++}`;
        return {
          id: newId,
          userId: 'user-1',
          name: url.includes('clone') ? 'Cloned Project' : 'Created Project',
          description: null,
          thumbnail: null,
          isPublic: false,
          canvas: { nodes: [], edges: [] },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      vi.spyOn(api, 'delete').mockResolvedValue({});

      // Create 20 projects concurrently
      const createPromises = Array.from({ length: 20 }, (_, i) =>
        useProjectStore.getState().createProject(`Project ${i}`, { nodes: [], edges: [] })
      );

      const createdIds = await Promise.all(createPromises);
      expect(createdIds.length).toBe(20);
      expect(useProjectStore.getState().projects.length).toBe(20);

      // Clone 10 projects concurrently
      const clonePromises = createdIds.slice(0, 10).map((id) =>
        useProjectStore.getState().cloneProject(id)
      );
      const clonedIds = await Promise.all(clonePromises);
      expect(clonedIds.length).toBe(10);
      expect(useProjectStore.getState().projects.length).toBe(30);

      // Delete 15 projects concurrently
      const deletePromises = createdIds.slice(0, 15).map((id) =>
        useProjectStore.getState().deleteProject(id)
      );
      await Promise.all(deletePromises);
      expect(useProjectStore.getState().projects.length).toBe(15);
    });
  });

  describe('authStore - Session Auth Token Lifecycle & Interleaved Auth Requests', () => {
    it('manages rapid session token login/logout/checkAuth switches without token leaks', async () => {
      let activeToken: string | null = null;
      vi.spyOn(api, 'setToken').mockImplementation((token: string | null) => {
        activeToken = token;
      });
      vi.spyOn(api, 'getToken').mockImplementation(() => activeToken);

      const user1 = { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null, provider: 'local', createdAt: '' };
      const user2 = { id: 'u2', email: 'u2@test.com', name: 'U2', avatarUrl: null, provider: 'local', createdAt: '' };

      vi.spyOn(api, 'post').mockImplementation(async (_url: string, body: any) => {
        if (body.email === 'u1@test.com') return { user: user1, token: 'jwt-u1' };
        if (body.email === 'u2@test.com') return { user: user2, token: 'jwt-u2' };
        throw new Error('User not found');
      });

      vi.spyOn(api, 'get').mockImplementation(async () => {
        if (activeToken === 'jwt-u1') return user1;
        if (activeToken === 'jwt-u2') return user2;
        throw new Error('Unauthorized');
      });

      // Login User 1
      await useAuthStore.getState().login('u1@test.com', 'pass1');
      expect(useAuthStore.getState().user?.id).toBe('u1');
      expect(activeToken).toBe('jwt-u1');

      // Check auth
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Logout User 1
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
      expect(activeToken).toBeNull();

      // Check auth when logged out
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // Login User 2
      await useAuthStore.getState().login('u2@test.com', 'pass2');
      expect(useAuthStore.getState().user?.id).toBe('u2');
      expect(activeToken).toBe('jwt-u2');
    });

    it('isolates error state correctly when rapid failed logins follow successful ones', async () => {
      const validUser = { id: 'u-valid', email: 'valid@test.com', name: 'Valid', avatarUrl: null, provider: 'local', createdAt: '' };

      vi.spyOn(api, 'setToken').mockImplementation(() => {});
      vi.spyOn(api, 'post').mockImplementation(async (_url: string, body: any) => {
        if (body.email === 'valid@test.com' && body.password === 'correct') {
          return { user: validUser, token: 'valid-jwt' };
        }
        const err = new Error('Invalid credentials');
        (err as any).body = { message: 'Invalid credentials' };
        throw err;
      });

      // Successful login
      await useAuthStore.getState().login('valid@test.com', 'correct');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().error).toBeNull();

      // Failed re-login attempt with bad credentials
      await expect(useAuthStore.getState().login('valid@test.com', 'WRONG')).rejects.toThrow();
      expect(useAuthStore.getState().error).toBe('Invalid credentials');
      expect(useAuthStore.getState().isLoading).toBe(false);

      // Empirically confirm auth state is reset and isolated upon failed login attempt
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();

      // Clear error
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
