import { Elysia, t } from 'elysia';
import { sql, type ScrapeJob } from '../../db/index.ts';
import { authMiddleware } from '../../middleware/auth.ts';

export const jobsRoutes = new Elysia()
  .use(authMiddleware)

  // GET /v1/jobs/:id
  .get('/jobs/:id', async ({ params, set, apiKey }) => {
    const [job] = await sql<ScrapeJob[]>`
      SELECT * FROM scrape_jobs
      WHERE id = ${params.id}
        AND api_key_id = ${apiKey.id}
      LIMIT 1
    `;

    if (!job) {
      set.status = 404;
      return { error: 'Job not found' };
    }

    return formatJob(job);
  }, {
    params: t.Object({ id: t.String() }),
  })

  // GET /v1/jobs?status=done&limit=20&cursor=<id>
  .get('/jobs', async ({ query, apiKey }) => {
    const status = (query as Record<string, string>).status;
    const limit = Math.min(parseInt((query as Record<string, string>).limit ?? '20', 10), 100);
    const cursor = (query as Record<string, string>).cursor;

    const jobs = await sql<ScrapeJob[]>`
      SELECT * FROM scrape_jobs
      WHERE api_key_id = ${apiKey.id}
        ${status ? sql`AND status = ${status}` : sql``}
        ${cursor ? sql`AND id < ${cursor}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return {
      data: jobs.map(formatJob),
      next_cursor: jobs.length === limit ? jobs[jobs.length - 1].id : null,
    };
  });

function formatJob(job: ScrapeJob) {
  return {
    job_id:         job.id,
    status:         job.status,
    url:            job.url,
    strategy:       job.strategy,
    strategy_used:  job.strategyUsed,
    proxy_tier:     job.proxyTier ?? null,
    output_formats: job.outputFormats,
    credits_used:   job.creditsCost,
    duration_ms:    job.durationMs,
    created_at:     job.createdAt,
    started_at:     job.startedAt,
    completed_at:   job.completedAt,
    error:          job.error ?? null,
    result:         job.result ?? null,
  };
}
