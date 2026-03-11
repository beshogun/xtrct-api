import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { applyStealthContext, randomUA, randomViewport } from './stealth.ts';

const POOL_SIZE = parseInt(process.env.BROWSER_POOL_SIZE ?? '3', 10);
const RECYCLE_INTERVAL_MS = 30 * 60 * 1000; // recycle browsers every 30 min

interface PoolEntry {
  browser: Browser;
  launchedAt: number;
  activeContexts: number;
}

class BrowserPool {
  private pool: PoolEntry[] = [];
  private ready = false;

  async init(): Promise<void> {
    if (this.ready) return;
    await Promise.all(
      Array.from({ length: POOL_SIZE }, () => this.launchBrowser())
    );
    this.ready = true;
    // Periodic recycling to prevent memory creep
    setInterval(() => this.recycleStale(), 60_000);
  }

  private async launchBrowser(): Promise<PoolEntry> {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
      ],
    });
    const entry: PoolEntry = { browser, launchedAt: Date.now(), activeContexts: 0 };
    this.pool.push(entry);
    return entry;
  }

  /** Pick the least-loaded live browser from the pool. */
  private pickBrowser(): PoolEntry {
    const sorted = this.pool
      .filter(e => e.browser.isConnected())
      .sort((a, b) => a.activeContexts - b.activeContexts);
    if (!sorted.length) throw new Error('No browsers available in pool');
    return sorted[0];
  }

  /**
   * Check out a fresh browser context for one scrape job.
   * The caller MUST call context.close() when done.
   */
  async acquireContext(opts: {
    headers?: Record<string, string>;
    cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
    proxy?: string | null;
  } = {}): Promise<{ context: BrowserContext; release: () => void }> {
    if (!this.ready) await this.init();

    const entry = this.pickBrowser();
    const vp = randomViewport();

    const context = await entry.browser.newContext({
      userAgent: randomUA(),
      viewport: vp,
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      extraHTTPHeaders: opts.headers ?? {},
      ignoreHTTPSErrors: true,
      ...(opts.proxy ? { proxy: { server: opts.proxy } } : {}),
    });

    await applyStealthContext(context);

    if (opts.cookies?.length) {
      await context.addCookies(
        opts.cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? '',
          path: c.path ?? '/',
          url: undefined,
        }))
      );
    }

    entry.activeContexts++;
    const release = () => {
      entry.activeContexts = Math.max(0, entry.activeContexts - 1);
    };

    return { context, release };
  }

  /** Replace browsers that have been running for over RECYCLE_INTERVAL_MS. */
  private async recycleStale(): Promise<void> {
    const now = Date.now();
    const toRecycle = this.pool.filter(
      e => now - e.launchedAt > RECYCLE_INTERVAL_MS && e.activeContexts === 0
    );

    for (const entry of toRecycle) {
      this.pool = this.pool.filter(e => e !== entry);
      entry.browser.close().catch(() => {});
      await this.launchBrowser();
    }

    // Replace any disconnected browsers
    const disconnected = this.pool.filter(e => !e.browser.isConnected());
    for (const entry of disconnected) {
      this.pool = this.pool.filter(e => e !== entry);
      await this.launchBrowser();
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.pool.map(e => e.browser.close()));
    this.pool = [];
    this.ready = false;
  }
}

// Singleton pool — shared across all workers in the process
export const pool = new BrowserPool();
