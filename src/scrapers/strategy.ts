import { httpScraper, CloudflareError } from './http.ts';
import { playwrightScraper, CloudflareJSError, type PlaywrightOptions } from './playwright.ts';
import { flareScraper } from './flaresolverr.ts';
import { proxyManager, selectProxy, type ProxyTier } from '../proxy/manager.ts';
import { randomBytes } from 'crypto';
import type { Strategy } from '../db/index.ts';

export interface StrategyResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  strategyUsed: 'http' | 'playwright' | 'flaresolverr';
  proxyUsed: string | null;
  proxyTier: ProxyTier;
  /** Only set when Playwright was used — caller must close + release when done */
  playwright?: {
    page: import('playwright').Page;
    context: import('playwright').BrowserContext;
    release: () => void;
  };
}

export interface RunOptions extends PlaywrightOptions {
  strategy?: Strategy;
  timeout?: number;
  /** API key ID — used for proxy credit deduction. If omitted, proxy is used without billing check. */
  apiKeyId?: string;
  /**
   * Force a specific proxy tier instead of using the auto-escalation chain.
   * 'auto' (default) works through all tiers as needed.
   * 'none' skips all proxy steps.
   * 'datacenter' / 'residential' jumps straight to that tier (both HTTP and Playwright).
   */
  proxyTier?: 'auto' | ProxyTier;
}

// ─── Domain strategy hints ────────────────────────────────────────────────────

// Sites that block datacenter IPs at the HTTP level — skip no-proxy/datacenter steps.
const RESIDENTIAL_ONLY_DOMAINS = new Set([
  'therealreal.com',
  'stockx.com',
  'zalando.co.uk',
  'zalando.com',
  'farfetch.com',
  'net-a-porter.com',
  'matchesfashion.com',
  'ssense.com',
  'wayfair.co.uk',
  'wayfair.com',
  'wine-auctioneer.com',
  'waterstones.com',
  // All Amazon TLDs — also in FLARESOLVERR_FIRST_DOMAINS; this acts as fallback
  // when FlareSolverr is unavailable so we still skip no-proxy/datacenter steps.
  'amazon.co.uk',
  'amazon.com',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'amazon.ca',
  'amazon.com.au',
  'amazon.in',
  'amazon.co.jp',
]);

// Sites that require real Chrome (not headless Playwright) to pass bot detection.
// FlareSolverr uses a real Chrome binary — proper fingerprint, JS execution,
// and cookie handling. Skip HTTP and Playwright steps entirely.
const FLARESOLVERR_FIRST_DOMAINS = new Set([
  'asos.com',
  'linkedin.com',
  'ticketmaster.co.uk',
  'ticketmaster.com',
  'livenation.co.uk',
  // Amazon uses its own bot detection — real Chrome fingerprint is required.
  // Even residential Playwright gets blocked; FlareSolverr + residential proxy
  // is the most reliable path.
  'amazon.co.uk',
  'amazon.com',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'amazon.ca',
  'amazon.com.au',
  'amazon.in',
  'amazon.co.jp',
]);

function getEffectiveProxyTier(url: string, requested: 'auto' | ProxyTier): 'auto' | ProxyTier {
  if (requested !== 'auto') return requested;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (RESIDENTIAL_ONLY_DOMAINS.has(hostname)) {
      process.stderr.write(`  [strategy] domain hint: ${hostname} → residential only\n`);
      return 'residential';
    }
  } catch {}
  return 'auto';
}

