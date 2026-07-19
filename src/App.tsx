import { useState, useEffect } from 'react';
import { Toolbar } from './components/ui/Toolbar';
import { ComponentPalette } from './components/sidebar/ComponentPalette';
import { SimulatorCanvas } from './components/canvas/SimulatorCanvas';
import { ConfigPanel } from './components/panels/ConfigPanel';
import { MetricsPanel } from './components/panels/MetricsPanel';
import { SaveDialog, LoadDialog } from './components/panels/ScenarioDialogs';
import { useSimulatorStore } from './store/simulatorStore';
import { CapacityCalculator } from './components/panels/CapacityCalculator';

function App() {
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const { selectedNodeId } = useSimulatorStore();

  // On tablets/mobile, if a node is selected, close the calculator to avoid layout clutter
  useEffect(() => {
    if (selectedNodeId && window.innerWidth <= 1200) {
      setShowCalculator(false);
    }
  }, [selectedNodeId]);

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

  return (
    <div className="app-shell">
      <Toolbar
        onSave={() => setShowSave(true)}
        onLoad={() => setShowLoad(true)}
        isPaletteOpen={isPaletteOpen}
        onTogglePalette={handleTogglePalette}
        showCalculator={showCalculator}
        onToggleCalculator={handleToggleCalculator}
      />

      <div className="app-body">
        {showCalculator && <CapacityCalculator onClose={() => setShowCalculator(false)} />}
        <ComponentPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

        <main className="canvas-area">
          <SimulatorCanvas />
          <MetricsPanel />
        </main>

        {selectedNodeId && <ConfigPanel />}
      </div>

      {showSave && <SaveDialog onClose={() => setShowSave(false)} />}
      {showLoad && <LoadDialog onClose={() => setShowLoad(false)} />}
    </div>
  );
}

export default App;
