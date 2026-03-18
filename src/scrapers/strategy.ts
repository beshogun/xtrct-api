import { httpScraper, CloudflareError } from './http.ts';
import { playwrightScraper, CloudflareJSError, type PlaywrightOptions } from './playwright.ts';
import { flareScraper } from './flaresolverr.ts';
import { trySlipstream, isSlipstreamEnabled } from './slipstream.ts';
import { proxyManager, selectProxy, type ProxyTier } from '../proxy/manager.ts';
import { getSession, markSuccess, markFailed, isAmazonBotPage } from './amazon-session.ts';
import { randomBytes } from 'crypto';
import type { Strategy } from '../db/index.ts';
import { sql } from '../db/index.ts';

export interface StrategyResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  strategyUsed: 'http' | 'playwright' | 'flaresolverr' | 'slipstream';
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
  'johnlewis.com',
  'currys.co.uk',
  'flannels.com',
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
  'flannels.com',
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

function isAmazonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, '').startsWith('amazon.');
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

// ─── Telemetry ────────────────────────────────────────────────────────────────

export type StepAttempt = {
  stepIndex: number;
  strategy: 'slipstream' | 'http' | 'playwright' | 'flaresolverr';
  proxyTier: 'none' | 'datacenter' | 'residential' | 'isp';
  success: boolean;
  blocked: boolean;
  timeMs: number;
  costCredits: number;
  errorType: 'cloudflare' | 'timeout' | 'network' | 'parse' | null;
};

/** Cost in credits per strategy+tier combination, matching billing table */
const STEP_CREDITS: Partial<Record<string, Partial<Record<string, number>>>> = {
  slipstream:   { isp: 1 },
  http:         { none: 1, datacenter: 2, residential: 5 },
  playwright:   { none: 3, datacenter: 5, residential: 10 },
  flaresolverr: { none: 8, datacenter: 8, residential: 8 },
};

export function stepCost(strategy: StepAttempt['strategy'], proxyTier: StepAttempt['proxyTier']): number {
  return STEP_CREDITS[strategy]?.[proxyTier] ?? 1;
}

export function classifyError(err: unknown): StepAttempt['errorType'] {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cloudflare|cf-ray|403|challenge/i.test(msg)) return 'cloudflare';
  if (/timeout|timed out/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return 'network';
  return 'parse';
}

/**
 * Wraps an escalation step: records timing and outcome into `steps`.
 * - fn() returns null → success=false, no exception re-thrown
 * - fn() throws → success=false, exception re-thrown (unexpected errors abort chain)
 */
export async function attempt<T extends object | string>(
  steps: StepAttempt[],
  stepIndex: number,
  strategy: StepAttempt['strategy'],
  proxyTier: StepAttempt['proxyTier'],
  costCredits: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ stepIndex, strategy, proxyTier, success: result !== null,
                 blocked: false, timeMs: Date.now() - t0, costCredits, errorType: null });
    return result;
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({ stepIndex, strategy, proxyTier, success: false,
                 blocked: errorType === 'cloudflare',
                 timeMs: Date.now() - t0, costCredits, errorType });
    throw err;
  }
}

/**
 * Batch-writes accumulated step attempts to scrape_telemetry.
 * Fire-and-forget — never throws.
 */
