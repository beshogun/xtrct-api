import { Elysia } from 'elysia';
import Stripe from 'stripe';
import { stripe, PRICE_IDS, PRICE_TO_TIER } from '../../billing/stripe.ts';
import { sql } from '../../db/index.ts';
import { resetPeriodCredits } from '../../billing/credits.ts';
import { addProxyCredits } from '../../billing/proxy-credits.ts';
import { TIER_CREDITS, type Tier } from '../../db/index.ts';

export const billingRoutes = new Elysia()

  // GET /checkout/:tier?email=...
  .get('/checkout/:tier', async ({ params, query, set }) => {
    const { tier } = params;
    const email = (query as Record<string, string>).email ?? '';
    const priceId = PRICE_IDS[tier];

    if (!priceId) {
      set.status = 400;
      return { error: `Unknown tier: ${tier}` };
    }

    const baseUrl = process.env.PUBLIC_URL ?? 'https://xtrct.io';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/#pricing`,
      metadata: { tier },
      subscription_data: { trial_period_days: 7 },
    });

    set.status = 302;
    set.headers['Location'] = session.url!;
    return;
  })

  // GET /checkout/proxy-credits?email=&amount=1000
  .get('/checkout/proxy-credits', async ({ query, set }) => {
    const { email = '', amount = '1000' } = query as Record<string, string>;
    const credits = Math.max(100, parseInt(amount, 10) || 1000);

    const priceId = process.env.STRIPE_PRICE_PROXY_CREDITS;
    if (!priceId) {
      set.status = 503;
      return { error: 'Proxy credit purchases not configured (STRIPE_PRICE_PROXY_CREDITS not set)' };
    }

    const baseUrl = process.env.PUBLIC_URL ?? 'https://xtrct.io';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: credits }],
      customer_email: email || undefined,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
      metadata: { proxy_credits: String(credits) },
    });

    set.status = 302;
    set.headers['Location'] = session.url!;
    return;
  })

  // GET /success?session_id=...
  .get('/success', async ({ query, set }) => {
    const sessionId = (query as Record<string, string>).session_id;
    if (!sessionId) { set.status = 400; return { error: 'Missing session_id' }; }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer'],
      });

      const isComplete = session.status === 'complete';
      const isPaid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
      if (!isComplete && !isPaid) {
        set.status = 400;
        return { error: 'Payment not completed' };
      }

      const customerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null;
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;

      const customer = session.customer as Stripe.Customer | null;
      const email = (typeof customer === 'object' ? customer?.email : null)
                 ?? session.customer_email ?? '';
      const tier = (session.metadata?.tier ?? 'starter') as Tier;
      const credits = TIER_CREDITS[tier] ?? 10_000;

      const [existing] = await sql`SELECT key, id FROM api_keys WHERE email = ${email.toLowerCase()} LIMIT 1`;

      if (existing) {
        await sql`
          UPDATE api_keys SET
            tier                   = ${tier},
            credits_remaining      = ${credits},
            stripe_customer_id     = ${customerId},
            stripe_subscription_id = ${subscriptionId}
          WHERE email = ${email.toLowerCase()}
        `;
        return successPage(existing.key as string, tier, true);
      }

      const [row] = await sql`
        INSERT INTO api_keys (email, tier, credits_remaining, stripe_customer_id, stripe_subscription_id)
        VALUES (${email.toLowerCase()}, ${tier}, ${credits}, ${customerId}, ${subscriptionId})
        RETURNING key
      `;
      return successPage(row.key as string, tier, false);
    } catch (e) {
      set.status = 500;
      return { error: String(e) };
    }
  })

  // POST /stripe/webhook
  .post('/stripe/webhook', async ({ request, set }) => {
    const sig = request.headers.get('stripe-signature') ?? '';
    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
    } catch {
      set.status = 400;
      return { error: 'Invalid signature' };
    }

    // Handle proxy credit top-ups (one-time payment)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const proxyCredits = session.metadata?.proxy_credits ? parseInt(session.metadata.proxy_credits, 10) : 0;
      if (proxyCredits > 0 && session.customer_email) {
        const [key] = await sql`SELECT id FROM api_keys WHERE email = ${session.customer_email.toLowerCase()} AND active = true LIMIT 1`;
        if (key) {
          await addProxyCredits(key.id as string, proxyCredits);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      await sql`UPDATE api_keys SET tier = 'free', credits_remaining = 500 WHERE stripe_subscription_id = ${sub.id}`;
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? '';
      const tier = PRICE_TO_TIER[priceId] as Tier | undefined;
      if (tier) {
        await sql`UPDATE api_keys SET tier = ${tier} WHERE stripe_subscription_id = ${sub.id}`;
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id;
      if (subId) {
        const [key] = await sql`SELECT id, tier FROM api_keys WHERE stripe_subscription_id = ${subId} LIMIT 1`;
        if (key) {
          await resetPeriodCredits(key.id as string, key.tier as Tier);
        }
      }
    }

    return { received: true };
  })

  // GET /v1/usage — credit balance
  .get('/v1/usage', async ({ request, set }) => {
    const apiKeyStr = request.headers.get('x-api-key') ?? '';
    if (!apiKeyStr) { set.status = 401; return { error: 'Missing X-API-Key' }; }

    const [row] = await sql`
      SELECT tier, credits_remaining, credits_used_period, overage_credits, period_reset_at
      FROM api_keys WHERE key = ${apiKeyStr} AND active = true LIMIT 1
    `;
    if (!row) { set.status = 401; return { error: 'Invalid key' }; }

    return {
      tier:                 row.tier,
      credits_remaining:    row.creditsRemaining,
      credits_used_period:  row.creditsUsedPeriod,
      overage_credits:      row.overageCredits,
      period_reset_at:      row.periodResetAt,
    };
  });

function successPage(key: string, tier: string, upgraded: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xtrct — ${upgraded ? 'Plan upgraded' : 'Welcome'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background:#07060f; font-family:'Plus Jakarta Sans',sans-serif; }
    .mono { font-family:'JetBrains Mono',monospace; }
    .grad { background:linear-gradient(135deg,#a78bfa,#7c3aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center px-6" style="color:#ede9fe;">
  <div class="max-w-lg w-full text-center">
    <a href="/" class="inline-block text-2xl font-extrabold mb-8" style="color:#ede9fe;">xtrct<span style="color:#7c3aed;">.</span></a>
    <h1 class="text-3xl font-extrabold mb-2">${upgraded ? 'Plan upgraded! 🎉' : 'You\'re in. 🎉'}</h1>
    <p class="mb-8" style="color:#6d6880;">Your <strong style="color:#a78bfa;" class="capitalize">${tier}</strong> plan is active.
    ${!upgraded ? ' 7-day free trial — no charge until it ends.' : ''}</p>

    <div class="rounded-xl mb-5 text-left overflow-hidden" style="background:#0f0d1a;border:1px solid #1e1a2e;">
      <div class="px-4 py-3 text-xs mono" style="border-bottom:1px solid #1e1a2e;color:#6d6880;">Your API key — copy it now</div>
      <div id="key" class="px-4 py-3 mono text-sm break-all" style="color:#a78bfa;">${key}</div>
    </div>

    <div class="rounded-xl mb-8 text-left overflow-hidden" style="background:#0a0812;border:1px solid #1e1a2e;">
      <div class="px-4 py-2 text-xs mono" style="border-bottom:1px solid #1e1a2e;color:#6d6880;">Quick start</div>
      <pre class="px-4 py-4 text-xs mono overflow-x-auto" style="color:#6d6880;line-height:1.7;"><span style="color:#4a4560;"># Extract clean markdown from any URL</span>
curl -X POST https://api.xtrct.io/v1/scrape \\
  -H <span style="color:#c4b5fd;">"X-API-Key: ${key}"</span> \\
  -H <span style="color:#c4b5fd;">"Content-Type: application/json"</span> \\
  -d <span style="color:#c4b5fd;">'{"url":"https://example.com","output":"markdown","wait":true}'</span></pre>
    </div>

    <button onclick="navigator.clipboard.writeText('${key}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy API key',2000)"
      class="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
      style="background:linear-gradient(135deg,#7c3aed,#5b21b6);">
      Copy API key
    </button>
    <p class="mt-6 text-xs" style="color:#4a4560;">
      <a href="https://xtrct.io" style="color:#6d6880;text-decoration:none;" onmouseover="this.style.color='#a78bfa'" onmouseout="this.style.color='#6d6880'">← Back to xtrct.io</a>
    </p>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