function isFlareSolverrFirst(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return FLARESOLVERR_FIRST_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNetworkError(e: Error): boolean {
  return (
    e.message.includes('net::') ||
    e.message.includes('ECONNREFUSED') ||
    e.message.includes('ETIMEDOUT') ||
    e.message.includes('ECONNRESET') ||
    e.message.includes('fetch failed') ||
    e.message.includes('certificate') ||
    e.message.includes('SSL') ||
    e.message.includes('TLS') ||
    e.message.includes('timed out') ||
    e.message.includes('TimeoutError') ||
    e.name === 'TimeoutError'
  );
}

/**
 * Attempt an HTTP fetch with an explicit proxy URL (or null for no proxy).
 * Returns null on CF block or network error (signals: try next step).
 * Throws on unexpected errors.
 */
async function tryHttp(
  url: string,
  proxyUrl: string | null,
  opts: RunOptions,
): Promise<{ html: string; statusCode: number; finalUrl: string } | null> {
  try {
    const result = await httpScraper.fetchWithProxy(url, proxyUrl, opts);
    return result;
  } catch (e) {
    if (e instanceof CloudflareError) return null;
    if (e instanceof Error && isNetworkError(e)) {
      if (proxyUrl) proxyManager.markFailed(proxyUrl);
      return null;
    }
    // Proxy auth failure — skip this proxy and try the next step
    if (e instanceof Error && e.message.includes('407')) {
      if (proxyUrl) proxyManager.markFailed(proxyUrl);
      return null;
    }
    // 403/401/429 are access-denied responses — try next step (proxy/browser may help)
    // Only 404 should hard-fail (URL doesn't exist regardless of strategy)
    if (e instanceof Error && (
      e.message.includes('HTTP 403') ||
      e.message.includes('HTTP 401') ||
      e.message.includes('HTTP 429') ||
      e.message.includes('HTTP 503')
    )) {
      return null;
    }
    throw e;
  }
}

/**
 * Attempt a Playwright fetch with an explicit proxy URL (or null for no proxy).
 * Returns null on CF JS challenge or network error (signals: try next step).
 * Throws on unexpected errors.
 */
async function tryPlaywright(
  url: string,
  proxyUrl: string | null,
  opts: RunOptions,
): Promise<{ result: { html: string; statusCode: number; finalUrl: string }; page: import('playwright').Page; context: import('playwright').BrowserContext; release: () => void } | null> {
  try {
    const r = await playwrightScraper.fetchWithProxy(url, proxyUrl, opts);
    return r;
  } catch (e) {
    if (e instanceof CloudflareJSError) return null;
    if (e instanceof Error && isNetworkError(e)) {
      if (proxyUrl) proxyManager.markFailed(proxyUrl);
      return null;
    }
    // Playwright navigation timeouts → try next step (e.g. with proxy)
    if (e instanceof Error && e.message.includes('Timeout') && e.message.includes('exceeded')) return null;
    throw e;
  }
}

// ─── Forced-strategy paths ────────────────────────────────────────────────────

async function runForced(url: string, opts: RunOptions, strategy: Strategy): Promise<StrategyResult> {
  if (strategy === 'http') {
    try {
      const proxy = proxyManager.getProxy();
      const r = await httpScraper.fetchWithProxy(url, proxy, opts);
      return { ...r, strategyUsed: 'http', proxyUsed: proxy, proxyTier: proxy ? 'datacenter' : 'none' };
    } catch (e) {
      if (e instanceof CloudflareError && await flareScraper.isAvailable()) {
        process.stderr.write(`  [strategy] HTTP blocked by Cloudflare → trying FlareSolverr (forced http mode)\n`);
        const r = await flareScraper.fetch(url, opts.timeout);
        return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
      }
      throw e;
    }
  }

  if (strategy === 'playwright') {
    // Try playwright with escalating proxies, then fall through to FlareSolverr on CF block
    const dcProxy  = proxyManager.getDatacenterProxy();
    const resProxy = proxyManager.getResidentialProxy();
    for (const [proxy, tier] of [[null, 'none'], [dcProxy, 'datacenter'], [resProxy, 'residential']] as [string | null, ProxyTier][]) {
      if (proxy === undefined) continue;
      const r = await tryPlaywright(url, proxy, opts);
      if (r) return { ...r.result, strategyUsed: 'playwright', proxyUsed: proxy, proxyTier: tier, playwright: { page: r.page, context: r.context, release: r.release } };
    }
    // All playwright attempts blocked by CF — escalate to FlareSolverr + sticky cookie handoff
    if (await flareScraper.isAvailable()) {
      process.stderr.write(`  [strategy] Playwright blocked → FlareSolverr SPA handoff (forced playwright mode)\n`);
      const sessionId = randomBytes(8).toString('hex');
      const stickyProxy = resProxy ? proxyManager.getStickyResidentialProxy(sessionId) : dcProxy ?? null;
      const flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);
      if (flareResult.html.length > 50_000 && !flareResult.html.includes("This site can't be reached")) {
        const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
        return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
      }
      const cfCookies = flareResult.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));
      const pwResult = await tryPlaywright(url, stickyProxy, { ...opts, cookies: [...(opts.cookies ?? []), ...cfCookies] });
      if (pwResult) {
        const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
        return { ...pwResult.result, strategyUsed: 'playwright', proxyUsed: stickyProxy, proxyTier, playwright: { page: pwResult.page, context: pwResult.context, release: pwResult.release } };
      }
      return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier: stickyProxy ? 'residential' : 'none' };
    }
    throw new Error('Cloudflare JS challenge blocked all Playwright attempts and FlareSolverr is not available');
  }

  if (strategy === 'flaresolverr') {
    const r = await flareScraper.fetch(url, opts.timeout);
    return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
  }

  throw new Error(`[strategy] Unknown strategy: ${strategy}`);
}

