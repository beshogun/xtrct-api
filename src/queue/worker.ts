import { sql, calculateCredits, type ScrapeJob, type OutputFormat } from '../db/index.ts';
import { log } from '../log.ts';
import { runStrategy } from '../scrapers/strategy.ts';
import { extractAll } from '../extractors/index.ts';
import { deductCredits } from '../billing/credits.ts';
import { deductProxyCredit } from '../billing/proxy-credits.ts';
import { fireJobWebhooks } from './webhook.ts';
import type { ProxyTier } from '../proxy/manager.ts';
import { PRESETS } from '../extractors/presets/index.ts';

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
const POLL_INTERVAL_MS = 1_000;

// Map of job IDs awaiting sync resolution
export const syncWaiters = new Map<string, (job: ScrapeJob) => void>();

// ─── Per-domain concurrency cap ───────────────────────────────────────────────
// Hard sites get cap 1 (sequential); everything else cap 2.
// This prevents all workers piling onto the same domain simultaneously,
// which triggers rate limiting and looks like a bot attack.

const HARD_DOMAINS = new Set([
  'therealreal.com', 'stockx.com', 'zalando.co.uk', 'zalando.com',
  'farfetch.com', 'net-a-porter.com', 'ssense.com',
  'wayfair.co.uk', 'wayfair.com', 'wine-auctioneer.com', 'asos.com',
]);
const DEFAULT_DOMAIN_CAP = 2;
const HARD_DOMAIN_CAP    = 1;

const domainActive = new Map<string, number>();

function jobDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function domainCap(domain: string): number {
  return HARD_DOMAINS.has(domain) ? HARD_DOMAIN_CAP : DEFAULT_DOMAIN_CAP;
}

function acquireDomain(domain: string): boolean {
  const n = domainActive.get(domain) ?? 0;
  if (n >= domainCap(domain)) return false;
  domainActive.set(domain, n + 1);
  return true;
}

function releaseDomain(domain: string): void {
  const n = (domainActive.get(domain) ?? 1) - 1;
  if (n <= 0) domainActive.delete(domain);
  else domainActive.set(domain, n);
}

async function processJob(job: ScrapeJob): Promise<void> {
  const started = Date.now();

  try {
    const options = job.options as {
      headers?: Record<string, string>;
      cookies?: Array<{ name: string; value: string; domain?: string }>;
      jsInject?: string;
      waitFor?: { type: string; value?: string | number };
      screenshotOptions?: Record<string, unknown>;
      pdfOptions?: Record<string, unknown>;
      selectors?: Record<string, string>;
      timeout?: number;
      proxyTier?: 'auto' | ProxyTier;
    };

    // Run the scraping strategy
    const strategyResult = await runStrategy(job.url, {
      strategy: job.strategy,
      headers: options.headers,
      cookies: options.cookies,
      jsInject: options.jsInject,
      waitFor: options.waitFor as never,
      timeout: options.timeout ?? 30_000,
      apiKeyId: job.apiKeyId,
      proxyTier: options.proxyTier,
    });

    // Extract requested formats
    const result = await extractAll({
      formats: job.outputFormats as OutputFormat[],
      selectors: options.selectors,
      screenshotOptions: options.screenshotOptions as never,
      pdfOptions: options.pdfOptions as never,
      html: strategyResult.html,
      finalUrl: strategyResult.finalUrl,
      statusCode: strategyResult.statusCode,
      contentType: 'text/html',
      page: strategyResult.playwright?.page,
      jobId: job.id,
    });

    // Apply preset postProcess if available (e.g. to parse prices, merge extra selector fields)
    const presetId = (options as { presetApplied?: string }).presetApplied;
    if (presetId && result.structured) {
      const preset = PRESETS[presetId];
      if (preset?.postProcess) {
        result.structured = preset.postProcess(result.structured as Record<string, string | string[] | null>);
      }
    }

    // Clean up Playwright page/context if used
    if (strategyResult.playwright) {
      await strategyResult.playwright.page.close().catch(() => {});
      await strategyResult.playwright.context.close().catch(() => {});
      strategyResult.playwright.release();
    }

    const durationMs = Date.now() - started;
    const credits = calculateCredits(strategyResult.strategyUsed, job.outputFormats as OutputFormat[]);
    const proxyTier = strategyResult.proxyTier;

    // Deduct proxy credits if a proxy was used
    if (proxyTier !== 'none' && strategyResult.proxyUsed) {
      const { PROXY_CREDIT_COSTS } = await import('../billing/proxy-credits.ts');
      const proxyCost = PROXY_CREDIT_COSTS[proxyTier];
      const deducted = await deductProxyCredit(job.apiKeyId, proxyTier, proxyCost).catch(() => false);
      log(`[worker] proxy credits: tier=${proxyTier} cost=${proxyCost} deducted=${deducted} job=${job.id}`);
    }

    log(`[worker] job ${job.id} done: strategy=${strategyResult.strategyUsed} proxy=${proxyTier} credits=${credits}`);

    // Mark job done
    const [updated] = await sql<ScrapeJob[]>`
      UPDATE scrape_jobs SET
        status        = 'done',
        strategy_used = ${strategyResult.strategyUsed},
        proxy_tier    = ${proxyTier},
        result        = ${sql.json(result as never)},
        credits_cost  = ${credits},
        duration_ms   = ${durationMs},
        completed_at  = NOW()
      WHERE id = ${job.id}
      RETURNING *
    `;

    // Deduct scrape credits
    await deductCredits(job.apiKeyId, credits, job.id, strategyResult.strategyUsed);

    // Notify sync waiters
    const waiter = syncWaiters.get(job.id);
    if (waiter) {
      syncWaiters.delete(job.id);
      waiter(updated);
    }

    await fireJobWebhooks(updated).catch(() => {});
  } catch (e) {
    const durationMs = Date.now() - started;
    const errMsg = e instanceof Error ? e.message : String(e);

    const [updated] = await sql<ScrapeJob[]>`
      UPDATE scrape_jobs SET
        status       = 'failed',
        error        = ${errMsg},
        duration_ms  = ${durationMs},
        completed_at = NOW()
      WHERE id = ${job.id}
      RETURNING *
    `;

    const waiter = syncWaiters.get(job.id);
    if (waiter) {
      syncWaiters.delete(job.id);
      waiter(updated);
    }

    await fireJobWebhooks(updated).catch(() => {});
    log(`[worker] job ${job.id} failed: ${errMsg}`);
  }
}

