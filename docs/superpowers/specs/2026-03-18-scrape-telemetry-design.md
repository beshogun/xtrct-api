# Scrape Telemetry & Auto-Learning Strategy Design

**Goal:** Log every escalation step attempted by `strategy.ts`, analyse outcomes per domain, and automatically apply the cheapest/fastest proven strategy on future scrapes — across all Xtrct customers.

**Architecture:** Telemetry is written inside `strategy.ts` as a fire-and-forget batch insert after each request. A background analyser job runs hourly, crunches the last 7 days of telemetry per domain, and writes the optimal strategy to a `domain_strategies` table. `runAuto()` consults that table at the start of each scrape and jumps straight to the proven step, falling through to the full chain on failure.

**Tech Stack:** Bun + TypeScript, Postgres (Neon), Elysia, existing `src/db/index.ts` SQL client, existing `src/cron/cleanup.ts` cron pattern.

---

## Scope

This is a scraper-api (Xtrct) feature. All customers' scrapes contribute to domain telemetry. Domain strategy knowledge is operational (not sensitive) — knowing "slipstream works for currys.co.uk" benefits everyone.

---

## Data Model

### `scrape_telemetry`

One row per escalation step attempted. Written in batch at the end of each `runStrategy()` call.

```sql
CREATE TABLE scrape_telemetry (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        VARCHAR     NOT NULL,   -- hostname without www, e.g. 'currys.co.uk'
  step_index    INT         NOT NULL,   -- order within this request's chain (0, 1, 2...)
  strategy      VARCHAR     NOT NULL,   -- 'slipstream' | 'http' | 'playwright' | 'flaresolverr'
  proxy_tier    VARCHAR     NOT NULL,   -- 'none' | 'datacenter' | 'residential' | 'isp'
  success       BOOLEAN     NOT NULL,
  blocked       BOOLEAN     NOT NULL DEFAULT false, -- CF/bot wall hit
  time_ms       INT         NOT NULL,
  cost_credits  INT         NOT NULL DEFAULT 0,
  error_type    VARCHAR,                -- 'cloudflare' | 'timeout' | 'network' | 'parse' | NULL
  api_key_id    UUID,                   -- which customer triggered this (NULL = internal)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scrape_telemetry_domain_created ON scrape_telemetry (domain, created_at DESC);
CREATE INDEX scrape_telemetry_created ON scrape_telemetry (created_at DESC);
```

Retention: rows older than 30 days are deleted by the existing cleanup cron.

### `domain_strategies`

One row per domain — the analyser's computed optimal strategy. The strategy engine reads from this table.

```sql
CREATE TABLE domain_strategies (
  domain           VARCHAR     PRIMARY KEY,
  optimal_strategy VARCHAR     NOT NULL, -- 'slipstream' | 'http' | 'playwright' | 'flaresolverr'
  proxy_tier       VARCHAR     NOT NULL, -- 'none' | 'datacenter' | 'residential' | 'isp'
  success_rate     FLOAT       NOT NULL, -- 0.0–1.0 over last 7 days
  avg_time_ms      INT         NOT NULL,
  avg_cost_credits FLOAT       NOT NULL,
  sample_count     INT         NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked           BOOLEAN     NOT NULL DEFAULT false -- if true, analyser won't overwrite
);
```

**One row per domain** — the analyser evaluates all `strategy + proxy_tier` combos but writes only the single winner. The `locked` flag allows manual ops-only pinning (direct DB update, e.g. force Amazon to always use FlareSolverr). Locked rows are **never updated by the analyser** and are **exempt from the 14-day cleanup** — they persist until manually unlocked. Unlocked rows older than 2 hours are not consulted by `getLearnedStrategy()` (the full chain runs instead), but remain in the DB until the 14-day cleanup removes them. Low-confidence rows (fewer than 10 samples) that age out will simply be rebuilt from fresh scrapes.

**Credit costs per strategy step** — these are the 8 steps of the escalation chain in execution order. Slipstream runs via the ISP-tier Webshare proxy internally; it has no proxy-tier variants from the caller's perspective.

| Step | Strategy | Proxy Tier | Credits |
|------|----------|-----------|---------|
| 0 | slipstream | isp (internal) | 1 |
| 1 | http | none | 1 |
| 2 | http | datacenter | 2 |
| 3 | http | residential | 5 |
| 4 | playwright | none | 3 |
| 5 | playwright | datacenter | 5 |
| 6 | playwright | residential | 10 |
| 7 | flaresolverr | residential | 8 |

**`api_key_id`** is recorded for future per-customer debugging (e.g. "which customers drove the Currys strategy learning?") and potential future per-customer strategy isolation. It is not used in analysis in this iteration.

---

## Instrumentation in `strategy.ts`

### StepAttempt type (internal)

