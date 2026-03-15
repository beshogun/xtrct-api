/**
 * Amazon session pool.
 *
 * Pre-warms browser sessions on amazon.co.uk (solving image CAPTCHAs via
 * CapSolver when needed) and caches the resulting cookies. The strategy layer
 * loads a cached session before hitting Amazon, dramatically cutting the
 * per-request bot-detection rate — the same technique used by Rainforest API.
 *
 * Pool lifecycle:
 *   - Filled on startup (AMAZON_SESSION_POOL_SIZE, default 10)
 *   - Refreshed every 30 min — tops up sessions expiring within 8 h
 *   - Sessions live for AMAZON_SESSION_TTL_H hours (default 36)
 *   - Sessions with 3+ consecutive bot pages are evicted
 *
 * Requires:
 *   CAPSOLVER_API_KEY — for solving Amazon's image CAPTCHA during session creation
 *   RESIDENTIAL_PROXY — rotating residential proxy (already used by strategy.ts)
 *
 * Optional:
 *   AMAZON_SESSION_POOL_SIZE — pool target size (default 10)
 *   AMAZON_SESSION_TTL_H     — session lifetime in hours (default 36)
 *   AMAZON_SESSION_POOL=false — disable entirely
 */

import { chromium } from 'playwright';
import { proxyManager } from '../proxy/manager.ts';
import { applyStealthContext, randomUA, randomViewport } from '../browser/stealth.ts';

// ─── Config ───────────────────────────────────────────────────────────────────

const POOL_SIZE    = Number(process.env.AMAZON_SESSION_POOL_SIZE ?? 5);
const TTL_MS       = Number(process.env.AMAZON_SESSION_TTL_H    ?? 36) * 60 * 60 * 1_000;
const REFRESH_SOON = 8 * 60 * 60 * 1_000;  // refresh sessions expiring within 8 h
const CAPSOLVER    = process.env.CAPSOLVER_API_KEY ?? '';
const ENABLED      = process.env.AMAZON_SESSION_POOL !== 'false';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmazonSession {
  proxyUrl:   string;
  cookies:    Array<{ name: string; value: string; domain: string; path: string }>;
  userAgent:  string;
  createdAt:  number;
  expiresAt:  number;
  lastUsedAt: number;
  failures:   number;
}

// ─── In-memory pool ───────────────────────────────────────────────────────────

const _pool: AmazonSession[] = [];
let   _filling = false;

// ─── Bot page detection ───────────────────────────────────────────────────────

/** True when Amazon returned a CAPTCHA / robot-check page instead of product data. */
export function isAmazonBotPage(html: string): boolean {
  return (
    html.includes('Robot Check') ||
    html.includes('api-services-support@amazon.com') ||
    html.includes('Type the characters you see') ||
    html.includes('Enter the characters you see') ||
    html.includes('validateCaptcha') ||
    (html.toLowerCase().includes('captcha') && html.includes('amazon.co.uk'))
  );
}

// ─── CapSolver — Amazon image CAPTCHA ────────────────────────────────────────

/**
 * Detect and solve Amazon's /errors/validateCaptcha image CAPTCHA via CapSolver.
 * Amazon uses a plain distorted-text image (not hCaptcha/reCAPTCHA), so we use
 * the ImageToTextTask type.  Tries up to 3 times per page load.
 */
