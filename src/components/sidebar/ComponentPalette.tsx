import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ComponentCategory } from '../../types';
import type { ComponentDefinition } from '../../engine/models/ComponentModel';
import { COMPONENT_DEFINITIONS, CATEGORIES } from '../../engine/models/ComponentModel';

interface ComponentCardProps {
  def: ComponentDefinition;
}

const ComponentCard: React.FC<ComponentCardProps> = ({ def }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/sds-component', def.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="component-card"
      draggable
      onDragStart={handleDragStart}
      title={def.description}
      style={{ '--node-color': def.color } as React.CSSProperties}
    >
      <span className="component-card-icon">{def.icon}</span>
      <span className="component-card-label">{def.label}</span>
    </div>
  );
};

type CollapsedState = Partial<Record<ComponentCategory, boolean>>;

export const ComponentPalette: React.FC = () => {
  const [collapsed, setCollapsed] = useState<CollapsedState>({
    client: false,
    network: false,
    compute: false,
    cache: false,
    database: false,
    messaging: false,
    storage: false,
    monitoring: true,
  });

  const toggleCategory = (cat: ComponentCategory) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const componentsByCategory = CATEGORIES.map((cat) => ({
    ...cat,
    components: Object.values(COMPONENT_DEFINITIONS).filter((d) => d.category === cat.id),
  }));

  return (
    <aside className="component-palette">
      <div className="palette-header">
        <h2 className="palette-title">Components</h2>
        <p className="palette-subtitle">Drag to canvas</p>
      </div>
      <div className="palette-list">
        {componentsByCategory.map((cat) => (
          <div key={cat.id}>
            <button className="palette-category-header" onClick={() => toggleCategory(cat.id)}>
              <span className="palette-category-icon">{cat.icon}</span>
              <span className="palette-category-label">{cat.label}</span>
              {collapsed[cat.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsed[cat.id] && (
              <div className="palette-category-items">
                {cat.components.map((def) => (
                  <ComponentCard key={def.type} def={def} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};
