/**
 * Live scrape test — exercises HTTP and Playwright strategies directly
 * against 10 real sites representing common customer use cases.
 * Run: bun test-live.ts
 */

import { httpScraper } from './src/scrapers/http.ts';
import { playwrightScraper } from './src/scrapers/playwright.ts';
import { pool } from './src/browser/pool.ts';
import { extractAll } from './src/extractors/index.ts';
import { extractMetadata } from './src/extractors/metadata.ts';
import { extractMarkdown } from './src/extractors/markdown.ts';
import { extractLinks } from './src/extractors/links.ts';
import { parse } from 'node-html-parser';

const SITES: Array<{
  name: string;
  url: string;
  category: string;
  expectedChallenge: string;
  strategy: 'http' | 'playwright' | 'auto';
  formats: string[];
}> = [
  {
    name: 'Books to Scrape',
    url: 'https://books.toscrape.com',
    category: 'E-commerce',
    expectedChallenge: 'None (test site)',
    strategy: 'http',
    formats: ['html', 'links', 'structured'],
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    category: 'News Aggregator',
    expectedChallenge: 'Minimal — pure HTML',
    strategy: 'http',
    formats: ['html', 'structured', 'links'],
  },
  {
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Web_scraping',
    category: 'Reference / Wiki',
    expectedChallenge: 'None — open data',
    strategy: 'http',
    formats: ['html', 'markdown', 'metadata'],
  },
  {
    name: 'BBC News',
    url: 'https://www.bbc.co.uk/news',
    category: 'Major News Site',
    expectedChallenge: 'Moderate — cookie consent',
    strategy: 'http',
    formats: ['html', 'metadata', 'links'],
  },
  {
    name: 'GitHub Trending',
    url: 'https://github.com/trending',
    category: 'Developer Platform',
    expectedChallenge: 'Light JS — mostly SSR',
    strategy: 'http',
    formats: ['html', 'structured', 'links'],
  },
  {
    name: 'Quotes to Scrape (JS)',
    url: 'https://quotes.toscrape.com/js/',
    category: 'JS-rendered Content',
    expectedChallenge: 'Requires JS execution',
    strategy: 'playwright',
    formats: ['html', 'structured'],
  },
  {
    name: 'Rightmove',
    url: 'https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E87490&maxPrice=500000',
    category: 'Real Estate',
    expectedChallenge: 'Heavy — likely bot detection',
    strategy: 'playwright',
    formats: ['html', 'metadata', 'screenshot'],
  },
  {
    name: 'IMDb Top 250',
    url: 'https://www.imdb.com/chart/top/',
    category: 'Entertainment',
    expectedChallenge: 'Heavy JS + bot detection',
    strategy: 'playwright',
    formats: ['html', 'structured'],
  },
  {
    name: 'RemoteOK Jobs',
    url: 'https://remoteok.com',
    category: 'Job Listings',
    expectedChallenge: 'Cloudflare protected',
    strategy: 'playwright',
    formats: ['html', 'links'],
  },
  {
    name: 'GOV.UK',
    url: 'https://www.gov.uk/browse/benefits',
    category: 'Government / Public Data',
    expectedChallenge: 'None — public sector',
    strategy: 'http',
    formats: ['html', 'markdown', 'metadata'],
  },
];

