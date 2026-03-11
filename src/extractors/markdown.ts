import TurndownService from 'turndown';
import { extractCleanedHtml } from './html.ts';

const td = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
});

// Remove common noise elements before converting
td.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe']);

// Convert code blocks
td.addRule('pre', {
  filter: 'pre',
  replacement: (content, node) => {
    const lang = (node as Element).querySelector?.('code')?.getAttribute?.('class')
      ?.replace('language-', '') ?? '';
    return `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
  },
});

export function extractMarkdown(html: string): string {
  // Use Readability first to get clean article HTML, then convert to Markdown
  const cleaned = extractCleanedHtml(html);
  return td.turndown(cleaned);
}
