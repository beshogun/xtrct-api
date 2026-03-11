import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

/** Return raw HTML as-is. */
export function extractHtml(html: string): string {
  return html;
}

/**
 * Extract the main article content using Mozilla Readability.
 * Returns cleaned HTML with boilerplate, nav, ads, and scripts stripped.
 */
export function extractCleanedHtml(html: string): string {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    return article?.content ?? stripScriptsAndStyles(html);
  } catch {
    return stripScriptsAndStyles(html);
  }
}

/** Minimal fallback — strip script/style tags without a full DOM parse. */
function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/** Plain text — strip all HTML tags and collapse whitespace. */
export function extractText(html: string): string {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    if (article?.textContent) {
      return article.textContent.replace(/\s+/g, ' ').trim();
    }
  } catch {}
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
