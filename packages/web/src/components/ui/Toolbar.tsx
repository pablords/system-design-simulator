import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Save, FolderOpen, Trash2, Zap, ChevronDown, Menu, Calculator, LogIn, LayoutDashboard, User } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';

interface ToolbarProps {
  onSave: () => void;
  onLoad: () => void;
  isPaletteOpen: boolean;
  onTogglePalette: () => void;
  showCalculator: boolean;
  onToggleCalculator: () => void;
  onAuthClick: () => void;
  onDashboardClick: () => void;
  isAuthenticated: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onSave, onLoad, isPaletteOpen, onTogglePalette, showCalculator, onToggleCalculator, onAuthClick, onDashboardClick, isAuthenticated }) => {
  const { simulation, startSimulation, pauseSimulation, resetSimulation, setSimulationSpeed, clearCanvas, loadPreset, setGlobalTrafficScale } = useSimulatorStore();
  const { currentProjectName } = useProjectStore();
  const { user } = useAuthStore();
  const [showPresets, setShowPresets] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [tempGlobalLoad, setTempGlobalLoad] = useState(String(simulation.globalTrafficScale ?? 100));

  React.useEffect(() => {
    setTempGlobalLoad(String(simulation.globalTrafficScale ?? 100));
  }, [simulation.globalTrafficScale]);

  const handleGlobalLoadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempGlobalLoad(e.target.value);
    const val = Number(e.target.value);
    if (!isNaN(val) && e.target.value !== '' && val >= 0 && val <= 500) {
      setGlobalTrafficScale(val);
    }
  };

  const handleGlobalLoadBlurOrEnter = () => {
    let val = Number(tempGlobalLoad);
    if (isNaN(val) || tempGlobalLoad === '') {
      val = simulation.globalTrafficScale ?? 100;
    }
    const clampedVal = Math.max(0, Math.min(500, val));
    setGlobalTrafficScale(clampedVal);
    setTempGlobalLoad(String(clampedVal));
  };

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
        {isAuthenticated && currentProjectName && (
          <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px', fontWeight: 400 }}>
            / {currentProjectName}
          </span>
        )}
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
              value={tempGlobalLoad}
              onChange={handleGlobalLoadChange}
              onBlur={handleGlobalLoadBlurOrEnter}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGlobalLoadBlurOrEnter();
                  e.currentTarget.blur();
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

      {/* Desktop View (hidden on iPad/mobile) */}
      <div className="toolbar-right desktop-only">
        {/* Estimativas */}
        <button className={`btn btn-ghost ${showCalculator ? 'active' : ''}`} onClick={onToggleCalculator} title="Calculadora de Capacidades (Conta de Padaria)">
          <Calculator size={16} />
          <span className="btn-text">Estimativas</span>
        </button>

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

        {/* Auth / Dashboard button */}
        {isAuthenticated ? (
          <button className="btn btn-ghost" onClick={onDashboardClick} title="Meus Projetos">
            <LayoutDashboard size={16} />
            <span className="btn-text">{user?.name?.split(' ')[0] || 'Projetos'}</span>
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onAuthClick} title="Entrar">
            <LogIn size={16} />
            <span className="btn-text">Entrar</span>
          </button>
        )}
      </div>

      {/* Tablet/Mobile View (visible on iPad/mobile <= 1200px) */}
      <div className="toolbar-right tablet-only">
        <div className="relative">
          <button className="btn btn-ghost" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            <Menu size={16} />
            <span style={{ marginLeft: 4 }}>Menu</span>
            <ChevronDown size={14} style={{ marginLeft: 2 }} />
          </button>
          {showMobileMenu && (
            <div className="dropdown" onMouseLeave={() => setShowMobileMenu(false)} style={{ right: 0, left: 'auto', minWidth: '220px' }}>
              <div className="dropdown-header">Ferramentas</div>
              <button className={`dropdown-item ${showCalculator ? 'active' : ''}`} onClick={() => { onToggleCalculator(); setShowMobileMenu(false); }}>
                <Calculator size={14} style={{ marginRight: 6 }} />
                Estimativas (Calculadora)
              </button>
              
              <div className="dropdown-divider" />
              <div className="dropdown-header">Presets</div>
              <button className="dropdown-item" onClick={() => { loadPreset('simple-api'); setShowMobileMenu(false); }}>
                🔌 Simple REST API
              </button>
              <button className="dropdown-item" onClick={() => { loadPreset('ecommerce'); setShowMobileMenu(false); }}>
                🛒 E-commerce Platform
              </button>
              <button className="dropdown-item" onClick={() => { loadPreset('streaming'); setShowMobileMenu(false); }}>
                📺 Video Streaming
              </button>
              
              <div className="dropdown-divider" />
              <div className="dropdown-header">Cenário</div>
              <button className="dropdown-item" onClick={() => { onSave(); setShowMobileMenu(false); }}>
                <Save size={14} style={{ marginRight: 6 }} />
                Salvar Cenário
              </button>
              <button className="dropdown-item" onClick={() => { onLoad(); setShowMobileMenu(false); }}>
                <FolderOpen size={14} style={{ marginRight: 6 }} />
                Carregar Cenário
              </button>
              <button className="dropdown-item danger" onClick={() => { clearCanvas(); setShowMobileMenu(false); }}>
                <Trash2 size={14} style={{ marginRight: 6 }} />
                Limpar Canvas
              </button>

              <div className="dropdown-divider" />
              <div className="dropdown-header">Conta</div>
              {isAuthenticated ? (
                <>
                  <button className="dropdown-item" onClick={() => { onDashboardClick(); setShowMobileMenu(false); }}>
                    <LayoutDashboard size={14} style={{ marginRight: 6 }} />
                    Meus Projetos
                  </button>
                </>
              ) : (
                <button className="dropdown-item" onClick={() => { onAuthClick(); setShowMobileMenu(false); }}>
                  <User size={14} style={{ marginRight: 6 }} />
                  Entrar / Criar Conta
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
