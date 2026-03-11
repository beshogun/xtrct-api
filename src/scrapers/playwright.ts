import type { Page, BrowserContext } from 'playwright';
import { pool } from '../browser/pool.ts';
import { proxyManager } from '../proxy/manager.ts';

export interface PlaywrightResult {
  html: string;
  statusCode: number;
  finalUrl: string;
}

export type WaitFor =
  | { type: 'networkidle' }
  | { type: 'selector'; value: string }
  | { type: 'js'; value: string }
  | { type: 'delay'; value: number };

export interface PlaywrightOptions {
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string }>;
  jsInject?: string;
  waitFor?: WaitFor;
  timeout?: number;
  apiKeyId?: string;
}

export class CloudflareJSError extends Error {
  constructor(url: string) {
    super(`Cloudflare JS challenge: ${url}`);
    this.name = 'CloudflareJSError';
  }
}

export class PlaywrightScraper {
  /**
   * Fetch using an explicitly provided proxy URL (or null for no proxy).
   * Used by the strategy layer, which manages proxy selection and tier tracking.
   */
  async fetchWithProxy(
    url: string,
    proxy: string | null,
    opts: PlaywrightOptions = {},
  ): Promise<{ result: PlaywrightResult; page: Page; context: BrowserContext; release: () => void }> {
    let { context, release } = await pool.acquireContext({
      headers: opts.headers,
      cookies: opts.cookies,
      proxy,
    });

    const page = await context.newPage();
    let statusCode = 200;

    page.on('response', async res => {
      if (res.url() === page.url()) statusCode = res.status();
    });

    const timeout = opts.timeout ?? 30_000;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Detect network/connection errors (not page-level errors like 404)
      const isNetworkError = msg.includes('net::') || msg.includes('ERR_') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT');
      if (proxy && isNetworkError) {
        proxyManager.markFailed(proxy);
      }
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      release();
      throw e;
    }

    // Apply custom wait strategy
    await this.applyWait(page, opts.waitFor, timeout);

    // Inject custom JS if requested
    if (opts.jsInject) {
      await page.evaluate(opts.jsInject);
    }

    const finalUrl = page.url();
    const html = await page.content();

    // Detect Cloudflare JS challenge
    if (this.isCloudflareChallenge(html)) {
      await page.close();
      await context.close();
      release();
      throw new CloudflareJSError(url);
    }

    return { result: { html, statusCode, finalUrl }, page, context, release };
  }

  /**
   * Legacy fetch method — auto-selects a proxy from the pool.
   * Prefer fetchWithProxy() for new callers that need tier tracking.
   */
  async fetch(url: string, opts: PlaywrightOptions = {}): Promise<{ result: PlaywrightResult; page: Page; context: BrowserContext; release: () => void }> {
    const proxy = opts.apiKeyId
      ? await proxyManager.getProxyForKey(opts.apiKeyId)
      : proxyManager.getProxy();
    return this.fetchWithProxy(url, proxy, opts);
  }

  private async applyWait(page: Page, waitFor: WaitFor | undefined, timeout: number): Promise<void> {
    if (!waitFor) {
      try {
        await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 15_000) });
      } catch {
        // networkidle can timeout on pages with constant XHR — that's fine
      }
      return;
    }

    switch (waitFor.type) {
      case 'networkidle':
        await page.waitForLoadState('networkidle', { timeout });
        break;
      case 'selector':
        await page.waitForSelector(waitFor.value, { timeout });
        break;
      case 'js':
        await page.waitForFunction(waitFor.value, null, { timeout });
        break;
      case 'delay':
        await new Promise(r => setTimeout(r, Math.min(waitFor.value, 10_000)));
        break;
    }
  }

  private isCloudflareChallenge(html: string): boolean {
    const lower = html.toLowerCase();
    return (
      lower.includes('checking your browser') ||
      lower.includes('just a moment') ||
      (lower.includes('cloudflare') && lower.includes('challenge'))
    );
  }
}

export const playwrightScraper = new PlaywrightScraper();
