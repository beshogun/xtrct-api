import { sql, calculateCredits, type ScrapeJob, type OutputFormat } from '../db/index.ts';
import { runStrategy } from '../scrapers/strategy.ts';
import { extractAll } from '../extractors/index.ts';
import { deductCredits } from '../billing/credits.ts';
import { deductProxyCredit } from '../billing/proxy-credits.ts';
import { fireJobWebhooks } from './webhook.ts';
import type { ProxyTier } from '../proxy/manager.ts';

const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
const POLL_INTERVAL_MS = 1_000;

// Map of job IDs awaiting sync resolution
export const syncWaiters = new Map<string, (job: ScrapeJob) => void>();

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
      process.stderr.write(
        `  [worker] proxy credits: tier=${proxyTier} cost=${proxyCost} deducted=${deducted} job=${job.id}\n`,
      );
    }

    process.stderr.write(
      `  [worker] job ${job.id} done: strategy=${strategyResult.strategyUsed} proxy=${proxyTier} credits=${credits}\n`,
    );

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
    process.stderr.write(`  [worker] job ${job.id} failed: ${errMsg}\n`);
  }
}

/** Poll for pending jobs and process them. Run N workers concurrently. */
export async function startWorkers(concurrency = 4): Promise<void> {
  let active = 0;

  const poll = async () => {
    if (active >= concurrency) return;

    let job: ScrapeJob | undefined;
    try {
      // Atomically claim a pending job
      const rows = await sql<ScrapeJob[]>`
        UPDATE scrape_jobs
        SET status     = 'running',
            started_at = NOW(),
            worker_id  = ${WORKER_ID}
        WHERE id = (
          SELECT id FROM scrape_jobs
          WHERE status = 'pending'
          ORDER BY priority DESC, created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `;
      job = rows[0];
    } catch {
      return; // DB not available — skip this poll cycle
    }

    if (!job) return;

    active++;
    const jobTimeout = ((job.options as Record<string, unknown>)?.timeout as number ?? 30_000) + 120_000; // job timeout + 2 min buffer
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Job exceeded maximum allowed duration')), jobTimeout)
    );
    Promise.race([processJob(job), timeoutPromise])
      .catch(async (e) => {
        const errMsg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`  [worker] job ${job!.id} hard-killed: ${errMsg}\n`);
        await sql`UPDATE scrape_jobs SET status = 'failed', error = ${errMsg}, completed_at = NOW() WHERE id = ${job!.id} AND status = 'running'`.catch(() => {});
      })
      .finally(() => { active--; });
  };

  setInterval(poll, POLL_INTERVAL_MS);
  process.stdout.write(`[workers] ${concurrency} workers started (${WORKER_ID})\n`);
}
