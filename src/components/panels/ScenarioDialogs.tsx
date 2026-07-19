import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, X, Clock } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { SavedScenario } from '../../types';

interface SaveDialogProps {
  onClose: () => void;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const { saveScenario } = useSimulatorStore();

  const handleSave = () => {
    if (!name.trim()) return;
    saveScenario(name.trim());
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <Save size={18} />
          <h3>Save Scenario</h3>
          <button className="dialog-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dialog-body">
          <label className="config-label">Scenario Name</label>
          <input
            className="config-input"
            type="text"
            placeholder="e.g. E-commerce v2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  );
};

interface LoadDialogProps {
  onClose: () => void;
}

export const LoadDialog: React.FC<LoadDialogProps> = ({ onClose }) => {
  const { getSavedScenarios, loadScenario, deleteScenario } = useSimulatorStore();
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => getSavedScenarios());

  const handleLoad = (id: string) => {
    loadScenario(id);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteScenario(id);
    setScenarios(getSavedScenarios());
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <FolderOpen size={18} />
          <h3>Load Scenario</h3>
          <button className="dialog-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dialog-body">
          {scenarios.length === 0 ? (
            <p className="dialog-empty">No saved scenarios yet. Build something and save it!</p>
          ) : (
            <div className="scenario-list">
              {scenarios.map((s) => (
                <div key={s.id} className="scenario-item">
                  <div className="scenario-info">
                    <span className="scenario-name">{s.name}</span>
                    <span className="scenario-date">
                      <Clock size={12} />
                      {new Date(s.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="scenario-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleLoad(s.id)}>Load</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
