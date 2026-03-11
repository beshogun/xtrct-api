import { sql } from '../db/index.ts';

const HOUR_MS = 60 * 60 * 1000;

async function runCleanup(): Promise<void> {
  try {
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

    console.log(
      `[cleanup] scrape_jobs=${jobsDeleted} webhook_deliveries=${deliveriesDeleted} usage_events=${usageDeleted}`
    );
  } catch (e) {
    console.error('[cleanup] error:', e instanceof Error ? e.message : String(e));
  }
}

export function startCleanup(): void {
  // Run once shortly after startup, then every hour
  setTimeout(() => runCleanup(), 30_000);
  setInterval(() => runCleanup(), HOUR_MS);
  console.log('[cleanup] Hourly cleanup scheduled');
}
