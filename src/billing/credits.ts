import { sql, TIER_CREDITS, type Tier } from '../db/index.ts';

/**
 * Deduct credits after a successful job.
 * If the key has no remaining credits, bills as overage instead.
 */
export async function deductCredits(apiKeyId: string, credits: number, jobId: string, strategy: string): Promise<void> {
  // Internal tier: track usage for observability but never block or deduct
  const [keyRow] = await sql`SELECT tier FROM api_keys WHERE id = ${apiKeyId}`;
  if (keyRow?.tier === 'internal') {
    await sql`INSERT INTO usage_events (api_key_id, job_id, credits, strategy) VALUES (${apiKeyId}, ${jobId}, ${credits}, ${strategy})`;
    return;
  }

  await sql`
    UPDATE api_keys SET
      credits_remaining   = GREATEST(0, credits_remaining - ${credits}),
      overage_credits     = CASE
                              WHEN credits_remaining < ${credits}
                              THEN overage_credits + (${credits} - credits_remaining)
                              ELSE overage_credits
                            END,
      credits_used_period = credits_used_period + ${credits}
    WHERE id = ${apiKeyId}
  `;

  await sql`
    INSERT INTO usage_events (api_key_id, job_id, credits, strategy)
    VALUES (${apiKeyId}, ${jobId}, ${credits}, ${strategy})
  `;
}

/**
 * Check if key has enough credits (or overage allowed) for estimated cost.
 * Returns true if the job can proceed.
 */
export async function checkCredits(apiKeyId: string, tier: Tier): Promise<boolean> {
  // Internal tier: always allowed
  if (tier === 'internal') return true;

  // Free tier: hard block at 0 credits
  if (tier === 'free') {
    const [row] = await sql`SELECT credits_remaining FROM api_keys WHERE id = ${apiKeyId}`;
    return (row?.creditsRemaining ?? 0) > 0;
  }
  // Paid tiers: allow overage
  return true;
}

/** Reset credits for a new billing period. Called by billing webhook. */
export async function resetPeriodCredits(apiKeyId: string, tier: Tier): Promise<void> {
  await sql`
    UPDATE api_keys SET
      credits_remaining   = ${TIER_CREDITS[tier] ?? 500},
      credits_used_period = 0,
      overage_credits     = 0,
      period_reset_at     = date_trunc('month', NOW()) + interval '1 month'
    WHERE id = ${apiKeyId}
  `;
}
