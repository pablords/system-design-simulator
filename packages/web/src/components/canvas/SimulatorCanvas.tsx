import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
} from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComponentNode } from './ComponentNode';
import { LayerNode } from './LayerNode';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ComponentType } from '../../types';

import { ConnectionEdge } from './ConnectionEdge';
import { Map, EyeOff } from 'lucide-react';

const nodeTypes = { simulatorNode: ComponentNode, layerNode: LayerNode };
const edgeTypes = { connectionEdge: ConnectionEdge };

/** Recursively calculates the absolute position of a node in flow coordinates */
function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find((n) => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return {
    x: parentAbs.x + node.position.x,
    y: parentAbs.y + node.position.y,
  };
}

/** Returns true if node bounding box overlaps the layer bounding box (using absolute coordinates) */
function isNodeInsideLayer(node: Node, layer: Node, allNodes: Node[]): boolean {
  const absPos = getAbsolutePosition(node, allNodes);
  const nodeW = node.measured?.width ?? node.width ?? 160;
  const nodeH = node.measured?.height ?? node.height ?? 80;

  const layerAbsPos = getAbsolutePosition(layer, allNodes);
  const lW = layer.measured?.width ?? layer.width ?? 400;
  const lH = layer.measured?.height ?? layer.height ?? 300;

  const centerX = absPos.x + nodeW / 2;
  const centerY = absPos.y + nodeH / 2;

  return (
    centerX >= layerAbsPos.x &&
    centerX <= layerAbsPos.x + lW &&
    centerY >= layerAbsPos.y &&
    centerY <= layerAbsPos.y + lH
  );
}

const CanvasInner: React.FC = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode, selectEdge, showMinimap, toggleMinimap, moveNodeToLayer, removeNodeFromLayer } = useSimulatorStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData('application/sds-component') as ComponentType;
      if (!componentType) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(componentType, position);

      // Auto-attach to layer if dropped inside one
      setTimeout(() => {
        const currentNodes = useSimulatorStore.getState().nodes;
        const newlyAdded = currentNodes.find((n) => n.data.componentType === componentType && n.position.x === position.x && n.position.y === position.y);
        if (newlyAdded) {
          const layers = currentNodes.filter((n) => n.type === 'layerNode');
          const targetLayer = layers.find((layer) => isNodeInsideLayer(newlyAdded, layer, currentNodes));
          if (targetLayer) {
            moveNodeToLayer(newlyAdded.id, targetLayer.id);
          }
        }
      }, 50);
    },
    [screenToFlowPosition, addNode, moveNodeToLayer]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    selectNode(node.id);
  }, [selectNode]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
    selectEdge(edge.id);
  }, [selectEdge]);

  const onNodeDragStop = useCallback((_: MouseEvent | TouchEvent, draggedNode: Node) => {
    // Only move simulatorNodes, not layers
    if (draggedNode.type !== 'simulatorNode') return;

    // Find a layer that contains the dragged node's center (using absolute coords)
    const layers = nodes.filter((n) => n.type === 'layerNode');
    const overlappingLayer = layers.find((layer) => isNodeInsideLayer(draggedNode, layer, nodes));

    if (overlappingLayer && draggedNode.parentId !== overlappingLayer.id) {
      moveNodeToLayer(draggedNode.id, overlappingLayer.id);
    } else if (!overlappingLayer && draggedNode.parentId) {
      removeNodeFromLayer(draggedNode.id);
    }
  }, [nodes, moveNodeToLayer, removeNodeFromLayer]);

  return (
    <div ref={reactFlowWrapper} className="canvas-wrapper" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: 'connectionEdge',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e293b"
        />
        <Controls className="flow-controls" />
        {showMinimap && (
          <MiniMap
            className="flow-minimap"
            nodeColor={(node) => {
              const status = (node.data as { metrics?: { status?: string } })?.metrics?.status;
              if (status === 'critical') return '#ef4444';
              if (status === 'warning') return '#f59e0b';
              if (status === 'ok') return '#22c55e';
              return '#334155';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
            style={{ background: '#0f172a' }}
          />
        )}
      </ReactFlow>

      {/* MiniMap Toggle Button */}
      <button
        onClick={toggleMinimap}
        className="btn btn-ghost btn-sm"
        title={showMinimap ? "Ocultar Mini-Mapa" : "Exibir Mini-Mapa"}
        style={{
          position: 'absolute',
          right: '15px',
          bottom: showMinimap ? '175px' : '15px',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontSize: '11px',
          fontWeight: 500,
        }}
      >
        {showMinimap ? (
          <>
            <EyeOff size={13} />
            <span>Esconder Mapa</span>
          </>
        ) : (
          <>
            <Map size={13} />
            <span>Ver Mapa</span>
          </>
        )}
      </button>

      {nodes.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">🏗️</div>
          <h3 className="canvas-empty-title">Start Building</h3>
          <p className="canvas-empty-subtitle">Drag components from the left panel or load a preset from the toolbar</p>
        </div>
      )}
    </div>
  );
};

export const SimulatorCanvas: React.FC = () => (
  <ReactFlowProvider>
    <CanvasInner />
  </ReactFlowProvider>
);
