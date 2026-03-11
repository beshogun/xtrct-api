import { parse } from 'node-html-parser';

/** Extract all unique absolute href values from the page. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const root = parse(html);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

    try {
      const abs = new URL(href, baseUrl).href;
      if (!seen.has(abs)) {
        seen.add(abs);
        result.push(abs);
      }
    } catch {
      // ignore malformed URLs
    }
  }

  return result;
}
