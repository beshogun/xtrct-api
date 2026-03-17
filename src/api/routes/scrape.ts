import { Elysia, t } from 'elysia';
import { sql, calculateCredits, type OutputFormat, type Strategy } from '../../db/index.ts';
import { authMiddleware } from '../../middleware/auth.ts';
import { rateLimitMiddleware } from '../../middleware/rate-limit.ts';
import { checkCredits } from '../../billing/credits.ts';
import { syncWaiters } from '../../queue/worker.ts';
import { PRESETS, detectPreset } from '../../extractors/presets/index.ts';

const OutputFormatEnum = t.Union([
  t.Literal('html'), t.Literal('cleaned_html'), t.Literal('markdown'),
  t.Literal('text'), t.Literal('screenshot'), t.Literal('pdf'),
  t.Literal('links'), t.Literal('metadata'), t.Literal('structured'),
]);

const WaitForSchema = t.Union([
  t.Object({ type: t.Literal('networkidle') }),
  t.Object({ type: t.Literal('selector'), value: t.String() }),
  t.Object({ type: t.Literal('js'), value: t.String() }),
  t.Object({ type: t.Literal('delay'), value: t.Number({ minimum: 0, maximum: 10000 }) }),
]);

export const scrapeRoutes = new Elysia()
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  .post('/scrape', async ({ body, set, apiKey }) => {
    const {
      url, strategy: strategyParam, output,
      selectors, wait_for, headers, cookies, js_inject,
      screenshot_options, pdf_options,
      priority = 0, webhook_url, wait = false, timeout = 30_000,
      preset: presetId,
      proxy_tier = 'auto',
    } = body;

    // ─── Preset resolution ─────────────────────────────────────────────────────
    let presetApplied: string | null = null;
    let resolvedStrategy: Strategy = (strategyParam as Strategy) ?? 'auto';
    let resolvedFormats: OutputFormat[] = output ? (Array.isArray(output) ? output : [output]) : [];
    let resolvedSelectors: Record<string, string> = selectors ?? {};
    let resolvedWaitFor = wait_for ?? null;

    if (presetId) {
      // Explicit preset requested
      const preset = PRESETS[presetId];
      if (!preset) {
        set.status = 400;
        return { error: `Unknown preset "${presetId}". Call GET /v1/presets for a list of available presets.` };
      }
      presetApplied = preset.id;

      // Merge preset defaults — explicit request params win
      if (!strategyParam) resolvedStrategy = preset.strategy as Strategy;
      if (!output)        resolvedFormats  = preset.outputFormats;
      if (!selectors || Object.keys(selectors).length === 0) resolvedSelectors = preset.selectors;
      if (!wait_for)      resolvedWaitFor  = preset.waitFor ?? null;
    } else {
      // Auto-detect from URL if no preset explicitly given
      const detected = detectPreset(url);
      if (detected) {
        presetApplied = detected.id;
        process.stderr.write(`  [preset] Auto-detected preset "${detected.id}" for ${url}\n`);

        if (!strategyParam) resolvedStrategy = detected.strategy as Strategy;
        if (!output)        resolvedFormats  = detected.outputFormats;
        if (!selectors || Object.keys(selectors).length === 0) resolvedSelectors = detected.selectors;
        if (!wait_for)      resolvedWaitFor  = detected.waitFor ?? null;
      }
    }

    // Ensure formats is always populated
    if (!resolvedFormats || resolvedFormats.length === 0) {
      resolvedFormats = Array.isArray(output) ? output : [output];
    }

    // ─── Free tier: no proxy access / Internal tier: full access ───────────────
    const effective_proxy_tier = (apiKey.tier === 'free' && proxy_tier !== 'none') ? 'none' as typeof proxy_tier : proxy_tier;

    // ─── Priority: tier-based default, explicit request value capped by tier ───
    // internal/free → max priority 0 (background, never blocks customers)
    // starter       → max priority 1
    // growth/enterprise → max priority 2
    const tierMaxPriority: Record<string, number> = {
      free: 0, internal: 0, starter: 1, growth: 2, enterprise: 2,
    };
    const maxPrio = tierMaxPriority[apiKey.tier] ?? 1;
    const defaultPrio = apiKey.tier === 'free' || apiKey.tier === 'internal' ? 0 : 1;
    const effectivePriority = Math.min(priority, maxPrio) || defaultPrio;

    // ─── Validation ────────────────────────────────────────────────────────────

    // Structured requires selectors (preset satisfies this automatically)
    if (resolvedFormats.includes('structured') && Object.keys(resolvedSelectors).length === 0) {
      set.status = 400;
      return { error: 'structured output requires selectors' };
    }

    // screenshot/pdf require a Playwright-compatible strategy
    if ((resolvedFormats.includes('screenshot') || resolvedFormats.includes('pdf')) && resolvedStrategy === 'http') {
      set.status = 400;
      return { error: 'screenshot/pdf require playwright or auto strategy' };
    }

    // ─── Credit check ──────────────────────────────────────────────────────────
    const canProceed = await checkCredits(apiKey.id, apiKey.tier);
    if (!canProceed) {
      set.status = 402;
      return { error: 'Insufficient credits. Upgrade your plan or wait for the next billing period.' };
    }

    const estimatedCredits = calculateCredits(
      resolvedStrategy === 'auto' ? 'playwright' : resolvedStrategy,
      resolvedFormats,
    );

    // ─── Enqueue job ───────────────────────────────────────────────────────────
    const [job] = await sql`
      INSERT INTO scrape_jobs (api_key_id, url, strategy, output_formats, options, priority, webhook_url)
      VALUES (
        ${apiKey.id}, ${url}, ${resolvedStrategy}, ${resolvedFormats},
        ${sql.json({
          headers:           headers ?? {},
          cookies:           cookies ?? [],
          jsInject:          js_inject ?? null,
          waitFor:           resolvedWaitFor,
          screenshotOptions: screenshot_options ?? null,
          pdfOptions:        pdf_options ?? null,
          selectors:         resolvedSelectors,
          timeout,
          presetApplied,
          proxyTier:         effective_proxy_tier,
        })},
        ${effectivePriority}, ${webhook_url ?? null}
      )
      RETURNING id
    `;

    const jobId = job.id as string;

    // ─── Sync mode ─────────────────────────────────────────────────────────────
    if (wait) {
      const result = await new Promise<Record<string, unknown>>((resolve) => {
        const timer = setTimeout(() => {
          syncWaiters.delete(jobId);
          resolve({ job_id: jobId, status: 'queued', message: 'Job is still processing. Poll /v1/jobs/:id for result.' });
        }, Math.min(timeout, 30_000));

        syncWaiters.set(jobId, (completedJob) => {
          clearTimeout(timer);
          resolve(formatJob(completedJob, presetApplied));
        });
      });
      return result;
    }

    return {
      job_id:            jobId,
      status:            'queued',
      priority:          effectivePriority,
      credits_estimated: estimatedCredits,
      ...(presetApplied ? { preset_applied: presetApplied } : {}),
    };
  }, {
    body: t.Object({
      url:         t.String({ minLength: 1 }),
      preset:      t.Optional(t.String()),
      strategy:    t.Optional(t.Union([
        t.Literal('auto'), t.Literal('http'),
        t.Literal('playwright'), t.Literal('flaresolverr'),
      ])),
      output:      t.Optional(t.Union([OutputFormatEnum, t.Array(OutputFormatEnum, { minItems: 1 })])),
      selectors:   t.Optional(t.Record(t.String(), t.String())),
      wait_for:    t.Optional(WaitForSchema),
      headers:     t.Optional(t.Record(t.String(), t.String())),
      cookies:     t.Optional(t.Array(t.Object({
        name:   t.String(),
        value:  t.String(),
        domain: t.Optional(t.String()),
      }))),
      js_inject:          t.Optional(t.String()),
      screenshot_options: t.Optional(t.Object({
        format:    t.Optional(t.Union([t.Literal('png'), t.Literal('jpeg')])),
        quality:   t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        full_page: t.Optional(t.Boolean()),
        clip:      t.Optional(t.Object({
          x: t.Number(), y: t.Number(), width: t.Number(), height: t.Number(),
        })),
      })),
      pdf_options: t.Optional(t.Object({
        format:           t.Optional(t.Union([t.Literal('A4'), t.Literal('Letter')])),
        print_background: t.Optional(t.Boolean()),
      })),
      priority:    t.Optional(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
      webhook_url: t.Optional(t.String()),
      wait:        t.Optional(t.Boolean()),
      timeout:     t.Optional(t.Number({ minimum: 1000, maximum: 120_000 })),
      proxy_tier:  t.Optional(t.Union([
        t.Literal('auto'), t.Literal('none'),
        t.Literal('datacenter'), t.Literal('residential'),
      ])),
    }),
  });

function formatJob(job: Record<string, unknown>, presetApplied: string | null = null) {
  return {
    job_id:        job.id,
    status:        job.status,
    url:           job.url,
    strategy_used: job.strategyUsed,
    proxy_tier:    job.proxyTier ?? null,
    credits_used:  job.creditsCost,
    duration_ms:   job.durationMs,
    created_at:    job.createdAt,
    completed_at:  job.completedAt,
    error:         job.error ?? null,
    result:        job.result ?? null,
    ...(presetApplied ? { preset_applied: presetApplied } : {}),
  };
}
