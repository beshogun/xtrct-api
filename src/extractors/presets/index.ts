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
  /** ISO 4217 currency code for the market this preset targets (e.g. 'GBP', 'EUR', 'USD'). */
  currency?: string;
  /** Selector map using the all: and @attr syntax from extractors/structured.ts */
  selectors: Record<string, string>;
  /**
   * Optional post-processing step applied after raw CSS extraction.
   * Use it to clean price strings, parse numeric ratings, etc.
   */
  postProcess?: (raw: Record<string, string | string[] | null>) => Record<string, unknown>;
}

// ─── Import all preset groups ──────────────────────────────────────────────────

import {
  amazonProduct,
  ebayListing,
  etsyProduct,
  shopifyProduct,
  currysProduct,
  johnLewisProduct,
  argosProduct,
  aoProduct,
  veryProduct,
  scanProduct,
  overclockerProduct,
  boxProduct,
  laptopsDirectProduct,
  ebuyerProduct,
  // US retailers
  bestBuyProduct,
  walmartProduct,
  neweggProduct,
  adoramaProduct,
  targetUsProduct,
  // AU retailers
  jbHifiAuProduct,
  harveyNormanAuProduct,
  theGoodGuysProduct,
  // DE retailers
  mediamarktDeProduct,
  saturnDeProduct,
  notebooksbilligerDeProduct,
  cyberportDeProduct,
  alternateDeProduct,
  // FR retailers
  fnacFrProduct,
  dartyFrProduct,
  boulangerFrProduct,
  // NL retailers
  bolComProduct,
  coolblueNlProduct,
  // ES retailers
  pcComponentesProduct,
  elCorteInglesProduct,
  amazonEsProduct,
  mediaMarktEsProduct,
  // IT retailers
  unieuroItProduct,
  mediaworldItProduct,
  amazonItProduct,
  // IN retailers
  flipkartProduct,
  amazonInProduct,
  cromaProduct,
  // JP retailers
  amazonJpProduct,
  yodobashiProduct,
  bicCameraProduct,
  // CA retailers
  memoryExpressProduct,
  mikesComputerShopProduct,
  // Category listing presets
  amazonUkCategory,
  currysCategory,
  argosCategory,
  johnLewisCategory,
  aoCategory,
  ebuyerCategory,
  scanCategory,
  laptopsDirectCategory,
  veryCategory,
  // UK Fashion
  asosProduct,
  nextProduct,
  marksAndSpencerProduct,
  zalandoUkProduct,
  // UK Home & Garden
  dunelmProduct,
  wayfairUkProduct,
  bAndQProduct,
  ikeaUkProduct,
  // UK Health & Beauty
  bootsProduct,
  superdrugProduct,
  lookfantasticProduct,
  // UK Sports
  sportsDirectProduct,
  jdSportsProduct,
  decathlonUkProduct,
  // UK Toys & Books
  smythsToysProduct,
  waterstonesBooksProduct,
  // UK Pets
  petsAtHomeProduct,
  // Category listings — fashion, beauty, sports, toys, books, pets, home
  asosCategory,
  nextCategory,
  marksAndSpencerCategory,
  zalandoUkCategory,
  bootsCategory,
  superdrugCategory,
  lookfantasticCategory,
  sportsDirectCategory,
  jdSportsCategory,
  decathlonUkCategory,
  smythsCategory,
  waterstonesCategory,
  petsAtHomeCategory,
  dunelmCategory,
  wayfairUkCategory,
  bAndQCategory,
} from './ecommerce.ts';
import { indeedJob, linkedinJob, glassdoorJob, remoteokListing } from './jobs.ts';
import { rightmoveProperty, zillowListing, zooplaProperty } from './realestate.ts';
import { genericArticle, hnPost, redditPost } from './news.ts';
import { googleSerp, yellowPages, tripadvisorHotel, trustpilotCompany } from './data.ts';
import { twitterProfile, youtubeVideo } from './social.ts';

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, ScrapePreset> = {
  // ecommerce — global
  'amazon-product':    amazonProduct,
  'ebay-listing':      ebayListing,
  'etsy-product':      etsyProduct,
  'shopify-product':   shopifyProduct,

  // ecommerce — UK retailers
  'currys-product':        currysProduct,
  'johnlewis-product':     johnLewisProduct,
  'argos-product':         argosProduct,
  'ao-product':            aoProduct,
  'very-product':          veryProduct,
  'scan-product':          scanProduct,
  'overclockers-product':  overclockerProduct,
  'box-product':           boxProduct,
  'laptopsdirect-product': laptopsDirectProduct,
  'ebuyer-product':        ebuyerProduct,

  // ecommerce — US retailers
  'best-buy':    bestBuyProduct,
  'walmart':     walmartProduct,
  'newegg':      neweggProduct,
  'adorama':     adoramaProduct,
  'target-us':   targetUsProduct,

  // ecommerce — AU retailers
  'jb-hifi-au':          jbHifiAuProduct,
  'harvey-norman-au':    harveyNormanAuProduct,
  'the-good-guys':       theGoodGuysProduct,

  // ecommerce — DE retailers
  'mediamarkt-de':          mediamarktDeProduct,
  'saturn-de':              saturnDeProduct,
  'notebooksbilliger-de':   notebooksbilligerDeProduct,
  'cyberport-de':           cyberportDeProduct,
  'alternate-de':           alternateDeProduct,

  // ecommerce — FR retailers
  'fnac-fr':       fnacFrProduct,
  'darty-fr':      dartyFrProduct,
  'boulanger-fr':  boulangerFrProduct,

  // ecommerce — NL retailers
  'bol-com':       bolComProduct,
  'coolblue-nl':   coolblueNlProduct,

  // ecommerce — ES retailers
  'pc-componentes':   pcComponentesProduct,
  'el-corte-ingles':  elCorteInglesProduct,
  'amazon-es':        amazonEsProduct,
  'media-markt-es':   mediaMarktEsProduct,

  // ecommerce — IT retailers
  'unieuro-it':    unieuroItProduct,
  'mediaworld-it': mediaworldItProduct,
  'amazon-it':     amazonItProduct,

  // ecommerce — IN retailers
  'flipkart':   flipkartProduct,
  'amazon-in':  amazonInProduct,
  'croma':      cromaProduct,

  // ecommerce — JP retailers
  'amazon-jp':   amazonJpProduct,
  'yodobashi':   yodobashiProduct,
  'bic-camera':  bicCameraProduct,

  // ecommerce — CA retailers
  'memory-express':       memoryExpressProduct,
  'mikes-computer-shop':  mikesComputerShopProduct,

  // ecommerce — UK fashion
  'asos-product':               asosProduct,
  'next-product':               nextProduct,
  'marks-and-spencer-product':  marksAndSpencerProduct,
  'zalando-uk-product':         zalandoUkProduct,

  // ecommerce — UK home & garden
  'dunelm-product':      dunelmProduct,
  'wayfair-uk-product':  wayfairUkProduct,
  'b-and-q-product':     bAndQProduct,
  'ikea-uk-product':     ikeaUkProduct,

  // ecommerce — UK health & beauty
  'boots-product':         bootsProduct,
  'superdrug-product':     superdrugProduct,
  'lookfantastic-product': lookfantasticProduct,

  // ecommerce — UK sports
  'sports-direct-product':  sportsDirectProduct,
  'jd-sports-product':      jdSportsProduct,
  'decathlon-uk-product':   decathlonUkProduct,

  // ecommerce — UK toys & books
  'smyths-toys-product':     smythsToysProduct,
  'waterstones-product':     waterstonesBooksProduct,

  // ecommerce — UK pets
  'pets-at-home-product':   petsAtHomeProduct,

  // ecommerce — category/listing pages
  'amazon-uk-category':    amazonUkCategory,
  'currys-category':       currysCategory,
  'argos-category':        argosCategory,
  'johnlewis-category':    johnLewisCategory,
  'ao-category':           aoCategory,
  'ebuyer-category':       ebuyerCategory,
  'scan-category':         scanCategory,
  'laptopsdirect-category': laptopsDirectCategory,
  'very-category':         veryCategory,

  // ecommerce — UK fashion category pages
  'asos-category':               asosCategory,
  'next-category':               nextCategory,
  'marks-and-spencer-category':  marksAndSpencerCategory,
  'zalando-uk-category':         zalandoUkCategory,

  // ecommerce — UK beauty category pages
  'boots-category':         bootsCategory,
  'superdrug-category':     superdrugCategory,
  'lookfantastic-category': lookfantasticCategory,

  // ecommerce — UK sports category pages
  'sports-direct-category':  sportsDirectCategory,
  'jd-sports-category':      jdSportsCategory,
  'decathlon-uk-category':   decathlonUkCategory,

  // ecommerce — UK toys/books/pets category pages
  'smyths-category':        smythsCategory,
  'waterstones-category':   waterstonesCategory,
  'pets-at-home-category':  petsAtHomeCategory,

  // ecommerce — UK home category pages
  'dunelm-category':      dunelmCategory,
  'wayfair-uk-category':  wayfairUkCategory,
  'b-and-q-category':     bAndQCategory,

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
