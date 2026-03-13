import { parse } from 'node-html-parser';

type SelectorMap = Record<string, string>;
type StructuredResult = Record<string, string | string[] | null>;

/**
 * CSS selector-based structured extraction.
 *
 * Selector syntax:
 *   "title":  "h1"                        → first match, text content
 *   "prices": "all:.price"                → all matches, array               (prefix "all:")
 *   "href":   "a.cta@href"                → attribute value                  (suffix @attr)
 *   "imgs":   "all:img@src"               → all matches, array of attribute  (both)
 *   "price":  "jsonld:offers.price"       → JSON-LD schema.org dot-path
 *   "imgs":   "jsonld[]:image"            → JSON-LD array value
 *   "price":  "nextdata:props.pageProps.product.price"  → Next.js __NEXT_DATA__ dot-path
 *   "imgs":   "nextdata[]:props.pageProps.product.images"
 *   "price":  "xhr:/api/product:price"    → XHR/fetch JSON capture dot-path
 *   "items":  "xhr[]:*\/products*:results" → XHR array value
 */

// ── JSON-LD helpers ─────────────────────────────────────────────────────────

function parseJsonLd(root: ReturnType<typeof parse>): Record<string, unknown> | null {
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  const parsed: Record<string, unknown>[] = [];
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.rawText) as Record<string, unknown>;
      if (typeof data === 'object' && data !== null) parsed.push(data);
    } catch { /* ignore */ }
  }
  return parsed.find(d => d['@type'] === 'Product') ?? parsed[0] ?? null;
}

// ── __NEXT_DATA__ helpers ───────────────────────────────────────────────────

function parseNextData(root: ReturnType<typeof parse>): Record<string, unknown> | null {
  const script = root.querySelector('script#__NEXT_DATA__');
  if (!script) return null;
  try {
    const data = JSON.parse(script.rawText) as Record<string, unknown>;
    return typeof data === 'object' && data !== null ? data : null;
  } catch {
    return null;
  }
}

// ── XHR captures helpers ────────────────────────────────────────────────────
// Playwright injects captured API responses as <script id="__XHR_CAPTURES__" type="application/json">

function parseXhrCaptures(root: ReturnType<typeof parse>): Record<string, unknown> | null {
  const script = root.querySelector('script#__XHR_CAPTURES__');
  if (!script) return null;
  try {
    const data = JSON.parse(script.rawText) as Record<string, unknown>;
    return typeof data === 'object' && data !== null ? data : null;
  } catch {
    return null;
  }
}

function matchXhrCapture(captures: Record<string, unknown>, pattern: string): unknown | null {
  // Find the first captured URL whose pathname contains the pattern (glob * supported)
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  for (const [urlPath, data] of Object.entries(captures)) {
    if (urlPath.includes(pattern) || regex.test(urlPath)) return data;
  }
  return null;
}

// ── Generic dot-path traversal ──────────────────────────────────────────────

