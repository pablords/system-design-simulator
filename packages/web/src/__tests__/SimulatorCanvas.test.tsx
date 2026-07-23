import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (!globalThis.window.addEventListener) {
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
}
if (!globalThis.window.location) {
  (globalThis.window as any).location = { hostname: 'localhost' };
}

import { SimulatorCanvas } from '../components/canvas/SimulatorCanvas';
import { useSimulatorStore } from '../store/simulatorStore';

describe('SimulatorCanvas Component Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useSimulatorStore.getState().clearCanvas();
  });

  it('should render SimulatorCanvas element structure cleanly inside ReactFlowProvider', () => {
    const canvasElement = React.createElement(SimulatorCanvas);
    expect(canvasElement).toBeDefined();
    expect(canvasElement.type).toBe(SimulatorCanvas);
  });

  it('should render empty canvas placeholder when no nodes exist', () => {
    const html = renderToStaticMarkup(React.createElement(SimulatorCanvas));
    expect(html).toContain('Start Building');
    expect(html).toContain('Drag components from the left panel');
  });

  it('should render canvas wrapper element cleanly', () => {
    const html = renderToStaticMarkup(React.createElement(SimulatorCanvas));
    expect(html).toContain('canvas-wrapper');
  });

  it('should reflect showMinimap state toggle', () => {
    const htmlBefore = renderToStaticMarkup(React.createElement(SimulatorCanvas));
    expect(htmlBefore).toContain('Esconder Mapa');

    useSimulatorStore.getState().toggleMinimap();
    const isMinimapVisible = useSimulatorStore.getState().showMinimap;
    expect(isMinimapVisible).toBe(false);
  });

  it('should evaluate MiniMap nodeColor mapping correctly for status levels', () => {
    const nodeColorResolver = (node: any) => {
      const status = node?.data?.metrics?.status;
      if (status === 'critical') return '#ef4444';
      if (status === 'warning') return '#f59e0b';
      if (status === 'ok') return '#22c55e';
      return '#334155';
    };

    expect(nodeColorResolver({ data: { metrics: { status: 'critical' } } })).toBe('#ef4444');
    expect(nodeColorResolver({ data: { metrics: { status: 'warning' } } })).toBe('#f59e0b');
    expect(nodeColorResolver({ data: { metrics: { status: 'ok' } } })).toBe('#22c55e');
    expect(nodeColorResolver({ data: { metrics: { status: 'idle' } } })).toBe('#334155');
    expect(nodeColorResolver({})).toBe('#334155');
  });

  it('should simulate screenToFlowPosition drag-and-drop position calculation', () => {
    const mockScreenToFlowPosition = (screenPos: { x: number; y: number }) => {
      return { x: screenPos.x - 50, y: screenPos.y - 100 };
    };

    const dropEventCoordinates = { clientX: 250, clientY: 300 };
    const flowPosition = mockScreenToFlowPosition({ x: dropEventCoordinates.clientX, y: dropEventCoordinates.clientY });

    expect(flowPosition).toEqual({ x: 200, y: 200 });

    useSimulatorStore.getState().addNode('sql-database', flowPosition);
    const nodes = useSimulatorStore.getState().nodes;
    expect(nodes.length).toBe(1);
    expect(nodes[0].position).toEqual({ x: 200, y: 200 });
  });
});
