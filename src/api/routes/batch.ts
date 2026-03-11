import { Elysia, t } from 'elysia';
import { sql, calculateCredits, type OutputFormat } from '../../db/index.ts';
import { authMiddleware } from '../../middleware/auth.ts';
import { rateLimitMiddleware } from '../../middleware/rate-limit.ts';
import { checkCredits } from '../../billing/credits.ts';

const OutputFormatEnum = t.Union([
  t.Literal('html'), t.Literal('cleaned_html'), t.Literal('markdown'),
  t.Literal('text'), t.Literal('screenshot'), t.Literal('pdf'),
  t.Literal('links'), t.Literal('metadata'), t.Literal('structured'),
]);

export const batchRoutes = new Elysia()
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  // ─── POST /v1/batch ────────────────────────────────────────────────────────
  .post('/batch', async ({ body, set, apiKey }) => {
    const {
      urls, strategy = 'auto', output,
      selectors, wait_for, headers,
      priority = 0, webhook_url,
    } = body;

    if (urls.length === 0) {
      set.status = 400;
      return { error: 'urls must not be empty' };
    }

    const formats: OutputFormat[] = Array.isArray(output) ? output : [output];

    // Validate: structured requires selectors
    if (formats.includes('structured') && (!selectors || Object.keys(selectors).length === 0)) {
      set.status = 400;
      return { error: 'structured output requires selectors' };
    }

    // Credit check (single check — assume worst-case strategy)
    const canProceed = await checkCredits(apiKey.id, apiKey.tier);
    if (!canProceed) {
      set.status = 402;
      return { error: 'Insufficient credits. Upgrade your plan or wait for the next billing period.' };
    }

    const creditsPerJob = calculateCredits(
      strategy === 'auto' ? 'playwright' : strategy,
      formats,
    );
    const creditsEstimated = creditsPerJob * urls.length;

    // Generate a single batch ID for this group of jobs
    const batchId = crypto.randomUUID();

    const optionsJson = {
      headers:   headers   ?? {},
      cookies:   [],
      waitFor:   wait_for  ?? null,
      selectors: selectors ?? {},
    };

    // Insert all jobs in one transaction
    const jobs = await sql.begin(async tx => {
      const inserted: Array<{ id: string }> = [];
      for (const url of urls) {
        const [row] = await tx`
          INSERT INTO scrape_jobs (api_key_id, batch_id, url, strategy, output_formats, options, priority, webhook_url)
          VALUES (
            ${apiKey.id}, ${batchId}, ${url}, ${strategy}, ${formats},
            ${tx.json(optionsJson)},
            ${priority}, ${webhook_url ?? null}
          )
          RETURNING id
        `;
        inserted.push(row);
      }
      return inserted;
    });

    return {
      batch_id:          batchId,
      job_ids:           jobs.map(j => j.id),
      total:             jobs.length,
      credits_estimated: creditsEstimated,
    };
  }, {
    body: t.Object({
      urls:        t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 50 }),
      strategy:    t.Optional(t.Union([
        t.Literal('auto'), t.Literal('http'),
        t.Literal('playwright'), t.Literal('flaresolverr'),
      ])),
      output:      t.Union([OutputFormatEnum, t.Array(OutputFormatEnum, { minItems: 1 })]),
      selectors:   t.Optional(t.Record(t.String(), t.String())),
      wait_for:    t.Optional(t.Union([
        t.Object({ type: t.Literal('networkidle') }),
        t.Object({ type: t.Literal('selector'), value: t.String() }),
        t.Object({ type: t.Literal('js'), value: t.String() }),
        t.Object({ type: t.Literal('delay'), value: t.Number({ minimum: 0, maximum: 10000 }) }),
      ])),
      headers:     t.Optional(t.Record(t.String(), t.String())),
      priority:    t.Optional(t.Union([t.Literal(0), t.Literal(1), t.Literal(2)])),
      webhook_url: t.Optional(t.String()),
    }),
  })

  // ─── GET /v1/batch/:batch_id ───────────────────────────────────────────────
  .get('/batch/:batch_id', async ({ params, set, apiKey }) => {
    // Verify at least one job belongs to this api key
    const jobs = await sql<Array<{
      id: string;
      url: string;
      status: string;
      priority: number;
      creditsCost: number | null;
      durationMs: number | null;
      createdAt: Date;
      completedAt: Date | null;
      error: string | null;
    }>>`
      SELECT id, url, status, priority, credits_cost, duration_ms, created_at, completed_at, error
      FROM scrape_jobs
      WHERE batch_id = ${params.batch_id}
        AND api_key_id = ${apiKey.id}
      ORDER BY created_at ASC
    `;

    if (jobs.length === 0) {
      set.status = 404;
      return { error: 'Batch not found' };
    }

    const total   = jobs.length;
    const done    = jobs.filter(j => j.status === 'done').length;
    const failed  = jobs.filter(j => j.status === 'failed').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const pending = jobs.filter(j => j.status === 'pending').length;

    return {
      batch_id: params.batch_id,
      total,
      done,
      failed,
      running,
      pending,
      jobs: jobs.map(j => ({
        job_id:       j.id,
        url:          j.url,
        status:       j.status,
        credits_used: j.creditsCost,
        duration_ms:  j.durationMs,
        created_at:   j.createdAt,
        completed_at: j.completedAt,
        error:        j.error ?? null,
      })),
    };
  }, {
    params: t.Object({ batch_id: t.String() }),
  });
