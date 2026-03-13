import { parse } from 'node-html-parser';

type SelectorMap = Record<string, string>;
type StructuredResult = Record<string, string | string[] | null>;

/**
 * CSS selector-based structured extraction.
 *
 * Selector syntax:
 *   "title":  "h1"              → first match, text content
 *   "prices": "all:.price"      → all matches, array of text content  (prefix with "all:")
 *   "href":   "a.cta@href"      → first match, attribute value        (suffix with @attr)
 *   "imgs":   "all:img@src"     → all matches, array of attribute     (both combined)
 *   "price":  "jsonld:offers.price"  → value from JSON-LD schema.org data (dot-path)
 *   "imgs":   "jsonld[]:image"       → array value from JSON-LD
 */

// ── JSON-LD helpers ────────────────────────────────────────────────────────────

function parseJsonLd(root: ReturnType<typeof parse>): Record<string, unknown> | null {
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  const parsed: Record<string, unknown>[] = [];
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.rawText) as Record<string, unknown>;
      if (typeof data === 'object' && data !== null) parsed.push(data);
    } catch { /* ignore */ }
  }
  // Prefer Product schema; fall back to first parseable
  return parsed.find(d => d['@type'] === 'Product') ?? parsed[0] ?? null;
}

function getJsonLdPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = data;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── CSS extraction helpers ─────────────────────────────────────────────────────

function extractAll(root: ReturnType<typeof parse>, rawSelector: string): string[] {
  // A field may have multiple "all:selector" parts joined by ", all:"
  // Split them and combine results to avoid "all:" appearing mid-CSS.
  const parts = rawSelector.split(/,\s*(?=all:)/);
  const values: string[] = [];
  for (const part of parts) {
    const sel = part.trim().startsWith('all:') ? part.trim().slice(4) : part.trim();
    const attrMatch = sel.match(/^(.+?)@([a-zA-Z0-9_-]+)$/);
    const css  = attrMatch ? attrMatch[1] : sel;
    const attr = attrMatch ? attrMatch[2] : null;
    try {
      const nodes = root.querySelectorAll(css);
      for (const n of nodes) {
        const v = attr ? (n.getAttribute(attr) ?? '') : n.text.trim();
        if (v) values.push(v);
      }
    } catch { /* ignore bad selectors */ }
  }
  return values;
}

export function extractStructured(html: string, selectors: SelectorMap): StructuredResult {
  const root = parse(html);
  let jsonLd: Record<string, unknown> | null = null; // lazy-parsed
  const result: StructuredResult = {};

  for (const [key, rawSelector] of Object.entries(selectors)) {
    // ── JSON-LD selectors ────────────────────────────────────────────────────
    if (rawSelector.startsWith('jsonld[]:') || rawSelector.startsWith('jsonld:')) {
      const isArray = rawSelector.startsWith('jsonld[]:');
      const path = rawSelector.slice(isArray ? 'jsonld[]:'.length : 'jsonld:'.length);
      if (!jsonLd) jsonLd = parseJsonLd(root);
      if (!jsonLd) { result[key] = isArray ? [] : null; continue; }
      const val = getJsonLdPath(jsonLd, path);
      if (isArray) {
        result[key] = Array.isArray(val) ? val.map(String) : (val != null ? [String(val)] : []);
      } else {
        result[key] = val != null ? String(val) : null;
      }
      continue;
    }

    // ── CSS selectors ────────────────────────────────────────────────────────
    const all = rawSelector.startsWith('all:');

    if (all) {
      result[key] = extractAll(root, rawSelector);
    } else {
      const attrMatch = rawSelector.match(/^(.+?)@([a-zA-Z0-9_-]+)$/);
      const css  = attrMatch ? attrMatch[1] : rawSelector;
      const attr = attrMatch ? attrMatch[2] : null;
      try {
        const node = root.querySelector(css);
        result[key] = node
          ? (attr ? (node.getAttribute(attr) ?? null) : node.text.trim() || null)
          : null;
      } catch { result[key] = null; }
    }
  }

  return result;
}
