// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';
import { parsePrice, parseCount } from './ecommerce.ts';

export const rightmoveProperty: ScrapePreset = {
  id: 'rightmove-property',
  name: 'Rightmove Property',
  category: 'real-estate',
  description: 'Extracts property title, price, bedrooms, bathrooms, description, agent and images from a Rightmove listing. Requires Playwright.',
  matchDomains: ['rightmove.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1._2uQQ3SV0eMHL1P6t5ZDo2q' },
  outputFormats: ['structured'],
  selectors: {
    title:       'h1._2uQQ3SV0eMHL1P6t5ZDo2q',
    price:       '._1gfnqJ3Vh9hSBtC5O2a4X5 span',
    bedrooms:    '[data-testid="beds-label"]',
    bathrooms:   '[data-testid="baths-label"]',
    description: '.STw8udCxUaBUMfOo3LSy_',
    agent:       '.jLbCbTBQBtLvBGpLOLn5u',
    images:      'all:._2zqynvtPOuTFHTHVW3n3nS@src',
    address:     'address._2C6dqOGiGdoMkMDGUJzd4L',
    property_type: '._1fcftXUEbWfJOJqhQ1ExLR',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};

export const zillowListing: ScrapePreset = {
  id: 'zillow-listing',
  name: 'Zillow Property Listing',
  category: 'real-estate',
  description: 'Extracts property name, price, beds, baths, sqft, description, agent and images from a Zillow listing. Requires Playwright.',
  matchDomains: ['zillow.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1[data-testid="bdp-building-name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:       'h1[data-testid="bdp-building-name"]',
    price:       'span[data-testid="price"]',
    beds:        '[data-testid="bed-bath-item"]:first-child strong',
    baths:       '[data-testid="bed-bath-item"]:nth-child(2) strong',
    sqft:        '[data-testid="bed-bath-item"]:last-child strong',
    description: '[data-testid="description-section"] div',
    agent:       '[data-testid="attribution-LISTING_AGENT"] span',
    images:      'all:[data-testid="media-carousel"] img@src',
    address:     'h2.hdp__sc-1tsvzbc-4',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};

export const zooplaProperty: ScrapePreset = {
  id: 'zoopla-property',
  name: 'Zoopla Property',
  category: 'real-estate',
  description: 'Extracts property title, price, bedrooms, description, agent and listing date from a Zoopla listing. Requires Playwright.',
  matchDomains: ['zoopla.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-testid="listing-summary-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:        '[data-testid="listing-summary-title"]',
    price:        '.e2uk8e16, [data-testid="price"]',
    bedrooms:     '[data-testid="beds-label"], span[class*="Bedroomse"]',
    description:  '[data-testid="listing-description"]',
    agent:        '[data-testid="agent-name"]',
    listing_date: '[data-testid="listing-date"]',
    address:      '[data-testid="address"]',
    images:       'all:[data-testid="hero-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};