async function solveAmazonCaptcha(page: import('playwright').Page): Promise<boolean> {
  if (!CAPSOLVER) {
    process.stderr.write('  [amazon-session] CAPTCHA detected but CAPSOLVER_API_KEY not set\n');
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const html = await page.content();
    if (!isAmazonBotPage(html)) return true;

    process.stderr.write(`  [amazon-session] Solving image CAPTCHA (attempt ${attempt + 1}/3)\n`);

    // Extract the CAPTCHA image URL from the page
    const imgSrc: string | null = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(
        'img[src*="captcha"], .a-box img[src*="captcha"], form img'
      );
      return img?.src ?? null;
    });

    if (!imgSrc) {
      process.stderr.write('  [amazon-session] Cannot locate CAPTCHA image element\n');
      return false;
    }

    // Download and base64-encode the image
    let imgBase64: string;
    try {
      const res = await fetch(imgSrc, { signal: AbortSignal.timeout(10_000) });
      imgBase64  = Buffer.from(await res.arrayBuffer()).toString('base64');
    } catch (e) {
      process.stderr.write(`  [amazon-session] Failed to fetch CAPTCHA image: ${e}\n`);
      return false;
    }

    // Submit to CapSolver ImageToTextTask
    const createRes  = await fetch('https://api.capsolver.com/createTask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        clientKey: CAPSOLVER,
        task:      { type: 'ImageToTextTask', body: imgBase64 },
      }),
    });
    const created = await createRes.json() as {
      taskId?: string;
      errorCode?: string;
      errorDescription?: string;
    };

    if (!created.taskId) {
      process.stderr.write(`  [amazon-session] CapSolver createTask failed: ${created.errorDescription ?? created.errorCode}\n`);
      return false;
    }

    // Poll for result (max 30 s)
    let solution: string | null = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2_000));
      const pollRes  = await fetch('https://api.capsolver.com/getTaskResult', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clientKey: CAPSOLVER, taskId: created.taskId }),
        signal:  AbortSignal.timeout(8_000),
      });
      const polled = await pollRes.json() as { status: string; solution?: { text: string } };
      if (polled.status === 'ready' && polled.solution?.text) {
        solution = polled.solution.text.trim();
        break;
      }
      if (polled.status !== 'processing') break;
    }

    if (!solution) {
      process.stderr.write('  [amazon-session] CapSolver returned no solution\n');
      return false;
    }

    process.stderr.write(`  [amazon-session] CAPTCHA solved: "${solution}"\n`);

    // Type the answer and submit
    await page.fill(
      'input#captchacharacters, input[name="field-keywords"], input[type="text"]',
      solution,
    );
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
      page.click('button.a-button-text, button[type="submit"], input[type="submit"]'),
    ]);
  }

  return !isAmazonBotPage(await page.content());
}

// ─── Session creation ─────────────────────────────────────────────────────────