```typescript
type StepAttempt = {
  stepIndex: number;
  strategy: 'slipstream' | 'http' | 'playwright' | 'flaresolverr';
  proxyTier: 'none' | 'datacenter' | 'residential' | 'isp';
  success: boolean;
  blocked: boolean;
  timeMs: number;
  costCredits: number;
  errorType: 'cloudflare' | 'timeout' | 'network' | 'parse' | null;
};
```

### `attempt()` helper

Wraps each escalation step. Records timing and outcome regardless of success or failure.

```typescript
async function attempt(
  steps: StepAttempt[],
  stepIndex: number,
  strategy: StepAttempt['strategy'],
  proxyTier: StepAttempt['proxyTier'],
  costCredits: number,
  fn: () => Promise<StrategyResult>
): Promise<StrategyResult | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ stepIndex, strategy, proxyTier, success: true, blocked: false,
                 timeMs: Date.now() - t0, costCredits, errorType: null });
    return result;
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({ stepIndex, strategy, proxyTier, success: false,
                 blocked: errorType === 'cloudflare',
                 timeMs: Date.now() - t0, costCredits, errorType });
    return null;
  }
}
```

### `classifyError()` helper

```typescript
function classifyError(err: unknown): StepAttempt['errorType'] {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cloudflare|cf-ray|403|challenge/i.test(msg)) return 'cloudflare';
  if (/timeout|timed out/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return 'network';
  return 'parse';
}
```

### `writeTelemetry()` — fire-and-forget

Called at the end of `runStrategy()`. Never throws, never blocks the response.

```typescript
async function writeTelemetry(
  domain: string,
  steps: StepAttempt[],
  apiKeyId: string | null
): Promise<void> {
  if (steps.length === 0) return;
  await sql`
    INSERT INTO scrape_telemetry
      (domain, step_index, strategy, proxy_tier, success, blocked, time_ms, cost_credits, error_type, api_key_id)
    SELECT * FROM json_to_recordset(${JSON.stringify(steps.map(s => ({
      domain,
      step_index:    s.stepIndex,
      strategy:      s.strategy,
      proxy_tier:    s.proxyTier,
      success:       s.success,
      blocked:       s.blocked,
      time_ms:       s.timeMs,
      cost_credits:  s.costCredits,
      error_type:    s.errorType,
      api_key_id:    apiKeyId ?? null,
    })))}}
    AS t(domain varchar, step_index int, strategy varchar, proxy_tier varchar,
         success boolean, blocked boolean, time_ms int, cost_credits int,
         error_type varchar, api_key_id uuid)
  `;
}
```

### Integration point in `runStrategy()`

Both `runForced()` and `runAuto()` receive the `steps` array and are responsible for pushing `StepAttempt` entries into it via `attempt()`. `runStrategy()` owns the array and writes it in the `finally` block — so telemetry is captured regardless of which path runs.

```typescript
export async function runStrategy(url: string, opts: RunOptions = {}): Promise<StrategyResult> {
  const steps: StepAttempt[] = [];
  const domain = new URL(url).hostname.replace(/^www\./, '');

  try {
    const result = opts.strategy
      ? await runForced(url, opts, steps)  // single step logged
      : await runAuto(url, opts, steps);   // 1–N steps logged
    return result;
  } finally {
    writeTelemetry(domain, steps, opts.apiKeyId ?? null).catch(() => {});
  }
}
```

`runForced()` logs exactly one step — whichever strategy was forced. `runAuto()` logs one step per escalation attempt until one succeeds or all are exhausted.

---

## Strategy Lookup in `runAuto()`

At the start of `runAuto()`, before the escalation chain:

```typescript
async function getLearnedStrategy(domain: string): Promise<DomainStrategy | null> {
  const [row] = await sql`
    SELECT optimal_strategy, proxy_tier, success_rate, sample_count
    FROM domain_strategies
    WHERE domain = ${domain}
      AND computed_at > NOW() - INTERVAL '2 hours'
      AND sample_count >= 10
      AND success_rate >= 0.85
  `;
  return row ?? null;
}
```

`runAuto()` uses the learned strategy as its starting step. If the learned strategy fails, it falls through to the next step in the chain as normal. The failure is logged, causing the analyser to recompute within the hour.

Steps skipped due to the learned strategy are **not** logged — only attempted steps appear in telemetry. The `step_index` reflects execution order within the request (0, 1, 2...), not position in the full 8-step chain. A step never attempted is not a failure — the analyser computes success rates only over steps that were actually tried. When a learned strategy fails and falls through, subsequent steps **are** logged normally. The analyser detects degradation because the previously-winning strategy's success_rate drops below 0.85 over the 7-day window, triggering a recompute.

---

## Background Analyser Job

**File:** `src/cron/strategy-analyser.ts`

**Schedule:** Hourly, registered in `src/index.ts` alongside `startCleanup()`.

**Logic:**

