import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 10,
  idle_timeout: 30,
  transform: postgres.camel,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = 'free' | 'starter' | 'growth' | 'enterprise';
export type Strategy = 'auto' | 'http' | 'playwright' | 'flaresolverr';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';
export type OutputFormat =
  | 'html' | 'cleaned_html' | 'markdown' | 'text'
  | 'screenshot' | 'pdf' | 'links' | 'metadata' | 'structured';

export interface ApiKey {
  id: string;
  key: string;
  name: string | null;
  email: string | null;
  tier: Tier;
  creditsRemaining: number;
  creditsUsedPeriod: number;
  overageCredits: number;
  proxyCreditsRemaining: number;
  periodResetAt: Date;
  active: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeItemId: string | null;
  createdAt: Date;
}

export interface ScrapeJob {
  id: string;
  apiKeyId: string;
  batchId: string | null;
  url: string;
  strategy: Strategy;
  strategyUsed: Strategy | null;
  proxyTier: string | null;
  outputFormats: OutputFormat[];
  options: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  workerId: string | null;
  creditsCost: number | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
  webhookUrl: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface Webhook {
  id: string;
  apiKeyId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  lastFiredAt: Date | null;
}

// ─── Credit costs per strategy ────────────────────────────────────────────────

export const STRATEGY_CREDITS: Record<string, number> = {
  http:          1,
  playwright:    3,
  flaresolverr:  5,
};

export const EXTRA_CREDITS: Record<string, number> = {
  screenshot: 2,
  pdf:        2,
};

export const TIER_CREDITS: Record<Tier, number> = {
  free:       500,
  starter:    10_000,
  growth:     50_000,
  enterprise: 250_000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getApiKey(key: string): Promise<ApiKey | null> {
  // Reset credits if period has elapsed
  await sql`
    UPDATE api_keys
    SET credits_remaining   = ${sql`(SELECT credits_remaining FROM api_keys WHERE key = ${key})`},
        credits_used_period = 0,
        period_reset_at     = date_trunc('month', NOW()) + interval '1 month'
    WHERE key = ${key}
      AND active = true
      AND period_reset_at <= NOW()
  `;

  const [row] = await sql<ApiKey[]>`
    SELECT * FROM api_keys WHERE key = ${key} AND active = true LIMIT 1
  `;
  return row ?? null;
}

export function calculateCredits(strategy: string, formats: OutputFormat[]): number {
  let cost = STRATEGY_CREDITS[strategy] ?? 1;
  for (const fmt of formats) {
    cost += EXTRA_CREDITS[fmt] ?? 0;
  }
  return cost;
}
