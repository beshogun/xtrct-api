import { sql } from '../db/index.ts';

const ANALYSER_INTERVAL_MS = 60 * 60 * 1000; // every hour

function chainPosition(strategy: string): number {
  return ({ slipstream: 0, http: 1, playwright: 2, flaresolverr: 3 } as Record<string, number>)[strategy] ?? 99;
}

export async function runStrategyAnalyser(): Promise<void> {
  try {
    // 1. Aggregate last 7 days of telemetry per domain + strategy + proxy_tier (min 10 samples)
    const stats = await sql`
      SELECT
        domain,
        strategy,
        proxy_tier,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float AS success_rate,
        AVG(time_ms)::int                                    AS avg_time_ms,
        AVG(cost_credits)::float                             AS avg_cost_credits,
        COUNT(*)::int                                        AS sample_count
      FROM scrape_telemetry
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY domain, strategy, proxy_tier
      HAVING COUNT(*) >= 10
    `;

    if (stats.length === 0) return;

    // 2. Per domain: pick winner using priority order:
    //    a) success_rate >= 0.85 beats any that doesn't qualify
    //    b) Among qualifying: lowest avg_cost_credits
    //    c) Tie on cost: lowest avg_time_ms
    //    d) No qualifier: highest success_rate, then lowest cost, then lowest time
    //    e) Complete tie: earlier chain position (slipstream < http < playwright < flaresolverr)
    type StatRow = typeof stats[0];
    const winners = new Map<string, StatRow>();

    for (const row of stats) {
      const current = winners.get(row.domain);
      const qualifies = row.successRate >= 0.85;

      if (!current) {
        winners.set(row.domain, row);
        continue;
      }

      const currentQualifies = current.successRate >= 0.85;

      if (qualifies && !currentQualifies) {
        winners.set(row.domain, row);
        continue;
      }

      if (qualifies === currentQualifies) {
        const rowPos = chainPosition(row.strategy);
        const curPos = chainPosition(current.strategy);
        const better =
          (!qualifies && row.successRate > current.successRate) ||
          (row.avgCostCredits < current.avgCostCredits) ||
          (row.avgCostCredits === current.avgCostCredits && row.avgTimeMs < current.avgTimeMs) ||
          (row.avgCostCredits === current.avgCostCredits &&
           row.avgTimeMs === current.avgTimeMs &&
           row.successRate === current.successRate &&
           rowPos < curPos);
        if (better) winners.set(row.domain, row);
      }
    }

    // 3. Upsert winners — skip locked domains
    let updated = 0;
    for (const [domain, row] of winners) {
      await sql`
        INSERT INTO domain_strategies
          (domain, optimal_strategy, proxy_tier, success_rate,
           avg_time_ms, avg_cost_credits, sample_count, computed_at)
        VALUES (
          ${domain}, ${row.strategy}, ${row.proxyTier}, ${row.successRate},
          ${row.avgTimeMs}, ${row.avgCostCredits}, ${row.sampleCount}, NOW()
        )
        ON CONFLICT (domain) DO UPDATE SET
          optimal_strategy = EXCLUDED.optimal_strategy,
          proxy_tier       = EXCLUDED.proxy_tier,
          success_rate     = EXCLUDED.success_rate,
          avg_time_ms      = EXCLUDED.avg_time_ms,
          avg_cost_credits = EXCLUDED.avg_cost_credits,
          sample_count     = EXCLUDED.sample_count,
          computed_at      = NOW()
        WHERE NOT domain_strategies.locked
      `;
      updated++;
    }

    console.log(`[strategy-analyser] Processed ${stats.length} domain/strategy combos → updated ${updated} domain strategies`);
  } catch (err) {
    console.error('[strategy-analyser] error:', err instanceof Error ? err.message : String(err));
  }
}

export function startStrategyAnalyser(): void {
  // Run 2 minutes after startup (give server time to warm up), then hourly
  setTimeout(() => runStrategyAnalyser(), 2 * 60 * 1000);
  setInterval(() => runStrategyAnalyser(), ANALYSER_INTERVAL_MS);
  console.log('[strategy-analyser] Hourly strategy analyser scheduled');
}
