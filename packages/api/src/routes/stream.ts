import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { runSimulationTickCore } from '@system-design/shared';

export const streamRoutes = new Hono();

// GET /stream — SSE live tick stream endpoint
streamRoutes.get('/stream', (c) => {
  return streamSSE(c, async (stream) => {
    let isAborted = false;
    stream.onAbort(() => {
      isAborted = true;
      console.log('⚡ SSE Stream closed by client');
    });

    try {
      await stream.writeSSE({
        data: JSON.stringify({ message: 'Connected to simulation tick stream engine', timestamp: new Date().toISOString() }),
        event: 'connected',
        id: '1',
      });
    } catch (err) {
      isAborted = true;
      console.error('⚡ SSE Stream initial write error:', err);
      return;
    }

    let tick = 1;
    const sampleNodes = [
      {
        id: 'node-client',
        data: {
          componentType: 'client',
          category: 'entry',
          config: { rps: 100 },
        },
      },
      {
        id: 'node-lb',
        data: {
          componentType: 'load_balancer',
          category: 'routing',
          config: { algorithm: 'round_robin' },
        },
      },
      {
        id: 'node-app',
        data: {
          componentType: 'app_server',
          category: 'compute',
          config: { replicas: 3, maxRpsPerReplica: 200 },
        },
      },
    ];
    const sampleEdges = [
      { id: 'e1', source: 'node-client', target: 'node-lb' },
      { id: 'e2', source: 'node-lb', target: 'node-app' },
    ];

    while (!isAborted) {
      const tickResult = runSimulationTickCore({
        nodes: sampleNodes,
        edges: sampleEdges,
        tick,
        globalTrafficScale: 100 + Math.sin(tick / 5) * 20,
      });

      try {
        await stream.writeSSE({
          data: JSON.stringify({
            tick,
            timestamp: new Date().toISOString(),
            totalRps: tickResult.totalRps,
            updatedMetrics: tickResult.updatedMetrics,
            updatedEdgeMetrics: tickResult.updatedEdgeMetrics,
            bottlenecks: tickResult.bottlenecks,
          }),
          event: 'tick',
          id: String(tick + 1),
        });
      } catch (err) {
        isAborted = true;
        console.error('⚡ SSE Stream write error on socket teardown:', err);
        break;
      }

      tick++;
      try {
        await stream.sleep(process.env.NODE_ENV === 'test' ? 50 : 1000);
      } catch (err) {
        isAborted = true;
        break;
      }
    }
  });
});
