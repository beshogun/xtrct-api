import type { OutputFormat, Strategy } from '../../db/index.ts';

// Re-export the WaitFor type that matches the DB/scrape schema
export type WaitFor =
  | { type: 'networkidle' }
  | { type: 'selector'; value: string }
  | { type: 'js'; value: string }
  | { type: 'delay'; value: number };

export interface ScrapePreset {
  id: string;
  name: string;
  /** Broad grouping: 'ecommerce' | 'jobs' | 'real-estate' | 'news' | 'social' | 'data' */
  category: string;
  description: string;
  /** Domains that trigger auto-detection when no preset is specified. */
  matchDomains?: string[];
  strategy: 'http' | 'playwright' | 'auto';
  waitFor?: WaitFor;
  outputFormats: OutputFormat[];
  /** Selector map using the all: and @attr syntax from extractors/structured.ts */
  selectors: Record<string, string>;
  /**
   * Optional post-processing step applied after raw CSS extraction.
   * Use it to clean price strings, parse numeric ratings, etc.
   */
  postProcess?: (raw: Record<string, string | string[] | null>) => Record<string, unknown>;
}

// ─── Import all preset groups ──────────────────────────────────────────────────

import { amazonProduct, ebayListing, etsyProduct, shopifyProduct } from './ecommerce.ts';
import { indeedJob, linkedinJob, glassdoorJob, remoteokListing } from './jobs.ts';
import { rightmoveProperty, zillowListing, zooplaProperty } from './realestate.ts';
import { genericArticle, hnPost, redditPost } from './news.ts';
import { googleSerp, yellowPages, tripadvisorHotel, trustpilotCompany } from './data.ts';
import { twitterProfile, youtubeVideo } from './social.ts';

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, ScrapePreset> = {
  // ecommerce
  'amazon-product':    amazonProduct,
  'ebay-listing':      ebayListing,
  'etsy-product':      etsyProduct,
  'shopify-product':   shopifyProduct,

  // jobs
  'indeed-job':        indeedJob,
  'linkedin-job':      linkedinJob,
  'glassdoor-job':     glassdoorJob,
  'remoteok-listing':  remoteokListing,

  // real-estate
  'rightmove-property': rightmoveProperty,
  'zillow-listing':     zillowListing,
  'zoopla-property':    zooplaProperty,

  // news
  'article':           genericArticle,
  'hn-post':           hnPost,
  'reddit-post':       redditPost,

  // data aggregators / directories
  'google-serp':         googleSerp,
  'yellow-pages':        yellowPages,
  'tripadvisor-hotel':   tripadvisorHotel,
  'trustpilot-company':  trustpilotCompany,

  // social
  'twitter-profile': twitterProfile,
  'youtube-video':   youtubeVideo,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-detect a preset from a URL by matching against each preset's matchDomains.
 * Returns the first match, or null if none found.
 */
export function detectPreset(url: string): ScrapePreset | null {
  for (const preset of Object.values(PRESETS)) {
    if (preset.matchDomains?.some(d => url.includes(d))) return preset;
  }
  return null;
}

/** Return a lightweight summary of all presets, suitable for a discovery endpoint. */
export function listPresets(): Array<{
  id: string;
  name: string;
  category: string;
  description: string;
  matchDomains?: string[];
}> {
  return Object.values(PRESETS).map(({ id, name, category, description, matchDomains }) => ({
    id, name, category, description, matchDomains,
  }));
}
