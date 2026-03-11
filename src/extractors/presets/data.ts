// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';
import { parseRating, parseCount } from './ecommerce.ts';

export const googleSerp: ScrapePreset = {
  id: 'google-serp',
  name: 'Google Search Results',
  category: 'data',
  description: 'Extracts organic result titles, URLs and snippets from a Google SERP. Requires Playwright. High Cloudflare/bot-detection risk — use with caution.',
  matchDomains: ['google.com', 'google.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '#search' },
  outputFormats: ['structured'],
  selectors: {
    titles:    'all:#search .g h3',
    urls:      'all:#search .g a@href',
    snippets:  'all:#search .g .VwiC3b',
    ads_count: 'all:[aria-label="Ads"] h3',
  },
  postProcess(raw) {
    const adsCount = Array.isArray(raw.ads_count) ? raw.ads_count.length : 0;
    return { ...raw, ads_count: adsCount };
  },
};

export const yellowPages: ScrapePreset = {
  id: 'yellow-pages',
  name: 'Yellow Pages Listings',
  category: 'data',
  description: 'Extracts business names, phone numbers, addresses and ratings from a Yellow Pages search results page.',
  matchDomains: ['yellowpages.com', 'yell.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    names:     'all:.business-name',
    phones:    'all:.phones',
    addresses: 'all:.street-address',
    ratings:   'all:.ratings',
    categories:'all:.categories',
  },
};

export const tripadvisorHotel: ScrapePreset = {
  id: 'tripadvisor-hotel',
  name: 'TripAdvisor Hotel',
  category: 'data',
  description: 'Extracts hotel name, rating, review count, price range, address, description and recent reviews from a TripAdvisor hotel page. Requires Playwright.',
  matchDomains: ['tripadvisor.com', 'tripadvisor.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1.QdLfr' },
  outputFormats: ['structured'],
  selectors: {
    name:         'h1.QdLfr, h1[data-automation="mainH1"]',
    rating:       '.ZDEqb, span.uwJeR',
    review_count: 'span.hkxYU, a[href*="Reviews"]',
    price_range:  'span.biGQs._P.pZUbB.KxBGd',
    address:      'span.biGQs._P.pZUbB.hmDzD',
    description:  '.fIrGe, [class*="hotelDescription"]',
    reviews:      'all:.partial_entry, all:[data-automation="reviewCard"] q',
  },
  postProcess(raw) {
    return {
      ...raw,
      rating:       parseRating(raw.rating as string | null),
      review_count: parseCount(raw.review_count as string | null),
    };
  },
};

export const trustpilotCompany: ScrapePreset = {
  id: 'trustpilot-company',
  name: 'Trustpilot Company Profile',
  category: 'data',
  description: 'Extracts company name, trust score, review count, categories and recent review text from a Trustpilot company page. Requires Playwright.',
  matchDomains: ['trustpilot.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-business-unit-display-name]' },
  outputFormats: ['structured'],
  selectors: {
    name:            'h1[data-business-unit-display-name], span.title_title',
    score:           'p.typography_body-l__KUYFJ[data-rating-typography], span.headline_rating-score',
    review_count:    'p.typography_body-l__KUYFJ[data-reviews-count-typography], span.headline_review-count',
    categories:      'all:a.category-link, all:[class*="businessCategories"] a',
    recent_reviews:  'all:p.typography_body-l__KUYFJ[data-service-review-text-typography], all:.review-content__text',
  },
  postProcess(raw) {
    return {
      ...raw,
      score:        raw.score ? parseFloat(raw.score as string) || null : null,
      review_count: parseCount(raw.review_count as string | null),
    };
  },
};
