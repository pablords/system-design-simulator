import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { streamRoutes } from '../routes/stream.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Empirical SSE Stream Testing Suite (/api/v1/simulation/stream)', () => {
  let app: Hono;
  let unhandledRejections: Error[] = [];
  let warningEvents: any[] = [];

  const onUnhandledRejection = (reason: any) => {
    unhandledRejections.push(reason instanceof Error ? reason : new Error(String(reason)));
  };

  const onWarning = (warning: any) => {
    warningEvents.push(warning);
  };

  beforeEach(() => {
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/simulation', streamRoutes);
    unhandledRejections = [];
    warningEvents = [];
    process.on('unhandledRejection', onUnhandledRejection);
    process.on('warning', onWarning);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
    process.off('warning', onWarning);
  });

  it('1. Single Client Stream: Header verification and continuous tick propagation', async () => {
    const res = await app.request('/api/v1/simulation/stream');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    const ticks: any[] = [];
    let combined = '';
    const decoder = new TextDecoder();

    // Read 5 chunks
    for (let i = 0; i < 6; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      combined += decoder.decode(value, { stream: true });

      const events = combined.split('\n\n');
      // Keep unfinished part in combined
      combined = events.pop() || '';

      for (const evt of events) {
        if (!evt.trim()) continue;
        const lines = evt.split('\n');
        let eventName = '';
        let dataStr = '';
        let idStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) dataStr = line.slice(5).trim();
          if (line.startsWith('id:')) idStr = line.slice(3).trim();
        }

        if (eventName === 'tick' && dataStr) {
          const parsed = JSON.parse(dataStr);
          ticks.push({ id: idStr, data: parsed });
        }
      }

      if (ticks.length >= 3) break;
    }

    await reader.cancel();

    expect(ticks.length).toBeGreaterThanOrEqual(3);

    // Verify tick monotonicity & schema
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].data).toHaveProperty('tick');
      expect(ticks[i].data).toHaveProperty('timestamp');
      expect(ticks[i].data).toHaveProperty('totalRps');
      expect(ticks[i].data).toHaveProperty('updatedMetrics');
      expect(ticks[i].data).toHaveProperty('updatedEdgeMetrics');
      expect(ticks[i].data).toHaveProperty('bottlenecks');
      expect(typeof ticks[i].data.tick).toBe('number');
      expect(typeof ticks[i].data.totalRps).toBe('number');

      if (i > 0) {
        expect(ticks[i].data.tick).toBe(ticks[i - 1].data.tick + 1);
      }
    }
  });

  it('2. Multiple Concurrent Client Connections: 20 simultaneous SSE streams', async () => {
    const CONCURRENCY = 20;
    const streamPromises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
      const res = await app.request('/api/v1/simulation/stream');
      expect(res.status).toBe(200);

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      if (!reader) return null;

      const decoder = new TextDecoder();
      let chunks = '';
      let receivedTicks = 0;

      for (let i = 0; i < 4; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks += decoder.decode(value, { stream: true });
        if (chunks.includes('event: tick')) {
          receivedTicks++;
        }
        if (receivedTicks >= 2) break;
      }

      await reader.cancel();
      return { clientIdx: idx, receivedTicks };
    });

    const results = await Promise.all(streamPromises);

    expect(results.length).toBe(CONCURRENCY);
    results.forEach((res) => {
      expect(res).not.toBeNull();
      expect(res?.receivedTicks).toBeGreaterThanOrEqual(2);
    });

    expect(unhandledRejections.length).toBe(0);
  });

  it('3. Speed Adjustment Probe: Testing speed/interval parameters on query string', async () => {
    // Request with fast speed query params
    const resFast = await app.request('/api/v1/simulation/stream?speed=5&intervalMs=10');
    expect(resFast.status).toBe(200);

    const readerFast = resFast.body?.getReader();
    const startFast = Date.now();
    let countFast = 0;
    if (readerFast) {
      for (let i = 0; i < 3; i++) {
        const { done } = await readerFast.read();
        if (done) break;
        countFast++;
      }
      await readerFast.cancel();
    }
    const durationFast = Date.now() - startFast;

    // Request default
    const resNormal = await app.request('/api/v1/simulation/stream');
    const readerNormal = resNormal.body?.getReader();
    const startNormal = Date.now();
    let countNormal = 0;
    if (readerNormal) {
      for (let i = 0; i < 3; i++) {
        const { done } = await readerNormal.read();
        if (done) break;
        countNormal++;
      }
      await readerNormal.cancel();
    }
    const durationNormal = Date.now() - startNormal;

    // Note: We record empirical timing to see if query parameters change interval
    console.log(`[EMPIRICAL] Stream durationFast: ${durationFast}ms (${countFast} reads), durationNormal: ${durationNormal}ms (${countNormal} reads)`);
  });

  it('4. Disconnect & Cleanup Stress: Rapid connect and immediate abort (50 iterations)', async () => {
    const ITERATIONS = 50;

    for (let i = 0; i < ITERATIONS; i++) {
      const res = await app.request('/api/v1/simulation/stream');
      const reader = res.body?.getReader();
      if (reader) {
        // Read initial chunk then immediately cancel/abort
        await reader.read();
        await reader.cancel('Client aborted connection empirically');
      }
    }

    // Wait 150ms for any potential pending loops to finish or trigger rejection
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(unhandledRejections.length).toBe(0);
    expect(warningEvents.filter((w) => w?.name === 'MaxListenersExceededWarning').length).toBe(0);
  });

  it('5. Abort before reading any data', async () => {
    const res = await app.request('/api/v1/simulation/stream');
    const reader = res.body?.getReader();
    if (reader) {
      await reader.cancel('Immediate abort');
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(unhandledRejections.length).toBe(0);
  });
});
