import type { Page } from 'playwright';
import type { OutputFormat } from '../db/index.ts';
import { extractHtml, extractCleanedHtml, extractText } from './html.ts';
import { extractMarkdown } from './markdown.ts';
import { extractMetadata, type PageMetadata } from './metadata.ts';
import { extractLinks } from './links.ts';
import { extractStructured } from './structured.ts';
import { uploadBuffer, makeStorageKey } from '../storage/r2.ts';

export interface ExtractOptions {
  formats: OutputFormat[];
  selectors?: Record<string, string>;
  screenshotOptions?: {
    format?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  };
  pdfOptions?: {
    format?: 'A4' | 'Letter';
    printBackground?: boolean;
  };
  // Pre-fetched data (from HTTP/FlareSolverr strategies)
  html?: string;
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  // Playwright page (only when Playwright strategy was used)
  page?: Page;
  // Job ID used to derive storage keys
  jobId?: string;
}

export type ExtractResult = Partial<{
  html: string;
  cleaned_html: string;
  markdown: string;
  text: string;
  screenshot: string; // base64 data URI or signed S3 URL
  pdf: string;        // base64 data URI or signed S3 URL
  links: string[];
  metadata: PageMetadata;
  structured: Record<string, string | string[] | null>;
}>;

export async function extractAll(opts: ExtractOptions): Promise<ExtractResult> {
  const result: ExtractResult = {};
  const html = opts.html ?? '';
  const finalUrl = opts.finalUrl ?? '';
  const statusCode = opts.statusCode ?? 200;
  const contentType = opts.contentType ?? 'text/html';

  for (const fmt of opts.formats) {
    switch (fmt) {
      case 'html':
        result.html = extractHtml(html);
        break;

      case 'cleaned_html':
        result.cleaned_html = extractCleanedHtml(html);
        break;

      case 'markdown':
        result.markdown = extractMarkdown(html);
        break;

      case 'text':
        result.text = extractText(html);
        break;

      case 'links':
        result.links = extractLinks(html, finalUrl);
        break;

      case 'metadata':
        result.metadata = extractMetadata(html, finalUrl, statusCode, contentType);
        break;

      case 'structured':
        result.structured = extractStructured(html, opts.selectors ?? {});
        break;

      case 'screenshot': {
        if (!opts.page) throw new Error('screenshot requires Playwright strategy');
        const screenshotOpts = opts.screenshotOptions ?? {};
        const imgFmt = screenshotOpts.format ?? 'png';
        const buf = await opts.page.screenshot({
          type: imgFmt,
          quality: imgFmt === 'jpeg' ? (screenshotOpts.quality ?? 85) : undefined,
          fullPage: screenshotOpts.fullPage ?? true,
          clip: screenshotOpts.clip,
        });
        const screenshotKey = opts.jobId
          ? makeStorageKey(opts.jobId, 'screenshot', imgFmt)
          : `screenshots/tmp/${Date.now()}.${imgFmt}`;
        result.screenshot = await uploadBuffer(screenshotKey, buf, `image/${imgFmt}`);
        break;
      }

      case 'pdf': {
        if (!opts.page) throw new Error('pdf requires Playwright strategy');
        const pdfOpts = opts.pdfOptions ?? {};
        const buf = await opts.page.pdf({
          format: pdfOpts.format ?? 'A4',
          printBackground: pdfOpts.printBackground ?? true,
        });
        const pdfKey = opts.jobId
          ? makeStorageKey(opts.jobId, 'pdf', 'pdf')
          : `pdfs/tmp/${Date.now()}.pdf`;
        result.pdf = await uploadBuffer(pdfKey, buf, 'application/pdf');
        break;
      }
    }
  }

  return result;
}
