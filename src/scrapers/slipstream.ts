/**
 * Slipstream client — calls the Slipstream Engine as a cheap Step 0 before
 * Xtrct's own Playwright/FlareSolverr chain.
 *
 * Slipstream has its own internal escalation:
 *   Fast (rquest, Chrome TLS fingerprint)
 *   → Fast + ISP proxy
 *   → CapSolver (CF JS challenge)
 *   → Heavy Gear (real headless Chrome via SOCKS5 proxy)
 *
 * Config (env vars):
 *   SLIPSTREAM_URL      Base URL e.g. https://slipstream-engine.fly.dev  (required to enable)
 *   SLIPSTREAM_API_KEY  API key for the Slipstream Engine                 (required to enable)
 */

import { log } from '../log.ts';

const SLIPSTREAM_URL = process.env.SLIPSTREAM_URL?.replace(/\/$/, '');
const SLIPSTREAM_API_KEY = process.env.SLIPSTREAM_API_KEY;

/** Minimum HTML length to consider a Slipstream result valid content */
const MIN_CONTENT_BYTES = 5_000;

export function isSlipstreamEnabled(): boolean {
  return Boolean(SLIPSTREAM_URL && SLIPSTREAM_API_KEY);
}

/**
 * Fetch `url` via Slipstream's smart escalation chain.
 * Returns the HTML string on success, or null if Slipstream failed/timed out/returned thin content.
 */
export async function trySlipstream(url: string, timeoutMs = 90_000): Promise<string | null> {
  if (!SLIPSTREAM_URL || !SLIPSTREAM_API_KEY) return null;

  const script = `const html = await Agent.fetchSmart(${JSON.stringify(url)}); return html;`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(`${SLIPSTREAM_URL}/execute`, {
        method: 'POST',
        headers: {
          'x-api-key': SLIPSTREAM_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ script }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`[slipstream] request failed: ${msg}`);
    return null;
  }

  if (!res.ok) {
    log(`[slipstream] HTTP ${res.status} for ${url}`);
    return null;
  }

  let body: { status: string; result?: string; error?: { message?: string } };
  try {
    body = await res.json() as typeof body;
  } catch {
    log(`[slipstream] invalid JSON response for ${url}`);
    return null;
  }

  if ((body.status !== 'ok' && body.status !== 'success') || typeof body.result !== 'string') {
    log(`[slipstream] error for ${url}: ${body.error?.message ?? body.status}`);
    return null;
  }

  if (body.result.length < MIN_CONTENT_BYTES) {
    log(`[slipstream] thin content for ${url}: ${body.result.length} bytes`);
    return null;
  }

  log(`[slipstream] success for ${url}: ${body.result.length} bytes`);
  return body.result;
}