export async function writeTelemetry(
  domain: string,
  steps: StepAttempt[],
  apiKeyId: string | null,
): Promise<void> {
  if (steps.length === 0) return;
  for (const s of steps) {
    await sql`
      INSERT INTO scrape_telemetry
        (domain, step_index, strategy, proxy_tier, success, blocked,
         time_ms, cost_credits, error_type, api_key_id)
      VALUES (
        ${domain}, ${s.stepIndex}, ${s.strategy}, ${s.proxyTier},
        ${s.success}, ${s.blocked}, ${s.timeMs}, ${s.costCredits},
        ${s.errorType}, ${apiKeyId}
      )
    `;
  }
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

async function runForcedInner(url: string, opts: RunOptions, strategy: Strategy): Promise<StrategyResult> {
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

async function runForced(url: string, opts: RunOptions, strategy: Strategy, steps: StepAttempt[]): Promise<StrategyResult> {
  const t0 = Date.now();
  try {
    const result = await runForcedInner(url, opts, strategy);
    steps.push({
      stepIndex: 0,
      strategy: result.strategyUsed,
      proxyTier: result.proxyTier === 'none' ? 'none' : result.proxyTier as StepAttempt['proxyTier'],
      success: true, blocked: false,
      timeMs: Date.now() - t0,
      costCredits: stepCost(result.strategyUsed, result.proxyTier === 'none' ? 'none' : result.proxyTier as StepAttempt['proxyTier']),
      errorType: null,
    });
    return result;
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({
      stepIndex: 0, strategy: strategy as StepAttempt['strategy'],
      proxyTier: 'none', success: false,
      blocked: errorType === 'cloudflare',
      timeMs: Date.now() - t0,
      costCredits: stepCost(strategy as StepAttempt['strategy'], 'none'),
      errorType,
    });
    throw err;
  }
}

function stickyProxyTier(proxy: string | null, resProxy: string | null): ProxyTier {
  if (!proxy) return 'none';
  if (proxy === resProxy) return 'residential';
  const statics = [process.env.STATIC_RESIDENTIAL_PROXY_1, process.env.STATIC_RESIDENTIAL_PROXY_2].filter(Boolean);
  if (statics.includes(proxy)) return 'residential';
  return 'datacenter';
}

// ─── Learned strategy lookup ──────────────────────────────────────────────────

interface DomainStrategy {
  optimalStrategy: 'slipstream' | 'http' | 'playwright' | 'flaresolverr';
  proxyTier: 'none' | 'datacenter' | 'residential' | 'isp';
  successRate: number;
  sampleCount: number;
}

/**
 * Returns the learned optimal strategy for a domain if one exists and is fresh
 * (computed within last 2 hours, ≥10 samples, ≥85% success rate).
 * Returns null if no confident strategy is known — caller runs the full chain.
 */
async function getLearnedStrategy(domain: string): Promise<DomainStrategy | null> {
  try {
    const [row] = await sql<DomainStrategy[]>`
      SELECT optimal_strategy, proxy_tier, success_rate, sample_count
      FROM domain_strategies
      WHERE domain = ${domain}
        AND computed_at > NOW() - INTERVAL '2 hours'
        AND sample_count >= 10
        AND success_rate >= 0.85
    `;
    return row ?? null;
  } catch {
    return null; // never block a scrape due to telemetry DB issues
  }
}

/**
 * Attempts the learned strategy for a domain. Returns the result on success,
 * or null if the strategy fails (caller falls through to the full chain).
 * Logs one StepAttempt regardless of outcome.
 */
async function tryLearnedStrategy(
  url: string,
  opts: RunOptions,
  learned: DomainStrategy,
  steps: StepAttempt[],
): Promise<StrategyResult | null> {
  const strat = learned.optimalStrategy;
  // Don't cast to ProxyTier here — DomainStrategy.proxyTier includes 'isp' (slipstream-internal).
  // ProxyTier in manager.ts is 'none' | 'datacenter' | 'residential' only.
  // We use learned.proxyTier directly; the http/playwright branches only match non-'isp' values.
  const tier  = learned.proxyTier;
  const cost  = stepCost(strat, learned.proxyTier);
  const si    = steps.length;

  try {
    if (strat === 'slipstream') {
      const html = await attempt(steps, si, 'slipstream', 'isp', cost,
        () => trySlipstream(url, opts.timeout ?? 90_000));
      if (html) return { html, statusCode: 200, finalUrl: url, strategyUsed: 'slipstream', proxyUsed: null, proxyTier: 'none' };
    }

    if (strat === 'http') {
      // getResidentialProxy/getDatacenterProxy return string | null (never undefined)
      const proxy = tier === 'residential' ? proxyManager.getResidentialProxy()
                  : tier === 'datacenter'  ? proxyManager.getDatacenterProxy()
                  : null;
      if (proxy !== null) {
        const r = await attempt(steps, si, 'http', tier, cost, () => tryHttp(url, proxy, opts));
        if (r) return { ...r, strategyUsed: 'http', proxyUsed: proxy, proxyTier: tier as ProxyTier };
      }
    }

    if (strat === 'playwright') {
      const proxy = tier === 'residential' ? proxyManager.getResidentialProxy()
                  : tier === 'datacenter'  ? proxyManager.getDatacenterProxy()
                  : null;
      if (proxy !== null) {
        const r = await attempt(steps, si, 'playwright', tier, cost,
          () => tryPlaywright(url, proxy, opts));
        if (r) return { ...r.result, strategyUsed: 'playwright', proxyUsed: proxy, proxyTier: tier as ProxyTier,
                        playwright: { page: r.page, context: r.context, release: r.release } };
      }
    }

    if (strat === 'flaresolverr' && await flareScraper.isAvailable()) {
      // flareScraper.fetch() throws on failure — wrap to log the step either way
      const t0 = Date.now();
      try {
        const r = await flareScraper.fetch(url, opts.timeout);
        steps.push({ stepIndex: si, strategy: 'flaresolverr', proxyTier: 'none',
                     success: true, blocked: false, timeMs: Date.now() - t0,
                     costCredits: cost, errorType: null });
        return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
      } catch (err) {
        const errorType = classifyError(err);
        steps.push({ stepIndex: si, strategy: 'flaresolverr', proxyTier: 'none',
                     success: false, blocked: errorType === 'cloudflare',
                     timeMs: Date.now() - t0, costCredits: cost, errorType });
        // fall through to return null below
      }
    }
  } catch {
    // logged by attempt() or explicit push above; swallow — fall through to full chain
  }

  return null;
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
async function runAuto(url: string, opts: RunOptions, steps: StepAttempt[]): Promise<StrategyResult> {
  const domain = new URL(url).hostname.replace(/^www\./, '');

  // Try learned strategy first (skip for FlareSolverr-first domains — they have hardcoded requirements)
  if (!isFlareSolverrFirst(url)) {
    const learned = await getLearnedStrategy(domain);
    if (learned) {
      process.stderr.write(`  [strategy] learned: ${domain} → ${learned.optimalStrategy}+${learned.proxyTier} (rate=${learned.successRate.toFixed(2)} n=${learned.sampleCount})\n`);
      const result = await tryLearnedStrategy(url, opts, learned, steps);
      if (result) return result;
      process.stderr.write(`  [strategy] learned strategy failed — running full chain\n`);
    }
  }

  // Akamai/Datadome sites: skip HTTP+Playwright entirely, go straight to FlareSolverr
  if (isFlareSolverrFirst(url) && (opts.proxyTier == null || opts.proxyTier === 'auto')) {
    process.stderr.write(`  [strategy] domain hint: FlareSolverr-first for ${new URL(url).hostname}\n`);

    // ── Amazon session pool: try pre-warmed cached cookies first ──────────────
    // Pre-warmed sessions dramatically reduce bot-detection hits vs cold requests.
    if (isAmazonUrl(url)) {
      const session = getSession();
      if (session) {
        process.stderr.write(`  [strategy] Amazon session pool: trying cached session\n`);
        const sessionCookies = session.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }));
        const pwResult = await attempt(steps, steps.length, 'playwright', 'residential', stepCost('playwright', 'residential'),
          async () => tryPlaywright(url, session.proxyUrl, { ...opts, cookies: [...(opts.cookies ?? []), ...sessionCookies] }));
        if (pwResult) {
          if (!isAmazonBotPage(pwResult.result.html)) {
            markSuccess(session);
            process.stderr.write(`  [strategy] Amazon session pool: clean page — success\n`);
            return {
              ...pwResult.result,
              strategyUsed: 'playwright',
              proxyUsed: session.proxyUrl,
              proxyTier: 'residential',
              playwright: { page: pwResult.page, context: pwResult.context, release: pwResult.release },
            };
          }
          // Bot page — evict session and fall through to FlareSolverr
          markFailed(session);
          pwResult.release();
          process.stderr.write(`  [strategy] Amazon session pool: bot page — session evicted, falling back to FlareSolverr\n`);
        } else {
          markFailed(session);
          process.stderr.write(`  [strategy] Amazon session pool: Playwright failed — falling back to FlareSolverr\n`);
        }
      } else {
        process.stderr.write(`  [strategy] Amazon session pool: no sessions available — using FlareSolverr\n`);
      }
    }

    // Try Slipstream before FlareSolverr — cheaper and faster when it works.
    // 30s timeout so we don't delay the FlareSolverr fallback too long.
    if (isSlipstreamEnabled()) {
      process.stderr.write(`  [strategy] step 0: Slipstream Engine (FlareSolverr-first domain)\n`);
      const html = await attempt(steps, steps.length, 'slipstream', 'isp', 1,
        () => trySlipstream(url, 30_000));
      if (html) {
        return { html, statusCode: 200, finalUrl: url, strategyUsed: 'slipstream', proxyUsed: null, proxyTier: 'none' };
      }
      process.stderr.write(`  [strategy] Slipstream failed — falling through to FlareSolverr\n`);
    }

    const resProxy = proxyManager.getResidentialProxy();
    const dcProxy  = proxyManager.getDatacenterProxy();
    const sessionId = randomBytes(8).toString('hex');
    const stickyProxy = resProxy
      ? proxyManager.getStickyResidentialProxy(sessionId)
      : (dcProxy ?? null);
    if (await flareScraper.isAvailable()) {
      const flareFirstT0 = Date.now();
      let flareResult: Awaited<ReturnType<typeof flareScraper.fetch>>;
      try {
        flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);
        steps.push({ stepIndex: steps.length, strategy: 'flaresolverr',
                     proxyTier: stickyProxy ? 'residential' : 'none',
                     success: true, blocked: false, timeMs: Date.now() - flareFirstT0,
                     costCredits: stepCost('flaresolverr', stickyProxy ? 'residential' : 'none'),
                     errorType: null });
      } catch (err) {
        const errorType = classifyError(err);
        steps.push({ stepIndex: steps.length, strategy: 'flaresolverr',
                     proxyTier: stickyProxy ? 'residential' : 'none',
                     success: false, blocked: errorType === 'cloudflare',
                     timeMs: Date.now() - flareFirstT0,
                     costCredits: stepCost('flaresolverr', stickyProxy ? 'residential' : 'none'),
                     errorType });
        throw err;
      }
      const proxyTier: ProxyTier = stickyProxyTier(stickyProxy, resProxy);
      // Detect Amazon bot/CAPTCHA pages — these are large HTML pages but contain no product data.
      // Treating them as success causes garbage price extraction, so we fail fast instead.
      if (isAmazonBotPage(flareResult.html)) {
        process.stderr.write(`  [strategy] Amazon bot/CAPTCHA page detected — failing job\n`);
        throw new Error('Amazon bot detection page returned (CAPTCHA)');
      }
      if (flareResult.html.length > 15_000) {
        return { ...flareResult, strategyUsed: 'flaresolverr', proxyUsed: stickyProxy, proxyTier };
      }
      // SPA shell — hand off to Playwright with CF clearance cookies
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

  // When Slipstream is enabled, skip HTTP proxy steps — Slipstream handles proxy escalation
  // internally with cheaper Webshare ISP proxies. Only run HTTP with no proxy first (free),
  // then hand off to Slipstream. Proxjet only used as Playwright fallback for stubborn SPAs.
  // Note: we only skip Slipstream if the USER explicitly forced a proxy tier via the API.
  // Domain hints (RESIDENTIAL_ONLY_DOMAINS) should not suppress Slipstream — those domains
  // still benefit from Slipstream's ISP proxy chain before falling through to Proxjet.
  const userForcedTier = (opts.proxyTier && opts.proxyTier !== 'auto') ? opts.proxyTier : null;
  const slipstreamActive = isSlipstreamEnabled() && !userForcedTier;

  if (!forcedTier || forcedTier === 'none') {
    httpSteps.push({ label: 'HTTP, no proxy', proxyUrl: null, tier: 'none' });
  }
  if (!slipstreamActive) {
    // Only include Proxjet HTTP proxy steps when Slipstream is not available
    if ((!forcedTier || forcedTier === 'datacenter') && hasDc) {
      httpSteps.push({ label: 'HTTP + datacenter proxy', proxyUrl: dcProxy, tier: 'datacenter' });
    }
    if ((!forcedTier || forcedTier === 'residential') && hasRes) {
      httpSteps.push({ label: 'HTTP + residential proxy', proxyUrl: resProxy, tier: 'residential' });
    }
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
    const r = await attempt(steps, steps.length, 'http', step.tier, stepCost('http', step.tier),
      () => tryHttp(url, step.proxyUrl, opts));
    if (r) {
      return { ...r, strategyUsed: 'http', proxyUsed: step.proxyUrl, proxyTier: step.tier };
    }
    stepNum++;
  }

  // ── Slipstream Engine (after HTTP, before Playwright) ───────────────────────
  // HTTP failed (CF block, bot detection, etc.) — try Slipstream's smart chain:
  //   FastGear (rquest, Chrome TLS) → ISP proxy → CapSolver → Heavy Gear (real Chrome + SOCKS5)
  // Much cheaper than spinning up Playwright/FlareSolverr for sites with CF JS challenges.
  // Skipped when strategy is forced or proxyTier is forced (user explicitly chose a path).
  if (slipstreamActive) {
    process.stderr.write(`  [strategy] step ${stepNum}: Slipstream Engine\n`);
    const html = await attempt(steps, steps.length, 'slipstream', 'isp', 1,
      () => trySlipstream(url, 90_000));
    if (html) {
      return {
        html,
        statusCode: 200,
        finalUrl: url,
        strategyUsed: 'slipstream',
        proxyUsed: null,
        proxyTier: 'none',
      };
    }
    process.stderr.write(`  [strategy] Slipstream failed — escalating to Playwright\n`);
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
    const r = await attempt(steps, steps.length, 'playwright', step.tier, stepCost('playwright', step.tier),
      () => tryPlaywright(url, step.proxyUrl, { ...opts, timeout: stepTimeout }));
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

  const flareT0 = Date.now();
  let flareResult: Awaited<ReturnType<typeof flareScraper.fetch>>;
  try {
    flareResult = await flareScraper.fetch(url, opts.timeout, stickyProxy);
    steps.push({ stepIndex: steps.length, strategy: 'flaresolverr',
                 proxyTier: stickyProxy ? 'residential' : 'none',
                 success: true, blocked: false, timeMs: Date.now() - flareT0,
                 costCredits: stepCost('flaresolverr', stickyProxy ? 'residential' : 'none'),
                 errorType: null });
  } catch (err) {
    const errorType = classifyError(err);
    steps.push({ stepIndex: steps.length, strategy: 'flaresolverr',
                 proxyTier: stickyProxy ? 'residential' : 'none',
                 success: false, blocked: errorType === 'cloudflare',
                 timeMs: Date.now() - flareT0,
                 costCredits: stepCost('flaresolverr', stickyProxy ? 'residential' : 'none'),
                 errorType });
    throw err;
  }

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
  const steps: StepAttempt[] = [];
  let domain = 'unknown';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {}

  try {
    if (strategy !== 'auto') {
      return await runForced(url, opts, strategy, steps);
    }
    return await runAuto(url, opts, steps);
  } finally {
    writeTelemetry(domain, steps, opts.apiKeyId ?? null).catch(() => {});
  }
}
