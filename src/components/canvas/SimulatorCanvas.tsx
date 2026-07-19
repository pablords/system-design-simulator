import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComponentNode } from './ComponentNode';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ComponentType } from '../../types';

import { ConnectionEdge } from './ConnectionEdge';

const nodeTypes = { simulatorNode: ComponentNode };
const edgeTypes = { connectionEdge: ConnectionEdge };

const CanvasInner: React.FC = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode } = useSimulatorStore();
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
    },
    [screenToFlowPosition, addNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div ref={reactFlowWrapper} className="canvas-wrapper" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
      </ReactFlow>

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
