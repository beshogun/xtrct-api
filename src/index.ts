import { createServer } from './server.ts';
import { pool } from './browser/pool.ts';
import { startWorkers } from './queue/worker.ts';
import { startCleanup } from './cron/cleanup.ts';
import { proxyManager } from './proxy/manager.ts';
import { startAmazonSessionPool } from './scrapers/amazon-session.ts';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '4', 10);

// ── 1. HTTP server starts immediately (healthcheck passes) ──────────────────
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

// ── 2. Workers start immediately — handles HTTP jobs without browser pool ───
(async () => {
  try {
    await startWorkers(CONCURRENCY);
    startCleanup();
    console.log(`[workers] ${CONCURRENCY} workers started`);
  } catch (err) {
    console.error('[workers] Failed to start:', err);
  }
})();

// ── 3. Browser pool init in background — Playwright jobs wait until ready ───
(async () => {
  try {
    await pool.init();
    console.log(`[browser] Pool initialised (size: ${process.env.BROWSER_POOL_SIZE ?? 3})`);
  } catch (err) {
    console.error('[browser] Pool init failed:', err);
  }
})();

// ── 4. Proxy refresh if configured ─────────────────────────────────────────
if (process.env.WEBSHARE_API_KEY) {
  proxyManager.refreshWebshare().catch(err =>
    console.error('[proxy] Webshare refresh failed:', err)
  );
}

// ── 5. Amazon session pool — pre-warm cookies to reduce bot detection ────────
startAmazonSessionPool();
