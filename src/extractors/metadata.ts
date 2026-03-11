import { parse } from 'node-html-parser';

export interface PageMetadata {
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  canonical: string | null;
  statusCode: number;
  contentType: string;
  finalUrl: string;
}

export function extractMetadata(
  html: string,
  finalUrl: string,
  statusCode: number,
  contentType: string
): PageMetadata {
  const root = parse(html);

  const meta = (name: string) =>
    root.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ??
    root.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ??
    null;

  return {
    title:          root.querySelector('title')?.text?.trim() ?? null,
    description:    meta('description'),
    ogTitle:        meta('og:title'),
    ogDescription:  meta('og:description'),
    ogImage:        meta('og:image'),
    ogUrl:          meta('og:url'),
    canonical:      root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    statusCode,
    contentType,
    finalUrl,
  };
}
