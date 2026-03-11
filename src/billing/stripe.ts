import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia' as never,
});

export const PRICE_IDS: Record<string, string> = {
  starter:    process.env.STRIPE_PRICE_STARTER    ?? '',
  growth:     process.env.STRIPE_PRICE_GROWTH     ?? '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
};

export const PRICE_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_IDS).map(([tier, id]) => [id, tier])
);