```typescript
export async function runStrategyAnalyser(): Promise<void> {
  // 1. Aggregate last 7 days of telemetry per domain + strategy + proxy_tier
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

  // 2. Per domain: pick the best strategy using a strict priority order:
  //    a) Prefer any combo with success_rate >= 0.85 over one without
  //    b) Among qualifying combos: lowest avg_cost_credits wins
  //    c) Tie on cost: lowest avg_time_ms wins
  //    d) If NO combo qualifies (all below 0.85): pick highest success_rate,
  //       then lowest cost, then lowest time — so the system still improves
  //       incrementally rather than giving up
  //    e) Complete tie on all dimensions: prefer earlier step in chain
  //       (slipstream=0 > http=1-3 > playwright=4-6 > flaresolverr=7)
  const winners = new Map<string, typeof stats[0]>();
  for (const row of stats) {
    const current = winners.get(row.domain);
    const qualifies = row.success_rate >= 0.85;
    if (!current) {
      winners.set(row.domain, row);
    } else {
      const currentQualifies = current.success_rate >= 0.85;
      if (qualifies && !currentQualifies) {
        // New row qualifies, current doesn't — always prefer qualifying
        winners.set(row.domain, row);
      } else if (qualifies === currentQualifies) {
        // Both qualify or neither does
        const rowChainPos = chainPosition(row.strategy);
        const curChainPos = chainPosition(current.strategy);
        const better =
          // Neither qualifies: higher success_rate wins first
          (!qualifies && row.success_rate > current.success_rate) ||
          // Lower cost
          (row.avg_cost_credits < current.avg_cost_credits) ||
          // Same cost, lower time
          (row.avg_cost_credits === current.avg_cost_credits && row.avg_time_ms < current.avg_time_ms) ||
          // Complete tie: prefer earlier in chain (slipstream < http < playwright < flaresolverr)
          (row.avg_cost_credits === current.avg_cost_credits &&
           row.avg_time_ms === current.avg_time_ms &&
           row.success_rate === current.success_rate &&
           rowChainPos < curChainPos);
        if (better) winners.set(row.domain, row);
      }
    }
  }

  // chainPosition: for tiebreaking — lower = prefer
  // slipstream(0) < http(1) < playwright(2) < flaresolverr(3)
  function chainPosition(strategy: string): number {
    return { slipstream: 0, http: 1, playwright: 2, flaresolverr: 3 }[strategy] ?? 99;
  }

  // 3. Upsert winners — skip locked domains
  for (const [domain, row] of winners) {
    await sql`
      INSERT INTO domain_strategies
        (domain, optimal_strategy, proxy_tier, success_rate, avg_time_ms, avg_cost_credits, sample_count, computed_at)
      VALUES
        (${domain}, ${row.strategy}, ${row.proxy_tier}, ${row.success_rate},
         ${row.avg_time_ms}, ${row.avg_cost_credits}, ${row.sample_count}, NOW())
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
  }

  console.log(`[strategy-analyser] Updated ${winners.size} domain strategies`);
}
```

---

## Retention & Cleanup

The existing `src/cron/cleanup.ts` is extended with two deletions:

```typescript
// Telemetry: keep 30 days
await sql`DELETE FROM scrape_telemetry WHERE created_at < NOW() - INTERVAL '30 days'`;

// Domain strategies: remove stale entries for domains not seen in 14 days
// (no recent telemetry = no useful signal; lookup already ignores >2hr old rows)
await sql`
  DELETE FROM domain_strategies
  WHERE computed_at < NOW() - INTERVAL '14 days'
    AND NOT locked
`;
```

---

## Files Changed / Created

| Action | File |
|--------|------|
| Create | `src/cron/strategy-analyser.ts` |
| Modify | `src/scrapers/strategy.ts` — add `StepAttempt`, `attempt()`, `classifyError()`, `writeTelemetry()`, `getLearnedStrategy()`, wire into `runAuto()` and `runStrategy()` |
| Modify | `src/cron/cleanup.ts` — add 30-day telemetry retention |
| Modify | `src/index.ts` — register hourly analyser cron |
| Modify | `src/db/migrate.ts` — add migrations for `scrape_telemetry` and `domain_strategies` |

---

## What This Enables

- **Auto-preset for new retailers:** Add Sony UK to the DB with no `scraper_preset`. First scrape runs the full chain. After 10+ attempts, the system knows the optimal path and uses it automatically.
- **Cost visibility:** Query `domain_strategies` to see avg cost per domain — Currys costs X credits, Amazon costs Y.
- **Degradation detection:** If a domain's learned strategy starts failing (bot detection update), telemetry catches it within hours and the analyser recomputes.
- **Manual overrides:** Set `locked = true` on any domain to pin its strategy without the analyser overwriting it.
- **Cross-customer learning:** Every Xtrct customer's scrapes improve domain knowledge for all customers.