function stickyProxyTier(proxy: string | null, resProxy: string | null): ProxyTier {
  if (!proxy) return 'none';
  if (proxy === resProxy) return 'residential';
  const statics = [process.env.STATIC_RESIDENTIAL_PROXY_1, process.env.STATIC_RESIDENTIAL_PROXY_2].filter(Boolean);
  if (statics.includes(proxy)) return 'residential';
  return 'datacenter';
}

// ─── Auto-escalation chain ────────────────────────────────────────────────────

/**
 * Auto-escalating 7-step strategy runner:
 *
 *  1. HTTP, no proxy
 *  2. HTTP + datacenter proxy (if available)
 *  3. HTTP + residential proxy (if available)
 *  4. Playwright stealth, no proxy
 *  5. Playwright + datacenter proxy (if available)
 *  6. Playwright + residential proxy (if available)
 *  7. FlareSolverr (no proxy)
 *
 * Steps for unavailable tiers are skipped automatically.
 * If opts.proxyTier is forced (not 'auto'), the chain starts at the
 * corresponding proxy tier and skips earlier proxy steps.
 */
async function runAuto(url: string, opts: RunOptions): Promise<StrategyResult> {
  // Akamai/Datadome sites: skip HTTP+Playwright entirely, go straight to FlareSolverr
  if (isFlareSolverrFirst(url) && (opts.proxyTier == null || opts.proxyTier === 'auto')) {
    process.stderr.write(`  [strategy] domain hint: FlareSolverr-first for ${new URL(url).hostname}\n`);
    const resProxy = proxyManager.getResidentialProxy();
    const dcProxy  = proxyManager.getDatacenterProxy();
    const sessionId = randomBytes(8).toString('hex');
    const stickyProxy = resProxy
      ? proxyManager.getStickyResidentialProxy(sessionId)
      : (dcProxy ?? null);
    if (await flareScraper.isAvailable()) {
      const flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);
      const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
      if (flareResult.html.length > 15_000) {
        return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
      }
      // SPA shell — hand off to Playwright
      const cfCookies = flareResult.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));
      const pwResult = await tryPlaywright(url, stickyProxy, { ...opts, cookies: [...(opts.cookies ?? []), ...cfCookies] });
      if (pwResult) {
        return { ...pwResult.result, strategyUsed: 'playwright', proxyUsed: stickyProxy, proxyTier, playwright: { page: pwResult.page, context: pwResult.context, release: pwResult.release } };
      }
      return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
    }
    // FlareSolverr unavailable — fall through to normal chain
    process.stderr.write(`  [strategy] FlareSolverr unavailable — falling back to normal chain\n`);
  }

  const effectiveTier = getEffectiveProxyTier(url, opts.proxyTier ?? 'auto');
  const forcedTier = (effectiveTier === 'auto') ? null : effectiveTier;

  const dcProxy   = proxyManager.getDatacenterProxy();
  const resProxy  = proxyManager.getResidentialProxy();
  const hasDc     = dcProxy !== null;
  const hasRes    = resProxy !== null;

  // Build the list of (label, proxyUrl, tier) steps to attempt for HTTP
  type Step = { label: string; proxyUrl: string | null; tier: ProxyTier };

  const httpSteps: Step[] = [];
  const playwrightSteps: Step[] = [];

  if (!forcedTier || forcedTier === 'none') {
    httpSteps.push({ label: 'HTTP, no proxy', proxyUrl: null, tier: 'none' });
  }
  if ((!forcedTier || forcedTier === 'datacenter') && hasDc) {
    httpSteps.push({ label: 'HTTP + datacenter proxy', proxyUrl: dcProxy, tier: 'datacenter' });
  }
  if ((!forcedTier || forcedTier === 'residential') && hasRes) {
    httpSteps.push({ label: 'HTTP + residential proxy', proxyUrl: resProxy, tier: 'residential' });
  }

  if (!forcedTier || forcedTier === 'none') {
    playwrightSteps.push({ label: 'Playwright stealth, no proxy', proxyUrl: null, tier: 'none' });
  }
  if ((!forcedTier || forcedTier === 'datacenter') && hasDc) {
    playwrightSteps.push({ label: 'Playwright + datacenter proxy', proxyUrl: dcProxy, tier: 'datacenter' });
  }
  if ((!forcedTier || forcedTier === 'residential') && hasRes) {
    playwrightSteps.push({ label: 'Playwright + residential proxy', proxyUrl: resProxy, tier: 'residential' });
  }

  // ── HTTP steps ──────────────────────────────────────────────────────────────
  let stepNum = 1;
  for (const step of httpSteps) {
    process.stderr.write(`  [strategy] step ${stepNum}: ${step.label}\n`);
    const r = await tryHttp(url, step.proxyUrl, opts);
    if (r) {
      return { ...r, strategyUsed: 'http', proxyUsed: step.proxyUrl, proxyTier: step.tier };
    }
    stepNum++;
  }

  // ── Playwright steps ────────────────────────────────────────────────────────
  const totalTimeout = opts.timeout ?? 30_000;
  for (let i = 0; i < playwrightSteps.length; i++) {
    const step = playwrightSteps[i];
    // Cap early steps (no proxy, datacenter) at 20s so we escalate to residential quickly.
    // Give the last Playwright step the full timeout.
    const isLastPw = i === playwrightSteps.length - 1;
    const stepTimeout = isLastPw ? totalTimeout : Math.min(totalTimeout, 20_000);
    process.stderr.write(`  [strategy] step ${stepNum}: ${step.label}\n`);
    const r = await tryPlaywright(url, step.proxyUrl, { ...opts, timeout: stepTimeout });
    if (r) {
      return {
        ...r.result,
        strategyUsed: 'playwright',
        proxyUsed: step.proxyUrl,
        proxyTier: step.tier,
        playwright: { page: r.page, context: r.context, release: r.release },
      };
    }
    stepNum++;
  }

  // ── Step 7: FlareSolverr (with residential proxy) → Playwright cookie handoff ─
  process.stderr.write(`  [strategy] step ${stepNum}: FlareSolverr\n`);
  if (!(await flareScraper.isAvailable())) {
    throw new Error(
      `[strategy] FlareSolverr not reachable at ${flareScraper.url} — install it: ` +
      `docker run -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest`,
    );
  }

  // Use a sticky session so FlareSolverr and the Playwright handoff share the same exit IP.
  // cf_clearance cookies are IP-bound — mismatched IPs cause Cloudflare to reject them.
  const sessionId = randomBytes(8).toString('hex');
  const stickyProxy = resProxy
    ? proxyManager.getStickyResidentialProxy(sessionId)
    : (dcProxy ?? null);

  const flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);

  // If the page looks fully rendered and not a Chrome error page, return directly
  if (flareResult.html.length > 50_000 && !flareResult.html.includes("This site can't be reached")) {
    const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
    return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
  }

  // SPA shell — hand CF cookies to Playwright using the SAME sticky proxy
  process.stderr.write(`  [strategy] step ${stepNum}b: FlareSolverr→Playwright SPA handoff (sticky session ${sessionId})\n`);
  const cfCookies = flareResult.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));

  const pwResult = await tryPlaywright(url, stickyProxy, {
    ...opts,
    cookies: [...(opts.cookies ?? []), ...cfCookies],
    timeout: opts.timeout ?? 30_000,
  });

  if (pwResult) {
    const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
    return {
      ...pwResult.result,
      strategyUsed: 'playwright',
      proxyUsed: stickyProxy,
      proxyTier,
      playwright: { page: pwResult.page, context: pwResult.context, release: pwResult.release },
    };
  }

  const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
  return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run the appropriate strategy for the given URL.
 *
 * - strategy 'auto' (default): runs the 7-step escalation chain
 * - strategy 'http' | 'playwright' | 'flaresolverr': forced single strategy
 * - opts.proxyTier: when strategy is 'auto', forces a specific proxy tier
 *   ('none' | 'datacenter' | 'residential') skipping earlier proxy steps
 */
export async function runStrategy(url: string, opts: RunOptions = {}): Promise<StrategyResult> {
  const strategy = opts.strategy ?? 'auto';

  if (strategy !== 'auto') {
    return runForced(url, opts, strategy);
  }

  return runAuto(url, opts);
}
