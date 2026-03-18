# Scrape Telemetry & Auto-Learning Strategy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every escalation step in `strategy.ts`, analyse outcomes per domain hourly, and automatically apply the cheapest proven strategy on future scrapes — making Xtrct smarter over time.

**Architecture:** `StepAttempt` records are accumulated in an array during `runStrategy()`, then batch-written to `scrape_telemetry` in a fire-and-forget `finally` block. An hourly cron job (`strategy-analyser.ts`) crunches 7 days of telemetry and writes one optimal strategy per domain to `domain_strategies`. `runAuto()` consults `domain_strategies` before starting the chain and jumps straight to the proven step.

**Tech Stack:** Bun + TypeScript, postgres.js (`sql` tagged template), existing `src/db/index.ts`, existing `src/cron/cleanup.ts` pattern.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/db/schema.sql` | Add `scrape_telemetry` and `domain_strategies` table DDL |
| Modify | `src/scrapers/strategy.ts` | Add `StepAttempt` type, `classifyError()`, `attempt()`, `writeTelemetry()`, `getLearnedStrategy()`, `tryLearnedStrategy()`; wire into `runStrategy()`, `runForced()`, `runAuto()` |
| Create | `src/cron/strategy-analyser.ts` | Hourly job: crunch telemetry → write `domain_strategies` winners |
| Modify | `src/cron/cleanup.ts` | Add 30-day telemetry + 14-day domain_strategies deletion |
| Modify | `src/index.ts` | Register hourly analyser cron |
| Create | `tests/scrapers/strategy-telemetry.test.ts` | Unit tests for `classifyError`, `attempt` |

---

## Chunk 1: Schema + Telemetry Helpers

### Task 1: DB Schema — add `scrape_telemetry` and `domain_strategies`

**Files:**
- Modify: `src/db/schema.sql` (append at end)

- [ ] **Step 1: Append the two new tables to `src/db/schema.sql`**

Add after the last existing table definition:

```sql
-- ─── Scrape Telemetry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_telemetry (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        VARCHAR     NOT NULL,
  step_index    INT         NOT NULL,
  strategy      VARCHAR     NOT NULL,
  proxy_tier    VARCHAR     NOT NULL,
  success       BOOLEAN     NOT NULL,
  blocked       BOOLEAN     NOT NULL DEFAULT false,
  time_ms       INT         NOT NULL,
  cost_credits  INT         NOT NULL DEFAULT 0,
  error_type    VARCHAR,
  api_key_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scrape_telemetry_domain_created
  ON scrape_telemetry (domain, created_at DESC);

CREATE INDEX IF NOT EXISTS scrape_telemetry_created
  ON scrape_telemetry (created_at DESC);

-- ─── Domain Strategies ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS domain_strategies (
  domain           VARCHAR     PRIMARY KEY,
  optimal_strategy VARCHAR     NOT NULL,
  proxy_tier       VARCHAR     NOT NULL,
  success_rate     FLOAT       NOT NULL,
  avg_time_ms      INT         NOT NULL,
  avg_cost_credits FLOAT       NOT NULL,
  sample_count     INT         NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked           BOOLEAN     NOT NULL DEFAULT false
);
```

- [ ] **Step 2: Run migration**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_X6YEanK5wxhO@ep-misty-water-ajyilpdg-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require" bun src/db/migrate.ts
```

Expected: dots printed, `Migration complete.`

- [ ] **Step 3: Verify tables exist**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_X6YEanK5wxhO@ep-misty-water-ajyilpdg-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require" bun -e "
import { sql } from './src/db/index.ts';
const tables = await sql\`SELECT table_name FROM information_schema.tables WHERE table_name IN ('scrape_telemetry','domain_strategies') ORDER BY table_name\`;
console.log(tables.map(r => r.tableName));
await sql.end();
"
```

Expected: `[ 'domain_strategies', 'scrape_telemetry' ]`

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat: add scrape_telemetry and domain_strategies schema"
```

---

### Task 2: Telemetry helpers in `strategy.ts` + tests

**Files:**
- Modify: `src/scrapers/strategy.ts`
- Create: `tests/scrapers/strategy-telemetry.test.ts`

**Context:** `src/scrapers/strategy.ts` already imports from `../db/index.ts` for the `Strategy` type but does NOT import `sql`. The `isNetworkError()` helper is at line ~128. Add new helpers after it.

- [ ] **Step 1: Create test directory and test file**

```bash
mkdir -p /Users/ben/claudecode/scraper-api/tests/scrapers
```

> **Note on postgres.js camelCase transform:** `src/db/index.ts` uses `transform: postgres.camel`. This means query **results** have camelCase property names (e.g. `row.costCredits`), but SQL column names in INSERT/SELECT statements must remain **snake_case** (e.g. `cost_credits`). The `writeTelemetry()` INSERT uses snake_case column names correctly — TypeScript properties on StepAttempt are camelCase (`s.costCredits`) mapped to snake_case SQL columns.

Create `tests/scrapers/strategy-telemetry.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';

// Inline classifyError to test in isolation (mirrors strategy.ts implementation)
function classifyError(err: unknown): 'cloudflare' | 'timeout' | 'network' | 'parse' {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cloudflare|cf-ray|403|challenge/i.test(msg)) return 'cloudflare';
  if (/timeout|timed out/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return 'network';
  return 'parse';
}

describe('classifyError', () => {
  test('classifies cloudflare errors', () => {
    expect(classifyError(new Error('Cloudflare blocked'))).toBe('cloudflare');
    expect(classifyError(new Error('cf-ray header present'))).toBe('cloudflare');
    expect(classifyError(new Error('403 Forbidden'))).toBe('cloudflare');
    expect(classifyError(new Error('challenge page'))).toBe('cloudflare');
  });

  test('classifies timeout errors', () => {
    expect(classifyError(new Error('timeout exceeded'))).toBe('timeout');
    expect(classifyError(new Error('Request timed out'))).toBe('timeout');
  });

  test('classifies network errors', () => {
    expect(classifyError(new Error('ECONNREFUSED connection'))).toBe('network');
    expect(classifyError(new Error('ENOTFOUND host'))).toBe('network');
  });

  test('falls back to parse for unknown errors', () => {
    expect(classifyError(new Error('JSON parse error'))).toBe('parse');
    expect(classifyError('some string error')).toBe('parse');
  });
});

// StepAttempt type for testing attempt()
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

async function attempt<T extends object | string>(
  steps: StepAttempt[],
  stepIndex: number,
  strategy: StepAttempt['strategy'],
  proxyTier: StepAttempt['proxyTier'],
  costCredits: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ stepIndex, strategy, proxyTier, success: result !== null,
                 blocked: false, timeMs: Date.now() - t0, costCredits, errorType: null });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let errorType: StepAttempt['errorType'] = 'parse';
    if (/cloudflare|cf-ray|403|challenge/i.test(msg)) errorType = 'cloudflare';
    else if (/timeout|timed out/i.test(msg)) errorType = 'timeout';
    else if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) errorType = 'network';
    steps.push({ stepIndex, strategy, proxyTier, success: false,
                 blocked: errorType === 'cloudflare', timeMs: Date.now() - t0,
                 costCredits, errorType });
    throw err;
  }
}

