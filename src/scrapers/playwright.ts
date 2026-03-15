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

    // ── XHR/fetch capture ──────────────────────────────────────────────────
    // Capture JSON API responses so structured extractors can use xhr: selectors.
    // IMPORTANT: store as named function so it can be removed — dangling listeners
    // on closed pages accumulate over time and cause Bun's GC to segfault.
    const xhrCaptures: Record<string, unknown> = {};
    const onResponse = async (res: import('playwright').Response) => {
      try {
        if (res.url() === page.url()) statusCode = res.status();
        const ct = res.headers()['content-type'] ?? '';
        if (ct.includes('application/json')) {
          const pathname = new URL(res.url()).pathname;
          const json = await res.json().catch(() => null);
          if (json !== null) xhrCaptures[pathname] = json;
        }
      } catch {}
    };
    page.on('response', onResponse);

    // Helper: remove the response listener and unroute before closing.
    // Must be called on every exit path to prevent listener accumulation.
    const cleanup = () => {
      page.off('response', onResponse);
      page.unroute('**/*').catch(() => {});
    };

    // Block images, media and fonts — saves bandwidth and speeds up load.
    // JS and CSS must be allowed so Cloudflare challenge scripts can run.
    await page.route('**/*', (route) => {
      try {
        const type = route.request().resourceType();
        if (['image', 'media', 'font'].includes(type)) {
          route.abort().catch(() => {});
        } else {
          route.continue().catch(() => {});
        }
      } catch {
        // Page may have been closed/navigated — ignore
      }
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
      cleanup();
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      release();
      throw e;
    }

    // ── Active Cloudflare challenge wait ───────────────────────────────────
    // CF JS challenges run in-browser: the page title is "Just a moment..."
    // while CF's JS solves the challenge, then redirects to the real page.
    // Wait up to 15s for it to resolve rather than giving up immediately.
    const cfResolved = await this.waitForCFChallenge(page, 15_000);
    if (!cfResolved) {
      cleanup();
      await page.close();
      await context.close();
      release();
      throw new CloudflareJSError(url);
    }

    // Apply custom wait strategy
    await this.applyWait(page, opts.waitFor, timeout);

    // ── CapSolver CAPTCHA handling ─────────────────────────────────────────
    await this.solveCapsolverIfPresent(page, url);

    // Inject custom JS if requested
    if (opts.jsInject) {
      await page.evaluate(opts.jsInject);
    }

    const finalUrl = page.url();
    let html = await page.content();

    // Remove the response listener now — we have the HTML, no more needed.
    // Do this before the final CF check so the listener is always cleaned up.
    cleanup();

    // Final check — if still showing CF challenge after waiting, escalate
    if (this.isCloudflareChallenge(html)) {
      await page.close();
      await context.close();
      release();
      throw new CloudflareJSError(url); // cleanup() already called above
    }

    // Inject XHR captures into HTML so structured extractors can access them
    if (Object.keys(xhrCaptures).length > 0) {
      const capturesJson = JSON.stringify(xhrCaptures).replace(/<\/script>/gi, '<\\/script>');
      html = html.replace('</body>', `<script id="__XHR_CAPTURES__" type="application/json">${capturesJson}</script></body>`);
      if (!html.includes('__XHR_CAPTURES__')) {
        // No </body> tag — append at end
        html += `<script id="__XHR_CAPTURES__" type="application/json">${capturesJson}</script>`;
      }
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

  /**
   * Wait for a Cloudflare JS challenge to self-resolve.
   * CF challenges show a "Just a moment..." / "Attention Required" title while
   * the browser runs CF's JS proof-of-work. The page then auto-redirects.
   * Returns true if the page cleared (or was never challenged).
   * Returns false if still blocked after maxWaitMs.
   */
  private async waitForCFChallenge(page: Page, maxWaitMs: number): Promise<boolean> {
    const isCFTitle = (t: string) => {
      const l = t.toLowerCase();
      return l.includes('just a moment') || l.includes('attention required') || l.includes('checking your browser');
    };

    let title = '';
    try { title = await page.title(); } catch { return true; }

    if (!isCFTitle(title)) return true; // no challenge — proceed

    process.stderr.write(`  [playwright] CF challenge detected ("${title}") — waiting up to ${maxWaitMs / 1000}s\n`);
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1_000));
      try { title = await page.title(); } catch { return false; }
      if (!isCFTitle(title)) {
        process.stderr.write(`  [playwright] CF challenge resolved ("${title}")\n`);
        return true;
      }
    }
    process.stderr.write(`  [playwright] CF challenge did not resolve after ${maxWaitMs / 1000}s\n`);
    return false;
  }

  /**
   * Detect common CAPTCHA widgets and solve them via CapSolver if API key is set.
   * Supports hCaptcha, reCAPTCHA v2, and Cloudflare Turnstile.
   */
  private async solveCapsolverIfPresent(page: Page, pageUrl: string): Promise<void> {
    const apiKey = process.env.CAPSOLVER_API_KEY;
    if (!apiKey) return;

    try {
      // Detect which CAPTCHA is present
      const captchaType = await page.evaluate(() => {
        if (document.querySelector('.h-captcha, [data-hcaptcha-widget-id]')) return 'hcaptcha';
        if (document.querySelector('.g-recaptcha, [data-sitekey]')) return 'recaptcha';
        if (document.querySelector('.cf-turnstile')) return 'turnstile';
        return null;
      });
      if (!captchaType) return;

      const siteKey = await page.evaluate((type: string) => {
        if (type === 'hcaptcha') {
          const el = document.querySelector('.h-captcha') as HTMLElement | null;
          return el?.dataset.sitekey ?? null;
        }
        if (type === 'turnstile') {
          const el = document.querySelector('.cf-turnstile') as HTMLElement | null;
          return el?.dataset.sitekey ?? null;
        }
        const el = document.querySelector('.g-recaptcha') as HTMLElement | null;
        return el?.dataset.sitekey ?? null;
      }, captchaType);

      if (!siteKey) return;
      process.stderr.write(`  [playwright] CAPTCHA detected: ${captchaType} sitekey=${siteKey} — calling CapSolver\n`);

      const taskTypeMap: Record<string, string> = {
        hcaptcha: 'HCaptchaTaskProxyLess',
        recaptcha: 'ReCaptchaV2TaskProxyLess',
        turnstile: 'AntiTurnstileTaskProxyLess',
      };

      const createRes = await fetch('https://api.capsolver.com/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: apiKey,
          task: { type: taskTypeMap[captchaType], websiteURL: pageUrl, websiteKey: siteKey },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const createData = await createRes.json() as { taskId?: string; errorCode?: string };
      if (!createData.taskId) {
        process.stderr.write(`  [playwright] CapSolver createTask failed: ${createData.errorCode}\n`);
        return;
      }

      // Poll for result (up to 90s)
      let token: string | null = null;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3_000));
        const resultRes = await fetch('https://api.capsolver.com/getTaskResult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientKey: apiKey, taskId: createData.taskId }),
          signal: AbortSignal.timeout(10_000),
        });
        const resultData = await resultRes.json() as { status: string; solution?: { gRecaptchaResponse?: string; token?: string } };
        if (resultData.status === 'ready') {
          token = resultData.solution?.gRecaptchaResponse ?? resultData.solution?.token ?? null;
          break;
        }
        if (resultData.status !== 'processing') break;
      }

      if (!token) {
        process.stderr.write(`  [playwright] CapSolver: no token received\n`);
        return;
      }

      // Inject the token into the page
      await page.evaluate(({ type, tok }: { type: string; tok: string }) => {
        if (type === 'hcaptcha') {
          const ta = document.querySelector('textarea[name="h-captcha-response"]') as HTMLTextAreaElement | null;
          if (ta) ta.value = tok;
        } else if (type === 'turnstile') {
          const inp = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
          if (inp) inp.value = tok;
        } else {
          const ta = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement | null;
          if (ta) ta.value = tok;
        }
      }, { type: captchaType, tok: token });

      // Submit the form if there is one
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });

      // Wait for navigation after form submit
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
      process.stderr.write(`  [playwright] CapSolver: token injected and form submitted\n`);
    } catch (e) {
      // Non-fatal — log and continue without solving
      process.stderr.write(`  [playwright] CapSolver error: ${e instanceof Error ? e.message : String(e)}\n`);
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
