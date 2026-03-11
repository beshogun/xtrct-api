const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL ?? 'http://localhost:8191';

export interface FlareResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  cookies: Array<{ name: string; value: string; domain: string }>;
}

export class FlareSolverrScraper {
  private _availabilityCache: { result: boolean; expiresAt: number } | null = null;

  /** Health-check the FlareSolverr instance. Result is cached for 60 seconds. */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this._availabilityCache && now < this._availabilityCache.expiresAt) {
      return this._availabilityCache.result;
    }

    let result = false;
    try {
      const res = await fetch(`${FLARESOLVERR_URL}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      result = res.ok;
    } catch {
      result = false;
    }

    this._availabilityCache = { result, expiresAt: now + 60_000 };
    return result;
  }

  get url(): string {
    return FLARESOLVERR_URL;
  }

  async fetch(url: string, timeout = 60_000): Promise<FlareResult> {
    const res = await fetch(`${FLARESOLVERR_URL}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: timeout }),
    });

    if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);

    const data = await res.json() as {
      status: string;
      solution?: {
        status: number;
        response: string;
        url: string;
        cookies: Array<{ name: string; value: string; domain: string }>;
      };
      message?: string;
    };

    if (data.status !== 'ok' || !data.solution) {
      throw new Error(`FlareSolverr failed: ${data.message ?? 'unknown error'}`);
    }

    return {
      html:       data.solution.response,
      statusCode: data.solution.status,
      finalUrl:   data.solution.url,
      cookies:    data.solution.cookies,
    };
  }
}

export const flareScraper = new FlareSolverrScraper();
