import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { streamRoutes } from '../routes/stream.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Stream Routes Integration Tests (SSE)', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/simulation', streamRoutes);
  });

  it('should establish SSE stream connection with text/event-stream headers and emit connected/tick events', async () => {
    const res = await app.request('/api/v1/simulation/stream');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      let combined = '';
      // Read initial connected event and tick event
      for (let i = 0; i < 3; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        combined += new TextDecoder().decode(value);
        if (combined.includes('event: tick')) break;
      }

      expect(combined).toContain('event: connected');
      expect(combined).toContain('Connected to simulation tick stream engine');
      expect(combined).toContain('event: tick');
      expect(combined).toContain('"tick":1');

      // Cancel reader to close stream connection cleanly
      await reader.cancel();
    }
  });
});
