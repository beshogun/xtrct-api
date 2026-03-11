import { sql } from '../db/index.ts';
import type { ProxyTier } from '../proxy/manager.ts';

/**
 * Credit costs per proxy tier.
 * Datacenter costs 2 credits, residential 10 credits, none is free.
 */
export const PROXY_CREDIT_COSTS: Record<ProxyTier, number> = {
  none:        0,
  datacenter:  2,
  residential: 10,
};

/**
 * Attempt to deduct proxy credits for one request.
 * Returns true if credits were available and deducted (or cost is 0).
 * Returns false if the key has insufficient credits — caller should proceed
 * without a proxy.
 */
export async function deductProxyCredit(
  apiKeyId: string,
  tier: ProxyTier,
  creditCost: number,
): Promise<boolean> {
  if (creditCost <= 0) return true;

  const result = await sql`
    UPDATE api_keys
    SET proxy_credits_remaining = proxy_credits_remaining - ${creditCost}
    WHERE id = ${apiKeyId}
      AND proxy_credits_remaining >= ${creditCost}
    RETURNING id
  `;

  return result.length > 0;
}

/**
 * Top up proxy credits for an API key.
 */
export async function addProxyCredits(apiKeyId: string, credits: number): Promise<void> {
  await sql`
    UPDATE api_keys
    SET proxy_credits_remaining = proxy_credits_remaining + ${credits}
    WHERE id = ${apiKeyId}
  `;
}

/**
 * Get current proxy credit balance for an API key.
 */
export async function getProxyCredits(apiKeyId: string): Promise<number> {
  const [row] = await sql`
    SELECT proxy_credits_remaining FROM api_keys WHERE id = ${apiKeyId} LIMIT 1
  `;
  return (row?.proxyCreditsRemaining as number | undefined) ?? 0;
}
