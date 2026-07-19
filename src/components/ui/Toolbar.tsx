import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Save, FolderOpen, Trash2, Zap, ChevronDown, Menu } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';

interface ToolbarProps {
  onSave: () => void;
  onLoad: () => void;
  isPaletteOpen: boolean;
  onTogglePalette: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onSave, onLoad, isPaletteOpen, onTogglePalette }) => {
  const { simulation, startSimulation, pauseSimulation, resetSimulation, setSimulationSpeed, clearCanvas, loadPreset, setGlobalTrafficScale } = useSimulatorStore();
  const [showPresets, setShowPresets] = useState(false);

  const speedOptions = [
    { value: 'slow', label: '0.5×' },
    { value: 'normal', label: '1×' },
    { value: 'fast', label: '2.5×' },
  ] as const;

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <button
          className="btn btn-ghost btn-sm btn-menu-toggle"
          onClick={onTogglePalette}
          title={isPaletteOpen ? "Ocultar Paleta" : "Exibir Paleta"}
        >
          <Menu size={18} />
        </button>
        <Zap size={20} className="brand-icon" />
        <span className="brand-name">SysDesign Simulator</span>
      </div>

      <div className="toolbar-center">
        {/* Play / Pause */}
        {simulation.running ? (
          <button className="btn btn-warning" onClick={pauseSimulation}>
            <Pause size={16} />
            <span className="btn-text">Pause</span>
          </button>
        ) : (
          <button className="btn btn-primary" onClick={startSimulation}>
            <Play size={16} />
            <span className="btn-text">Simulate</span>
          </button>
        )}

        <button className="btn btn-ghost" onClick={resetSimulation} title="Reset simulation">
          <RotateCcw size={16} />
          <span className="btn-text">Reset</span>
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

        {/* Global Load Slider */}
        <div className="global-load-slider" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="speed-label slider-label">Global Load</span>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={simulation.globalTrafficScale ?? 100}
            onChange={(e) => setGlobalTrafficScale(Number(e.target.value))}
            className="global-load-range-input"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <input
              type="number"
              min={0}
              max={500}
              step={10}
              value={simulation.globalTrafficScale ?? 100}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) {
                  setGlobalTrafficScale(Math.max(0, Math.min(500, val)));
                }
              }}
              style={{
                width: '50px',
                padding: '2px 4px',
                background: '#192231',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#ffffff',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                textAlign: 'right',
              }}
            />
            <span className="speed-label" style={{ minWidth: 'auto', padding: 0 }}>%</span>
          </div>
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
            <span className="btn-text" style={{ marginRight: 4 }}>Presets</span>
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
          <span className="btn-text">Save</span>
        </button>

        <button className="btn btn-ghost" onClick={onLoad}>
          <FolderOpen size={16} />
          <span className="btn-text">Load</span>
        </button>
      </div>
    </header>
  );
};
