import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComponentPalette } from '../components/sidebar/ComponentPalette';
import { COMPONENT_DEFINITIONS, CATEGORIES } from '../engine/models/ComponentModel';
import { useSimulatorStore } from '../store/simulatorStore';

describe('ComponentPalette Component Suite', () => {
  beforeEach(() => {
    useSimulatorStore.getState().clearCanvas();
  });

  it('should contain all 34 system component definitions across 8 categories (including layer container)', () => {
    const definitionsCount = Object.keys(COMPONENT_DEFINITIONS).length;
    expect(definitionsCount).toBe(34);

    expect(CATEGORIES.length).toBe(8);
    const categoryIds = CATEGORIES.map((c) => c.id);
    expect(categoryIds).toEqual([
      'client',
      'traffic-edge',
      'compute',
      'storage',
      'messaging',
      'observability',
      'network',
      'layer',
    ]);
  });

  it('should render ComponentPalette structure cleanly when open', () => {
    const paletteElement = React.createElement(ComponentPalette, {
      isOpen: true,
      onClose: () => {},
    });
    expect(paletteElement).toBeDefined();

    const html = renderToStaticMarkup(paletteElement);
    expect(html).toContain('component-palette');
    expect(html).not.toContain('collapsed');
    expect(html).toContain('Search components...');
    expect(html).toContain('Start Tutorial');
  });

  it('should render collapsed class when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(ComponentPalette, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toContain('component-palette collapsed');
  });

  it('should filter component definitions based on search query', () => {
    const query = 'cache';
    const filtered = Object.values(COMPONENT_DEFINITIONS).filter((def) => {
      const q = query.toLowerCase();
      return (
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q)
      );
    });

    expect(filtered.some((d) => d.type === 'cache')).toBe(true);
    expect(filtered.some((d) => d.type === 'cdn')).toBe(true);
  });

  it('should trigger addNode when clicking on a component definition card', () => {
    const store = useSimulatorStore.getState();
    expect(store.nodes.length).toBe(0);

    useSimulatorStore.getState().addNode('app-server', { x: 300, y: 250 });

    const nodes = useSimulatorStore.getState().nodes;
    expect(nodes.length).toBe(1);
    expect(nodes[0].data.componentType).toBe('app-server');
    expect(nodes[0].position).toEqual({ x: 300, y: 250 });
  });

  it('should format HTML drag metadata correctly for HTML5 drag-and-drop', () => {
    const mockDataTransfer = {
      data: new Map<string, string>(),
      effectAllowed: '',
      setData(key: string, value: string) {
        this.data.set(key, value);
      },
    };

    const handleDragStart = (type: string, dataTransfer: typeof mockDataTransfer) => {
      dataTransfer.setData('application/sds-component', type);
      dataTransfer.effectAllowed = 'copy';
    };

    handleDragStart('kafka', mockDataTransfer);

    expect(mockDataTransfer.data.get('application/sds-component')).toBe('kafka');
    expect(mockDataTransfer.effectAllowed).toBe('copy');
  });
});
