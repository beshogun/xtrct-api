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

export class HttpScraper {
  private static readonly UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': HttpScraper.UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...opts.headers,
        },
        // @ts-ignore Bun-specific options
        tls: { rejectUnauthorized: false },
        ...(proxy ? { proxy } : {}),
        signal: AbortSignal.timeout(opts.timeout ?? 30_000),
        redirect: 'follow',
      });
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
    return (status === 403 || status === 503) && server.includes('cloudflare');
  }
}

export const httpScraper = new HttpScraper();
