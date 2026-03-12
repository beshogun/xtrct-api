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
 */
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
  const result: StructuredResult = {};

  for (const [key, rawSelector] of Object.entries(selectors)) {
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
