// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';

export const amazonProduct: ScrapePreset = {
  id: 'amazon-product',
  name: 'Amazon Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability, images and bullet points from an Amazon product page.',
  matchDomains: ['amazon.co.uk', 'amazon.com', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.ca', 'amazon.com.au'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'span#productTitle',
    price:          'span.a-price span.a-offscreen',
    original_price: 'span.a-price.a-text-price span.a-offscreen',
    rating:         'span.a-icon-alt',
    review_count:   'span#acrCustomerReviewText',
    availability:   'div#availability span',
    brand:          'a#bylineInfo',
    asin:           'input#ASIN@value',
    images:         'all:img.a-dynamic-image@src',
    bullet_points:  'all:#feature-bullets .a-list-item',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
    };
  },
};

export const ebayListing: ScrapePreset = {
  id: 'ebay-listing',
  name: 'eBay Listing',
  category: 'ecommerce',
  description: 'Extracts title, price, condition, seller details and item specifics from an eBay listing.',
  matchDomains: ['ebay.co.uk', 'ebay.com', 'ebay.de', 'ebay.fr', 'ebay.com.au'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1.x-item-title__mainTitle span',
    price:          'div.x-price-primary span.ux-textspans',
    condition:      'div.x-item-condition-text span.ux-textspans',
    seller:         'div.x-sellercard-atf__info__about-seller a.ux-textspans',
    feedback_score:  'div.x-sellercard-atf__data-item span.ux-textspans',
    shipping:       'div.ux-labels-with-data__data-value span.ux-textspans',
    item_specifics: 'all:.ux-labels-with-data li',
    images:         'all:.ux-image-carousel-item img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};

export const etsyProduct: ScrapePreset = {
  id: 'etsy-product',
  name: 'Etsy Product',
  category: 'ecommerce',
  description: 'Extracts title, price, shop name, rating, reviews, description and tags from an Etsy product listing.',
  matchDomains: ['etsy.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:        'h1[data-buy-box-listing-title]',
    price:        'p.wt-text-title-03',
    shop_name:    'a.wt-text-link span',
    rating:       'input[name="rating"]@value',
    review_count: 'span.wt-badge',
    description:  'div[data-id="description-text"] p',
    tags:         'all:.wt-tag',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:        parsePrice(raw.price as string | null),
      rating:       raw.rating ? parseFloat(raw.rating as string) || null : null,
      review_count: parseCount(raw.review_count as string | null),
    };
  },
};

export const shopifyProduct: ScrapePreset = {
  id: 'shopify-product',
  name: 'Shopify Product (generic)',
  category: 'ecommerce',
  description: 'Generic extractor for Shopify-powered stores — works across most default and popular themes.',
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    // Cover multiple common Shopify theme selectors
    title:       'h1.product__title, h1.product-single__title, h1.product_name, h1[itemprop="name"]',
    price:       '.price__regular .price-item--regular, .product__price .price, .price',
    description: '.product__description, .product-single__description, .product-description',
    variants:    'all:select[name="id"] option',
    images:      'all:.product__media img@src, all:.product-single__photo img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Parse a price string like "$1,234.56" or "£999" into a number. */
export function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,(?=\d{3})/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Parse a rating string like "4.5 out of 5 stars" into a number. */
export function parseRating(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/** Parse a review/count string like "1,234 ratings" into a number. */
export function parseCount(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}
