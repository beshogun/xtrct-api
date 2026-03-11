import { createServer } from './server.ts';
import { pool } from './browser/pool.ts';
import { startWorkers } from './queue/worker.ts';
import { startCleanup } from './cron/cleanup.ts';
import { proxyManager } from './proxy/manager.ts';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '4', 10);

// Start HTTP server FIRST so healthcheck passes immediately
const app = createServer();
app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[server] Shutting down...');
  await pool.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// Init browser pool, workers, cleanup in background (non-blocking)
(async () => {
  try {
    await pool.init();
    console.log(`[browser] Pool initialised (size: ${process.env.BROWSER_POOL_SIZE ?? 3})`);

    if (process.env.WEBSHARE_API_KEY) {
      await proxyManager.refreshWebshare();
    }

    await startWorkers(CONCURRENCY);
    startCleanup();
    console.log(`[workers] Ready`);
  } catch (err) {
    console.error('[startup] Background init failed:', err);
  }
})();
