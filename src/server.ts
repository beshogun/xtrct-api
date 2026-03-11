import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { scrapeRoutes } from './api/routes/scrape.ts';
import { jobsRoutes } from './api/routes/jobs.ts';
import { webhooksRoutes } from './api/routes/webhooks.ts';
import { billingRoutes } from './api/routes/billing.ts';
import { batchRoutes } from './api/routes/batch.ts';
import { proxyRoutes } from './api/routes/proxy.ts';
import { sql } from './db/index.ts';
import { pool } from './browser/pool.ts';
import { presetsRoutes } from './api/routes/presets.ts';
import path from 'path';
import { sendApiKey } from './email.ts';

const PUBLIC_DIR = path.join(import.meta.dir, '../public');

function serveHtml(file: string) {
  return Bun.file(path.join(PUBLIC_DIR, file));
}

export function createServer() {
  return new Elysia()
    .use(cors())

    // ─── Landing page & static files ─────────────────────────────────────────
    .get('/',            () => serveHtml('index.html'))
    .get('/sitemap.xml',  () => Bun.file(path.join(PUBLIC_DIR, 'sitemap.xml')))
    .get('/robots.txt',   () => Bun.file(path.join(PUBLIC_DIR, 'robots.txt')))
    .get('/og.png',       () => Bun.file(path.join(PUBLIC_DIR, 'og.png')))
    .get('/dashboard',    () => serveHtml('dashboard.html'))
    .get('/privacy',      () => serveHtml('privacy.html'))
    .get('/terms',        () => serveHtml('terms.html'))

    // ─── Health ──────────────────────────────────────────────────────────────
    .get('/health', async () => {
      const [dbRow] = await sql`SELECT 1 AS ok`.catch(() => [null]);
      return {
        status:  dbRow ? 'ok' : 'degraded',
        db:      dbRow ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      };
    })

    // ─── Self-serve signup ───────────────────────────────────────────────────
    .post('/signup', async ({ body, set }) => {
      const { email, name } = body as { email?: string; name?: string };

      if (!email?.includes('@')) {
        set.status = 400;
        return { error: 'Valid email required.' };
      }

      const [existing] = await sql`
        SELECT key FROM api_keys WHERE email = ${email.toLowerCase()} AND active = true LIMIT 1
      `;
      if (existing) {
        sendApiKey(email.toLowerCase(), existing.key, true).catch(() => {});
        return { key: existing.key, existing: true };
      }

      const [row] = await sql`
        INSERT INTO api_keys (name, email, tier, credits_remaining)
        VALUES (${name?.trim() ?? null}, ${email.toLowerCase()}, 'free', 500)
        RETURNING key
      `;
      sendApiKey(email.toLowerCase(), row.key, false).catch(() => {});
      return { key: row.key };
    })

    // ─── Key recovery ─────────────────────────────────────────────────────────
    .post('/keys/recover', async ({ body, set }) => {
      const { email } = body as { email?: string };
      if (!email?.includes('@')) {
        set.status = 400;
        return { error: 'Valid email required.' };
      }
      const [row] = await sql`
        SELECT key FROM api_keys WHERE email = ${email.toLowerCase()} AND active = true LIMIT 1
      `;
      // Always return success to avoid email enumeration
      if (row) sendApiKey(email.toLowerCase(), row.key, true).catch(() => {});
      return { message: 'If an account exists for that email, your API key has been sent.' };
    })

    // ─── Key rotation ────────────────────────────────────────────────────────
    .post('/v1/keys/rotate', async ({ request, set }) => {
      const oldKey = request.headers.get('x-api-key') ?? '';
      if (!oldKey) { set.status = 401; return { error: 'Missing X-API-Key' }; }

      const [row] = await sql`
        UPDATE api_keys
        SET key = 'x_live_' || encode(gen_random_bytes(24), 'hex')
        WHERE key = ${oldKey} AND active = true
        RETURNING key
      `;
      if (!row) { set.status = 404; return { error: 'Key not found' }; }
      return { key: row.key };
    })

    // ─── Billing ─────────────────────────────────────────────────────────────
    .use(billingRoutes)

    // ─── Preset discovery (no auth — registered before the auth group) ───────
    .use(presetsRoutes)

    // ─── API v1 ──────────────────────────────────────────────────────────────
    .group('/v1', app =>
      app
        .use(scrapeRoutes)
        .use(batchRoutes)
        .use(jobsRoutes)
        .use(webhooksRoutes)
        .use(proxyRoutes)
    )

    // ─── Global error handler ────────────────────────────────────────────────
    .onError(({ error, set }) => {
      const msg = error instanceof Error ? error.message : 'Internal error';
      if (set.status === 200) set.status = 500;
      return { error: msg };
    });
}
