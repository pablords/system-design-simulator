import React, { memo, useCallback, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Trash2, Layers } from 'lucide-react';
import { useSimulatorStore } from '../../store/simulatorStore';

const LAYER_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

export const LayerNode = memo(({ id, data: rawData, selected }: NodeProps) => {
  const { removeNode, updateNodeConfig, nodes } = useSimulatorStore();
  const config = (rawData as any).config ?? {};
  const layerColor = config.layerColor ?? '#6366f1';

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(config.label ?? 'Nova Camada');

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
    },
    [id, removeNode]
  );

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLabel(true);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setEditingLabel(false);
    updateNodeConfig(id, { label: labelValue });
  }, [id, labelValue, updateNodeConfig]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setEditingLabel(false);
        updateNodeConfig(id, { label: labelValue });
      }
    },
    [id, labelValue, updateNodeConfig]
  );

  const obsCount = nodes.filter(
    (n) =>
      n.parentId === id &&
      ['metrics', 'logs', 'tracing'].includes((n.data as any)?.componentType ?? '')
  ).length;

  const childCount = nodes.filter((n) => n.parentId === id).length;

  return (
    <div
      className={`layer-node ${selected ? 'layer-node--selected' : ''}`}
      style={
        {
          '--layer-color': layerColor,
          width: '100%',
          height: '100%',
          position: 'relative',
        } as React.CSSProperties
      }
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={140}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: layerColor,
          border: '2px solid #0f172a',
        }}
        lineStyle={{ borderColor: layerColor, borderWidth: 2 }}
      />

      <div className="layer-header" style={{ background: `${layerColor}22`, borderBottom: `1px solid ${layerColor}44` }}>
        <div className="layer-header-left">
          <Layers size={12} style={{ color: layerColor, flexShrink: 0 }} />
          {editingLabel ? (
            <input
              autoFocus
              className="layer-label-input"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="layer-label"
              onDoubleClick={handleLabelDoubleClick}
              title="Clique duplo para renomear"
            >
              {config.label ?? 'Nova Camada'}
            </span>
          )}
        </div>
        <div className="layer-header-right">
          {childCount > 0 && (
            <span className="layer-child-count" style={{ color: layerColor }}>
              {childCount} node{childCount !== 1 ? 's' : ''}
            </span>
          )}
          {obsCount > 0 && (
            <span
              className="layer-obs-badge"
              title={`${obsCount} no(s) de observabilidade coletando metricas automaticamente`}
            >
              🔭
            </span>
          )}
          <button className="layer-delete-btn" onClick={handleDelete} title="Remover camada">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {selected && (
        <div className="layer-color-picker">
          {LAYER_COLORS.map((c) => (
            <button
              key={c}
              className={`layer-color-dot ${c === layerColor ? 'layer-color-dot--active' : ''}`}
              style={{ background: c }}
              onClick={(e) => {
                e.stopPropagation();
                updateNodeConfig(id, { layerColor: c } as any);
              }}
              title={c}
            />
          ))}
        </div>
      )}

      {childCount === 0 && (
        <div className="layer-empty-hint">
          Arraste nodes para dentro desta camada
        </div>
      )}
    </div>
  );
});

LayerNode.displayName = 'LayerNode';
