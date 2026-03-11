import { Elysia } from 'elysia';
import { sql } from '../../db/index.ts';
import { proxyManager } from '../../proxy/manager.ts';

export const proxyRoutes = new Elysia()

  // GET /v1/proxy-stats
  .get('/proxy-stats', async ({ request, set }) => {
    const apiKeyStr = request.headers.get('x-api-key') ?? '';
    if (!apiKeyStr) {
      set.status = 401;
      return { error: 'Missing X-API-Key' };
    }

    const [key] = await sql`
      SELECT id, proxy_credits_remaining
      FROM api_keys
      WHERE key = ${apiKeyStr} AND active = true
      LIMIT 1
    `;
    if (!key) {
      set.status = 401;
      return { error: 'Invalid key' };
    }

    const stats = proxyManager.getStats();

    // Usage in the last 24 hours for this key
    const [usageRow] = await sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE success = true) AS successes
      FROM proxy_stats
      WHERE job_id IN (
        SELECT id FROM scrape_jobs
        WHERE api_key_id = ${key.id as string}
          AND created_at >= NOW() - INTERVAL '24 hours'
      )
    `;

    return {
      proxies_available: stats.total,
      healthy: stats.healthy,
      webshare_connected: proxyManager.isWebshareConnected(),
      credits_remaining: key.proxyCreditsRemaining as number,
      usage_last_24h: {
        total:    parseInt(usageRow?.total ?? '0', 10),
        success:  parseInt(usageRow?.successes ?? '0', 10),
      },
    };
  });
