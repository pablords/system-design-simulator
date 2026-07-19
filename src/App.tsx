import { useState } from 'react';
import { Toolbar } from './components/ui/Toolbar';
import { ComponentPalette } from './components/sidebar/ComponentPalette';
import { SimulatorCanvas } from './components/canvas/SimulatorCanvas';
import { ConfigPanel } from './components/panels/ConfigPanel';
import { MetricsPanel } from './components/panels/MetricsPanel';
import { SaveDialog, LoadDialog } from './components/panels/ScenarioDialogs';
import { useSimulatorStore } from './store/simulatorStore';

function App() {
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const { selectedNodeId } = useSimulatorStore();

  return (
    <div className="app-shell">
      <Toolbar
        onSave={() => setShowSave(true)}
        onLoad={() => setShowLoad(true)}
        isPaletteOpen={isPaletteOpen}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
      />

      <div className="app-body">
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
