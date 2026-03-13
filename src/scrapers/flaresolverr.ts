// Support multiple FlareSolverr instances for load balancing.
// Configure via FLARESOLVERR_URL (primary) and FLARESOLVERR_URL_2 / _3 etc.
// Falls back to localhost:8191 if none set.
function parseUrls(): string[] {
  const urls: string[] = [];
  const primary = process.env.FLARESOLVERR_URL;
  if (primary) urls.push(primary);
  for (let i = 2; i <= 9; i++) {
    const u = process.env[`FLARESOLVERR_URL_${i}`];
    if (u) urls.push(u);
  }
  return urls.length > 0 ? urls : ['http://localhost:8191'];
}

const FLARESOLVERR_URLS = parseUrls();

export interface FlareResult {
  html: string;
  statusCode: number;
  finalUrl: string;
  cookies: Array<{ name: string; value: string; domain: string }>;
}

interface InstanceState {
  url: string;
  activeRequests: number;
  available: boolean;
  availabilityCheckedAt: number;
}

export class FlareSolverrScraper {
  private instances: InstanceState[] = FLARESOLVERR_URLS.map(url => ({
    url,
    activeRequests: 0,
    available: true,
    availabilityCheckedAt: 0,
  }));

  /** Pick the least-loaded available instance. */
  private async pickInstance(): Promise<InstanceState | null> {
    // Refresh availability for any instance not checked in the last 60s
    const now = Date.now();
    await Promise.all(
      this.instances
        .filter(i => now - i.availabilityCheckedAt > 60_000)
        .map(i => this.checkInstance(i))
    );

    const available = this.instances
      .filter(i => i.available)
      .sort((a, b) => a.activeRequests - b.activeRequests);

    return available[0] ?? null;
  }

  private async checkInstance(inst: InstanceState): Promise<void> {
    try {
      const res = await fetch(`${inst.url}/health`, { signal: AbortSignal.timeout(3_000) });
      inst.available = res.ok;
    } catch {
      inst.available = false;
    }
    inst.availabilityCheckedAt = Date.now();
  }

  /** Health-check — true if at least one instance is reachable. */
  async isAvailable(): Promise<boolean> {
    const inst = await this.pickInstance();
    return inst !== null;
  }

  /** URL of the primary instance (used in error messages). */
  get url(): string {
    return this.instances[0].url;
  }

  async fetch(url: string, timeout = 60_000, proxyUrl?: string | null): Promise<FlareResult> {
    const inst = await this.pickInstance();
    if (!inst) {
      throw new Error(
        `[strategy] FlareSolverr not reachable at ${this.instances.map(i => i.url).join(', ')} — ` +
        `install it: docker run -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest`,
      );
    }

    const body: Record<string, unknown> = { cmd: 'request.get', url, maxTimeout: timeout };
    if (proxyUrl) {
      try {
        const u = new URL(proxyUrl);
        const proxy: Record<string, string> = { url: `${u.protocol}//${u.host}` };
        if (u.username) proxy.username = decodeURIComponent(u.username);
        if (u.password) proxy.password = decodeURIComponent(u.password);
        body.proxy = proxy;
      } catch {
        body.proxy = { url: proxyUrl };
      }
    }

    inst.activeRequests++;
    try {
      const res = await fetch(`${inst.url}/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout + 30_000),
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
    } finally {
      inst.activeRequests = Math.max(0, inst.activeRequests - 1);
    }
  }
}

export const flareScraper = new FlareSolverrScraper();
