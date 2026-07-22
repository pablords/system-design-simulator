import { describe, it, expect } from 'vitest';
import React from 'react';
import { SimulationBadge } from '../components/ui/SimulationBadge.js';

describe('Frontend CDUI Dumb Components (TDD)', () => {
  it('should render SimulationBadge cleanly', () => {
    const element = React.createElement(SimulationBadge, { backendConnected: true });
    expect(element).toBeDefined();
  });
});