async function createSession(proxyUrl: string): Promise<AmazonSession | null> {
  let browser: import('playwright').Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
      ],
    });

    let proxyConfig: { server: string; username?: string; password?: string } | undefined;
    try {
      const u = new URL(proxyUrl);
      proxyConfig = {
        server:   `${u.protocol}//${u.host}`,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    } catch { /* invalid proxy URL — skip proxy */ }

    const context = await browser.newContext({
      proxy:      proxyConfig,
      userAgent:  randomUA(),
      locale:     'en-GB',
      timezoneId: 'Europe/London',
      viewport:   randomViewport(),
      extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
    });
    await applyStealthContext(context);

    const page = await context.newPage();

    await page.goto('https://www.amazon.co.uk/', {
      waitUntil: 'load',
      timeout:   60_000,
    });
    // Wait for JS to execute and cookies to be set
    await page.waitForTimeout(3_000);

    // Solve CAPTCHA if Amazon challenged us on the homepage
    if (isAmazonBotPage(await page.content())) {
      const solved = await solveAmazonCaptcha(page);
      if (!solved) {
        process.stderr.write('  [amazon-session] Could not clear CAPTCHA — discarding session\n');
        await browser.close();
        return null;
      }
    }

    // Verify we landed on a real Amazon page
    const finalHtml = await page.content();
    const finalUrl  = page.url();
    process.stderr.write(`  [amazon-session] Final URL: ${finalUrl} | HTML size: ${finalHtml.length} | title: ${(finalHtml.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '').slice(0, 80)}\n`);
    if (isAmazonBotPage(finalHtml) || !finalUrl.includes('amazon')) {
      process.stderr.write('  [amazon-session] Session page looks invalid — discarding\n');
      await browser.close();
      return null;
    }

    const allCookies = await context.cookies();
    const cookies = allCookies
      .filter(c => c.domain.includes('amazon'))
      .map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));

    if (cookies.length < 3) {
      process.stderr.write(`  [amazon-session] Only ${cookies.length} cookies extracted — likely blocked\n`);
      await browser.close();
      return null;
    }

    const userAgent: string = await page.evaluate(() => navigator.userAgent);
    await browser.close();

    const now = Date.now();
    return {
      proxyUrl,
      cookies,
      userAgent,
      createdAt:  now,
      expiresAt:  now + TTL_MS,
      lastUsedAt: now,
      failures:   0,
    };
  } catch (e) {
    process.stderr.write(`  [amazon-session] createSession error: ${e instanceof Error ? e.message : e}\n`);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

// ─── Pool management ──────────────────────────────────────────────────────────

function valid(): AmazonSession[] {
  const now = Date.now();
  return _pool.filter(s => s.expiresAt > now && s.failures < 3);
}

/** Return the least-recently-used valid session, or null if pool is empty. */
export function getSession(): AmazonSession | null {
  const sessions = valid().sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  if (!sessions.length) return null;
  const s = sessions[0];
  s.lastUsedAt = Date.now();
  return s;
}

export function markSuccess(s: AmazonSession): void {
  s.failures   = 0;
  s.lastUsedAt = Date.now();
}

export function markFailed(s: AmazonSession): void {
  s.failures++;
  if (s.failures >= 3) {
    const i = _pool.indexOf(s);
    if (i >= 0) _pool.splice(i, 1);
    process.stderr.write('  [amazon-session] Session evicted after 3 failures\n');
  }
}

export function poolStatus(): { valid: number; total: number } {
  return { valid: valid().length, total: _pool.length };
}

// ─── Pool fill / refresh ──────────────────────────────────────────────────────

async function fillPool(): Promise<void> {
  if (!ENABLED || _filling) return;
  _filling = true;

  try {
    // Evict stale entries
    const now = Date.now();
    for (let i = _pool.length - 1; i >= 0; i--) {
      if (_pool[i].expiresAt <= now || _pool[i].failures >= 3) _pool.splice(i, 1);
    }

    // Also proactively refresh sessions expiring soon
    const soonExpiring = _pool.filter(s => s.expiresAt - Date.now() < REFRESH_SOON);
    for (const s of soonExpiring) {
      const i = _pool.indexOf(s);
      if (i >= 0) _pool.splice(i, 1);
    }

    const needed = POOL_SIZE - valid().length;
    if (needed <= 0) return;

    process.stderr.write(`  [amazon-session] Pool ${valid().length}/${POOL_SIZE} — creating ${needed} sessions\n`);

    for (let i = 0; i < needed; i++) {
      const proxyUrl = proxyManager.getResidentialProxy();
      if (!proxyUrl) {
        process.stderr.write('  [amazon-session] No residential proxy available — stopping fill\n');
        break;
      }
      const session = await createSession(proxyUrl);
      if (session) {
        _pool.push(session);
        process.stderr.write(`  [amazon-session] Pool now ${_pool.length}/${POOL_SIZE}\n`);
      }
      // 30s gap between sessions — Amazon rate-limits rapid sequential requests
      if (i < needed - 1) await new Promise(r => setTimeout(r, 30_000));
    }
  } finally {
    _filling = false;
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

/** Call once from index.ts — starts the background pool fill + refresh loop. */
export function startAmazonSessionPool(): void {
  if (!ENABLED) {
    process.stderr.write('  [amazon-session] Disabled (AMAZON_SESSION_POOL=false)\n');
    return;
  }
  if (!CAPSOLVER) {
    process.stderr.write('  [amazon-session] Warning: CAPSOLVER_API_KEY not set — CAPTCHAs during session creation will fail\n');
  }
  // Delay initial fill 10 s so the server starts fast
  setTimeout(() => {
    fillPool().catch(e => process.stderr.write(`  [amazon-session] Init fill error: ${e}\n`));
  }, 10_000);
  // Top up every 30 min
  setInterval(() => {
    fillPool().catch(e => process.stderr.write(`  [amazon-session] Refresh error: ${e}\n`));
  }, 30 * 60 * 1_000);

  process.stderr.write(`  [amazon-session] Pool started (target: ${POOL_SIZE}, TTL: ${TTL_MS / 3_600_000}h)\n`);
}
