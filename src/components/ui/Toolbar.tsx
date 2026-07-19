import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Save, FolderOpen, Trash2, Zap, ChevronDown } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';

interface ToolbarProps {
  onSave: () => void;
  onLoad: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onSave, onLoad }) => {
  const { simulation, startSimulation, pauseSimulation, resetSimulation, setSimulationSpeed, clearCanvas, loadPreset } = useSimulatorStore();
  const [showPresets, setShowPresets] = useState(false);

  const speedOptions = [
    { value: 'slow', label: '0.5×' },
    { value: 'normal', label: '1×' },
    { value: 'fast', label: '2.5×' },
  ] as const;

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <Zap size={20} className="brand-icon" />
        <span className="brand-name">SysDesign Simulator</span>
      </div>

      <div className="toolbar-center">
        {/* Play / Pause */}
        {simulation.running ? (
          <button className="btn btn-warning" onClick={pauseSimulation}>
            <Pause size={16} />
            Pause
          </button>
        ) : (
          <button className="btn btn-primary" onClick={startSimulation}>
            <Play size={16} />
            Simulate
          </button>
        )}

        <button className="btn btn-ghost" onClick={resetSimulation} title="Reset simulation">
          <RotateCcw size={16} />
          Reset
        </button>

        {/* Speed selector */}
        <div className="speed-selector">
          <span className="speed-label">Speed</span>
          {speedOptions.map((opt) => (
            <button
              key={opt.value}
              className={`speed-btn ${simulation.speed === opt.value ? 'active' : ''}`}
              onClick={() => setSimulationSpeed(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tick counter */}
        <div className="tick-counter">
          <span className="tick-label">Tick</span>
          <span className="tick-value">{simulation.tick}</span>
        </div>
      </div>

      <div className="toolbar-right">
        {/* Presets */}
        <div className="relative">
          <button className="btn btn-ghost" onClick={() => setShowPresets(!showPresets)}>
            Presets
            <ChevronDown size={14} />
          </button>
          {showPresets && (
            <div className="dropdown" onMouseLeave={() => setShowPresets(false)}>
              <button className="dropdown-item" onClick={() => { loadPreset('simple-api'); setShowPresets(false); }}>
                🔌 Simple REST API
              </button>
              <button className="dropdown-item" onClick={() => { loadPreset('ecommerce'); setShowPresets(false); }}>
                🛒 E-commerce Platform
              </button>
              <button className="dropdown-item" onClick={() => { loadPreset('streaming'); setShowPresets(false); }}>
                📺 Video Streaming
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={() => { clearCanvas(); setShowPresets(false); }}>
                <Trash2 size={14} />
                Clear Canvas
              </button>
            </div>
          )}
        </div>

        <button className="btn btn-ghost" onClick={onSave}>
          <Save size={16} />
          Save
        </button>

        <button className="btn btn-ghost" onClick={onLoad}>
          <FolderOpen size={16} />
          Load
        </button>
      </div>
    </header>
  );
};
