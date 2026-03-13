import { proxyManager } from '../proxy/manager.ts';

export interface HttpResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  headers: Record<string, string>;
}

export class CloudflareError extends Error {
  constructor(url: string) {
    super(`Cloudflare protected: ${url}`);
    this.name = 'CloudflareError';
  }
}

// Rotate through recent Chrome UAs — same pool as the Playwright stealth layer
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];
function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export class HttpScraper {
  /**
   * Fetch using an explicitly provided proxy URL (or null for no proxy).
   * Used by the strategy layer, which manages proxy selection and tier tracking.
   */
  async fetchWithProxy(
    url: string,
    proxy: string | null,
    opts: {
      headers?: Record<string, string>;
      cookies?: Array<{ name: string; value: string }>;
      timeout?: number;
    } = {}
  ): Promise<HttpResult> {
    const cookieHeader = opts.cookies?.map(c => `${c.name}=${c.value}`).join('; ') ?? '';

    let res: Response;
    try {
      const fetchOpts: RequestInit = {
        method: 'GET',
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...opts.headers,
        },
        signal: AbortSignal.timeout(opts.timeout ?? 30_000),
        redirect: 'follow',
      };
      if (proxy) (fetchOpts as Record<string, unknown>).proxy = proxy;
      res = await fetch(url, fetchOpts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('fetch failed');
      if (proxy && isNetworkError) {
        proxyManager.markFailed(proxy);
      }
      throw e;
    }

    if (this.isCloudflare(res.status, res.headers)) {
      throw new CloudflareError(url);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const html = await res.text();

    // Detect CF JS challenge pages that return 200 with a challenge body.
    // These look like success but contain no real content.
    if (this.isCloudflareBody(html)) {
      throw new CloudflareError(url);
    }

    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });

    return { html, statusCode: res.status, finalUrl: res.url, headers: respHeaders };
  }

  /**
   * Legacy fetch method — auto-selects a proxy from the pool.
   * Prefer fetchWithProxy() for new callers that need tier tracking.
   */
  async fetch(
    url: string,
    opts: {
      headers?: Record<string, string>;
      cookies?: Array<{ name: string; value: string }>;
      timeout?: number;
      apiKeyId?: string;
    } = {}
  ): Promise<HttpResult> {
    const proxy = proxyManager.getProxy();
    return this.fetchWithProxy(url, proxy, opts);
  }

  private isCloudflare(status: number, headers: Headers): boolean {
    const server = headers.get('server')?.toLowerCase() ?? '';
    const cfRay = headers.has('cf-ray');
    // Status-level CF block (header-based)
    if ((status === 403 || status === 503) && (server.includes('cloudflare') || cfRay)) return true;
    // Turnstile / managed challenge — CF returns 403 with cf-mitigated header
    if (status === 403 && headers.has('cf-mitigated')) return true;
    return false;
  }

  /**
   * Detect Cloudflare JS challenge pages that slip through as HTTP 200.
   * CF increasingly serves a browser JS proof-of-work page with a 200 status —
   * the real content only appears after the challenge script runs in a browser.
   */
  private isCloudflareBody(html: string): boolean {
    // Must be short — real pages are rarely under 15 KB
    if (html.length > 15_000) return false;
    const lower = html.toLowerCase();
    return (
      lower.includes('just a moment') ||
      lower.includes('cf-mitigated') ||
      lower.includes('enable javascript and cookies') ||
      lower.includes('checking your browser') ||
      lower.includes('error 1015') ||      // CF rate limit page
      lower.includes('error 1020') ||      // CF access denied
      (lower.includes('cloudflare') && lower.includes('challenge'))
    );
  }
}

export const httpScraper = new HttpScraper();
