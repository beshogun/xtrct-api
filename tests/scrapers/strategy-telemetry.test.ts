import { describe, test, expect } from 'bun:test';

// Inline classifyError to test in isolation (mirrors strategy.ts implementation)
function classifyError(err: unknown): 'cloudflare' | 'timeout' | 'network' | 'parse' {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cloudflare|cf-ray|403|challenge/i.test(msg)) return 'cloudflare';
  if (/timeout|timed out/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) return 'network';
  return 'parse';
}

describe('classifyError', () => {
  test('classifies cloudflare errors', () => {
    expect(classifyError(new Error('Cloudflare blocked'))).toBe('cloudflare');
    expect(classifyError(new Error('cf-ray header present'))).toBe('cloudflare');
    expect(classifyError(new Error('403 Forbidden'))).toBe('cloudflare');
    expect(classifyError(new Error('challenge page'))).toBe('cloudflare');
  });

  test('classifies timeout errors', () => {
    expect(classifyError(new Error('timeout exceeded'))).toBe('timeout');
    expect(classifyError(new Error('Request timed out'))).toBe('timeout');
  });

  test('classifies network errors', () => {
    expect(classifyError(new Error('ECONNREFUSED connection'))).toBe('network');
    expect(classifyError(new Error('ENOTFOUND host'))).toBe('network');
  });

  test('falls back to parse for unknown errors', () => {
    expect(classifyError(new Error('JSON parse error'))).toBe('parse');
    expect(classifyError('some string error')).toBe('parse');
  });
});

// StepAttempt type for testing attempt()
type StepAttempt = {
  stepIndex: number;
  strategy: 'slipstream' | 'http' | 'playwright' | 'flaresolverr';
  proxyTier: 'none' | 'datacenter' | 'residential' | 'isp';
  success: boolean;
  blocked: boolean;
  timeMs: number;
  costCredits: number;
  errorType: 'cloudflare' | 'timeout' | 'network' | 'parse' | null;
};

async function attempt<T extends object | string>(
  steps: StepAttempt[],
  stepIndex: number,
  strategy: StepAttempt['strategy'],
  proxyTier: StepAttempt['proxyTier'],
  costCredits: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ stepIndex, strategy, proxyTier, success: result !== null,
                 blocked: false, timeMs: Date.now() - t0, costCredits, errorType: null });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let errorType: StepAttempt['errorType'] = 'parse';
    if (/cloudflare|cf-ray|403|challenge/i.test(msg)) errorType = 'cloudflare';
    else if (/timeout|timed out/i.test(msg)) errorType = 'timeout';
    else if (/ECONNREFUSED|ENOTFOUND|network/i.test(msg)) errorType = 'network';
    steps.push({ stepIndex, strategy, proxyTier, success: false,
                 blocked: errorType === 'cloudflare', timeMs: Date.now() - t0,
                 costCredits, errorType });
    throw err;
  }
}

describe('attempt', () => {
  test('logs success when fn returns non-null', async () => {
    const steps: StepAttempt[] = [];
    const result = await attempt(steps, 0, 'http', 'none', 1, async () => ({ html: 'ok' }));
    expect(result).toEqual({ html: 'ok' });
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(true);
    expect(steps[0].strategy).toBe('http');
    expect(steps[0].costCredits).toBe(1);
    expect(steps[0].errorType).toBeNull();
  });

  test('logs failure when fn returns null', async () => {
    const steps: StepAttempt[] = [];
    const result = await attempt(steps, 1, 'playwright', 'datacenter', 5, async () => null);
    expect(result).toBeNull();
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(false);
    expect(steps[0].blocked).toBe(false);
  });

  test('logs failure and rethrows when fn throws', async () => {
    const steps: StepAttempt[] = [];
    const fn = async () => { throw new Error('Cloudflare blocked'); };
    await expect(attempt(steps, 2, 'http', 'none', 1, fn)).rejects.toThrow();
    expect(steps).toHaveLength(1);
    expect(steps[0].success).toBe(false);
    expect(steps[0].blocked).toBe(true);
    expect(steps[0].errorType).toBe('cloudflare');
  });

  test('records correct step index', async () => {
    const steps: StepAttempt[] = [];
    await attempt(steps, 3, 'slipstream', 'isp', 1, async () => 'html');
    expect(steps[0].stepIndex).toBe(3);
  });
});
