import { createHmac } from 'crypto';
import { sql } from '../db/index.ts';
import type { ScrapeJob } from '../db/index.ts';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 30_000, 300_000]; // immediate, 30s, 5min

interface WebhookPayload {
  event: 'job.done' | 'job.failed';
  timestamp: string;
  data: Partial<ScrapeJob> & { id: string };
}

async function deliver(
  webhookId: string,
  url: string,
  secret: string,
  payload: WebhookPayload,
  attempt: number
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', secret).update(body).digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scraper-Signature': `sha256=${sig}`,
        'X-Scraper-Event': payload.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    await sql`
      INSERT INTO webhook_deliveries (webhook_id, job_id, event, status_code, success, attempt)
      VALUES (${webhookId}, ${payload.data.id}, ${payload.event}, ${res.status}, ${res.ok}, ${attempt})
    `;

    if (res.ok) {
      await sql`UPDATE webhooks SET last_fired_at = NOW() WHERE id = ${webhookId}`;
    }

    return res.ok;
  } catch {
    await sql`
      INSERT INTO webhook_deliveries (webhook_id, job_id, event, status_code, success, attempt)
      VALUES (${webhookId}, ${payload.data.id}, ${payload.event}, null, false, ${attempt})
    `;
    return false;
  }
}

/** Fire registered webhooks for a completed job, with retry. */
export async function fireJobWebhooks(job: ScrapeJob): Promise<void> {
  const event: 'job.done' | 'job.failed' = job.status === 'done' ? 'job.done' : 'job.failed';

  const webhooks = await sql<Array<{ id: string; url: string; secret: string }>>`
    SELECT w.id, w.url, w.secret
    FROM webhooks w
    INNER JOIN api_keys k ON k.id = w.api_key_id
    WHERE w.active = true
      AND k.id = ${job.apiKeyId}
      AND ${event} = ANY(w.events)
  `;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data: {
      id:           job.id,
      url:          job.url,
      status:       job.status,
      strategyUsed: job.strategyUsed,
      creditsCost:  job.creditsCost,
      durationMs:   job.durationMs,
      result:       job.result,
      error:        job.error,
      completedAt:  job.completedAt,
    },
  };

  // One-shot webhook registered on the job itself
  if (job.webhookUrl) {
    scheduleWithRetry('__one-shot__', job.webhookUrl, 'one-shot-secret', payload);
  }

  for (const wh of webhooks) {
    scheduleWithRetry(wh.id, wh.url, wh.secret, payload);
  }
}

function scheduleWithRetry(
  webhookId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
): void {
  let attempt = 1;

  const tryDeliver = async () => {
    const ok = await deliver(webhookId, url, secret, payload, attempt);
    if (!ok && attempt < MAX_ATTEMPTS) {
      attempt++;
      setTimeout(tryDeliver, RETRY_DELAYS[attempt - 1] ?? 0);
    }
  };

  tryDeliver().catch(() => {});
}
