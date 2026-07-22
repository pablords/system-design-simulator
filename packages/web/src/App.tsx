import { useState, useEffect, useCallback } from 'react';
import { Toolbar } from './components/ui/Toolbar';
import { ComponentPalette } from './components/sidebar/ComponentPalette';
import { SimulatorCanvas } from './components/canvas/SimulatorCanvas';
import { ConfigPanel } from './components/panels/ConfigPanel';
import { MetricsPanel } from './components/panels/MetricsPanel';
import { SaveDialog, LoadDialog } from './components/panels/ScenarioDialogs';
import { useSimulatorStore } from './store/simulatorStore';
import { CapacityCalculator } from './components/panels/CapacityCalculator';
import { AuthModal } from './components/auth/AuthModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { SaveIndicator } from './components/ui/SaveIndicator';
import { useAuthStore } from './store/authStore';
import { useProjectStore } from './store/projectStore';
import { useAutoSave } from './hooks/useAutoSave';
import { api } from './api/client';
import type { Node, Edge } from '@xyflow/react';
import type { SimulatorNodeData } from './types';

type AppView = 'canvas' | 'dashboard';

function App() {
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [view, setView] = useState<AppView>('canvas');

  const { selectedNodeId, selectedEdgeId } = useSimulatorStore();
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const { setCurrentProject, loadProject } = useProjectStore();

  // Enable auto-save when authenticated and working on a project
  useAutoSave();

  // Check auth and capture URL OAuth token or error on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorParam = params.get('error');
    if (token) {
      api.setToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      console.error('OAuth Authentication Error:', errorParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkAuth();
  }, [checkAuth]);

  // On tablets/mobile, if a node or edge is selected, close the calculator and palette to avoid layout clutter
  useEffect(() => {
    if ((selectedNodeId || selectedEdgeId) && window.innerWidth <= 1200) {
      setShowCalculator(false);
      setIsPaletteOpen(false);
    }
  }, [selectedNodeId, selectedEdgeId]);

  const handleTogglePalette = () => {
    const nextVal = !isPaletteOpen;
    setIsPaletteOpen(nextVal);
    if (nextVal && window.innerWidth <= 1200) {
      setShowCalculator(false);
    }
  };

  const handleToggleCalculator = () => {
    const nextVal = !showCalculator;
    setShowCalculator(nextVal);
    if (nextVal && window.innerWidth <= 1200) {
      setIsPaletteOpen(false);
    }
  };

  const handleOpenProject = useCallback(async (id: string) => {
    try {
      const project = await loadProject(id);
      const store = useSimulatorStore.getState();
      store.pauseSimulation();
      useSimulatorStore.setState({
        nodes: (project.canvas.nodes as Node<SimulatorNodeData>[]),
        edges: (project.canvas.edges as Edge[]),
        selectedNodeId: null,
        selectedEdgeId: null,
        simulation: { running: false, tick: 0, speed: 'normal', totalRps: 0, bottlenecks: [], globalTrafficScale: 100 },
      });
      setView('canvas');
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }, [loadProject]);

  const handleNewProject = useCallback(() => {
    const store = useSimulatorStore.getState();
    store.clearCanvas();
    setCurrentProject(null);
    setView('canvas');
  }, [setCurrentProject]);

  const handleGoToDashboard = useCallback(() => {
    if (isAuthenticated) {
      setView('dashboard');
    } else {
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando...</div>
      </div>
    );
  }

  // Show dashboard view
  if (view === 'dashboard' && isAuthenticated) {
    return (
      <Dashboard
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
      />
    );
  }

  return (
    <div className="app-shell">
      <Toolbar
        onSave={() => setShowSave(true)}
        onLoad={() => setShowLoad(true)}
        isPaletteOpen={isPaletteOpen}
        onTogglePalette={handleTogglePalette}
        showCalculator={showCalculator}
        onToggleCalculator={handleToggleCalculator}
        onAuthClick={() => setShowAuthModal(true)}
        onDashboardClick={handleGoToDashboard}
        isAuthenticated={isAuthenticated}
      />

      <div className="app-body">
        {showCalculator && <CapacityCalculator onClose={() => setShowCalculator(false)} />}
        <ComponentPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

        <main className="canvas-area">
          <SimulatorCanvas />
          <MetricsPanel />
          <SaveIndicator />
        </main>

        {(selectedNodeId || selectedEdgeId) && <ConfigPanel />}
      </div>

      {showSave && <SaveDialog onClose={() => setShowSave(false)} />}
      {showLoad && <LoadDialog onClose={() => setShowLoad(false)} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

export default App;
