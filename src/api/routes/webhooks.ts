import { Elysia, t } from 'elysia';
import { sql, type Webhook } from '../../db/index.ts';
import { authMiddleware } from '../../middleware/auth.ts';

export const webhooksRoutes = new Elysia()
  .use(authMiddleware)

  // POST /v1/webhooks — register endpoint
  .post('/webhooks', async ({ body, apiKey }) => {
    const { url, events = ['job.done', 'job.failed'] } = body;

    const [wh] = await sql<Webhook[]>`
      INSERT INTO webhooks (api_key_id, url, events)
      VALUES (${apiKey.id}, ${url}, ${events})
      RETURNING *
    `;

    return {
      id:      wh.id,
      url:     wh.url,
      secret:  wh.secret, // returned once on creation
      events:  wh.events,
      active:  wh.active,
      created_at: wh.createdAt,
    };
  }, {
    body: t.Object({
      url:    t.String({ minLength: 1 }),
      events: t.Optional(t.Array(
        t.Union([t.Literal('job.done'), t.Literal('job.failed')])
      )),
    }),
  })

  // GET /v1/webhooks — list
  .get('/webhooks', async ({ apiKey }) => {
    const webhooks = await sql<Webhook[]>`
      SELECT * FROM webhooks WHERE api_key_id = ${apiKey.id} ORDER BY created_at DESC
    `;
    return webhooks.map(wh => ({
      id:         wh.id,
      url:        wh.url,
      events:     wh.events,
      active:     wh.active,
      created_at: wh.createdAt,
      last_fired_at: wh.lastFiredAt,
    }));
  })

  // DELETE /v1/webhooks/:id — remove
  .delete('/webhooks/:id', async ({ params, set, apiKey }) => {
    const result = await sql`
      DELETE FROM webhooks WHERE id = ${params.id} AND api_key_id = ${apiKey.id}
    `;
    if (result.count === 0) {
      set.status = 404;
      return { error: 'Webhook not found' };
    }
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
  })

  // POST /v1/webhooks/:id/test — fire a test delivery
  .post('/webhooks/:id/test', async ({ params, set, apiKey }) => {
    const [wh] = await sql<Webhook[]>`
      SELECT * FROM webhooks WHERE id = ${params.id} AND api_key_id = ${apiKey.id} LIMIT 1
    `;
    if (!wh) {
      set.status = 404;
      return { error: 'Webhook not found' };
    }

    const payload = {
      event: 'job.done',
      timestamp: new Date().toISOString(),
      data: { id: '00000000-0000-0000-0000-000000000000', status: 'done', url: 'https://example.com' },
    };

    try {
      const res = await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Scraper-Event': 'job.done' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      return { delivered: true, status_code: res.status };
    } catch (e) {
      return { delivered: false, error: (e as Error).message };
    }
  }, {
    params: t.Object({ id: t.String() }),
  });