interface TestResult {
  name: string;
  url: string;
  category: string;
  expectedChallenge: string;
  strategy: string;
  strategyUsed: string;
  success: boolean;
  durationMs: number;
  statusCode?: number;
  htmlBytes?: number;
  markdownWords?: number;
  linksFound?: number;
  structuredFields?: number;
  screenshotCaptured?: boolean;
  metadataTitle?: string | null;
  error?: string;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function grade(result: TestResult): string {
  if (!result.success) return '✗ FAIL';
  if (result.durationMs < 3000) return '✓ FAST';
  if (result.durationMs < 10000) return '✓ OK';
  return '~ SLOW';
}

async function testHttp(site: typeof SITES[0]): Promise<TestResult> {
  const start = Date.now();
  try {
    const r = await httpScraper.fetch(site.url, { timeout: 20_000 });
    const md = site.formats.includes('markdown') ? extractMarkdown(r.html) : '';
    const links = site.formats.includes('links') ? extractLinks(r.html, site.url) : [];
    const meta = extractMetadata(r.html, r.finalUrl, r.statusCode, r.headers['content-type'] ?? '');

    let structuredFields = 0;
    if (site.formats.includes('structured')) {
      const root = parse(r.html);
      structuredFields = root.querySelectorAll('a, h1, h2, h3, p').length;
    }

    return {
      name: site.name,
      url: site.url,
      category: site.category,
      expectedChallenge: site.expectedChallenge,
      strategy: site.strategy,
      strategyUsed: 'http',
      success: true,
      durationMs: Date.now() - start,
      statusCode: r.statusCode,
      htmlBytes: r.html.length,
      markdownWords: md ? wordCount(md) : undefined,
      linksFound: links.length || undefined,
      structuredFields: structuredFields || undefined,
      metadataTitle: meta.title,
    };
  } catch (e) {
    return {
      name: site.name,
      url: site.url,
      category: site.category,
      expectedChallenge: site.expectedChallenge,
      strategy: site.strategy,
      strategyUsed: 'http',
      success: false,
      durationMs: Date.now() - start,
      error: (e as Error).message.slice(0, 120),
    };
  }
}

async function testPlaywright(site: typeof SITES[0]): Promise<TestResult> {
  const start = Date.now();
  let pwPage: import('playwright').Page | undefined;
  let pwContext: import('playwright').BrowserContext | undefined;
  let pwRelease: (() => void) | undefined;

  try {
    const { result, page, context, release } = await playwrightScraper.fetch(site.url, {
      timeout: 25_000,
    });
    pwPage = page;
    pwContext = context;
    pwRelease = release;

    const md = site.formats.includes('markdown') ? extractMarkdown(result.html) : '';
    const links = site.formats.includes('links') ? extractLinks(result.html, site.url) : [];
    const meta = extractMetadata(result.html, result.finalUrl, result.statusCode, '');

    let screenshotCaptured = false;
    if (site.formats.includes('screenshot')) {
      try {
        await page.screenshot({ fullPage: false, type: 'png' });
        screenshotCaptured = true;
      } catch {}
    }

    let structuredFields = 0;
    if (site.formats.includes('structured')) {
      const root = parse(result.html);
      structuredFields = root.querySelectorAll('a, h1, h2, h3, p').length;
    }

    return {
      name: site.name,
      url: site.url,
      category: site.category,
      expectedChallenge: site.expectedChallenge,
      strategy: site.strategy,
      strategyUsed: 'playwright',
      success: true,
      durationMs: Date.now() - start,
      statusCode: result.statusCode,
      htmlBytes: result.html.length,
      markdownWords: md ? wordCount(md) : undefined,
      linksFound: links.length || undefined,
      structuredFields: structuredFields || undefined,
      screenshotCaptured,
      metadataTitle: meta.title,
    };
  } catch (e) {
    return {
      name: site.name,
      url: site.url,
      category: site.category,
      expectedChallenge: site.expectedChallenge,
      strategy: site.strategy,
      strategyUsed: 'playwright',
      success: false,
      durationMs: Date.now() - start,
      error: (e as Error).message.slice(0, 120),
    };
  } finally {
    try { await pwPage?.close(); } catch {}
    try { await pwContext?.close(); } catch {}
    pwRelease?.();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n🕷  ScraperAPI — Live Site Test\n');
console.log(`Testing ${SITES.length} sites across ${new Set(SITES.map(s => s.category)).size} categories...\n`);

await pool.init();

const results: TestResult[] = [];

for (const site of SITES) {
  process.stdout.write(`  Testing: ${site.name} (${site.category}) ... `);
  const result = site.strategy === 'http'
    ? await testHttp(site)
    : await testPlaywright(site);
  results.push(result);
  console.log(`${result.success ? '✓' : '✗'} ${result.durationMs}ms`);
  await new Promise(r => setTimeout(r, 1500)); // polite delay
}

await pool.close();

// ─── Report ───────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.success);
const failed = results.filter(r => !r.success);
const avgMs  = Math.round(results.filter(r => r.success).reduce((a, r) => a + r.durationMs, 0) / (passed.length || 1));

console.log('\n' + '═'.repeat(80));
console.log('  RESULTS\n' + '═'.repeat(80));

for (const r of results) {
  console.log(`\n${grade(r).padEnd(10)} ${r.name} [${r.category}]`);
  console.log(`           Strategy: ${r.strategyUsed} | Time: ${r.durationMs}ms | Status: ${r.statusCode ?? 'N/A'}`);
  if (r.success) {
    const parts = [];
    if (r.htmlBytes)       parts.push(`HTML ${(r.htmlBytes/1024).toFixed(0)}KB`);
    if (r.markdownWords)   parts.push(`${r.markdownWords} words (MD)`);
    if (r.linksFound)      parts.push(`${r.linksFound} links`);
    if (r.structuredFields) parts.push(`${r.structuredFields} nodes`);
    if (r.screenshotCaptured) parts.push('screenshot ✓');
    if (r.metadataTitle)   parts.push(`"${r.metadataTitle?.slice(0, 40)}"`);
    console.log(`           Output:   ${parts.join(' | ')}`);
  } else {
    console.log(`           Error:    ${r.error}`);
  }
}

console.log('\n' + '═'.repeat(80));
console.log('  SUMMARY\n' + '─'.repeat(80));
console.log(`  Pass rate:     ${passed.length}/${results.length} (${Math.round(passed.length/results.length*100)}%)`);
console.log(`  Avg latency:   ${avgMs}ms (successful requests)`);
console.log(`  HTTP success:  ${results.filter(r => r.strategy === 'http' && r.success).length}/${results.filter(r => r.strategy === 'http').length}`);
console.log(`  PW success:    ${results.filter(r => r.strategy === 'playwright' && r.success).length}/${results.filter(r => r.strategy === 'playwright').length}`);

if (failed.length) {
  console.log('\n  Failed sites:');
  for (const r of failed) {
    console.log(`    - ${r.name}: ${r.error}`);
  }
}

console.log('\n' + '═'.repeat(80));
console.log('  COMPETITIVE NOTES');
console.log('─'.repeat(80));
console.log('  ScraperAPI ($49/mo):  ~100K credits, 5-25 concurrent, no structured extraction');
console.log('  Zyte ($100+/mo):      per-request pricing, AI selectors, 93% success on protected');
console.log('  Bright Data ($499/mo): 98% success, proxy infra, premium pricing');
console.log('  Our API:              auto-escalation, 9 formats, batch, credits model');
console.log('═'.repeat(80) + '\n');