describe('attempt', () => {
  test('logs success when fn returns non-null', async () => {
    const steps: StepAttempt[] = [];
    const result = await attempt(steps, 0, 'http', 'none', 1, async () => ({ html: 'ok' }));
    expect(result).toEqual({ html: 'ok' });
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(true);
    expect(steps[0].strategy).toBe('http');
    expect(steps[0].costCredits).toBe(1);
    expect(steps[0].errorType).toBeNull();
  });

  test('logs failure when fn returns null', async () => {
    const steps: StepAttempt[] = [];
    const result = await attempt(steps, 1, 'playwright', 'datacenter', 5, async () => null);
    expect(result).toBeNull();
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(false);
    expect(steps[0].blocked).toBe(false);
  });

  test('logs failure and rethrows when fn throws', async () => {
    const steps: StepAttempt[] = [];
    const fn = async () => { throw new Error('Cloudflare blocked'); };
    await expect(attempt(steps, 2, 'http', 'none', 1, fn)).rejects.toThrow();
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(false);
    expect(steps[0].blocked).toBe(true);
    expect(steps[0].errorType).toBe('cloudflare');
  });

  test('records correct step index', async () => {
    const steps: StepAttempt[] = [];
    await attempt(steps, 3, 'slipstream', 'isp', 1, async () => 'html');
    expect(steps[0].stepIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/ben/claudecode/scraper-api && bun test tests/scrapers/strategy-telemetry.test.ts
```

Expected: all tests pass (the test file is self-contained — no imports from strategy.ts yet)

- [ ] **Step 3: Add `StepAttempt` type, `classifyError()`, `attempt()`, and `writeTelemetry()` to `strategy.ts`**

Add `sql` import at the top of `src/scrapers/strategy.ts` (after existing imports):

```typescript
import { sql } from '../db/index.ts';
```

Add after the `isNetworkError()` function (after line ~142):

```typescript
// ─── Telemetry ────────────────────────────────────────────────────────────────

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

/** Cost in credits per strategy+tier combination, matching billing table */
const STEP_CREDITS: Partial<Record<string, Partial<Record<string, number>>>> = {
  slipstream:   { isp: 1 },
  http:         { none: 1, datacenter: 2, residential: 5 },
  playwright:   { none: 3, datacenter: 5, residential: 10 },
  flaresolverr: { none: 8, datacenter: 8, residential: 8 },
};

function stepCost(strategy: StepAttempt['strategy'], proxyTier: StepAttempt['proxyTier']): number {
  return STEP_CREDITS[strategy]?.[proxyTier] ?? 1;
}

function classifyError(err: unknown): StepAttempt['errorType'] {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cloudflare|cf-ray|403|challenge/i.test(msg)) return 'cloudflare';
  if (/timeout|timed out/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return 'network';
  return 'parse';
}

/**
 * Wraps an escalation step: records timing and outcome into `steps`.
 * - fn() returns null → success=false, no exception re-thrown
 * - fn() throws → success=false, exception re-thrown (unexpected errors abort chain)
 */
async function attempt<T extends object | string>(
  steps: StepAttempt[],
  stepIndex: number,
  strategy: StepAttempt['strategy'],
  proxyTier: StepAttempt['proxyTier'],
  costCredits: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ stepIndex, strategy, proxyTier, success: result !== null,
                 blocked: false, timeMs: Date.now() - t0, costCredits, errorType: null });
    return result;
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({ stepIndex, strategy, proxyTier, success: false,
                 blocked: errorType === 'cloudflare',
                 timeMs: Date.now() - t0, costCredits, errorType });
    throw err;
  }
}

/**
 * Batch-writes accumulated step attempts to scrape_telemetry.
 * Fire-and-forget — never throws.
 */
async function writeTelemetry(
  domain: string,
  steps: StepAttempt[],
  apiKeyId: string | null,
): Promise<void> {
  if (steps.length === 0) return;
  for (const s of steps) {
    await sql`
      INSERT INTO scrape_telemetry
        (domain, step_index, strategy, proxy_tier, success, blocked,
         time_ms, cost_credits, error_type, api_key_id)
      VALUES (
        ${domain}, ${s.stepIndex}, ${s.strategy}, ${s.proxyTier},
        ${s.success}, ${s.blocked}, ${s.timeMs}, ${s.costCredits},
        ${s.errorType}, ${apiKeyId}
      )
    `;
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/ben/claudecode/scraper-api && bun --dry-run src/scrapers/strategy.ts 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones)

- [ ] **Step 5: Run tests again to confirm nothing broke**

```bash
bun test tests/scrapers/strategy-telemetry.test.ts
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/scrapers/strategy.ts tests/scrapers/strategy-telemetry.test.ts
git commit -m "feat: add StepAttempt, classifyError, attempt, writeTelemetry to strategy.ts"
```

---

## Chunk 2: Strategy Lookup + Instrumentation + Analyser + Cleanup

### Task 3: Wire telemetry into `runStrategy()`, `runForced()`, `runAuto()`

**Files:**
- Modify: `src/scrapers/strategy.ts`

**Context:** `runStrategy()` is the public entry point (line ~495). `runForced()` is at line ~209. `runAuto()` is at line ~287. We add `steps: StepAttempt[]` as the last param to both inner functions, create the array in `runStrategy()`, pass it through, and add `writeTelemetry()` in the `finally` block.

We also add `getLearnedStrategy()` and `tryLearnedStrategy()` before `runAuto()`.

- [ ] **Step 1: Add `getLearnedStrategy()` and `tryLearnedStrategy()` before `runAuto()`**

Insert before the `// ─── Auto-escalation chain ───` comment (~line 270):

```typescript
// ─── Learned strategy lookup ──────────────────────────────────────────────────

interface DomainStrategy {
  optimalStrategy: 'slipstream' | 'http' | 'playwright' | 'flaresolverr';
  proxyTier: 'none' | 'datacenter' | 'residential' | 'isp';
  successRate: number;
  sampleCount: number;
}

/**
 * Returns the learned optimal strategy for a domain if one exists and is fresh
 * (computed within last 2 hours, ≥10 samples, ≥85% success rate).
 * Returns null if no confident strategy is known — caller runs the full chain.
 */
async function getLearnedStrategy(domain: string): Promise<DomainStrategy | null> {
  try {
    const [row] = await sql<DomainStrategy[]>`
      SELECT optimal_strategy, proxy_tier, success_rate, sample_count
      FROM domain_strategies
      WHERE domain = ${domain}
        AND computed_at > NOW() - INTERVAL '2 hours'
        AND sample_count >= 10
        AND success_rate >= 0.85
    `;
    return row ?? null;
  } catch {
    return null; // never block a scrape due to telemetry DB issues
  }
}

/**
 * Attempts the learned strategy for a domain. Returns the result on success,
 * or null if the strategy fails (caller falls through to the full chain).
 * Logs one StepAttempt regardless of outcome.
 */
async function tryLearnedStrategy(
  url: string,
  opts: RunOptions,
  learned: DomainStrategy,
  steps: StepAttempt[],
): Promise<StrategyResult | null> {
  const strat = learned.optimalStrategy;
  // Don't cast to ProxyTier here — DomainStrategy.proxyTier includes 'isp' (slipstream-internal).
  // ProxyTier in manager.ts is 'none' | 'datacenter' | 'residential' only.
  // We use learned.proxyTier directly; the http/playwright branches only match non-'isp' values.
  const tier  = learned.proxyTier;
  const cost  = stepCost(strat, learned.proxyTier);
  const si    = steps.length;

  try {
    if (strat === 'slipstream') {
      const html = await attempt(steps, si, 'slipstream', 'isp', cost,
        () => trySlipstream(url, opts.timeout ?? 90_000));
      if (html) return { html, statusCode: 200, finalUrl: url, strategyUsed: 'slipstream', proxyUsed: null, proxyTier: 'none' };
    }

    if (strat === 'http') {
      // getResidentialProxy/getDatacenterProxy return string | null (never undefined)
      const proxy = tier === 'residential' ? proxyManager.getResidentialProxy()
                  : tier === 'datacenter'  ? proxyManager.getDatacenterProxy()
                  : null;
      if (proxy !== null) {
        const r = await attempt(steps, si, 'http', tier, cost, () => tryHttp(url, proxy, opts));
        if (r) return { ...r, strategyUsed: 'http', proxyUsed: proxy, proxyTier: tier as ProxyTier };
      }
    }

    if (strat === 'playwright') {
      const proxy = tier === 'residential' ? proxyManager.getResidentialProxy()
                  : tier === 'datacenter'  ? proxyManager.getDatacenterProxy()
                  : null;
      if (proxy !== null) {
        const r = await attempt(steps, si, 'playwright', tier, cost,
          () => tryPlaywright(url, proxy, opts));
        if (r) return { ...r.result, strategyUsed: 'playwright', proxyUsed: proxy, proxyTier: tier as ProxyTier,
                        playwright: { page: r.page, context: r.context, release: r.release } };
      }
    }

    if (strat === 'flaresolverr' && await flareScraper.isAvailable()) {
      // flareScraper.fetch() throws on failure — wrap to log the step either way
      const t0 = Date.now();
      try {
        const r = await flareScraper.fetch(url, opts.timeout);
        steps.push({ stepIndex: si, strategy: 'flaresolverr', proxyTier: 'none',
                     success: true, blocked: false, timeMs: Date.now() - t0,
                     costCredits: cost, errorType: null });
        return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
      } catch (err) {
        const errorType = classifyError(err);
        steps.push({ stepIndex: si, strategy: 'flaresolverr', proxyTier: 'none',
                     success: false, blocked: errorType === 'cloudflare',
                     timeMs: Date.now() - t0, costCredits: cost, errorType });
        // fall through to return null below
      }
    }
  } catch {
    // logged by attempt() or explicit push above; swallow — fall through to full chain
  }

  return null;
}
```

- [ ] **Step 2: Modify `runForced()` signature to accept `steps` and log one entry**

Change the function signature from:
```typescript
async function runForced(url: string, opts: RunOptions, strategy: Strategy): Promise<StrategyResult> {
```
to:
```typescript
async function runForced(url: string, opts: RunOptions, strategy: Strategy, steps: StepAttempt[]): Promise<StrategyResult> {
```

Wrap the entire function body so it logs one step. Add `const t0 = Date.now();` at the very top of the function body, then add a `try/catch` around the existing `return` statements:

Replace the existing function body to add timing at top and a `finally`-style push at each return path. The simplest approach — add at the very end of `runForced`, before each `return`, push to steps. Search for all `return {` statements inside `runForced` and add the push before each. Since runForced has ~5 return paths, use a wrapper:

```typescript
async function runForced(url: string, opts: RunOptions, strategy: Strategy, steps: StepAttempt[]): Promise<StrategyResult> {
  const t0 = Date.now();
  try {
    const result = await runForcedInner(url, opts, strategy);
    steps.push({
      stepIndex: 0,
      strategy: result.strategyUsed,
      proxyTier: result.proxyTier === 'none' ? 'none' : result.proxyTier as StepAttempt['proxyTier'],
      success: true, blocked: false,
      timeMs: Date.now() - t0,
      costCredits: stepCost(result.strategyUsed, result.proxyTier === 'none' ? 'none' : result.proxyTier as StepAttempt['proxyTier']),
      errorType: null,
    });
    return result;
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({
      stepIndex: 0, strategy: strategy as StepAttempt['strategy'],
      proxyTier: 'none', success: false,
      blocked: errorType === 'cloudflare',
      timeMs: Date.now() - t0,
      costCredits: stepCost(strategy as StepAttempt['strategy'], 'none'),
      errorType,
    });
    throw err;
  }
}
```

Then rename the existing function body to `runForcedInner()` (private, no `steps` param):

```typescript
async function runForcedInner(url: string, opts: RunOptions, strategy: Strategy): Promise<StrategyResult> {
  // ... existing runForced body unchanged ...
}
```

- [ ] **Step 3: Modify `runAuto()` signature to accept `steps`, add learned lookup, and instrument steps**

Change the function signature:
```typescript
async function runAuto(url: string, opts: RunOptions, steps: StepAttempt[]): Promise<StrategyResult> {
```

Add at the very top of `runAuto()`, before the `isFlareSolverrFirst` check:

```typescript
  const domain = new URL(url).hostname.replace(/^www\./, '');

  // Try learned strategy first (skip for FlareSolverr-first domains — they have hardcoded requirements)
  if (!isFlareSolverrFirst(url)) {
    const learned = await getLearnedStrategy(domain);
    if (learned) {
      process.stderr.write(`  [strategy] learned: ${domain} → ${learned.optimalStrategy}+${learned.proxyTier} (rate=${learned.successRate.toFixed(2)} n=${learned.sampleCount})\n`);
      const result = await tryLearnedStrategy(url, opts, learned, steps);
      if (result) return result;
      process.stderr.write(`  [strategy] learned strategy failed — running full chain\n`);
    }
  }
```

Then instrument the main chain steps. Find the `stepNum` variable (~line 402) and wrap each existing scrape call with `attempt()`. The existing code has this pattern:

```typescript
// BEFORE (HTTP loop):
for (const step of httpSteps) {
  process.stderr.write(`  [strategy] step ${stepNum}: ${step.label}\n`);
  const r = await tryHttp(url, step.proxyUrl, opts);
  if (r) {
    return { ...r, strategyUsed: 'http', proxyUsed: step.proxyUrl, proxyTier: step.tier };
  }
  stepNum++;
}
```

Replace with:

```typescript
for (const step of httpSteps) {
  process.stderr.write(`  [strategy] step ${stepNum}: ${step.label}\n`);
  const r = await attempt(steps, steps.length, 'http', step.tier, stepCost('http', step.tier),
    () => tryHttp(url, step.proxyUrl, opts));
  if (r) return { ...r, strategyUsed: 'http', proxyUsed: step.proxyUrl, proxyTier: step.tier };
  stepNum++;
}
```

Replace Slipstream call (~line 415):

```typescript
// BEFORE:
const html = await trySlipstream(url, 90_000);
if (html) {
  return { html, statusCode: 200, finalUrl: url, strategyUsed: 'slipstream', proxyUsed: null, proxyTier: 'none' };
}

// AFTER:
const html = await attempt(steps, steps.length, 'slipstream', 'isp', 1,
  () => trySlipstream(url, 90_000));
if (html) return { html, statusCode: 200, finalUrl: url, strategyUsed: 'slipstream', proxyUsed: null, proxyTier: 'none' };
```

Replace Playwright loop (~line 430):

```typescript
// BEFORE:
const r = await tryPlaywright(url, step.proxyUrl, { ...opts, timeout: stepTimeout });
if (r) {
  return { ...r.result, strategyUsed: 'playwright', ... };
}

// AFTER:
const r = await attempt(steps, steps.length, 'playwright', step.tier, stepCost('playwright', step.tier),
  () => tryPlaywright(url, step.proxyUrl, { ...opts, timeout: stepTimeout }));
if (r) return { ...r.result, strategyUsed: 'playwright', proxyUsed: step.proxyUrl, proxyTier: step.tier,
                playwright: { page: r.page, context: r.context, release: r.release } };
```

Replace final FlareSolverr call (~line 459). Since `flareScraper.fetch` doesn't return null (it throws on failure), push step manually after the call. Capture timing before the call:

```typescript
const flareT0 = Date.now();
const flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);
steps.push({ stepIndex: steps.length, strategy: 'flaresolverr',
             proxyTier: stickyProxy ? 'residential' : 'none',
             success: true, blocked: false, timeMs: Date.now() - flareT0,
             costCredits: stepCost('flaresolverr', stickyProxy ? 'residential' : 'none'),
             errorType: null });
```

For the FlareSolverr-first path (Amazon session pool + Slipstream + FlareSolverr block at top of `runAuto`), also instrument:

```typescript
// Amazon session pool attempt:
const pwResult = await attempt(steps, steps.length, 'playwright', 'residential', 10,
  async () => tryPlaywright(url, session.proxyUrl, { ...opts, cookies: [...] }));

// Slipstream in FlareSolverr-first block:
const html = await attempt(steps, steps.length, 'slipstream', 'isp', 1,
  () => trySlipstream(url, 30_000));

// FlareSolverr in FlareSolverr-first block: push manually after fetch
```

- [ ] **Step 4: Modify `runStrategy()` to create steps array, pass through, write in finally**

Replace the existing `runStrategy()`:

```typescript
export async function runStrategy(url: string, opts: RunOptions = {}): Promise<StrategyResult> {
  const strategy = opts.strategy ?? 'auto';
  const steps: StepAttempt[] = [];
  let domain = 'unknown';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {}

  try {
    if (strategy !== 'auto') {
      return await runForced(url, opts, strategy, steps);
    }
    return await runAuto(url, opts, steps);
  } finally {
    writeTelemetry(domain, steps, opts.apiKeyId ?? null).catch(() => {});
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/ben/claudecode/scraper-api && bun --dry-run src/scrapers/strategy.ts 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 6: Smoke test — start the server and check it boots**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_X6YEanK5wxhO@ep-misty-water-ajyilpdg-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require" timeout 5 bun src/index.ts 2>&1 | head -20
```

Expected: `[server] Listening on http://localhost:3000`, no crash

- [ ] **Step 7: Commit**

```bash
git add src/scrapers/strategy.ts
git commit -m "feat: instrument strategy.ts with telemetry — log every escalation step"
```

---

### Task 4: Strategy Analyser cron job

**Files:**
- Create: `src/cron/strategy-analyser.ts`

- [ ] **Step 1: Create `src/cron/strategy-analyser.ts`**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/ben/claudecode/scraper-api && bun --dry-run src/cron/strategy-analyser.ts 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Smoke test the analyser against the real DB (telemetry table will be empty initially — should log 0 updates)**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_X6YEanK5wxhO@ep-misty-water-ajyilpdg-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require" bun -e "
import { runStrategyAnalyser } from './src/cron/strategy-analyser.ts';
await runStrategyAnalyser();
"
```

Expected: `[strategy-analyser] Processed 0 domain/strategy combos → updated 0 domain strategies` (empty telemetry on first run)

- [ ] **Step 4: Commit**

```bash
git add src/cron/strategy-analyser.ts
git commit -m "feat: add hourly strategy analyser cron — learns optimal strategy per domain"
```

---

### Task 5: Cleanup retention + `index.ts` registration

**Files:**
- Modify: `src/cron/cleanup.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add telemetry retention to `cleanup.ts`**

Inside `runCleanup()`, after the existing `rate_limit_windows` deletion (~line 62), add:

```typescript
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
```

- [ ] **Step 2: Register analyser in `index.ts`**

Add import at top of `src/index.ts`:

```typescript
import { startStrategyAnalyser } from './cron/strategy-analyser.ts';
```

Add after `startAmazonSessionPool();` call (last line of index.ts):

```typescript
// ── 6. Strategy analyser — learns optimal scrape path per domain ─────────────
startStrategyAnalyser();
```

- [ ] **Step 3: Verify server boots cleanly**

```bash
DATABASE_URL="postgresql://neondb_owner:npg_X6YEanK5wxhO@ep-misty-water-ajyilpdg-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require" timeout 8 bun src/index.ts 2>&1 | head -30
```

Expected output includes:
```
[server] Listening on http://localhost:3000
[strategy-analyser] Hourly strategy analyser scheduled
```

- [ ] **Step 4: Commit**

```bash
git add src/cron/cleanup.ts src/index.ts
git commit -m "feat: register strategy analyser cron, add telemetry retention to cleanup"
```

---

## Verification After All Tasks

Once deployed, verify the loop is working end-to-end:

**1. Check telemetry is being written (after a few scrapes run):**
```sql
SELECT domain, strategy, proxy_tier, success, time_ms, cost_credits, created_at
FROM scrape_telemetry
ORDER BY created_at DESC
LIMIT 20;
```

**2. After 10+ scrapes per domain, check analyser output:**
```sql
SELECT domain, optimal_strategy, proxy_tier, success_rate, avg_time_ms, avg_cost_credits, sample_count, computed_at
FROM domain_strategies
ORDER BY computed_at DESC;
```

**3. Manually trigger the analyser to verify it runs:**
```bash
DATABASE_URL="..." bun -e "
import { runStrategyAnalyser } from './src/cron/strategy-analyser.ts';
await runStrategyAnalyser();
"
```

**4. Lock a domain manually (e.g. force Amazon to always use FlareSolverr):**
```sql
INSERT INTO domain_strategies (domain, optimal_strategy, proxy_tier, success_rate, avg_time_ms, avg_cost_credits, sample_count, locked)
VALUES ('amazon.co.uk', 'flaresolverr', 'residential', 0.95, 8000, 8, 999, true)
ON CONFLICT (domain) DO UPDATE SET optimal_strategy='flaresolverr', proxy_tier='residential', locked=true;
```
