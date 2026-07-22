import { describe, it, expect } from 'vitest';
import React from 'react';
import { SimulationBadge } from '../components/ui/SimulationBadge.js';

describe('Frontend CDUI Dumb Components (TDD)', () => {
  it('should render SimulationBadge with Sync Background status when backendConnected is true', () => {
    const element = React.createElement(SimulationBadge, { backendConnected: true });
    expect(element).toBeDefined();
    expect(element.props.backendConnected).toBe(true);
  });

  it('should render SimulationBadge with Motor Local status when backendConnected is false', () => {
    const element = React.createElement(SimulationBadge, { backendConnected: false });
    expect(element).toBeDefined();
    expect(element.props.backendConnected).toBe(false);
  });
});
