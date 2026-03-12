import { Elysia } from 'elysia';
import { sql } from '../db/index.ts';
import type { Tier } from '../db/index.ts';

// Per-tier limits
const TIER_LIMITS: Record<Tier, { reqPerMin: number; maxQueueDepth: number }> = {
  free:       { reqPerMin: 10,   maxQueueDepth: 5 },
  starter:    { reqPerMin: 60,   maxQueueDepth: 50 },
  growth:     { reqPerMin: 200,  maxQueueDepth: 200 },
  enterprise: { reqPerMin: 1000, maxQueueDepth: Infinity },
  internal:   { reqPerMin: 1000, maxQueueDepth: Infinity },
};

const GLOBAL_QUEUE_LIMIT = 500;

export const rateLimitMiddleware = new Elysia({ name: 'rate-limit' })
  .derive({ as: 'scoped' }, async ({ request, set, apiKey }) => {
    // apiKey is attached by authMiddleware (which must be used before this)
    const tier    = apiKey.tier as Tier;
    const limits  = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    // ── 1. Sliding-window rate limit ─────────────────────────────────────────
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000); // truncate to minute

    const [row] = await sql`
      INSERT INTO rate_limit_windows (api_key_id, window_start, request_count)
      VALUES (${apiKey.id}, ${windowStart}, 1)
      ON CONFLICT (api_key_id, window_start)
      DO UPDATE SET request_count = rate_limit_windows.request_count + 1
      RETURNING request_count
    `;

    const count = row.requestCount as number;

    if (count > limits.reqPerMin) {
      set.status = 429;
      const retryAfter = 60 - Math.floor((Date.now() % 60_000) / 1000);
      (set.headers as Record<string, string>)['Retry-After'] = String(retryAfter);
      throw new Error(`Rate limit exceeded. Tier "${tier}" allows ${limits.reqPerMin} requests/minute.`);
    }

    // ── 2. Per-tier queue depth check ────────────────────────────────────────
    if (limits.maxQueueDepth !== Infinity) {
      const [depthRow] = await sql`
        SELECT COUNT(*)::int AS depth FROM scrape_jobs
        WHERE api_key_id = ${apiKey.id}
          AND status IN ('pending', 'running')
      `;
      const depth = depthRow.depth as number;

      if (depth >= limits.maxQueueDepth) {
        set.status = 429;
        (set.headers as Record<string, string>)['Retry-After'] = '10';
        throw new Error(`Queue depth limit (${limits.maxQueueDepth}) reached for tier "${tier}". Wait for jobs to complete.`);
      }
    }

    // ── 3. Global queue overload check ───────────────────────────────────────
    const [globalRow] = await sql`
      SELECT COUNT(*)::int AS depth FROM scrape_jobs WHERE status = 'pending'
    `;
    const globalDepth = globalRow.depth as number;

    if (globalDepth > GLOBAL_QUEUE_LIMIT) {
      set.status = 503;
      (set.headers as Record<string, string>)['Retry-After'] = '30';
      throw new Error('Service temporarily overloaded. Please retry in 30 seconds.');
    }

    return {};
  });