/** On startup, reset any jobs left in 'running' state by a previous process. */
async function resetStuckJobs(): Promise<void> {
  const { count } = await sql`
    UPDATE scrape_jobs SET status = 'pending', started_at = NULL, worker_id = NULL
    WHERE status = 'running'
  `.then(r => ({ count: r.count }));
  if (count > 0) {
    log(`[workers] reset ${count} stuck running jobs → pending`);
  }
}

/** Periodically reset jobs that have been in 'running' state for too long. */
async function watchdogTick(): Promise<void> {
  const { count } = await sql`
    UPDATE scrape_jobs SET status = 'pending', started_at = NULL, worker_id = NULL
    WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '10 minutes'
  `.then(r => ({ count: r.count })).catch(() => ({ count: 0 }));
  if (count > 0) {
    log(`[watchdog] reset ${count} timed-out running jobs → pending`);
  }
}

/** Poll for pending jobs and process them. Run N workers concurrently. */
export async function startWorkers(concurrency = 4): Promise<void> {
  await resetStuckJobs();
  setInterval(watchdogTick, 60_000);

  let active = 0;

  const poll = async () => {
    if (active >= concurrency) return;

    let job: ScrapeJob | undefined;
    let domain = '';
    try {
      // Fetch the top pending candidates (by priority + age) and pick the
      // first one whose domain isn't at its concurrency cap.
      const candidates = await sql<Pick<ScrapeJob, 'id' | 'url'>[]>`
        SELECT id, url FROM scrape_jobs
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 20
      `;

      const eligible = candidates.find(c => {
        const d = jobDomain(c.url);
        return (domainActive.get(d) ?? 0) < domainCap(d);
      });
      if (!eligible) return;

      domain = jobDomain(eligible.url);

      // Atomically claim it — another worker may have grabbed it first
      const rows = await sql<ScrapeJob[]>`
        UPDATE scrape_jobs
        SET status     = 'running',
            started_at = NOW(),
            worker_id  = ${WORKER_ID}
        WHERE id = ${eligible.id} AND status = 'pending'
        RETURNING *
      `;
      job = rows[0];
    } catch {
      return; // DB not available — skip this poll cycle
    }

    if (!job) return; // claimed by another worker — try next poll

    acquireDomain(domain);
    active++;

    const jobTimeout = ((job.options as Record<string, unknown>)?.timeout as number ?? 30_000) + 120_000;
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Job exceeded maximum allowed duration')), jobTimeout)
    );
    Promise.race([processJob(job), timeoutPromise])
      .catch(async (e) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        log(`[worker] job ${job!.id} hard-killed: ${errMsg}`);
        await sql`UPDATE scrape_jobs SET status = 'failed', error = ${errMsg}, completed_at = NOW() WHERE id = ${job!.id} AND status = 'running'`.catch(() => {});
      })
      .finally(() => {
        releaseDomain(domain);
        active--;
      });
  };

  setInterval(poll, POLL_INTERVAL_MS);
  log(`[workers] ${concurrency} workers started (${WORKER_ID})`);
}
