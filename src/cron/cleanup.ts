import { sql } from '../db/index.ts';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

async function runCleanup(): Promise<void> {
  try {
    // Mark stale running jobs as failed (zombie detection)
    // Jobs running > 10 minutes have definitely lost their worker process
    const [zombieRow] = await sql`
      WITH killed AS (
        UPDATE scrape_jobs
        SET status = 'failed', error = 'Timed out: worker process restarted or job exceeded max duration'
        WHERE status = 'running'
          AND started_at < NOW() - INTERVAL '10 minutes'
        RETURNING id
      )
      SELECT COUNT(*) AS n FROM killed
    `;
    const zombiesKilled = Number(zombieRow?.n ?? 0);
    if (zombiesKilled > 0) {
      console.log(`[cleanup] Killed ${zombiesKilled} zombie running jobs`);
    }

    // Delete completed/failed scrape jobs older than 7 days
    const [jobsRow] = await sql`
      WITH deleted AS (
        DELETE FROM scrape_jobs
        WHERE completed_at < NOW() - INTERVAL '7 days'
          AND status IN ('done', 'failed')
        RETURNING id
      )
      SELECT COUNT(*) AS n FROM deleted
    `;
    const jobsDeleted = Number(jobsRow?.n ?? 0);

    // Delete webhook deliveries older than 30 days
    const [deliveriesRow] = await sql`
      WITH deleted AS (
        DELETE FROM webhook_deliveries
        WHERE attempted_at < NOW() - INTERVAL '30 days'
        RETURNING id
      )
      SELECT COUNT(*) AS n FROM deleted
    `;
    const deliveriesDeleted = Number(deliveriesRow?.n ?? 0);

    // Delete usage events older than 90 days
    const [usageRow] = await sql`
      WITH deleted AS (
        DELETE FROM usage_events
        WHERE recorded_at < NOW() - INTERVAL '90 days'
        RETURNING id
      )
      SELECT COUNT(*) AS n FROM deleted
    `;
    const usageDeleted = Number(usageRow?.n ?? 0);

    // Delete stale rate limit windows older than 2 minutes (they are 1-min buckets)
    await sql`
      DELETE FROM rate_limit_windows
      WHERE window_start < NOW() - INTERVAL '2 minutes'
    `;

    // Delete scrape_telemetry older than 30 days
    await sql`
      DELETE FROM scrape_telemetry
      WHERE created_at < NOW() - INTERVAL '30 days'
    `;

    // Delete stale domain_strategies for domains not seen in 14 days (locked rows exempt)
    await sql`
      DELETE FROM domain_strategies
      WHERE computed_at < NOW() - INTERVAL '14 days'
        AND NOT locked
    `;

    console.log(
      `[cleanup] scrape_jobs=${jobsDeleted} webhook_deliveries=${deliveriesDeleted} usage_events=${usageDeleted}`
    );
  } catch (e) {
    console.error('[cleanup] error:', e instanceof Error ? e.message : String(e));
  }
}

export function startCleanup(): void {
  // Run once shortly after startup, then every 10 minutes
  setTimeout(() => runCleanup(), 30_000);
  setInterval(() => runCleanup(), CLEANUP_INTERVAL_MS);
  console.log('[cleanup] Hourly cleanup scheduled');
}
