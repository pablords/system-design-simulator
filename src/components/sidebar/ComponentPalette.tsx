import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, GraduationCap, X } from 'lucide-react';
import type { ComponentCategory } from '../../types';
import type { ComponentDefinition } from '../../engine/models/ComponentModel';
import { COMPONENT_DEFINITIONS, CATEGORIES } from '../../engine/models/ComponentModel';
import { ServiceIcon } from '../ui/ServiceIcon';

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
      className="component-card-custom"
      draggable
      onDragStart={handleDragStart}
      title={def.description}
      style={{ '--node-color': def.color } as React.CSSProperties}
    >
      <span className="component-card-plus">+</span>
      <ServiceIcon type={def.type} size={15} style={{ opacity: 0.8 }} />
      <span className="component-card-label-custom">{def.label}</span>
    </div>
  );
};

type CollapsedState = Partial<Record<ComponentCategory, boolean>>;

export const ComponentPalette: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<CollapsedState>({
    client: false,
    'traffic-edge': false,
    compute: false,
    storage: false,
    messaging: false,
    observability: true,
    network: true,
  });

  const toggleCategory = (cat: ComponentCategory) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Filter components by search query
  const filteredDefinitions = Object.values(COMPONENT_DEFINITIONS).filter((def) => {
    const query = searchQuery.toLowerCase();
    return (
      def.label.toLowerCase().includes(query) ||
      def.description.toLowerCase().includes(query) ||
      def.category.toLowerCase().includes(query)
    );
  });

  const componentsByCategory = CATEGORIES.map((cat) => ({
    ...cat,
    components: filteredDefinitions.filter((d) => d.category === cat.id),
  })).filter((cat) => cat.components.length > 0);

  return (
    <>
      <aside className="component-palette">
        {/* Header Search & Tutorial */}
        <div className="palette-search-container">
          <button className="tutorial-btn" onClick={() => setIsTutorialOpen(true)}>
            <GraduationCap size={16} />
            Start Tutorial
          </button>
          <div className="palette-search-wrapper">
            <Search size={14} className="palette-search-icon" />
            <input
              type="text"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="palette-search-input"
            />
          </div>
        </div>

        {/* Categories list */}
        <div className="palette-list">
          {componentsByCategory.map((cat) => (
            <div key={cat.id} className="palette-category-container">
              <button className="palette-category-header" onClick={() => toggleCategory(cat.id)}>
                <div className="palette-category-label-group">
                  <span style={{ fontSize: 13, marginRight: 2 }}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </div>
                {collapsed[cat.id] ? <ChevronRight size={13} style={{ opacity: 0.6 }} /> : <ChevronDown size={13} style={{ opacity: 0.6 }} />}
              </button>
              {!collapsed[cat.id] && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
                  {cat.components.map((def) => (
                    <ComponentCard key={def.type} def={def} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Tutorial Modal */}
      {isTutorialOpen && (
        <div className="tutorial-modal-overlay" onClick={() => setIsTutorialOpen(false)}>
          <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tutorial-modal-header">
              <div className="tutorial-modal-title">
                <GraduationCap size={18} />
                <span>Como usar o Simulador</span>
              </div>
              <button className="tutorial-modal-close" onClick={() => setIsTutorialOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="tutorial-modal-body">
              <div className="tutorial-step">
                <div className="tutorial-step-number">1</div>
                <div className="tutorial-step-content">
                  <p>
                    <strong>Arraste e Solte os Componentes:</strong> Escolha os serviços organizados no painel esquerdo e arraste-os para o canvas central.
                  </p>
                </div>
              </div>

              <div className="tutorial-step">
                <div className="tutorial-step-number">2</div>
                <div className="tutorial-step-content">
                  <p>
                    <strong>Conecte os Serviços:</strong> Clique na alça de saída (bolinha verde na direita) de um componente e arraste até a alça de entrada (bolinha roxa na esquerda) de outro componente. O tráfego (RPS) fluirá nessa direção!
                  </p>
                </div>
              </div>

              <div className="tutorial-step">
                <div className="tutorial-step-number">3</div>
                <div className="tutorial-step-content">
                  <p>
                    <strong>Configure seus Limites:</strong> Clique em qualquer nó no canvas. O painel direito será aberto para você customizar o número de <strong>Réplicas</strong>, <strong>Max RPS</strong> suportado, tamanho de <strong>Connection Pool</strong> e <strong>Timeout</strong>.
                  </p>
                </div>
              </div>

              <div className="tutorial-step">
                <div className="tutorial-step-number">4</div>
                <div className="tutorial-step-content">
                  <p>
                    <strong>Simule Sobrecargas em Tempo Real:</strong> Clique no botão <strong>Simulate</strong> na barra superior. Use o slider de <strong>Global Load</strong> para aumentar a carga total do sistema de forma centralizada e observe filas acumulando, timeouts expirando e servidores caindo em overload!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
