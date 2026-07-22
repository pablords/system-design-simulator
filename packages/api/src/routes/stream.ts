import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

export const streamRoutes = new Hono();

// GET /stream — SSE live tick stream endpoint
streamRoutes.get('/stream', (c) => {
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      console.log('⚡ SSE Stream closed by client');
    });

    await stream.writeSSE({
      data: JSON.stringify({ message: 'Connected to simulation tick stream engine', timestamp: new Date().toISOString() }),
      event: 'connected',
      id: '1',
    });
  });
});
