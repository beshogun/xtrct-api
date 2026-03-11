import { httpScraper, CloudflareError } from './http.ts';
import { playwrightScraper, CloudflareJSError, type PlaywrightOptions } from './playwright.ts';
import { flareScraper } from './flaresolverr.ts';
import { proxyManager, selectProxy, type ProxyTier } from '../proxy/manager.ts';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNetworkError(e: Error): boolean {
  return (
    e.message.includes('net::') ||
    e.message.includes('ECONNREFUSED') ||
    e.message.includes('ETIMEDOUT') ||
    e.message.includes('ECONNRESET') ||
    e.message.includes('fetch failed')
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
    const proxy = proxyManager.getProxy();
    const { result, page, context, release } = await playwrightScraper.fetchWithProxy(url, proxy, opts);
    return { ...result, strategyUsed: 'playwright', proxyUsed: proxy, proxyTier: proxy ? 'datacenter' : 'none', playwright: { page, context, release } };
  }

  if (strategy === 'flaresolverr') {
    const r = await flareScraper.fetch(url, opts.timeout);
    return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
  }

  throw new Error(`[strategy] Unknown strategy: ${strategy}`);
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
  const forcedTier = (opts.proxyTier === 'auto' || opts.proxyTier == null) ? null : opts.proxyTier;

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
  for (const step of playwrightSteps) {
    process.stderr.write(`  [strategy] step ${stepNum}: ${step.label}\n`);
    const r = await tryPlaywright(url, step.proxyUrl, opts);
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

  // ── Step 7: FlareSolverr ────────────────────────────────────────────────────
  process.stderr.write(`  [strategy] step ${stepNum}: FlareSolverr\n`);
  if (!(await flareScraper.isAvailable())) {
    throw new Error(
      `[strategy] FlareSolverr not reachable at ${flareScraper.url} — install it: ` +
      `docker run -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest`,
    );
  }

  const r = await flareScraper.fetch(url, opts.timeout);
  return { ...r, strategyUsed: 'flaresolverr', proxyUsed: null, proxyTier: 'none' };
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
