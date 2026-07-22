import { useEffect, useRef } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';

const DEBOUNCE_MS = 2000;

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const saveProject = useProjectStore((s) => s.saveProject);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!isAuthenticated || !currentProjectId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const canvasData = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: {
            componentType: n.data.componentType,
            category: n.data.category,
            config: n.data.config,
          },
        })),
        edges: edges,
      };
      saveProject(currentProjectId, { canvas: canvasData });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, currentProjectId, isAuthenticated, saveProject]);
}
