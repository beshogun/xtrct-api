import { readFileSync } from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProxyTier = 'none' | 'datacenter' | 'residential';

export interface ProxySelection {
  url: string | null;
  tier: ProxyTier;
  creditCost: number;  // 0 for none, 2 for datacenter, 10 for residential
}

export interface ProxyEntry {
  url: string;           // http://user:pass@host:port
  source: 'static' | 'webshare';
  country?: string;
  healthy: boolean;
  failedAt?: number;     // timestamp of last failure
  successCount: number;
  failCount: number;
  avgResponseMs: number;
  lastUsedAt?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNHEALTHY_DURATION_MS = 5 * 60 * 1_000; // 5 minutes
const WEBSHARE_REFRESH_INTERVAL_MS = 10 * 60 * 1_000; // 10 minutes

function extractHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}`;
  } catch {
    return url;
  }
}

function parseStaticProxies(): ProxyEntry[] {
  let raw = '';

  if (process.env.PROXY_LIST) {
    raw = process.env.PROXY_LIST;
  } else if (process.env.PROXY_LIST_FILE) {
    try {
      raw = readFileSync(process.env.PROXY_LIST_FILE, 'utf8');
    } catch {
      console.warn(`[proxy] Could not read PROXY_LIST_FILE: ${process.env.PROXY_LIST_FILE}`);
    }
  }

  if (!raw.trim()) return [];

  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(url => ({
      url,
      source: 'static' as const,
      healthy: true,
      successCount: 0,
      failCount: 0,
      avgResponseMs: 0,
    }));
}

// ─── ProxyManager ─────────────────────────────────────────────────────────────

class ProxyManager {
  private proxies: ProxyEntry[] = [];
  private webshareRefreshedAt = 0;
  private roundRobinIdx = 0;

  constructor() {
    const statics = parseStaticProxies();
    this.proxies.push(...statics);
    if (statics.length > 0) {
      console.log(`[proxy] Loaded ${statics.length} static proxies`);
    }
  }

  // ── Residential proxy ──────────────────────────────────────────────────────

  /**
   * Returns the rotating residential proxy URL if credentials are configured,
   * otherwise null.
   */
  getResidentialProxy(): string | null {
    if (process.env.RESIDENTIAL_PROXY) return process.env.RESIDENTIAL_PROXY;
    const user = process.env.WEBSHARE_RESIDENTIAL_USER;
    const pass = process.env.WEBSHARE_RESIDENTIAL_PASS;
    if (!user || !pass) return null;
    return `http://${user}-rotate:${pass}@p.webshare.io:80`;
  }

  /**
   * Returns a sticky residential proxy URL pinned to a specific session ID.
   * Both FlareSolverr and the Playwright cookie handoff must use the same
   * sessionId so cf_clearance is valid for the exit IP.
   *
   * ProxyJet session format: append -session-{id} to the username.
   * Override with RESIDENTIAL_PROXY_SESSION_FORMAT env var if provider differs.
   * Format tokens: {user}, {session}, {pass}, {host}, {port}
   */
  getStickyResidentialProxy(sessionId: string): string | null {
    const base = process.env.RESIDENTIAL_PROXY;
    if (!base) return this.getResidentialProxy(); // fall back to rotating

    // Allow custom format override e.g. "{user}-sticky-{session}:{pass}@{host}:{port}"
    const fmt = process.env.RESIDENTIAL_PROXY_SESSION_FORMAT;
    if (fmt) {
      try {
        const u = new URL(base);
        return 'http://' + fmt
          .replace('{user}',    decodeURIComponent(u.username))
          .replace('{session}', sessionId)
          .replace('{pass}',    decodeURIComponent(u.password))
          .replace('{host}',    u.hostname)
          .replace('{port}',    u.port);
      } catch {
        return base;
      }
    }

    // Default: ProxyJet / most providers append -session-{id} to username
    try {
      const u = new URL(base);
      const stickyUser = `${decodeURIComponent(u.username)}-session-${sessionId}`;
      return `http://${stickyUser}:${decodeURIComponent(u.password)}@${u.host}`;
    } catch {
      return base;
    }
  }

  // ── Datacenter proxy ───────────────────────────────────────────────────────

  /**
   * Returns a healthy datacenter proxy URL from the static/Webshare list,
   * or null if none are configured or all are unhealthy.
   */
  getDatacenterProxy(preferCountry?: string): string | null {
    return this.getProxy(preferCountry);
  }

  // ── Legacy billing-aware selection (used by playwright.ts legacy fetch) ───

  /**
   * Round-robin over healthy proxies with billing check.
   * Returns null if no proxies configured, all unhealthy, or credits insufficient.
   */
  async getProxyForKey(apiKeyId: string, preferCountry?: string): Promise<string | null> {
    const url = this.getProxy(preferCountry);
    if (!url) return null;

    // Import here to avoid circular dependency at module load time
    const { deductProxyCredit } = await import('../billing/proxy-credits.ts');
    const deducted = await deductProxyCredit(apiKeyId, 'datacenter', 2).catch(() => false);
    if (!deducted) {
      console.warn(`[proxy] Insufficient proxy credits for key ${apiKeyId} — skipping proxy`);
      return null;
    }

    return url;
  }

  // ── Proxy selection ────────────────────────────────────────────────────────

  /**
   * Returns a ProxySelection for the requested tier. Never bills — billing
   * is handled by the strategy layer after the request succeeds.
   */
  selectProxy(tier: ProxyTier): ProxySelection {
    switch (tier) {
      case 'none':
        return { url: null, tier: 'none', creditCost: 0 };

      case 'datacenter': {
        const url = this.getDatacenterProxy();
        if (!url) return { url: null, tier: 'none', creditCost: 0 };
        return { url, tier: 'datacenter', creditCost: 2 };
      }

      case 'residential': {
        const url = this.getResidentialProxy();
        if (!url) return { url: null, tier: 'none', creditCost: 0 };
        return { url, tier: 'residential', creditCost: 10 };
      }
    }
  }

  /**
   * Round-robin over healthy proxies only.
   * Prefers proxies from the requested country if available.
   * Returns null if no proxies configured or all unhealthy.
   */
  getProxy(preferCountry?: string): string | null {
    const now = Date.now();

    // Revive proxies whose unhealthy period has elapsed
    for (const p of this.proxies) {
      if (!p.healthy && p.failedAt !== undefined && now - p.failedAt >= UNHEALTHY_DURATION_MS) {
        p.healthy = true;
        p.failedAt = undefined;
      }
    }

    let healthy = this.proxies.filter(p => p.healthy);
    if (healthy.length === 0) return null;

    // Prefer matching country if requested
    if (preferCountry) {
      const countryMatches = healthy.filter(p => p.country?.toLowerCase() === preferCountry.toLowerCase());
      if (countryMatches.length > 0) healthy = countryMatches;
    }

    // Sort by success rate (descending), use round-robin as tiebreaker
    healthy.sort((a, b) => {
      const rateA = a.successCount + a.failCount === 0 ? 0.5 : a.successCount / (a.successCount + a.failCount);
      const rateB = b.successCount + b.failCount === 0 ? 0.5 : b.successCount / (b.successCount + b.failCount);
      return rateB - rateA;
    });

    const idx = this.roundRobinIdx % healthy.length;
    this.roundRobinIdx = (this.roundRobinIdx + 1) % healthy.length;

    const selected = healthy[idx];
    selected.lastUsedAt = now;
    return selected.url;
  }

  // ── Health tracking ────────────────────────────────────────────────────────

  markSuccess(url: string, responseMs: number): void {
    const entry = this.proxies.find(p => p.url === url);
    if (!entry) return;
    entry.successCount++;
    // Exponential moving average for response time
    if (entry.avgResponseMs === 0) {
      entry.avgResponseMs = responseMs;
    } else {
      entry.avgResponseMs = Math.round(entry.avgResponseMs * 0.8 + responseMs * 0.2);
    }
  }

  markFailed(url: string): void {
    // Residential proxy is a rotating endpoint — don't mark it unhealthy
    if (this.isResidentialUrl(url)) {
      console.warn(`[proxy] Residential proxy request failed (rotating endpoint, not blacklisted)`);
      return;
    }
    const entry = this.proxies.find(p => p.url === url);
    if (!entry) return;
    entry.failCount++;
    entry.healthy = false;
    entry.failedAt = Date.now();
    console.warn(`[proxy] Marked unhealthy for 5 min: ${extractHost(url)}`);
  }

  private isResidentialUrl(url: string): boolean {
    if (process.env.RESIDENTIAL_PROXY && url === process.env.RESIDENTIAL_PROXY) return true;
    try {
      return new URL(url).hostname === 'p.webshare.io';
    } catch {
      return false;
    }
  }

  // ── Webshare datacenter integration ───────────────────────────────────────

  /**
   * Fetch up to `count` proxies from Webshare API (datacenter list).
   * Refreshes at most every 10 minutes.
   */
  async refreshWebshare(count = 100): Promise<void> {
    const apiKey = process.env.WEBSHARE_API_KEY;
    if (!apiKey) return;

    const now = Date.now();
    if (now - this.webshareRefreshedAt < WEBSHARE_REFRESH_INTERVAL_MS) return;

    try {
      const url = `https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=${count}`;
      const res = await fetch(url, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.error(`[proxy] Webshare API error: HTTP ${res.status}`);
        return;
      }

      const data = await res.json() as {
        results: Array<{
          username: string;
          password: string;
          proxy_address: string;
          port: number;
          country_code: string;
        }>;
      };

      if (!Array.isArray(data.results)) {
        console.error('[proxy] Webshare API returned unexpected shape');
        return;
      }

      // Remove old Webshare entries, replace with fresh ones
      this.proxies = this.proxies.filter(p => p.source !== 'webshare');

      for (const r of data.results) {
        this.proxies.push({
          url: `http://${r.username}:${r.password}@${r.proxy_address}:${r.port}`,
          source: 'webshare',
          country: r.country_code,
          healthy: true,
          successCount: 0,
          failCount: 0,
          avgResponseMs: 0,
        });
      }

      this.webshareRefreshedAt = now;
      console.log(`[proxy] Webshare: loaded ${data.results.length} proxies`);
    } catch (e) {
      console.error(`[proxy] Webshare refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats(): { total: number; healthy: number; sources: Record<string, number>; residential: boolean } {
    const now = Date.now();
    let healthyCount = 0;
    const sources: Record<string, number> = {};

    for (const p of this.proxies) {
      const isHealthy = p.healthy || (p.failedAt !== undefined && now - p.failedAt >= UNHEALTHY_DURATION_MS);
      if (isHealthy) healthyCount++;
      sources[p.source] = (sources[p.source] ?? 0) + 1;
    }

    return {
      total: this.proxies.length,
      healthy: healthyCount,
      sources,
      residential: this.getResidentialProxy() !== null,
    };
  }

  isWebshareConnected(): boolean {
    return !!process.env.WEBSHARE_API_KEY && this.webshareRefreshedAt > 0;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const proxyManager = new ProxyManager();

// Schedule periodic Webshare refresh (no-op if key not set)
setInterval(() => {
  proxyManager.refreshWebshare().catch(() => {});
}, WEBSHARE_REFRESH_INTERVAL_MS);

// ─── Clean functional API ─────────────────────────────────────────────────────

/**
 * Returns the right proxy URL and its credit cost for the requested tier.
 * Falls back gracefully if the requested tier isn't configured.
 */
export function selectProxy(tier: ProxyTier): ProxySelection {
  return proxyManager.selectProxy(tier);
}

/** Synchronous proxy selection (no billing check). Used by legacy callers. */
export function getProxy(): string | null {
  return proxyManager.getProxy();
}

export function markProxyFailed(proxyUrl: string): void {
  proxyManager.markFailed(proxyUrl);
}
