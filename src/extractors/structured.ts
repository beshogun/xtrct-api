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
export function extractStructured(html: string, selectors: SelectorMap): StructuredResult {
  const root = parse(html);
  const result: StructuredResult = {};

  for (const [key, rawSelector] of Object.entries(selectors)) {
    const all = rawSelector.startsWith('all:');
    const selector = all ? rawSelector.slice(4) : rawSelector;

    // Check for @attribute suffix
    const attrMatch = selector.match(/^(.+?)@([a-zA-Z0-9_-]+)$/);
    const cssSelector = attrMatch ? attrMatch[1] : selector;
    const attr = attrMatch ? attrMatch[2] : null;

    if (all) {
      const nodes = root.querySelectorAll(cssSelector);
      result[key] = nodes.map(n =>
        attr ? (n.getAttribute(attr) ?? '') : n.text.trim()
      ).filter(Boolean);
    } else {
      const node = root.querySelector(cssSelector);
      if (!node) {
        result[key] = null;
      } else {
        result[key] = attr
          ? (node.getAttribute(attr) ?? null)
          : node.text.trim() || null;
      }
    }
  }

  return result;
}
