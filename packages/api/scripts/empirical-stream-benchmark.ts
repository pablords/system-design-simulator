import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamRoutes } from '../src/routes/stream.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import http from 'node:http';

const app = new Hono();
app.onError(errorHandler);
app.route('/api/v1/simulation', streamRoutes);

// Unhandled rejection & warning listener
const unhandledRejections: Error[] = [];
const processWarnings: any[] = [];

process.on('unhandledRejection', (reason) => {
  console.error('🚨 UNHANDLED REJECTION DETECTED:', reason);
  unhandledRejections.push(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('warning', (warning) => {
  console.warn('⚠️ PROCESS WARNING DETECTED:', warning);
  processWarnings.push(warning);
});

async function runEmpiricalBenchmark() {
  console.log('===============================================================');
  console.log('🚀 EMPIRICAL BENCHMARK: SSE Stream Endpoint (/api/v1/simulation/stream)');
  console.log('===============================================================');

  // 1. Start HTTP Server
  const server = serve({
    fetch: app.fetch,
    port: 0, // Random available port
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ HTTP Server started at ${baseUrl}`);

  const initialMemory = process.memoryUsage();
  console.log(`📊 Initial Memory: RSS ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB, HeapUsed ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // Section 1: Tick Propagation & SSE Header Verification
  console.log('\n---------------------------------------------------------------');
  console.log('1️⃣ TESTING SINGLE CLIENT SSE STREAM & TICK PROPAGATION');
  console.log('---------------------------------------------------------------');

  const streamUrl = `${baseUrl}/api/v1/simulation/stream`;
  
  const tickData: any[] = [];
  const startSingle = Date.now();

  await new Promise<void>((resolve, reject) => {
    const req = http.get(streamUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP status ${res.statusCode}`));
        return;
      }
      const contentType = res.headers['content-type'] || '';
      console.log(`  Headers: content-type = "${contentType}"`);
      if (!contentType.includes('text/event-stream')) {
        console.error('❌ FAIL: content-type header missing text/event-stream');
      } else {
        console.log('  ✓ Content-Type header valid (text/event-stream)');
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

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

          if (eventName === 'connected') {
            console.log(`  ✓ Connected Event received: id=${idStr}, payload=${dataStr}`);
          } else if (eventName === 'tick') {
            const parsed = JSON.parse(dataStr);
            tickData.push({ id: idStr, data: parsed, recTime: Date.now() });
            if (tickData.length >= 5) {
              req.destroy();
              resolve();
            }
          }
        }
      });

      res.on('error', (err) => {
        console.log('  Stream response error (expected on abort):', err.message);
      });
    });

    req.on('error', (_err) => {
      // ignore abort destroy error
      resolve();
    });
  });

  const durationSingle = Date.now() - startSingle;
  console.log(`  ✓ Received ${tickData.length} ticks in ${durationSingle}ms`);
  tickData.forEach((t) => {
    console.log(`    Tick ${t.data.tick}: totalRps=${t.data.totalRps.toFixed(2)}, metricsCount=${Object.keys(t.data.updatedMetrics).length}, bottlenecks=${t.data.bottlenecks.length}`);
  });

  // Section 2: Concurrency Test (50 simultaneous clients)
  console.log('\n---------------------------------------------------------------');
  console.log('2️⃣ TESTING MULTIPLE CONCURRENT SSE CLIENTS (50 Clients)');
  console.log('---------------------------------------------------------------');

  const CONCURRENCY = 50;
  const startConcurrent = Date.now();

  const concurrentPromises = Array.from({ length: CONCURRENCY }, (_, i) => {
    return new Promise<{ client: number; ticksReceived: number }>((resolve) => {
      let ticksReceived = 0;
      const req = http.get(streamUrl, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('event: tick')) {
            const matches = buffer.match(/event: tick/g);
            ticksReceived = matches ? matches.length : 1;
            if (ticksReceived >= 3) {
              req.destroy();
              resolve({ client: i, ticksReceived });
            }
          }
        });
        res.on('error', () => resolve({ client: i, ticksReceived }));
      });
      req.on('error', () => resolve({ client: i, ticksReceived }));
    });
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  const durationConcurrent = Date.now() - startConcurrent;
  const successfulClients = concurrentResults.filter((r) => r.ticksReceived >= 3).length;
  console.log(`  ✓ 50 Concurrent Clients Test finished in ${durationConcurrent}ms`);
  console.log(`  ✓ Successful clients (received >= 3 ticks): ${successfulClients}/${CONCURRENCY}`);

  const midMemory = process.memoryUsage();
  console.log(`  📊 Peak Concurrent Memory: RSS ${(midMemory.rss / 1024 / 1024).toFixed(2)} MB, HeapUsed ${(midMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // Section 3: Speed Adjustments Probe
  console.log('\n---------------------------------------------------------------');
  console.log('3️⃣ TESTING SPEED & INTERVAL QUERY PARAMETERS');
  console.log('---------------------------------------------------------------');

  const testQueryParams = [
    '',
    '?speed=2',
    '?speed=10',
    '?intervalMs=50',
    '?intervalMs=500',
    '?speed=0.1',
  ];

  for (const qp of testQueryParams) {
    const url = `${baseUrl}/api/v1/simulation/stream${qp}`;
    const startQ = Date.now();
    let ticks = 0;
    await new Promise<void>((resolve) => {
      const req = http.get(url, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const matches = buffer.match(/event: tick/g);
          if (matches) {
            ticks = matches.length;
            if (ticks >= 3) {
              req.destroy();
              resolve();
            }
          }
        });
        res.on('error', () => resolve());
      });
      req.on('error', () => resolve());
    });
    const dur = Date.now() - startQ;
    console.log(`  Query "${qp.padEnd(20)}": Received 3 ticks in ${dur}ms`);
  }

  // Section 4: Abort Cleanup & Listener Leak Stress Test
  console.log('\n---------------------------------------------------------------');
  console.log('4️⃣ TESTING CLIENT ABORT DISCONNECT CLEANUP & LISTENER LEAKS (100 Abort Cycles)');
  console.log('---------------------------------------------------------------');

  const ABORT_CYCLES = 100;
  const startAbort = Date.now();

  for (let i = 0; i < ABORT_CYCLES; i++) {
    await new Promise<void>((resolve) => {
      const req = http.get(streamUrl, (res) => {
        // Immediately destroy socket upon receiving headers/first data chunk
        res.on('data', () => {
          req.destroy();
          resolve();
        });
        res.on('error', () => resolve());
      });
      req.on('error', () => resolve());
      // Fallback timeout in case no data
      setTimeout(() => {
        req.destroy();
        resolve();
      }, 50);
    });
  }

  const durationAbort = Date.now() - startAbort;
  console.log(`  ✓ Completed ${ABORT_CYCLES} rapid connect & abort cycles in ${durationAbort}ms`);

  // Allow event loop to process any pending async cleanups
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Section 5: Diagnostic Verification
  console.log('\n---------------------------------------------------------------');
  console.log('5️⃣ DIAGNOSTIC SUMMARY & EMPIRICAL VERIFICATION');
  console.log('---------------------------------------------------------------');

  const finalMemory = process.memoryUsage();
  console.log(`  📊 Final Memory: RSS ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB, HeapUsed ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  🚨 Unhandled Rejections Count: ${unhandledRejections.length}`);
  console.log(`  ⚠️ Process Warning Count (e.g., EventEmitter leaks): ${processWarnings.length}`);

  if (processWarnings.length > 0) {
    console.log('  Warnings details:', processWarnings);
  }

  // Close server
  server.close();
  console.log('\n✅ Empirical benchmark run finished successfully.');
}

runEmpiricalBenchmark().catch((err) => {
  console.error('Fatal error in empirical benchmark:', err);
  process.exit(1);
});