function getPath(data: unknown, path: string): unknown {
  if (!path) return data;
  const parts = path.split('.');
  let cur: unknown = data;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── CSS extraction helpers ──────────────────────────────────────────────────

function extractAll(root: ReturnType<typeof parse>, rawSelector: string): string[] {
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

// ── Main extractor ──────────────────────────────────────────────────────────

export function extractStructured(html: string, selectors: SelectorMap): StructuredResult {
  const root = parse(html);
  let jsonLd: Record<string, unknown> | null = null;     // lazy
  let nextData: Record<string, unknown> | null = null;   // lazy
  let xhrCaptures: Record<string, unknown> | null = null; // lazy
  const result: StructuredResult = {};

  for (const [key, rawSelector] of Object.entries(selectors)) {

    // ── JSON-LD ────────────────────────────────────────────────────────────
    if (rawSelector.startsWith('jsonld[]:') || rawSelector.startsWith('jsonld:')) {
      const isArray = rawSelector.startsWith('jsonld[]:');
      const path = rawSelector.slice(isArray ? 9 : 7);
      if (!jsonLd) jsonLd = parseJsonLd(root);
      if (!jsonLd) { result[key] = isArray ? [] : null; continue; }
      const val = getPath(jsonLd, path);
      result[key] = isArray
        ? (Array.isArray(val) ? val.map(String) : (val != null ? [String(val)] : []))
        : (val != null ? String(val) : null);
      continue;
    }

    // ── __NEXT_DATA__ ──────────────────────────────────────────────────────
    if (rawSelector.startsWith('nextdata[]:') || rawSelector.startsWith('nextdata:')) {
      const isArray = rawSelector.startsWith('nextdata[]:');
      const path = rawSelector.slice(isArray ? 11 : 9);
      if (!nextData) nextData = parseNextData(root);
      if (!nextData) { result[key] = isArray ? [] : null; continue; }
      const val = getPath(nextData, path);
      result[key] = isArray
        ? (Array.isArray(val) ? val.map(String) : (val != null ? [String(val)] : []))
        : (val != null ? String(val) : null);
      continue;
    }

    // ── XHR captures ──────────────────────────────────────────────────────
    if (rawSelector.startsWith('xhr[]:') || rawSelector.startsWith('xhr:')) {
      const isArray = rawSelector.startsWith('xhr[]:');
      const rest = rawSelector.slice(isArray ? 6 : 4);
      // Format: "URL_PATTERN:json.dot.path"  (colon separates pattern from path)
      const colonIdx = rest.indexOf(':');
      const urlPattern = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
      const jsonPath   = colonIdx >= 0 ? rest.slice(colonIdx + 1) : '';
      if (!xhrCaptures) xhrCaptures = parseXhrCaptures(root);
      if (!xhrCaptures) { result[key] = isArray ? [] : null; continue; }
      const capture = matchXhrCapture(xhrCaptures, urlPattern);
      if (capture == null) { result[key] = isArray ? [] : null; continue; }
      const val = jsonPath ? getPath(capture, jsonPath) : capture;
      result[key] = isArray
        ? (Array.isArray(val) ? val.map(String) : (val != null ? [String(val)] : []))
        : (val != null ? String(val) : null);
      continue;
    }

    // ── CSS selectors ──────────────────────────────────────────────────────
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

// ── LLM fallback ────────────────────────────────────────────────────────────
// When structured extraction returns all nulls, attempt semantic extraction
// using Claude Haiku. Only fires when ANTHROPIC_API_KEY is set.

export async function extractStructuredWithLLMFallback(
  html: string,
  selectors: SelectorMap,
): Promise<StructuredResult> {
  const result = extractStructured(html, selectors);

  // Only fallback if every field is null/empty and we have an API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return result;

  const allNull = Object.values(result).every(v =>
    v === null || (Array.isArray(v) && v.length === 0),
  );
  if (!allNull) return result;

  // Don't bother on tiny pages (error pages, empty responses)
  if (html.length < 5_000) return result;

  try {
    const fields = Object.keys(selectors).join(', ');
    // Strip scripts/styles to reduce tokens, keep visible text
    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .slice(0, 40_000); // ~10k tokens max

    const prompt = `Extract the following fields from this webpage HTML. Return ONLY a JSON object with these exact keys: ${fields}.
Use null for any field you cannot find. Do not add extra fields.

HTML:
${cleanHtml}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return result;

    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find(c => c.type === 'text')?.text ?? '';

    // Extract JSON from response (may be wrapped in ```json blocks)
    const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
    if (!jsonMatch) return result;

    const llmResult = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    const merged: StructuredResult = { ...result };
    for (const [k, v] of Object.entries(llmResult)) {
      if (k in selectors) {
        merged[k] = Array.isArray(v) ? v.map(String) : (v != null ? String(v) : null);
      }
    }
    process.stderr.write(`  [structured] LLM fallback used for ${Object.keys(selectors).join(', ')}\n`);
    return merged;
  } catch {
    return result;
  }
}
