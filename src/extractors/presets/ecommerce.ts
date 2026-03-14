// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.
// UK retailer presets added 2026-03-11 — selectors based on known page structure at that date.

import type { ScrapePreset } from './index.ts';

export const amazonProduct: ScrapePreset = {
  id: 'amazon-product',
  name: 'Amazon Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability, images and bullet points from an Amazon product page.',
  matchDomains: ['amazon.co.uk', 'amazon.com', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.ca', 'amazon.com.au'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'span#productTitle' },
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

// ─── UK Price Comparison Retailer Presets ──────────────────────────────────────

export const currysProduct: ScrapePreset = {
  id: 'currys-product',
  name: 'Currys Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, brand, MPN, rating and images from a Currys product page.',
  matchDomains: ['currys.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1.product-name, h1[class*="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    // Currys server-renders JSON-LD with all critical data — prices are React client-side so we pull from JSON-LD
    title:          'h1.product-name, h1[class*="product-title"]',
    price:          'jsonld:offers.price',
    original_price: 'jsonld:offers.highPrice',
    in_stock:       'jsonld:offers.availability',
    brand:          'jsonld:brand.name',
    mpn:            'jsonld:mpn',
    rating:         'jsonld:aggregateRating.ratingValue',
    review_count:   'jsonld:aggregateRating.reviewCount',
    images:         'jsonld[]:image',
  },
  postProcess(raw) {
    const availability = raw.in_stock as string | null;
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       availability ? availability.includes('InStock') : null,
    };
  },
};

export const johnLewisProduct: ScrapePreset = {
  id: 'johnlewis-product',
  name: 'John Lewis Product',
  category: 'ecommerce',
  description: 'Extracts product title, price (including Was/Now), availability, brand, MPN, rating and images from a John Lewis product page.',
  matchDomains: ['johnlewis.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-title"], h1[class*="ProductDetails"], script[type="application/ld+json"]' },
  outputFormats: ['structured'],
  selectors: {
    // JSON-LD Product schema is server-rendered and always present — prefer it over React-rendered DOM
    title:          'jsonld:name',
    price:          'jsonld:offers.price',
    original_price: 'jsonld:offers.highPrice',
    in_stock:       'jsonld:offers.availability',
    brand:          'jsonld:brand.name',
    mpn:            'jsonld:mpn',
    rating:         'jsonld:aggregateRating.ratingValue',
    review_count:   'jsonld:aggregateRating.reviewCount',
    images:         'jsonld[]:image',
  },
  postProcess(raw) {
    const availability = raw.in_stock as string | null;
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       availability ? availability.toLowerCase().includes('instock') : null,
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
    };
  },
};

export const argosProduct: ScrapePreset = {
  id: 'argos-product',
  name: 'Argos Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, catalogue number, rating and reviews from an Argos product page.',
  matchDomains: ['argos.co.uk'],
  strategy: 'playwright',
  // Argos is a React SPA — wait for the price block to mount
  waitFor: { type: 'selector', value: '[class*="PriceBlock"], [data-test="product-price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:        'h1[class*="Title"], h1[data-test="product-title"]',
    price:        '[data-test="product-price"] [class*="price"], [class*="PriceBlock"] [class*="price-now"]',
    original_price: '[data-test="product-price"] [class*="was"], [class*="PriceBlock"] [class*="price-was"], del',
    in_stock:     'button[data-test="add-to-trolley"]:not([disabled]), [data-test="add-to-trolley"], [class*="addToTrolley"]:not([disabled])',
    // Argos catalogue number — typically shown near the title as "Cat. no: 123/4567"
    cat_no:       '[class*="catalogue-number"], [data-test="catalogue-number"], p[class*="CatalogueNumber"]',
    rating:       '[class*="RatingStars"] [aria-label], [data-test="rating-value"]',
    review_count: '[data-test="review-count"], [class*="reviewCount"], a[href*="reviews"]',
    images:       'all:[class*="ProductGallery"] img@src, all:[class*="product-gallery"] img@src, all:[data-test="main-image"]@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const aoProduct: ScrapePreset = {
  id: 'ao-product',
  name: 'AO Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, energy rating, brand, MPN and images from an AO.com product page.',
  matchDomains: ['ao.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="ProductTitle"], h1[itemprop="name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="ProductTitle"], h1[class*="product-title"]',
    price:               '[class*="ProductPrice"] [class*="current"], [class*="price-now"]',
    price_attr:          '#wsi-sticky-banner@data-now-price',
    original_price:      '[class*="ProductPrice"] [class*="was"], [class*="price-was"], del[class*="price"]',
    original_price_attr: '#wsi-sticky-banner@data-was-price',
    in_stock:       'button[class*="AddToBasket"]:not([disabled]), [class*="add-to-basket"]:not([disabled]), [class*="InStock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], [class*="BrandName"], a[href*="/brand/"]',
    mpn:            '[itemprop="mpn"], [class*="ModelNumber"], td[data-label="Model Number"]',
    // AO appliance pages include an EU/UK energy rating badge
    energy_rating:  '[class*="EnergyRating"] [class*="grade"], [class*="energy-rating"] span, [aria-label*="Energy Rating"]',
    rating:         '[class*="RatingScore"], [itemprop="ratingValue"]@content, [class*="star-rating"] [class*="score"]',
    review_count:   '[class*="RatingCount"], [itemprop="reviewCount"]@content, [class*="review-count"]',
    images:         'all:[class*="ProductImages"] img@src, all:[class*="Gallery"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    const { price_attr, original_price_attr, ...rest } = raw as Record<string, unknown>;
    return {
      ...rest,
      price:          parsePrice(((price_attr ?? raw.price) as string | null)),
      original_price: parsePrice(((original_price_attr ?? raw.original_price) as string | null)),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const veryProduct: ScrapePreset = {
  id: 'very-product',
  name: 'Very Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, availability, brand, rating and images from a Very.co.uk product page.',
  matchDomains: ['very.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1[class*="productTitle"], [class*="ProductTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="productTitle"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[class*="productPrice"] [class*="nowPrice"], [class*="now-price"], [itemprop="price"]@content',
    original_price: '[class*="productPrice"] [class*="wasPrice"], [class*="was-price"], del[class*="price"]',
    in_stock:       'button[class*="addToBasket"]:not([disabled]), button[class*="AddToBasket"]:not([disabled]), [class*="InStock"]',
    brand:          '[class*="brandName"], [itemprop="brand"], a[class*="brand"]',
    rating:         '[class*="ratingScore"], [itemprop="ratingValue"]@content, [class*="star-rating"] span',
    review_count:   '[class*="reviewCount"], [itemprop="reviewCount"]@content, [class*="review-count"]',
    images:         'all:[class*="productImage"] img@src, all:[class*="ProductGallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const scanProduct: ScrapePreset = {
  id: 'scan-product',
  name: 'Scan Computers Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN and images from a Scan.co.uk product page.',
  matchDomains: ['scan.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, #product-name h1',
    price:          '[itemprop="price"]@content, span.price, #product-price span.inc-vat',
    in_stock:       '.add-to-basket:not(.out-of-stock), #add-to-basket:not([disabled]), .in-stock',
    brand:          '[itemprop="brand"] [itemprop="name"], span.brand a, #product-brand',
    mpn:            '[itemprop="mpn"], td.mpn, .product-specs td:contains("Model") + td',
    ean:            '[itemprop="gtin13"], td.ean, .product-specs td:contains("EAN") + td',
    images:         'all:[itemprop="image"]@src, all:#product-images img@src, all:.product-image-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

export const overclockerProduct: ScrapePreset = {
  id: 'overclockers-product',
  name: 'Overclockers UK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN, rating and images from an Overclockers.co.uk product page.',
  matchDomains: ['overclockers.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, .product_title',
    price:          '[itemprop="price"]@content, span.price, .woocommerce-Price-amount.amount',
    original_price: 'del .woocommerce-Price-amount.amount, del [itemprop="price"]',
    in_stock:       'button.single_add_to_cart_button:not([disabled]), .stock.in-stock, p.in-stock',
    brand:          '[itemprop="brand"] [itemprop="name"], .product-brand a, a[class*="brand"]',
    mpn:            '[itemprop="mpn"], .sku, span.sku',
    ean:            '[itemprop="gtin13"], .product-ean, td:contains("EAN") + td',
    rating:         '[itemprop="ratingValue"]@content, .star-rating span, .woocommerce-product-rating .star-rating',
    review_count:   '[itemprop="reviewCount"]@content, .woocommerce-review-link',
    images:         'all:[itemprop="image"]@src, all:.woocommerce-product-gallery img@src, all:.product-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const boxProduct: ScrapePreset = {
  id: 'box-product',
  name: 'Box.co.uk Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN, brand and images from a Box.co.uk product page.',
  matchDomains: ['box.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, #product-name',
    price:          '[itemprop="price"]@content, span.price-now, .product-price strong',
    original_price: 'span.price-was, del.price, [class*="was-price"]',
    in_stock:       'button#add-to-basket:not([disabled]), .add-to-basket:not(.disabled), .in-stock-message',
    brand:          '[itemprop="brand"] span, .product-brand a, td:contains("Manufacturer") + td',
    mpn:            '[itemprop="mpn"], .product-mpn, td:contains("MPN") + td',
    ean:            '[itemprop="gtin13"], .product-ean, td:contains("EAN") + td',
    images:         'all:[itemprop="image"]@src, all:#product-images img@src, all:.product-image img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const laptopsDirectProduct: ScrapePreset = {
  id: 'laptopsdirect-product',
  name: 'Laptops Direct Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN, brand, rating and images from a Laptops Direct product page.',
  matchDomains: ['laptopsdirect.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, .product-title h1',
    price:          '[itemprop="price"]@content, span.our-price, .product-price .price',
    original_price: 'span.rrp-price, .rrp span, del.price',
    in_stock:       'button.add-to-basket:not([disabled]), .add-to-basket:not(.out-of-stock), .availability.in-stock',
    brand:          '[itemprop="brand"] span, .product-brand a, td:contains("Manufacturer") + td',
    mpn:            '[itemprop="mpn"], .product-mpn, td:contains("Part Number") + td',
    ean:            '[itemprop="gtin13"], td:contains("EAN") + td, .product-ean',
    rating:         '[itemprop="ratingValue"]@content, .rating-score, .star-rating span',
    review_count:   '[itemprop="reviewCount"]@content, .review-count, a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:#main-image-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const ebuyerProduct: ScrapePreset = {
  id: 'ebuyer-product',
  name: 'Ebuyer Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN, brand, rating and images from an Ebuyer.com product page.',
  matchDomains: ['ebuyer.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, .product-intro h1',
    price:          '[itemprop="price"]@content, span.price, .price-inc-vat span',
    original_price: 'del.price, span.rrp, [class*="was-price"]',
    in_stock:       'button.add-to-basket:not([disabled]), #add_to_basket:not([disabled]), .product-availability.in-stock',
    brand:          '[itemprop="brand"] span, .manufacturer a, a[class*="brand"]',
    mpn:            '[itemprop="mpn"], .product-mpn, td:contains("Part No") + td, td:contains("MPN") + td',
    ean:            '[itemprop="gtin13"], td:contains("EAN") + td, .product-ean',
    rating:         '[itemprop="ratingValue"]@content, .product-rating .score, .star-rating span',
    review_count:   '[itemprop="reviewCount"]@content, .review-count, a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:#product-image-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── US Retailer Presets ───────────────────────────────────────────────────────

export const bestBuyProduct: ScrapePreset = {
  id: 'best-buy',
  name: 'Best Buy Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from a Best Buy product page.',
  matchDomains: ['bestbuy.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="priceView-customer-price"], [data-testid="customer-price"]' },
  outputFormats: ['structured'],
  selectors: {
    // Best Buy uses a React SPA; data-testid attributes are most stable
    title:          'div.sku-title h1, h1[class*="heading-5"], [data-testid="product-title"]',
    price:          '[data-testid="customer-price"] span:first-child, [class*="priceView-customer-price"] span:first-child, [class*="priceView-hero-price"] span',
    original_price: '[class*="pricing-price__regular-price"], [data-testid="regular-price"], s[class*="pricing"]',
    in_stock:       'button.add-to-cart-button:not([disabled]), button[data-button-state="ADD_TO_CART"], [class*="fulfillment-add-to-cart-button"]:not([disabled])',
    brand:          '[class*="brand-link"], h4.brand-name a, [data-testid="brand-name"]',
    sku:            'div.sku.product-data-value, [class*="sku-value"], span.shop-sku-value',
    rating:         'span.customer-rating, [class*="c-ratings-reviews"] [class*="c-stars-rating"]@aria-label, [data-testid="ratings-count"]',
    review_count:   'span.c-reviews, [class*="c-ratings-reviews"] span[class*="count"], a[href*="customer-reviews"] span',
    images:         'all:button.image-gallery-thumbnail img@src, all:[class*="primary-image"]@src, all:[class*="carousel-item"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const walmartProduct: ScrapePreset = {
  id: 'walmart',
  name: 'Walmart Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, item ID, rating and images from a Walmart product page.',
  matchDomains: ['walmart.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[itemprop="price"], [class*="prod-PriceHero"]' },
  outputFormats: ['structured'],
  selectors: {
    // Walmart uses server-side rendered HTML with itemprop attributes and JSON-LD
    title:          '[itemprop="name"], h1[class*="prod-ProductTitle"], h1.f3.b',
    price:          '[itemprop="price"]@content, [class*="price-characteristic"]@content, span[class*="w_iUH7"]',
    original_price: '[class*="price-old"], [class*="strikethrough-price"], s span[class*="w_iUH7"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [class*="prod-add-to-cart-btn"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"]',
    brand:          '[itemprop="brand"], [class*="prod-brandName"] a, a[href*="/brand/"]',
    sku:            '[itemprop="sku"], [class*="product-id"], span[class*="sku"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="stars-reviews-count-node"], span[class*="rating-number"]',
    review_count:   '[itemprop="reviewCount"]@content, [class*="prod-ReviewControls"] span, a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="prod-hero-image"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const neweggProduct: ScrapePreset = {
  id: 'newegg',
  name: 'Newegg Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, part number, rating and images from a Newegg product page.',
  matchDomains: ['newegg.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '.product-buy-box, .product-pane' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1.product-title, [itemprop="name"], h1.product-name',
    price:          'li.price-current strong, [itemprop="price"]@content, .product-price .price-current',
    original_price: 'li.price-was, [class*="price-was"], del.price',
    in_stock:       'div.product-inventory:not(.product-inventory--out-of-stock), button#btn-addToCart:not([disabled]), .btn-message:not([class*="out"])',
    brand:          '[itemprop="brand"] [itemprop="name"], a.product-brand, .product-brand',
    sku:            '[itemprop="sku"], .product-model, span.item-code',
    rating:         '[itemprop="ratingValue"]@content, .product-rating i.rating@title, .reviews-note span',
    review_count:   '[itemprop="reviewCount"]@content, .product-rating .item-rating-num, span.rating-num',
    images:         'all:[itemprop="image"]@src, all:.product-view-img-original@src, all:.swiper-slide img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const adoramaProduct: ScrapePreset = {
  id: 'adorama',
  name: 'Adorama Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from an Adorama product page.',
  matchDomains: ['adorama.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '.pd-price, [class*="product-price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.pd-title, h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, span.pd-price, .product-price span',
    original_price: 'span.pd-original-price, del[class*="price"], [class*="was-price"]',
    in_stock:       'button#cart-btn:not([disabled]), button.add-to-cart:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a.pd-brand, .product-brand',
    sku:            '[itemprop="sku"], span.pd-sku, span.product-sku',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-stars"]@aria-label, span.pd-rating',
    review_count:   '[itemprop="reviewCount"]@content, span.pd-review-count, a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:.product-gallery img@src, all:[class*="thumbnail"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const targetUsProduct: ScrapePreset = {
  id: 'target-us',
  name: 'Target (US) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, TCIN, rating and images from a Target product page.',
  matchDomains: ['target.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="product-price"], h1[data-test="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    // Target uses React with data-test attributes — most stable selectors available
    title:          'h1[data-test="product-title"], h1[class*="Heading__StyledHeading"]',
    price:          '[data-test="product-price"] span, [class*="styles__CurrentPriceStyle"], [data-test="current-price"]',
    original_price: '[data-test="product-regular-price"], [class*="styles__StrikethroughStyle"], s span',
    in_stock:       'button[data-test="shipItButton"]:not([disabled]), button[data-test="orderPickupButton"]:not([disabled]), [class*="fulfillment"]:not([class*="OOS"])',
    brand:          '[data-test="product-details-brand"] a, [class*="styles__BrandName"], h2[class*="ProductBrand"] a',
    sku:            '[data-test="product-details-tcin"], span[class*="TCIN"], div[data-test="item-id"]',
    rating:         '[data-test="ratings"] span[class*="ReviewCount"], [class*="styles__RatingsContainer"] span[class*="RatingValue"]@aria-label',
    review_count:   '[data-test="rating-count"], [class*="styles__ReviewCountStyle"], a[href*="reviews"] span',
    images:         'all:picture[data-test="product-image"] img@src, all:[class*="carousel"] picture img@src, all:[class*="hero"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── AU Retailer Presets ───────────────────────────────────────────────────────

export const jbHifiAuProduct: ScrapePreset = {
  id: 'jb-hifi-au',
  name: 'JB Hi-Fi (AU) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from a JB Hi-Fi Australia product page.',
  matchDomains: ['jbhifi.com.au'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="price__selling"], [class*="ProductPrice"]' },
  outputFormats: ['structured'],
  selectors: {
    // JB Hi-Fi runs a Next.js storefront with class-name hashes; use structural selectors
    title:          'h1[class*="product-name"], h1[class*="ProductName"], [data-testid="product-title"]',
    price:          '[class*="price__selling"], [class*="ProductPrice__selling"], [data-testid="product-price"]',
    original_price: '[class*="price__was"], [class*="ProductPrice__was"], del[class*="price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), button[data-testid="add-to-cart"]:not([disabled]), [class*="AddToCart"]:not([disabled])',
    brand:          '[class*="product-brand"] a, [class*="ProductBrand"], [data-testid="product-brand"]',
    sku:            '[class*="product-sku"], [data-testid="product-sku"], span[class*="sku"]',
    rating:         '[class*="rating"] [aria-label], [data-testid="product-rating"], [class*="StarRating"]@aria-label',
    review_count:   '[class*="review-count"], [data-testid="review-count"], a[href*="reviews"] span',
    images:         'all:[class*="product-gallery"] img@src, all:[data-testid="product-image"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const harveyNormanAuProduct: ScrapePreset = {
  id: 'harvey-norman-au',
  name: 'Harvey Norman (AU) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from a Harvey Norman Australia product page.',
  matchDomains: ['harveynorman.com.au'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="price"], [itemprop="price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], [class*="ProductTitle"] h1',
    price:          '[itemprop="price"]@content, span[class*="price-current"], [class*="selling-price"]',
    original_price: 'span[class*="price-was"], del[itemprop="price"], [class*="rrp-price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="in-stock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], [class*="product-brand"] a, [class*="BrandName"]',
    sku:            '[itemprop="sku"], [class*="product-code"], span[class*="sku"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-score"], [class*="star-rating"] span',
    review_count:   '[itemprop="reviewCount"]@content, [class*="review-count"], a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const theGoodGuysProduct: ScrapePreset = {
  id: 'the-good-guys',
  name: 'The Good Guys (AU) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from a The Good Guys product page.',
  matchDomains: ['thegoodguys.com.au'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="priceNow"], [class*="PriceNow"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[class*="ProductTitle"], [itemprop="name"]',
    price:          '[class*="priceNow"], [class*="PriceNow"], [itemprop="price"]@content',
    original_price: '[class*="priceSave"] del, [class*="priceWas"], del[class*="price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), button[class*="AddToCart"]:not([disabled]), [class*="in-stock-message"]',
    brand:          '[itemprop="brand"] [itemprop="name"], [class*="product-brand"], a[class*="brandName"]',
    sku:            '[itemprop="sku"], [class*="product-code"], span[class*="model-number"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-score"], [class*="StarRating"]@aria-label',
    review_count:   '[itemprop="reviewCount"]@content, [class*="review-count"], a[href*="reviews"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── DE Retailer Presets ───────────────────────────────────────────────────────

export const mediamarktDeProduct: ScrapePreset = {
  id: 'mediamarkt-de',
  name: 'MediaMarkt (DE) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, article number and images from a MediaMarkt Germany product page.',
  matchDomains: ['mediamarkt.de'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="mms-select-price"], [class*="Price__Wrapper"]' },
  outputFormats: ['structured'],
  selectors: {
    // MediaMarkt DE uses a React/Next.js SPA — data-test attributes are most reliable
    title:          '[data-test="product-title"] h1, h1[class*="Styled-sc"], [class*="ProductHeader"] h1',
    price:          '[data-test="mms-select-price"] [class*="Price__Wrapper"], [class*="PriceBox__price"], [data-test="product-price"]',
    original_price: '[data-test="mms-select-price"] [class*="StrikePrice"], [class*="strike-price"], s[class*="Price"]',
    in_stock:       '[data-test="add-to-cart"]:not([disabled]), [class*="AddToCart"]:not([disabled]), [data-test="product-delivery-info"]:not([class*="unavailable"])',
    brand:          '[data-test="product-brand"], [class*="BrandName"], [class*="brand-logo"] img@alt',
    sku:            '[data-test="product-article-number"], [class*="ArticleNumber"], span[class*="article-nr"]',
    images:         'all:[class*="GalleryImage"] img@src, all:[data-test="gallery-item"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const saturnDeProduct: ScrapePreset = {
  id: 'saturn-de',
  name: 'Saturn (DE) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, article number and images from a Saturn Germany product page.',
  matchDomains: ['saturn.de'],
  strategy: 'playwright',
  // Saturn DE shares the same React platform as MediaMarkt DE
  waitFor: { type: 'selector', value: '[data-test="mms-select-price"], [class*="Price__Wrapper"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          '[data-test="product-title"] h1, h1[class*="Styled-sc"], [class*="ProductHeader"] h1',
    price:          '[data-test="mms-select-price"] [class*="Price__Wrapper"], [class*="PriceBox__price"], [data-test="product-price"]',
    original_price: '[data-test="mms-select-price"] [class*="StrikePrice"], [class*="strike-price"], s[class*="Price"]',
    in_stock:       '[data-test="add-to-cart"]:not([disabled]), [class*="AddToCart"]:not([disabled]), [data-test="product-delivery-info"]:not([class*="unavailable"])',
    brand:          '[data-test="product-brand"], [class*="BrandName"], [class*="brand-logo"] img@alt',
    sku:            '[data-test="product-article-number"], [class*="ArticleNumber"], span[class*="article-nr"]',
    images:         'all:[class*="GalleryImage"] img@src, all:[data-test="gallery-item"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const notebooksbilligerDeProduct: ScrapePreset = {
  id: 'notebooksbilliger-de',
  name: 'Notebooksbilliger (DE) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN and images from a Notebooksbilliger.de product page.',
  matchDomains: ['notebooksbilliger.de'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[itemprop="price"], .price-wrapper' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, span.selling-price, [class*="price-wrapper"] strong',
    original_price: 'del[class*="price"], [class*="price-was"], span.old-price',
    in_stock:       'button[id*="addToCart"]:not([disabled]), button[class*="add-to-cart"]:not([disabled]), span.availability.in-stock',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="brand"], [class*="manufacturer"] a',
    mpn:            '[itemprop="mpn"], span[class*="mpn"], td[data-label="Herstellernummer"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-stars"] span, .product-rating [class*="score"]',
    review_count:   '[itemprop="reviewCount"]@content, [class*="review-count"], a[href*="bewertungen"] span',
    images:         'all:[itemprop="image"]@src, all:#product-gallery img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const cyberportDeProduct: ScrapePreset = {
  id: 'cyberport-de',
  name: 'Cyberport (DE) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN and images from a Cyberport.de product page.',
  matchDomains: ['cyberport.de'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="price-value"], [itemprop="price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], [class*="product-title"] h1',
    price:          '[itemprop="price"]@content, [class*="price-value"] strong, span[class*="selling-price"]',
    original_price: '[class*="old-price"], del[class*="price"], [class*="strike-through-price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="availability--in-stock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="brand-name"], [class*="manufacturer"] span',
    mpn:            '[itemprop="mpn"], [class*="product-no"] span, td[class*="article-no"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-stars"]@aria-label, [class*="review-score"] span',
    review_count:   '[itemprop="reviewCount"]@content, [class*="rating-count"], a[href*="bewertung"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="image-slider"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const alternateDeProduct: ScrapePreset = {
  id: 'alternate-de',
  name: 'Alternate (DE) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, MPN/EAN, rating and images from an Alternate.de product page.',
  matchDomains: ['alternate.de'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    // Alternate DE renders server-side HTML with microdata
    title:          'h1[itemprop="name"], h1.detail-name, span[class*="productHeading"]',
    price:          '[itemprop="price"]@content, span.price, div.price-wrapper span.nowPrice',
    original_price: 'del[class*="price"], span.oldPrice, [class*="was-price"]',
    in_stock:       'div.availability.available, span.in-stock, [itemprop="availability"][href*="InStock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a.manufacturer, td[data-label="Hersteller"]',
    mpn:            '[itemprop="mpn"], td[data-label="Herstellernummer"], span.manufacturer-product-id',
    ean:            '[itemprop="gtin13"], td[data-label="EAN"], span.ean',
    rating:         '[itemprop="ratingValue"]@content, span.rating-value, [class*="stars"]@aria-label',
    review_count:   '[itemprop="reviewCount"]@content, span.count, a[href*="bewertung"] span',
    images:         'all:[itemprop="image"]@src, all:#product-images img@src, all:.product-image img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── FR Retailer Presets ───────────────────────────────────────────────────────

export const fnacFrProduct: ScrapePreset = {
  id: 'fnac-fr',
  name: 'Fnac (FR) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, EAN, rating and images from a Fnac.com product page.',
  matchDomains: ['fnac.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="userPrice"], [class*="f-priceBox"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="f-productHeader__title"], h1[itemprop="name"], h1[class*="Title"]',
    price:          '[class*="userPrice"] [class*="f-priceBox__price"], [itemprop="price"]@content, [class*="f-price--actual"]',
    original_price: '[class*="f-priceBox__oldPrice"], del[itemprop="price"], [class*="f-price--old"]',
    in_stock:       'button[class*="addToCart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="availability--available"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="f-productHeader__brand"], [class*="BrandName"]',
    ean:            '[itemprop="gtin13"], [class*="product-ean"], td[data-label="EAN"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="f-starRating"]@aria-label, span[class*="rating-value"]',
    review_count:   '[itemprop="reviewCount"]@content, [class*="f-nbReviews"], a[href*="avis"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="productVisuals"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const dartyFrProduct: ScrapePreset = {
  id: 'darty-fr',
  name: 'Darty (FR) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, EAN, rating and images from a Darty.com product page.',
  matchDomains: ['darty.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="product-price"], [itemprop="price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], [class*="ProductTitle"] h1',
    price:          '[itemprop="price"]@content, span[class*="price__amount"], [class*="current-price"] span',
    original_price: 'del[class*="price"], [class*="old-price"] span, [class*="strikethrough-price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="disponible"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="brand-name"], [class*="manufacturer"] a',
    ean:            '[itemprop="gtin13"], [class*="product-ref"], td[data-label="EAN"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="note-globale"], span[class*="stars"]@aria-label',
    review_count:   '[itemprop="reviewCount"]@content, [class*="nb-avis"], a[href*="avis"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const boulangerFrProduct: ScrapePreset = {
  id: 'boulanger-fr',
  name: 'Boulanger (FR) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, SKU, rating and images from a Boulanger.com product page.',
  matchDomains: ['boulanger.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="price-block"], [itemprop="price"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], [data-testid="product-title"]',
    price:          '[itemprop="price"]@content, [class*="price-block__price"], [data-testid="product-price"] span',
    original_price: '[class*="price-block__old-price"], del[class*="price"], [class*="barred-price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [data-testid="add-to-cart"]:not([disabled]), [class*="stock-disponible"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="product-brand"], [data-testid="product-brand"]',
    sku:            '[itemprop="sku"], [class*="product-ref"], span[data-testid="product-sku"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="note-produit"], [class*="stars-rating"]@aria-label',
    review_count:   '[itemprop="reviewCount"]@content, [class*="nb-avis"], a[href*="avis"] span',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── NL Retailer Presets ───────────────────────────────────────────────────────

export const bolComProduct: ScrapePreset = {
  id: 'bol-com',
  name: 'bol.com Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, EAN, rating and images from a bol.com product page.',
  matchDomains: ['bol.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="price-block"], [class*="promo-price"]' },
  outputFormats: ['structured'],
  selectors: {
    // bol.com is a React SPA; data-test attributes are most stable
    title:          '[data-test="title"], h1[class*="product-title"], [class*="pdp-header__title"]',
    price:          '[data-test="price"] [class*="promo-price"], [data-test="price-block"] span[class*="price"], [class*="buy-block__price"] span',
    original_price: '[data-test="price"] del, [class*="price-strikethrough"], s[class*="price"]',
    in_stock:       'button[data-test="add-to-basket"]:not([disabled]), [data-test="delivery-message"]:not([class*="unavailable"]), [class*="delivery-info"]:not([class*="out"])',
    brand:          '[data-test="brand"] a, [class*="product-brand"] a, [class*="bol-brand"]',
    ean:            '[data-test="ean"], [class*="specs-list"] li[data-spec="EAN"]',
    rating:         '[data-test="rating"] [class*="star-rating"]@aria-label, [class*="review-score"], span[class*="average-rating"]',
    review_count:   '[data-test="review-count"], [class*="reviews-summary__count"], a[href*="recensies"] span',
    images:         'all:[data-test="product-image"] img@src, all:[class*="product-media"] img@src, all:[class*="media-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const coolblueNlProduct: ScrapePreset = {
  id: 'coolblue-nl',
  name: 'Coolblue (NL) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, product number, rating and images from a Coolblue product page.',
  matchDomains: ['coolblue.nl', 'coolblue.be'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="js-product-order-form"], [data-b-name="sales-price"]' },
  outputFormats: ['structured'],
  selectors: {
    // Coolblue uses server-side HTML with data-b-name attributes and microdata
    title:          'h1[itemprop="name"], h1[class*="product-name"], [data-b-name="product-name"]',
    price:          '[data-b-name="sales-price"] strong, [itemprop="price"]@content, [class*="sales-price__current"] strong',
    original_price: '[data-b-name="advice-price"] del, [class*="advice-price"], del[class*="price"]',
    in_stock:       'button[data-b-name="order-button"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="delivery-time"]:not([class*="unavailable"])',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="brand-name"], [data-b-name="brand"] span',
    sku:            '[itemprop="sku"], [data-b-name="product-number"], span[class*="product-number"]',
    rating:         '[itemprop="ratingValue"]@content, [data-b-name="review-rating"] span, [class*="review-rating__average"]',
    review_count:   '[itemprop="reviewCount"]@content, [data-b-name="review-count"] a, [class*="review-count"]',
    images:         'all:[itemprop="image"]@src, all:[data-b-name="product-images"] img@src, all:[class*="product-media"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── ES Retailer Presets ───────────────────────────────────────────────────────

export const pcComponentesProduct: ScrapePreset = {
  id: 'pc-componentes',
  name: 'PcComponentes (ES) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, brand and images from a PcComponentes Spain product page.',
  matchDomains: ['pccomponentes.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '.pdp-price__current-price' },
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:  '.pdp-title h1',
    price:  '.pdp-price__current-price',
    brand:  '.brand-logo img@alt',
    images: 'all:.pdp-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price: parsePrice(raw.price as string | null),
    };
  },
};

export const elCorteInglesProduct: ScrapePreset = {
  id: 'el-corte-ingles',
  name: 'El Corte Inglés (ES) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, brand, image and availability from an El Corte Inglés product page via schema.org JSON-LD.',
  matchDomains: ['elcorteingles.es'],
  strategy: 'http',
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    // Falls back to visible HTML if JSON-LD extraction is handled upstream
    title:        'h1[itemprop="name"], h1.product-title, [class*="product-name"] h1',
    price:        '[itemprop="price"]@content, [class*="price-sale"], span[class*="current-price"]',
    original_price: 'del[itemprop="price"], [class*="price-old"], [class*="price-before"]',
    in_stock:     '[itemprop="availability"][content="http://schema.org/InStock"], button[class*="add-to-cart"]:not([disabled])',
    brand:        '[itemprop="brand"] [itemprop="name"], a[class*="brand-name"]',
    images:       'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const amazonEsProduct: ScrapePreset = {
  id: 'amazon-es',
  name: 'Amazon Spain Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability and images from an Amazon Spain product page.',
  matchDomains: ['amazon.es'],
  strategy: 'http',
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:          'span#productTitle',
    price:          '#priceblock_ourprice, .a-price .a-offscreen',
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

export const mediaMarktEsProduct: ScrapePreset = {
  id: 'media-markt-es',
  name: 'MediaMarkt Spain Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a MediaMarkt Spain product page.',
  matchDomains: ['mediamarkt.es'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="mms-pdp-price"], [data-test="mms-pdp-product-name"]' },
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:          '[data-test="mms-pdp-product-name"] h1, [data-test="product-title"] h1',
    price:          '[data-test="mms-pdp-price"] [class*="Price__Wrapper"], [data-test="mms-pdp-price"]',
    original_price: '[data-test="mms-pdp-price"] [class*="StrikePrice"], s[class*="Price"]',
    in_stock:       '[data-test="add-to-cart"]:not([disabled]), [data-test="product-delivery-info"]:not([class*="unavailable"])',
    brand:          '[data-test="product-brand"], [class*="BrandName"]',
    images:         'all:[class*="GalleryImage"] img@src, all:[data-test="gallery-item"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── IT Retailer Presets ───────────────────────────────────────────────────────

export const unieuroItProduct: ScrapePreset = {
  id: 'unieuro-it',
  name: 'Unieuro (IT) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Unieuro Italy product page.',
  matchDomains: ['unieuro.it'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '.price .pdp-price, h1.pdp-title' },
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1.pdp-title, h1[class*="pdp-title"], [class*="product-title"] h1',
    price:          '.price .pdp-price, [class*="pdp-price"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="price-before"], [class*="original-price"]',
    in_stock:       'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"]',
    brand:          '[itemprop="brand"] [itemprop="name"], a[class*="brand-name"]',
    images:         'all:.pdp-gallery img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const mediaworldItProduct: ScrapePreset = {
  id: 'mediaworld-it',
  name: 'MediaWorld (IT) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a MediaWorld Italy product page.',
  matchDomains: ['mediaworld.it'],
  strategy: 'playwright',
  // Same React platform as MediaMarkt/Saturn DE
  waitFor: { type: 'selector', value: '[data-test="mms-select-price"], [class*="Price__Wrapper"]' },
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:          '[data-test="product-title"] h1, h1[class*="Styled-sc"], [class*="ProductHeader"] h1',
    price:          '[data-test="mms-select-price"] [class*="Price__Wrapper"], [class*="PriceBox__price"], [data-test="product-price"]',
    original_price: '[data-test="mms-select-price"] [class*="StrikePrice"], [class*="strike-price"], s[class*="Price"]',
    in_stock:       '[data-test="add-to-cart"]:not([disabled]), [class*="AddToCart"]:not([disabled]), [data-test="product-delivery-info"]:not([class*="unavailable"])',
    brand:          '[data-test="product-brand"], [class*="BrandName"], [class*="brand-logo"] img@alt',
    sku:            '[data-test="product-article-number"], [class*="ArticleNumber"]',
    images:         'all:[class*="GalleryImage"] img@src, all:[data-test="gallery-item"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const amazonItProduct: ScrapePreset = {
  id: 'amazon-it',
  name: 'Amazon Italy Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability and images from an Amazon Italy product page.',
  matchDomains: ['amazon.it'],
  strategy: 'http',
  currency: 'EUR',
  outputFormats: ['structured'],
  selectors: {
    title:          'span#productTitle',
    price:          '#priceblock_ourprice, .a-price .a-offscreen',
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

// ─── IN Retailer Presets ───────────────────────────────────────────────────────

export const flipkartProduct: ScrapePreset = {
  id: 'flipkart',
  name: 'Flipkart (IN) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Flipkart India product page.',
  matchDomains: ['flipkart.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '._30jeq3._16Jk6d, ._35KyD6 h1' },
  currency: 'INR',
  outputFormats: ['structured'],
  selectors: {
    title:    '._35KyD6 h1, h1[class*="title"], [class*="B_NuCI"]',
    price:    '._30jeq3._16Jk6d, [class*="_30jeq3"], [class*="CEmiEU"] [class*="Nx9bqj"]',
    out_of_stock: '._16FRp0, [class*="out-of-stock"], [class*="_16FRp0"]',
    images:   'all:._396cs4._2amPTt._3sGedP img@src, all:[class*="product-img"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:        parsePrice(raw.price as string | null),
      in_stock:     !(raw.out_of_stock),
    };
  },
};

export const amazonInProduct: ScrapePreset = {
  id: 'amazon-in',
  name: 'Amazon India Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability and images from an Amazon India product page.',
  matchDomains: ['amazon.in'],
  strategy: 'http',
  currency: 'INR',
  outputFormats: ['structured'],
  selectors: {
    title:          'span#productTitle',
    price:          '#priceblock_ourprice, .a-price .a-offscreen',
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

export const cromaProduct: ScrapePreset = {
  id: 'croma',
  name: 'Croma (IN) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Croma India product page.',
  matchDomains: ['croma.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'span.amount, h1.pd-title' },
  currency: 'INR',
  outputFormats: ['structured'],
  selectors: {
    title:    'h1.pd-title, h1[class*="product-title"], [class*="product-name"] h1',
    price:    'span.amount, [class*="pdp-price"] span, [itemprop="price"]@content',
    in_stock: 'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"]',
    brand:    '[itemprop="brand"] [itemprop="name"], a[class*="brand"]',
    images:   'all:[class*="pdp-gallery"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

// ─── JP Retailer Presets ───────────────────────────────────────────────────────

export const amazonJpProduct: ScrapePreset = {
  id: 'amazon-jp',
  name: 'Amazon Japan Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, rating, availability and images from an Amazon Japan product page.',
  matchDomains: ['amazon.co.jp'],
  strategy: 'http',
  currency: 'JPY',
  outputFormats: ['structured'],
  selectors: {
    title:          'span#productTitle',
    price:          '#priceblock_ourprice, .a-price .a-offscreen',
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

export const yodobashiProduct: ScrapePreset = {
  id: 'yodobashi',
  name: 'Yodobashi Camera (JP) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Yodobashi Camera product page.',
  matchDomains: ['yodobashi.com'],
  strategy: 'http',
  currency: 'JPY',
  outputFormats: ['structured'],
  selectors: {
    title:    'h1.review_product_name_link, h1[class*="product_name"], [class*="productName"] h1',
    price:    '.price_normal .price, [class*="price_normal"] [class*="price"], [class*="BottomBox"] strong[class*="price"]',
    in_stock: '[class*="addToCart"]:not([disabled]), [class*="cart_btn"]:not([class*="disable"]), [class*="stock--available"]',
    brand:    '[class*="manufacturer"] a, [class*="brandName"] a',
    images:   'all:.jis_image img@src, all:[class*="jis_image"] img@src, all:[class*="productImage"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

export const bicCameraProduct: ScrapePreset = {
  id: 'bic-camera',
  name: 'Bic Camera (JP) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Bic Camera product page.',
  matchDomains: ['biccamera.com'],
  strategy: 'http',
  currency: 'JPY',
  outputFormats: ['structured'],
  selectors: {
    title:    'h1.item_title, h1[class*="item_title"], [class*="product-title"] h1',
    price:    '.priceNormal, [class*="priceNormal"], [class*="selling-price"] strong',
    in_stock: '[class*="addToCart"]:not([disabled]), button[class*="cart"]:not([disabled]), [class*="stock-info"]:not([class*="sold"])',
    brand:    '[class*="maker_name"] a, [class*="brandName"], [itemprop="brand"] span',
    images:   'all:[class*="item_img"] img@src, all:[class*="product_img"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

// ─── CA Retailer Presets ───────────────────────────────────────────────────────

export const memoryExpressProduct: ScrapePreset = {
  id: 'memory-express',
  name: 'Memory Express (CA) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Memory Express Canada product page.',
  matchDomains: ['memoryexpress.com'],
  strategy: 'http',
  currency: 'CAD',
  outputFormats: ['structured'],
  selectors: {
    title:    '.PI_ProductName, [class*="ProductName"], h1[class*="product-name"]',
    price:    '.PIEndPrice, [class*="PIEndPrice"], [itemprop="price"]@content',
    in_stock: '[class*="AddToCart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="stock-available"]',
    brand:    '[class*="ProductBrand"] a, [itemprop="brand"] span, [class*="brand-name"]',
    sku:      '[class*="ProductSKU"], span[itemprop="sku"], [class*="product-code"]',
    images:   'all:[class*="ProductImages"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

export const mikesComputerShopProduct: ScrapePreset = {
  id: 'mikes-computer-shop',
  name: "Mike's Computer Shop (CA) Product",
  category: 'ecommerce',
  description: "Extracts product title, price, availability and images from a Mike's Computer Shop Canada product page.",
  matchDomains: ['mikescomputershop.com'],
  strategy: 'http',
  currency: 'CAD',
  outputFormats: ['structured'],
  selectors: {
    title:    'h1.product-title, h1[class*="product-title"], [itemprop="name"]',
    price:    '.product-price .price, [class*="product-price"] .price, [itemprop="price"]@content',
    in_stock: 'button[class*="add-to-cart"]:not([disabled]), [itemprop="availability"][content="http://schema.org/InStock"], [class*="in-stock"]',
    brand:    '[itemprop="brand"] span, a[class*="brand"], [class*="manufacturer-name"]',
    sku:      '[itemprop="sku"], [class*="product-sku"], span[class*="model-number"]',
    images:   'all:[class*="product-images"] img@src, all:[class*="image-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:    parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

// ─── Category / Listing Page Presets ──────────────────────────────────────────
//
// These presets scrape retailer category/search pages to discover products.
// Each returns parallel arrays: all_titles, all_urls, all_prices, all_images, all_asins?
// The category-crawler worker zips these arrays into product records.
//
// IMPORTANT: array lengths may differ if some cards lack prices. The worker
// uses all_urls as the authoritative index and treats missing values as null.

export const amazonUkCategory: ScrapePreset = {
  id: 'amazon-uk-category',
  name: 'Amazon UK Category / Search',
  category: 'ecommerce',
  description: 'Discovers product listings from an Amazon UK category or search results page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-asin]' },
  outputFormats: ['structured'],
  selectors: {
    all_asins:  'all:[data-asin]@data-asin',
    all_titles: 'all:[data-asin] h2 a span',
    all_urls:   'all:[data-asin] h2 a@href',
    all_prices: 'all:[data-asin] .a-price .a-offscreen',
    all_images: 'all:[data-asin] img.s-image@src',
  },
};

export const currysCategory: ScrapePreset = {
  id: 'currys-category',
  name: 'Currys Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a Currys category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    // Currys product cards — use container class to avoid picking up nav links
    all_titles: 'all:[class*="ProductCardstyles"] [class*="Title"], all:[class*="ProductCard"] [class*="Title"]',
    all_urls:   'all:[class*="ProductCardstyles"] a@href, all:[class*="ProductCard"] a@href',
    all_prices: 'all:[class*="ProductCardstyles"] [class*="price"], all:[class*="ProductCard"] [class*="price"]',
    all_images: 'all:[class*="ProductCardstyles"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const argosCategory: ScrapePreset = {
  id: 'argos-category',
  name: 'Argos Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from an Argos category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[href^="/product/"] [data-test="product-title"], all:[href^="/product/"] h3, all:[href^="/product/"] [class*="Title"]',
    all_urls:   'all:[href^="/product/"]@href',
    all_prices: 'all:[href^="/product/"] [data-test="price-display"], all:[href^="/product/"] [class*="price"]',
    all_images: 'all:[href^="/product/"] img@src',
  },
};

export const johnLewisCategory: ScrapePreset = {
  id: 'johnlewis-category',
  name: 'John Lewis Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a John Lewis category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[data-testid="product-card-anchor"] h2, all:a[data-testid="product-card-anchor"] [class*="title"]',
    all_urls:   'all:a[data-testid="product-card-anchor"]@href',
    all_prices: 'all:a[data-testid="product-card-anchor"] [data-testid="price"], all:a[data-testid="product-card-anchor"] [class*="price"]',
    all_images: 'all:a[data-testid="product-card-anchor"] img@src',
  },
};

export const aoCategory: ScrapePreset = {
  id: 'ao-category',
  name: 'AO.com Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from an AO.com category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[href^="/product/"] h2, all:[href^="/product/"] h3, all:[href^="/product/"] [class*="name"]',
    all_urls:   'all:[href^="/product/"]@href',
    all_prices: 'all:[href^="/product/"] [class*="price"]',
    all_images: 'all:[href^="/product/"] img@src',
  },
};

export const ebuyerCategory: ScrapePreset = {
  id: 'ebuyer-category',
  name: 'Ebuyer Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from an Ebuyer category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:li.grid-item .item-title a, all:.product-listing .item-title a',
    all_urls:   'all:li.grid-item .item-title a@href, all:.product-listing .item-title a@href',
    all_prices: 'all:li.grid-item .price-inc-vat, all:.product-listing .price',
    all_images: 'all:li.grid-item img.product-image@src, all:.product-listing img@src',
  },
};

export const scanCategory: ScrapePreset = {
  id: 'scan-category',
  name: 'Scan.co.uk Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a Scan.co.uk category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:ul.productList li .description a, all:.productListItem .description a',
    all_urls:   'all:ul.productList li .description a@href, all:.productListItem .description a@href',
    all_prices: 'all:ul.productList li .price, all:.productListItem .price',
    all_images: 'all:ul.productList li img@src, all:.productListItem img@src',
  },
};

export const laptopsDirectCategory: ScrapePreset = {
  id: 'laptopsdirect-category',
  name: 'Laptops Direct Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a Laptops Direct category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-list-item .product-title a, all:[class*="product-item"] h3 a',
    all_urls:   'all:.product-list-item .product-title a@href, all:[class*="product-item"] h3 a@href',
    all_prices: 'all:.product-list-item .product-price, all:[class*="product-item"] .price',
    all_images: 'all:.product-list-item img.product-image@src, all:[class*="product-item"] img@src',
  },
};

export const veryCategory: ScrapePreset = {
  id: 'very-category',
  name: 'Very.co.uk Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a Very.co.uk category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: '[data-testid="product-block"], [class*="ProductBlock"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-testid="product-block"] [data-testid="product-name"], all:[class*="ProductBlock"] h3',
    all_urls:   'all:[data-testid="product-block"] a@href, all:[class*="ProductBlock"] a@href',
    all_prices: 'all:[data-testid="product-block"] [data-testid="product-price"], all:[class*="ProductBlock"] [class*="price"]',
    all_images: 'all:[data-testid="product-block"] img@src, all:[class*="ProductBlock"] img@src',
  },
};

// ─── UK Fashion Retailer Presets ──────────────────────────────────────────────

export const asosProduct: ScrapePreset = {
  id: 'asos-product',
  name: 'ASOS Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, brand, images and availability from an ASOS product page.',
  matchDomains: ['asos.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: '[data-testid="product-title"], h1[class*="product-hero-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          '[data-testid="product-title"], h1[class*="product-hero-title"], h1[class*="productTitle"]',
    price:          '[data-testid="current-price"], [class*="current-price"], [class*="price__current"]',
    original_price: '[data-testid="previous-price"], [class*="previous-price"], [class*="price__previous"] del',
    brand:          '[data-testid="product-brand-link"], [class*="brand-name"] a, h2[class*="brand"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), button[class*="addToBag"]:not([disabled])',
    colour:         '[data-testid="colour-label"], [class*="colour-name"], [class*="colorName"]',
    images:         'all:[data-testid="image-thumbnail"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const nextProduct: ScrapePreset = {
  id: 'next-product',
  name: 'Next Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, and images from a Next product page.',
  matchDomains: ['next.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-title"], h1[class*="ProductTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-testid="product-title"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[data-testid="product-price"] [class*="now"], [itemprop="price"]@content, [class*="price--selling"]',
    original_price: '[data-testid="product-price"] [class*="was"], del[class*="price"], [class*="price--reduced"]',
    brand:          '[data-testid="brand-name"], [class*="brand-name"], [itemprop="brand"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), button[class*="AddToBag"]:not([disabled])',
    colour:         '[data-testid="colour-name"], [class*="colour-label"], [class*="color-name"]',
    images:         'all:[class*="product-image"] img@src, all:[data-testid="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const marksAndSpencerProduct: ScrapePreset = {
  id: 'marks-and-spencer-product',
  name: 'M&S Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Marks & Spencer product page.',
  matchDomains: ['marksandspencer.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-title"], [class*="ProductTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-testid="product-title"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[data-testid="product-selling-price"], [class*="price__selling"], [itemprop="price"]@content',
    original_price: '[data-testid="product-rrp"], del[class*="price"], [class*="price__original"]',
    brand:          '[data-testid="product-brand"], [class*="brand-name"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), [class*="add-to-bag"]:not([disabled])',
    images:         'all:[data-testid="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const zalandoUkProduct: ScrapePreset = {
  id: 'zalando-uk-product',
  name: 'Zalando (UK) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, brand and images from a Zalando UK product page.',
  matchDomains: ['zalando.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="title"], [data-testid="product-name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="title"], [data-testid="product-name"], [class*="product-title"]',
    price:          '[class*="price"][class*="original"], [data-testid="price"], x-price',
    original_price: '[class*="price"][class*="original"] del, [data-testid="original-price"]',
    brand:          'h3[class*="brand"], [data-testid="brand-name"], a[class*="brand"]',
    in_stock:       'button[data-testid="to-cart"]:not([disabled]), button[class*="AddToCart"]:not([disabled])',
    images:         'all:[class*="image-container"] img@src, all:[data-testid="image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── UK Home & Garden Retailer Presets ────────────────────────────────────────

export const dunelmProduct: ScrapePreset = {
  id: 'dunelm-product',
  name: 'Dunelm Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Dunelm product page.',
  matchDomains: ['dunelm.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [data-testid="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], [data-testid="product-title"], h1[itemprop="name"]',
    price:          '[class*="price__selling"], [data-testid="product-price"], [itemprop="price"]@content',
    original_price: '[class*="price__was"], del[class*="price"], [data-testid="was-price"]',
    in_stock:       'button[data-testid="add-to-basket"]:not([disabled]), button[class*="addToBasket"]:not([disabled])',
    brand:          '[class*="brand-name"], [data-testid="brand-name"]',
    images:         'all:[class*="product-gallery"] img@src, all:[data-testid="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const wayfairUkProduct: ScrapePreset = {
  id: 'wayfair-uk-product',
  name: 'Wayfair (UK) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Wayfair UK product page.',
  matchDomains: ['wayfair.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-hb-id="ProductDetailTitle"], [class*="ProductDetailTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-hb-id="ProductDetailTitle"], h1[class*="ProductDetailTitle"], [itemprop="name"]',
    price:          '[data-testid="PriceBlock"] [class*="BasePriceText"], [class*="sale-price"], [itemprop="price"]@content',
    original_price: '[data-testid="PriceBlock"] s, del[class*="price"], [class*="original-price"]',
    brand:          'a[data-testid="manufacturer-link"], [class*="manufacturer"], [itemprop="brand"]',
    in_stock:       'button[data-testid="AddToCartButton"]:not([disabled]), button[class*="AddToCart"]:not([disabled])',
    images:         'all:[class*="ProductGallery"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const bAndQProduct: ScrapePreset = {
  id: 'b-and-q-product',
  name: 'B&Q Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a B&Q product page.',
  matchDomains: ['diy.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-title"], [class*="ProductTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-testid="product-title"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[data-testid="product-price"] [class*="now"], [class*="priceNow"], [itemprop="price"]@content',
    original_price: '[data-testid="product-price"] [class*="was"], del[class*="price"], [class*="priceWas"]',
    in_stock:       'button[data-testid="add-to-basket"]:not([disabled]), button[class*="AddToBasket"]:not([disabled])',
    brand:          '[data-testid="brand-name"], [class*="brand"] a, [itemprop="brand"]',
    images:         'all:[data-testid="product-image"] img@src, all:[class*="ProductGallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const ikeaUkProduct: ScrapePreset = {
  id: 'ikea-uk-product',
  name: 'IKEA (UK) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from an IKEA UK product page.',
  matchDomains: ['ikea.com/gb'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="pip-header-section__title"], [class*="product-name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="pip-header-section__title"], [class*="product-name"] h1, [itemprop="name"]',
    price:          '[class*="pip-temp-price__integer"], [class*="price-package__price"], [class*="pip-price"]',
    in_stock:       'button[class*="pip-btn-primary"]:not([disabled]), [class*="pip-buynow"]:not([disabled])',
    brand:          '[class*="pip-header-section__description-part-number"], span[class*="pip-brand"]',
    images:         'all:[class*="pip-media"] img@src, all:[class*="product-gallery"] img@src',
    article_no:     '[class*="pip-header-section__description-part-number"]',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:   parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

// ─── UK Health & Beauty Retailer Presets ─────────────────────────────────────

export const bootsProduct: ScrapePreset = {
  id: 'boots-product',
  name: 'Boots Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Boots product page.',
  matchDomains: ['boots.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [data-testid="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[data-testid="product-title"], [itemprop="name"]',
    price:          '[class*="price-value"], [data-testid="product-price"], [class*="productPrice"]',
    original_price: 'del[class*="price"], [class*="price-previous"], [data-testid="was-price"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), button[class*="addToBag"]:not([disabled])',
    brand:          '[class*="brand-name"] a, [data-testid="brand-name"], [itemprop="brand"]',
    images:         'all:[class*="product-image"] img@src, all:[data-testid="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const superdrugProduct: ScrapePreset = {
  id: 'superdrug-product',
  name: 'Superdrug Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Superdrug product page.',
  matchDomains: ['superdrug.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [data-testid="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[data-testid="product-title"], [itemprop="name"]',
    price:          '[class*="price__current"], [class*="product-price"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="price__previous"], s[class*="price"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), button[class*="addToBasket"]:not([disabled])',
    brand:          '[class*="brand-name"], [itemprop="brand"] [itemprop="name"]',
    images:         'all:[class*="product-gallery"] img@src, all:[class*="ProductImage"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const lookfantasticProduct: ScrapePreset = {
  id: 'lookfantastic-product',
  name: 'Lookfantastic Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Lookfantastic product page.',
  matchDomains: ['lookfantastic.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [data-product-title]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], [data-product-title], [itemprop="name"]',
    price:          '[class*="price__current"], [data-price], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="price__previous"], [data-rrp]',
    brand:          '[class*="brand-name"] a, [class*="product-brand"], [itemprop="brand"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), [class*="atb-button"]:not([disabled])',
    images:         'all:[class*="product-gallery"] img@src, all:[class*="product-images"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── UK Sports & Outdoor Retailer Presets ────────────────────────────────────

export const sportsDirectProduct: ScrapePreset = {
  id: 'sports-direct-product',
  name: 'Sports Direct Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Sports Direct product page.',
  matchDomains: ['sportsdirect.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [itemprop="name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], [data-productname]',
    price:          '[class*="product-price"] [class*="selling"], [itemprop="price"]@content, [class*="nowPrice"]',
    original_price: 'del[class*="price"], [class*="wasPrice"], [itemprop="price"][class*="was"]',
    brand:          '[class*="product-brand"] a, [itemprop="brand"] [itemprop="name"]',
    in_stock:       'button[class*="addToBag"]:not([disabled]), button[id*="addToBag"]:not([disabled])',
    images:         'all:#altImages img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const jdSportsProduct: ScrapePreset = {
  id: 'jd-sports-product',
  name: 'JD Sports Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a JD Sports product page.',
  matchDomains: ['jdsports.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="prod-title"], [data-e2e="product-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="prod-title"], [data-e2e="product-title"], [itemprop="name"]',
    price:          '[class*="selling-price"], [data-e2e="product-price"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="was-price"], [data-e2e="original-price"]',
    brand:          '[class*="product-brand"] a, [data-e2e="brand-name"]',
    in_stock:       'button[data-e2e="add-to-bag"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[data-e2e="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const decathlonUkProduct: ScrapePreset = {
  id: 'decathlon-uk-product',
  name: 'Decathlon (UK) Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Decathlon UK product page.',
  matchDomains: ['decathlon.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [data-testid="product-name"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], [data-testid="product-name"], [itemprop="name"]',
    price:          '[class*="price__current"], [data-testid="product-price"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="price__original"], [data-testid="original-price"]',
    brand:          '[class*="product-brand"] a, [data-testid="brand-name"]',
    in_stock:       'button[data-testid="add-to-basket"]:not([disabled]), button[class*="AddToCart"]:not([disabled])',
    images:         'all:[class*="product-gallery"] img@src, all:[data-testid="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── UK Toy & Book Retailer Presets ──────────────────────────────────────────

export const smythsToysProduct: ScrapePreset = {
  id: 'smyths-toys-product',
  name: 'Smyths Toys Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Smyths Toys product page.',
  matchDomains: ['smythstoys.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], [class*="productTitle"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[class*="productTitle"], [itemprop="name"]',
    price:          '[class*="price__selling"], [class*="productPrice"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [class*="price__was"], [class*="rrp"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), [class*="addToBasket"]:not([disabled])',
    brand:          '[class*="brand-name"] a, [itemprop="brand"]',
    images:         'all:[class*="product-gallery"] img@src, all:[class*="productImage"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

export const waterstonesBooksProduct: ScrapePreset = {
  id: 'waterstones-product',
  name: 'Waterstones Product',
  category: 'ecommerce',
  description: 'Extracts title, price, author, ISBN and availability from a Waterstones book page.',
  matchDomains: ['waterstones.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:       'h1[itemprop="name"], h1[class*="title"], .title-and-author h1',
    price:       '[class*="price__current"], [itemprop="price"]@content, span[class*="price"]',
    author:      '[itemprop="author"] [itemprop="name"], a[class*="author-name"]',
    isbn:        '[itemprop="isbn"], [class*="isbn"]',
    in_stock:    'button[data-id="add-to-basket"]:not([disabled]), .add-to-basket-button:not([disabled])',
    format:      '[class*="format-selector"] .active, [class*="selected-format"]',
    images:      'all:[itemprop="image"]@src, all:.book-cover img@src',
    description: '[itemprop="description"], #tabContent p',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:   parsePrice(raw.price as string | null),
      in_stock: !!(raw.in_stock),
    };
  },
};

// ─── UK Pet Retailer Presets ──────────────────────────────────────────────────

export const petsAtHomeProduct: ScrapePreset = {
  id: 'pets-at-home-product',
  name: 'Pets at Home Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability and images from a Pets at Home product page.',
  matchDomains: ['petsathome.com'],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-name"], [class*="ProductName"]' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-testid="product-name"], h1[class*="ProductName"], [itemprop="name"]',
    price:          '[data-testid="product-price"], [class*="price__current"], [itemprop="price"]@content',
    original_price: 'del[class*="price"], [data-testid="was-price"], [class*="price__original"]',
    brand:          '[data-testid="product-brand"], [class*="brand-name"]',
    in_stock:       'button[data-testid="add-to-basket"]:not([disabled]), [class*="addToBasket"]:not([disabled])',
    images:         'all:[data-testid="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
    };
  },
};

// ─── Fashion category listings ───────────────────────────────────────────────

export const asosCategory: ScrapePreset = {
  id: 'asos-category',
  name: 'ASOS Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from an ASOS category/sale page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/prd/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/prd/"] [class*="name"], all:a[href*="/prd/"] [class*="title"], all:a[href*="/prd/"] h3, all:a[href*="/prd/"] p',
    all_urls:   'all:a[href*="/prd/"]@href',
    all_prices: 'all:a[href*="/prd/"] [class*="price"], all:a[href*="/prd/"] [data-auto-id="price"]',
    all_images: 'all:a[href*="/prd/"] img@src',
  },
};

export const nextCategory: ScrapePreset = {
  id: 'next-category',
  name: 'Next Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Next category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/style/"], a[href*="/p/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/style/"] [class*="title"], all:a[href*="/style/"] h3, all:a[href*="/p/"] h3',
    all_urls:   'all:a[href*="/style/"]@href, all:a[href*="/p/"]@href',
    all_prices: 'all:a[href*="/style/"] [class*="price"], all:a[href*="/p/"] [class*="price"]',
    all_images: 'all:a[href*="/style/"] img@src, all:a[href*="/p/"] img@src',
  },
};

export const marksAndSpencerCategory: ScrapePreset = {
  id: 'marks-and-spencer-category',
  name: 'Marks & Spencer Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from an M&S category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/p/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/p/"] [class*="title"], all:a[href*="/p/"] [class*="name"], all:a[href*="/p/"] h3',
    all_urls:   'all:a[href*="/p/"]@href',
    all_prices: 'all:a[href*="/p/"] [class*="price"]',
    all_images: 'all:a[href*="/p/"] img@src',
  },
};

export const zalandoUkCategory: ScrapePreset = {
  id: 'zalando-uk-category',
  name: 'Zalando UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Zalando UK category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/_/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/_/"] [class*="name"], all:a[href*="/_/"] h3, all:a[href*="/_/"] [data-testid*="product-name"]',
    all_urls:   'all:a[href*="/_/"]@href',
    all_prices: 'all:a[href*="/_/"] [class*="price"], all:a[href*="/_/"] [data-testid*="price"]',
    all_images: 'all:a[href*="/_/"] img@src',
  },
};

// ─── Beauty category listings ─────────────────────────────────────────────────

export const bootsCategory: ScrapePreset = {
  id: 'boots-category',
  name: 'Boots Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Boots category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-title"], all:a[href*="/product/"] [class*="productName"], all:a[href*="/product/"] h3',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const superdrugCategory: ScrapePreset = {
  id: 'superdrug-category',
  name: 'Superdrug Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Superdrug category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/p/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/p/"] [class*="product-name"], all:a[href*="/p/"] h3, all:a[href*="/p/"] [class*="title"]',
    all_urls:   'all:a[href*="/p/"]@href',
    all_prices: 'all:a[href*="/p/"] [class*="price"]',
    all_images: 'all:a[href*="/p/"] img@src',
  },
};

export const lookfantasticCategory: ScrapePreset = {
  id: 'lookfantastic-category',
  name: 'Lookfantastic Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Lookfantastic category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/products/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/products/"] [class*="product-name"], all:a[href*="/products/"] h3, all:a[href*="/products/"] [class*="title"]',
    all_urls:   'all:a[href*="/products/"]@href',
    all_prices: 'all:a[href*="/products/"] [class*="price"]',
    all_images: 'all:a[href*="/products/"] img@src',
  },
};

// ─── Sports category listings ─────────────────────────────────────────────────

export const sportsDirectCategory: ScrapePreset = {
  id: 'sports-direct-category',
  name: 'Sports Direct Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Sports Direct category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-name"], all:a[href*="/product/"] h3, all:a[href*="/product/"] [itemprop="name"]',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const jdSportsCategory: ScrapePreset = {
  id: 'jd-sports-category',
  name: 'JD Sports Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a JD Sports category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-name"], all:a[href*="/product/"] [class*="ProductName"], all:a[href*="/product/"] h3',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"], all:a[href*="/product/"] [data-auto-id="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const decathlonUkCategory: ScrapePreset = {
  id: 'decathlon-uk-category',
  name: 'Decathlon UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Decathlon UK category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/p-"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/p-"] [class*="product-name"], all:a[href*="/p-"] h3, all:a[href*="/p-"] [class*="title"]',
    all_urls:   'all:a[href*="/p-"]@href',
    all_prices: 'all:a[href*="/p-"] [class*="price"]',
    all_images: 'all:a[href*="/p-"] img@src',
  },
};

// ─── Toys, Books & Pets category listings ─────────────────────────────────────

export const smythsCategory: ScrapePreset = {
  id: 'smyths-category',
  name: 'Smyths Toys Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Smyths Toys category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-name"], all:a[href*="/product/"] h3, all:a[href*="/product/"] [itemprop="name"]',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const waterstonesCategory: ScrapePreset = {
  id: 'waterstones-category',
  name: 'Waterstones Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Waterstones category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/book/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/book/"] [class*="title"], all:a[href*="/book/"] h3',
    all_urls:   'all:a[href*="/book/"]@href',
    all_prices: 'all:a[href*="/book/"] [class*="price"], all:a[href*="/book/"] b.price',
    all_images: 'all:a[href*="/book/"] img@src',
  },
};

export const petsAtHomeCategory: ScrapePreset = {
  id: 'pets-at-home-category',
  name: 'Pets at Home Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Pets at Home category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [data-testid="product-name"], all:a[href*="/product/"] h3, all:a[href*="/product/"] [class*="name"]',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [data-testid="product-price"], all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

// ─── Home & Garden category listings ─────────────────────────────────────────

export const dunelmCategory: ScrapePreset = {
  id: 'dunelm-category',
  name: 'Dunelm Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Dunelm category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/product/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-title"], all:a[href*="/product/"] h3, all:a[href*="/product/"] [class*="title"]',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const wayfairUkCategory: ScrapePreset = {
  id: 'wayfair-uk-category',
  name: 'Wayfair UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Wayfair UK category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/pdp/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/pdp/"] [class*="name"], all:a[href*="/pdp/"] h3, all:a[href*="/pdp/"] [data-testid*="name"]',
    all_urls:   'all:a[href*="/pdp/"]@href',
    all_prices: 'all:a[href*="/pdp/"] [class*="price"], all:a[href*="/pdp/"] [data-testid*="price"]',
    all_images: 'all:a[href*="/pdp/"] img@src',
  },
};

export const bAndQCategory: ScrapePreset = {
  id: 'b-and-q-category',
  name: 'B&Q Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a B&Q category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/products/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/products/"] [class*="product-title"], all:a[href*="/products/"] h3, all:a[href*="/products/"] [class*="title"]',
    all_urls:   'all:a[href*="/products/"]@href',
    all_prices: 'all:a[href*="/products/"] [class*="price"]',
    all_images: 'all:a[href*="/products/"] img@src',
  },
};

// ─── UK Shared helpers ────────────────────────────────────────────────────────

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

// ─── UK Tech / Electronics category listings ──────────────────────────────────

export const overclockersCategoryUk: ScrapePreset = {
  id: 'overclockers-category',
  name: 'Overclockers UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from an Overclockers UK category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-info .product-title a, all:.product-listing-item h3 a',
    all_urls:   'all:.product-info .product-title a@href, all:.product-listing-item h3 a@href',
    all_prices: 'all:.product-info .price, all:.product-listing-item .price',
    all_images: 'all:.product-info img@src, all:.product-listing-item img@src',
  },
};

export const boxCategory: ScrapePreset = {
  id: 'box-category',
  name: 'Box.co.uk Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Box.co.uk category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-item"] [class*="product-name"] a, all:[class*="product-card"] h3 a',
    all_urls:   'all:[class*="product-item"] [class*="product-name"] a@href, all:[class*="product-card"] h3 a@href',
    all_prices: 'all:[class*="product-item"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-item"] img@src, all:[class*="product-card"] img@src',
  },
};

export const cclComputersCategory: ScrapePreset = {
  id: 'ccl-computers-category',
  name: 'CCL Computers Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a CCL Computers category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-listing .product-name a, all:.category-product h3 a',
    all_urls:   'all:.product-listing .product-name a@href, all:.category-product h3 a@href',
    all_prices: 'all:.product-listing .price, all:.category-product .price',
    all_images: 'all:.product-listing img@src, all:.category-product img@src',
  },
};

export const novatechCategory: ScrapePreset = {
  id: 'novatech-category',
  name: 'Novatech Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Novatech category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-list .product-title a, all:article.product h3 a',
    all_urls:   'all:.product-list .product-title a@href, all:article.product h3 a@href',
    all_prices: 'all:.product-list .price, all:article.product .price',
    all_images: 'all:.product-list img@src, all:article.product img@src',
  },
};

export const backMarketCategory: ScrapePreset = {
  id: 'back-market-category',
  name: 'Back Market Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Back Market category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'selector', value: 'a[href*="/p/"], a[data-test="product-link"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[data-test="product-link"] [data-test="product-title"], all:a[data-test="product-link"] h3',
    all_urls:   'all:a[data-test="product-link"]@href',
    all_prices: 'all:a[data-test="product-link"] [data-test="product-price"], all:a[data-test="product-link"] [class*="price"]',
    all_images: 'all:a[data-test="product-link"] img@src',
  },
};

export const musicMagpieCategory: ScrapePreset = {
  id: 'music-magpie-category',
  name: 'Music Magpie Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Music Magpie category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const richerSoundsCategory: ScrapePreset = {
  id: 'richer-sounds-category',
  name: 'Richer Sounds Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Richer Sounds category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-item .product-name a, all:li.product h3 a',
    all_urls:   'all:.product-item .product-name a@href, all:li.product h3 a@href',
    all_prices: 'all:.product-item .price, all:li.product .price',
    all_images: 'all:.product-item img@src, all:li.product img@src',
  },
};

export const gameUkCategory: ScrapePreset = {
  id: 'game-uk-category',
  name: 'GAME UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a GAME category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/products/"] [class*="product-name"], all:a[href*="/products/"] h3',
    all_urls:   'all:a[href*="/products/"]@href',
    all_prices: 'all:a[href*="/products/"] [class*="price"]',
    all_images: 'all:a[href*="/products/"] img@src',
  },
};

export const shoptoCategory: ScrapePreset = {
  id: 'shopto-category',
  name: 'ShopTo Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a ShopTo category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-list-item .product-title a, all:li.productItem h3 a',
    all_urls:   'all:.product-list-item .product-title a@href, all:li.productItem h3 a@href',
    all_prices: 'all:.product-list-item .price, all:li.productItem .price',
    all_images: 'all:.product-list-item img@src, all:li.productItem img@src',
  },
};

export const zavviCategory: ScrapePreset = {
  id: 'zavvi-category',
  name: 'Zavvi Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Zavvi category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/products/"] [class*="product-name"], all:a[href*="/products/"] h3',
    all_urls:   'all:a[href*="/products/"]@href',
    all_prices: 'all:a[href*="/products/"] [class*="price"]',
    all_images: 'all:a[href*="/products/"] img@src',
  },
};

export const gamesCategory: ScrapePreset = {
  id: '365games-category',
  name: '365 Games Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a 365 Games category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-list .product-title a, all:.ProductCard h3 a',
    all_urls:   'all:.product-list .product-title a@href, all:.ProductCard h3 a@href',
    all_prices: 'all:.product-list .price, all:.ProductCard .price',
    all_images: 'all:.product-list img@src, all:.ProductCard img@src',
  },
};

export const halfordsCategory: ScrapePreset = {
  id: 'halfords-category',
  name: 'Halfords Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Halfords category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const appliancesDirectCategory: ScrapePreset = {
  id: 'appliances-direct-category',
  name: 'Appliances Direct Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from an Appliances Direct category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-list-item .product-title a, all:[class*="product-item"] h3 a',
    all_urls:   'all:.product-list-item .product-title a@href, all:[class*="product-item"] h3 a@href',
    all_prices: 'all:.product-list-item [class*="price"], all:[class*="product-item"] [class*="price"]',
    all_images: 'all:.product-list-item img@src, all:[class*="product-item"] img@src',
  },
};

export const lakelandCategory: ScrapePreset = {
  id: 'lakeland-category',
  name: 'Lakeland Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Lakeland category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/p/"] [class*="product-title"], all:a[href*="/p/"] h3',
    all_urls:   'all:a[href*="/p/"]@href',
    all_prices: 'all:a[href*="/p/"] [class*="price"]',
    all_images: 'all:a[href*="/p/"] img@src',
  },
};

// ─── UK Fashion category listings ─────────────────────────────────────────────

export const boohooCategory: ScrapePreset = {
  id: 'boohoo-category',
  name: 'Boohoo Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Boohoo category page.',
  matchDomains: ['boohoo.com'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="name"], all:[class*="ProductCard"] [class*="name"]',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="ProductCard"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="ProductCard"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const prettylittlethingCategory: ScrapePreset = {
  id: 'prettylittlething-category',
  name: 'PrettyLittleThing Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a PrettyLittleThing category page.',
  matchDomains: ['prettylittlething.com'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="name"], all:[class*="ProductCard"] [class*="name"]',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="ProductCard"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="ProductCard"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const newLookCategory: ScrapePreset = {
  id: 'new-look-category',
  name: 'New Look Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a New Look category page.',
  matchDomains: ['newlook.com'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="productCard"] [class*="name"], all:[class*="product-card"] [class*="name"]',
    all_urls:   'all:[class*="productCard"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="productCard"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="productCard"] img@src, all:[class*="product-card"] img@src',
  },
};

export const riverIslandCategory: ScrapePreset = {
  id: 'river-island-category',
  name: 'River Island Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a River Island category page.',
  matchDomains: ['riverisland.com'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="name"], all:[class*="product-list"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:a[href*="/p/"]@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const houseOfFraserCategory: ScrapePreset = {
  id: 'house-of-fraser-category',
  name: 'House of Fraser Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a House of Fraser category page.',
  matchDomains: ['houseoffraser.co.uk'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="name"], all:[class*="ProductCard"] [class*="name"]',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="ProductCard"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="ProductCard"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const flannelsCategory: ScrapePreset = {
  id: 'flannels-category',
  name: 'FLANNELS Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a FLANNELS category page.',
  matchDomains: ['flannels.com'],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="name"], all:[class*="ProductCard"] [class*="name"]',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="ProductCard"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="ProductCard"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const mainlineMenswearCategory: ScrapePreset = {
  id: 'mainline-menswear-category',
  name: 'Mainline Menswear Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Mainline Menswear category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="product-name"], all:a[href*="/product/"] h3',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const fatFaceCategory: ScrapePreset = {
  id: 'fat-face-category',
  name: 'Fat Face Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Fat Face category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src',
  },
};

export const whiteStuffCategory: ScrapePreset = {
  id: 'white-stuff-category',
  name: 'White Stuff Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a White Stuff category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const joulesCategory: ScrapePreset = {
  id: 'joules-category',
  name: 'Joules Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Joules category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const tedBakerCategory: ScrapePreset = {
  id: 'ted-baker-category',
  name: 'Ted Baker Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Ted Baker category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const reissCategory: ScrapePreset = {
  id: 'reiss-category',
  name: 'Reiss Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Reiss category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const superdryCategory: ScrapePreset = {
  id: 'superdry-category',
  name: 'Superdry Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Superdry category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const matalanCategory: ScrapePreset = {
  id: 'matalan-category',
  name: 'Matalan Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Matalan category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const quizCategory: ScrapePreset = {
  id: 'quiz-category',
  name: 'Quiz Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Quiz category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const georgeAsdaCategory: ScrapePreset = {
  id: 'george-asda-category',
  name: 'George at ASDA Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a George at ASDA category page.',
  matchDomains: [],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-title"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

// ─── UK Sports & Outdoor category listings ────────────────────────────────────

export const goOutdoorsCategory: ScrapePreset = {
  id: 'go-outdoors-category',
  name: 'Go Outdoors Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Go Outdoors category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const mountainWarehouseCategory: ScrapePreset = {
  id: 'mountain-warehouse-category',
  name: 'Mountain Warehouse Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Mountain Warehouse category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/p/"] [class*="product-name"], all:a[href*="/p/"] h3, all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const cotswoldOutdoorCategory: ScrapePreset = {
  id: 'cotswold-outdoor-category',
  name: 'Cotswold Outdoor Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Cotswold Outdoor category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const chainReactionCategory: ScrapePreset = {
  id: 'chain-reaction-category',
  name: 'Chain Reaction Cycles Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Chain Reaction Cycles category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const sweatyBettyCategory: ScrapePreset = {
  id: 'sweaty-betty-category',
  name: 'Sweaty Betty Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Sweaty Betty category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const lululemonUkCategory: ScrapePreset = {
  id: 'lululemon-uk-category',
  name: 'Lululemon UK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Lululemon UK category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-testid="product-card"] [data-testid="product-tile-title"], all:[class*="product-card"] h3',
    all_urls:   'all:[data-testid="product-card"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[data-testid="product-card"] [data-testid="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[data-testid="product-card"] img@src, all:[class*="product-card"] img@src',
  },
};

// ─── UK Beauty category listings ──────────────────────────────────────────────

export const beautyBayCategory: ScrapePreset = {
  id: 'beauty-bay-category',
  name: 'Beauty Bay Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Beauty Bay category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'a[href*="/products/"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/products/"] [class*="product-name"], all:a[href*="/products/"] h3',
    all_urls:   'all:a[href*="/products/"]@href',
    all_prices: 'all:a[href*="/products/"] [class*="price"]',
    all_images: 'all:a[href*="/products/"] img@src',
  },
};

export const spaceNkCategory: ScrapePreset = {
  id: 'space-nk-category',
  name: 'Space NK Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Space NK category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const theBodyShopCategory: ScrapePreset = {
  id: 'the-body-shop-category',
  name: 'The Body Shop Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a The Body Shop category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[class*="product-card"] img@src',
  },
};

export const hollandBarrettCategory: ScrapePreset = {
  id: 'holland-barrett-category',
  name: 'Holland & Barrett Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Holland & Barrett category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const fragranceDirectCategory: ScrapePreset = {
  id: 'fragrance-direct-category',
  name: 'Fragrance Direct Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Fragrance Direct category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-item .product-name a, all:li.product-grid-item h3 a',
    all_urls:   'all:.product-item .product-name a@href, all:li.product-grid-item h3 a@href',
    all_prices: 'all:.product-item .price, all:li.product-grid-item .price',
    all_images: 'all:.product-item img@src, all:li.product-grid-item img@src',
  },
};

// ─── UK Toys category listings ────────────────────────────────────────────────

export const theEntertainerCategory: ScrapePreset = {
  id: 'the-entertainer-category',
  name: 'The Entertainer Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from The Entertainer category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const hamleysCategory: ScrapePreset = {
  id: 'hamleys-category',
  name: 'Hamleys Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Hamleys category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

// ─── UK Books category listings ───────────────────────────────────────────────

export const whsmithCategory: ScrapePreset = {
  id: 'whsmith-category',
  name: 'WHSmith Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a WHSmith category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const theBookPeopleCategory: ScrapePreset = {
  id: 'the-book-people-category',
  name: 'The Book People Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from The Book People category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const hiveCategory: ScrapePreset = {
  id: 'hive-category',
  name: 'Hive Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Hive category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="title"], all:a[href*="/product/"] h3',
    all_urls:   'all:a[href*="/product/"]@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"]',
    all_images: 'all:a[href*="/product/"] img@src',
  },
};

export const blackwellsCategory: ScrapePreset = {
  id: 'blackwells-category',
  name: 'Blackwell\'s Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Blackwell\'s category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:a[href*="/product/"] [class*="title"], all:.book-item h3 a',
    all_urls:   'all:a[href*="/product/"]@href, all:.book-item h3 a@href',
    all_prices: 'all:a[href*="/product/"] [class*="price"], all:.book-item .price',
    all_images: 'all:a[href*="/product/"] img@src, all:.book-item img@src',
  },
};

// ─── UK Pets category listings ────────────────────────────────────────────────

export const zooplusCategory: ScrapePreset = {
  id: 'zooplus-category',
  name: 'Zooplus Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Zooplus category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-item"] [class*="product-name"], all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-item"] a@href, all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-item"] [class*="price"], all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-item"] img@src, all:[class*="product-card"] img@src',
  },
};

export const jollyesCategory: ScrapePreset = {
  id: 'jollyes-category',
  name: 'Jollyes Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Jollyes category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const viovetCategory: ScrapePreset = {
  id: 'viovet-category',
  name: 'VioVet Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a VioVet category page.',
  matchDomains: [],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:.product-listing .product-name a, all:[class*="product-item"] h3 a',
    all_urls:   'all:.product-listing .product-name a@href, all:[class*="product-item"] h3 a@href',
    all_prices: 'all:.product-listing .price, all:[class*="product-item"] .price',
    all_images: 'all:.product-listing img@src, all:[class*="product-item"] img@src',
  },
};

// ─── UK Home & Garden additional category listings ────────────────────────────

export const homebaseCategory: ScrapePreset = {
  id: 'homebase-category',
  name: 'Homebase Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Homebase category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const oakFurniturelandCategory: ScrapePreset = {
  id: 'oak-furnitureland-category',
  name: 'Oak Furnitureland Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from an Oak Furnitureland category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const coxAndCoxCategory: ScrapePreset = {
  id: 'cox-and-cox-category',
  name: 'Cox & Cox Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Cox & Cox category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

export const gardenTradingCategory: ScrapePreset = {
  id: 'garden-trading-category',
  name: 'Garden Trading Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Garden Trading category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-tile"] h3',
    all_urls:   'all:[class*="product-card"] a@href, all:[class*="product-tile"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"], all:[class*="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src, all:[class*="product-tile"] img@src',
  },
};

// ─── UK Product Presets — Group 1: Tech / Gaming ─────────────────────────────

export const backMarketProduct: ScrapePreset = {
  id: 'back-market-product',
  name: 'Back Market Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, grade, brand and images from a Back Market refurbished electronics page.',
  matchDomains: ['backmarket.co.uk', 'backmarket.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-qa="product-title"], h1[class*="product-title"], h1[class*="ProductTitle"]',
    price:          '[data-qa="product-price"], [class*="price__current"], [class*="ProductPrice__current"]',
    original_price: '[data-qa="product-original-price"], [class*="price__crossed"], del',
    brand:          '[data-qa="product-brand"], [class*="brand-name"], [itemprop="brand"]',
    grade:          '[data-qa="product-grade"], [class*="grade-label"], [class*="GradeLabel"]',
    description:    '[data-qa="product-description"], [class*="product-description"]',
    in_stock:       '[data-qa="add-to-cart"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[class*="product-gallery"] img@src, all:[class*="ProductGallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const musicMagpieProduct: ScrapePreset = {
  id: 'music-magpie-product',
  name: 'musicMagpie Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, condition, brand, description and images from a musicMagpie product page.',
  matchDomains: ['musicmagpie.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[class*="product-price"] [class*="price"], [itemprop="price"]@content, [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="manufacturer"]',
    condition:      '[class*="condition-label"], [class*="grade"], [data-condition]',
    description:    '[class*="product-description"], [itemprop="description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const richerSoundsProduct: ScrapePreset = {
  id: 'richer-sounds-product',
  name: 'Richer Sounds Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, MPN and images from a Richer Sounds product page.',
  matchDomains: ['richersounds.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1.product-name, h1[class*="product-title"], h1[itemprop="name"]',
    price:          '.product-price .price, [class*="our-price"], [itemprop="price"]@content',
    original_price: '.rrp-price, [class*="was-price"], del.price',
    brand:          '[itemprop="brand"] [itemprop="name"], .product-brand a, [class*="manufacturer"]',
    mpn:            '[itemprop="mpn"], .product-mpn, td[class*="model-number"]',
    description:    '.product-description, [itemprop="description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), .add-to-basket:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const gameUkProduct: ScrapePreset = {
  id: 'game-uk-product',
  name: 'GAME UK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, platform, brand, description and images from a GAME UK product page.',
  matchDomains: ['game.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="ProductName"]',
    price:          '[class*="product-price"] [class*="price"], [itemprop="price"]@content, [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="publisher"]',
    platform:       '[class*="platform"], [data-platform], [class*="format-label"]',
    description:    '[class*="product-description"], [itemprop="description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const shoptoProduct: ScrapePreset = {
  id: 'shopto-product',
  name: 'ShopTo Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, platform, description and images from a ShopTo.net product page.',
  matchDomains: ['shopto.net'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-title, h1[class*="product-name"]',
    price:          '[itemprop="price"]@content, .product-price .price, [class*="selling-price"]',
    original_price: '[class*="rrp-price"], [class*="was-price"], del.price',
    brand:          '[itemprop="brand"], .product-brand, [class*="manufacturer"]',
    description:    '[itemprop="description"], .product-description',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), .add-to-basket:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:[class*="gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const zavviProduct: ScrapePreset = {
  id: 'zavvi-product',
  name: 'Zavvi Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Zavvi product page.',
  matchDomains: ['zavvi.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductName"]',
    price:          '[class*="product-price"] [class*="price-now"], [itemprop="price"]@content',
    original_price: '[class*="price-was"], [class*="price-rrp"], del[itemprop="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), [itemprop="availability"][content*="InStock"]',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const games365Product: ScrapePreset = {
  id: '365games-product',
  name: '365games Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, platform, description and images from a 365games.co.uk product page.',
  matchDomains: ['365games.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, .product-price .price, [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del.price',
    brand:          '[itemprop="brand"], .product-brand, [class*="manufacturer"]',
    description:    '[itemprop="description"], .product-description',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), .add-to-basket:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const halfordsProduct: ScrapePreset = {
  id: 'halfords-product',
  name: 'Halfords Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, SKU, description and images from a Halfords product page.',
  matchDomains: ['halfords.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[class*="ProductName"], h1[itemprop="name"]',
    price:          '[class*="product-price"] [class*="price-now"], [itemprop="price"]@content, [class*="selling-price"]',
    original_price: '[class*="price-was"], [class*="was-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    sku:            '[itemprop="sku"], [class*="product-code"], [class*="product-sku"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-gallery"] img@src, all:[class*="product-image"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const appliancesDirectProduct: ScrapePreset = {
  id: 'appliances-direct-product',
  name: 'Appliances Direct Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, MPN, energy rating and images from an Appliances Direct product page.',
  matchDomains: ['appliancesdirect.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, .our-price span, [class*="product-price"] [class*="price"]',
    original_price: '.rrp-price, [class*="was-price"], del.price',
    brand:          '[itemprop="brand"] [itemprop="name"], .product-brand a, [class*="manufacturer"]',
    mpn:            '[itemprop="mpn"], [class*="model-number"], td[data-label*="Model"]',
    energy_rating:  '[class*="energy-rating"], [class*="EnergyRating"], [aria-label*="Energy"]',
    description:    '[itemprop="description"], .product-description',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), .add-to-basket:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:.product-images img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const lakelandProduct: ScrapePreset = {
  id: 'lakeland-product',
  name: 'Lakeland Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description, rating and images from a Lakeland product page.',
  matchDomains: ['lakeland.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductName"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    rating:         '[itemprop="ratingValue"]@content, [class*="rating-score"], [class*="star-rating"] span',
    review_count:   '[itemprop="reviewCount"]@content, [class*="review-count"], a[href*="reviews"] span',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), [class*="AddToBasket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      rating:         parseRating(raw.rating as string | null),
      review_count:   parseCount(raw.review_count as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const novatechProduct: ScrapePreset = {
  id: 'novatech-product',
  name: 'Novatech Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, brand, MPN/EAN and images from a Novatech.co.uk product page.',
  matchDomains: ['novatech.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, #product-name',
    price:          '[itemprop="price"]@content, span.price, .product-price .inc-vat',
    original_price: '[class*="was-price"], del.price, span.rrp',
    brand:          '[itemprop="brand"] span, .product-brand a, td[data-label="Manufacturer"]',
    mpn:            '[itemprop="mpn"], td[data-label="Part No"], [class*="part-number"]',
    ean:            '[itemprop="gtin13"], td[data-label="EAN"]',
    description:    '[itemprop="description"], .product-description',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), .add-to-basket:not([disabled]), .in-stock',
    images:         'all:[itemprop="image"]@src, all:#product-images img@src, all:.product-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const cclComputersProduct: ScrapePreset = {
  id: 'ccl-computers-product',
  name: 'CCL Computers Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, availability, brand, MPN/EAN and images from a CCLOnline.com product page.',
  matchDomains: ['cclonline.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1.product-name, .product-title h1',
    price:          '[itemprop="price"]@content, span.price, .product-price strong',
    original_price: '[class*="was-price"], del.price, .rrp span',
    brand:          '[itemprop="brand"] span, .product-brand a, td[data-label="Brand"]',
    mpn:            '[itemprop="mpn"], td[data-label="MPN"], [class*="part-number"]',
    ean:            '[itemprop="gtin13"], td[data-label="EAN"]',
    description:    '[itemprop="description"], .product-description',
    in_stock:       'button#add-to-basket:not([disabled]), .add-to-basket:not([disabled]), .in-stock',
    images:         'all:[itemprop="image"]@src, all:#product-images img@src, all:.product-gallery img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const highStreetTvProduct: ScrapePreset = {
  id: 'high-street-tv-product',
  name: 'High Street TV Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a High Street TV product page.',
  matchDomains: ['highstreettv.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], h1[class*="product-name"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const bedsCoUkProduct: ScrapePreset = {
  id: 'beds-co-uk-product',
  name: 'Beds.co.uk Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a Beds.co.uk product page.',
  matchDomains: ['beds.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], h1[class*="product-name"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 2: Fashion ───────────────────────────────────

export const boohooProduct: ScrapePreset = {
  id: 'boohoo-product',
  name: 'Boohoo Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour, size options and images from a Boohoo product page.',
  matchDomains: ['boohoo.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[class*="ProductTitle"], h1[itemprop="name"]',
    price:          '[class*="product-price"] [class*="price-now"], [itemprop="price"]@content, [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"], [class*="product-details"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const prettylittlethingProduct: ScrapePreset = {
  id: 'prettylittlething-product',
  name: 'PrettyLittleThing Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a PrettyLittleThing product page.',
  matchDomains: ['prettylittlething.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const newLookProduct: ScrapePreset = {
  id: 'new-look-product',
  name: 'New Look Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a New Look product page.',
  matchDomains: ['newlook.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[data-testid="product-name"], h1[itemprop="name"]',
    price:          '[data-testid="price"], [class*="product-price"] [class*="price"], [itemprop="price"]@content',
    original_price: '[class*="was-price"], [class*="strike-price"], del[class*="price"]',
    brand:          '[class*="product-brand"], [class*="brand-name"], [itemprop="brand"]',
    description:    '[class*="product-description"], [itemprop="description"]',
    in_stock:       '.add-to-basket:not([disabled]), [data-testid="add-to-cart"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[class*="gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const riverIslandProduct: ScrapePreset = {
  id: 'river-island-product',
  name: 'River Island Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour, brand and images from a River Island product page.',
  matchDomains: ['riverisland.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[data-testid="product-title"], h1[itemprop="name"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"]',
    colour:         '[class*="colour-name"], [data-testid="selected-colour"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[data-testid="add-to-bag"]:not([disabled])',
    images:         'all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const houseOfFraserProduct: ScrapePreset = {
  id: 'house-of-fraser-product',
  name: 'House of Fraser Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a House of Fraser product page.',
  matchDomains: ['houseoffraser.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="ProductName"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="was-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], a[class*="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const flannelsProduct: ScrapePreset = {
  id: 'flannels-product',
  name: 'Flannels Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Flannels product page.',
  matchDomains: ['flannels.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="ProductName"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="was-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], a[class*="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const mainlineMenswearProduct: ScrapePreset = {
  id: 'mainline-menswear-product',
  name: 'Mainline Menswear Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Mainline Menswear product page.',
  matchDomains: ['mainlinemenswear.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-title"], h1[class*="product-name"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const fatFaceProduct: ScrapePreset = {
  id: 'fat-face-product',
  name: 'Fat Face Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Fat Face product page.',
  matchDomains: ['fatface.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const whiteStuffProduct: ScrapePreset = {
  id: 'white-stuff-product',
  name: 'White Stuff Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a White Stuff product page.',
  matchDomains: ['whitestuff.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const joulesProduct: ScrapePreset = {
  id: 'joules-product',
  name: 'Joules Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Joules product page.',
  matchDomains: ['joules.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const tedBakerProduct: ScrapePreset = {
  id: 'ted-baker-product',
  name: 'Ted Baker Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Ted Baker product page.',
  matchDomains: ['tedbaker.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const reissProduct: ScrapePreset = {
  id: 'reiss-product',
  name: 'Reiss Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Reiss product page.',
  matchDomains: ['reiss.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const superdryProduct: ScrapePreset = {
  id: 'superdry-product',
  name: 'Superdry Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Superdry product page.',
  matchDomains: ['superdry.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const matalanProduct: ScrapePreset = {
  id: 'matalan-product',
  name: 'Matalan Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Matalan product page.',
  matchDomains: ['matalan.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const quizProduct: ScrapePreset = {
  id: 'quiz-product',
  name: 'Quiz Clothing Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Quiz Clothing product page.',
  matchDomains: ['quizclothing.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const georgeAsdaProduct: ScrapePreset = {
  id: 'george-asda-product',
  name: 'George at Asda Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a George (Asda) product page.',
  matchDomains: ['george.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="brand-name"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const debenhamsProduct: ScrapePreset = {
  id: 'debenhams-product',
  name: 'Debenhams Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Debenhams product page.',
  matchDomains: ['debenhams.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], a[class*="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const karenMillenProduct: ScrapePreset = {
  id: 'karen-millen-product',
  name: 'Karen Millen Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Karen Millen product page.',
  matchDomains: ['karenmillen.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const dorothyPerkinsProduct: ScrapePreset = {
  id: 'dorothy-perkins-product',
  name: 'Dorothy Perkins Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Dorothy Perkins product page.',
  matchDomains: ['dorothyperkins.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const wallisProduct: ScrapePreset = {
  id: 'wallis-product',
  name: 'Wallis Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Wallis product page.',
  matchDomains: ['wallis.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price-now"], [class*="price__current"]',
    original_price: '[class*="price-was"], [class*="price__original"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const missSelfridgeProduct: ScrapePreset = {
  id: 'miss-selfridge-product',
  name: 'Miss Selfridge Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Miss Selfridge product page.',
  matchDomains: ['missselfridge.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[itemprop="name"], h1[class*="ProductTitle"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    colour:         '[class*="colour-name"], [data-colour], [class*="selected-colour"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 3: Sports & Outdoor ──────────────────────────

export const goOutdoorsProduct: ScrapePreset = {
  id: 'go-outdoors-product',
  name: 'Go Outdoors Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Go Outdoors product page.',
  matchDomains: ['gooutdoors.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const mountainWarehouseProduct: ScrapePreset = {
  id: 'mountain-warehouse-product',
  name: 'Mountain Warehouse Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Mountain Warehouse product page.',
  matchDomains: ['mountainwarehouse.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const cotswoldOutdoorProduct: ScrapePreset = {
  id: 'cotswold-outdoor-product',
  name: 'Cotswold Outdoor Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Cotswold Outdoor product page.',
  matchDomains: ['cotswoldoutdoor.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const chainReactionProduct: ScrapePreset = {
  id: 'chain-reaction-product',
  name: 'Chain Reaction Cycles Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Chain Reaction Cycles product page.',
  matchDomains: ['chainreactioncycles.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const sweatyBettyProduct: ScrapePreset = {
  id: 'sweaty-betty-product',
  name: 'Sweaty Betty Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a Sweaty Betty product page.',
  matchDomains: ['sweatybetty.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [class*="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-basket"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const lululemonUkProduct: ScrapePreset = {
  id: 'lululemon-uk-product',
  name: 'lululemon UK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from a lululemon product page.',
  matchDomains: ['lululemon.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[data-testid="product-name"], h1[class*="product-name"], h1[itemprop="name"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[data-testid="colour-name"], [class*="colour-name"]',
    description:    '[data-testid="product-description"], [itemprop="description"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[data-testid="product-image"] img@src, all:[class*="product-image"] img@src, all:[class*="carousel"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const blacksProduct: ScrapePreset = {
  id: 'blacks-product',
  name: 'Blacks Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Blacks product page.',
  matchDomains: ['blacks.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const evansCyclesProduct: ScrapePreset = {
  id: 'evans-cycles-product',
  name: 'Evans Cycles Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from an Evans Cycles product page.',
  matchDomains: ['evanscycles.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const probikeKitProduct: ScrapePreset = {
  id: 'probikekit-product',
  name: 'ProBikeKit Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a ProBikeKit product page.',
  matchDomains: ['probikekit.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const underArmourUkProduct: ScrapePreset = {
  id: 'under-armour-uk-product',
  name: 'Under Armour UK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, colour and images from an Under Armour product page.',
  matchDomains: ['underarmour.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-name"]',
    price:          '[itemprop="price"]@content, [data-testid="product-price"], [class*="product-price"] [class*="price"]',
    original_price: '[class*="original-price"], [class*="was-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    colour:         '[class*="selected-colour"], [data-testid="colour-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-bag"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 4: Beauty & Health ───────────────────────────

export const beautyBayProduct: ScrapePreset = {
  id: 'beauty-bay-product',
  name: 'Beauty Bay Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Beauty Bay product page.',
  matchDomains: ['beautybay.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const spaceNkProduct: ScrapePreset = {
  id: 'space-nk-product',
  name: 'Space NK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Space NK product page.',
  matchDomains: ['spacenk.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[itemprop="price"]@content, [data-testid="product-price"], [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const theBodyShopProduct: ScrapePreset = {
  id: 'the-body-shop-product',
  name: 'The Body Shop Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a The Body Shop product page.',
  matchDomains: ['thebodyshop.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[itemprop="price"]@content, [data-testid="product-price"], [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const hollandBarrettProduct: ScrapePreset = {
  id: 'holland-barrett-product',
  name: 'Holland & Barrett Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Holland & Barrett product page.',
  matchDomains: ['hollandandbarrett.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-name"]',
    price:          '[itemprop="price"]@content, [data-testid="price"], [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const fragranceDirectProduct: ScrapePreset = {
  id: 'fragrance-direct-product',
  name: 'Fragrance Direct Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Fragrance Direct product page.',
  matchDomains: ['fragrancedirect.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const feeluniqueProduct: ScrapePreset = {
  id: 'feelunique-product',
  name: 'Feelunique Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Feelunique product page.',
  matchDomains: ['feelunique.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-bag"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const chemistDirectProduct: ScrapePreset = {
  id: 'chemist-direct-product',
  name: 'Chemist Direct Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Chemist Direct product page.',
  matchDomains: ['chemistdirect.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const pharmacy2uProduct: ScrapePreset = {
  id: 'pharmacy2u-product',
  name: 'Pharmacy2U Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Pharmacy2U product page.',
  matchDomains: ['pharmacy2u.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 5: Toys ──────────────────────────────────────

export const theEntertainerProduct: ScrapePreset = {
  id: 'the-entertainer-product',
  name: 'The Entertainer Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from The Entertainer product page.',
  matchDomains: ['thetoyshop.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const hamleysProduct: ScrapePreset = {
  id: 'hamleys-product',
  name: 'Hamleys Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Hamleys product page.',
  matchDomains: ['hamleys.com'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const characterOnlineProduct: ScrapePreset = {
  id: 'character-online-product',
  name: 'Character Online Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Character Online product page.',
  matchDomains: ['character-online.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 6: Books ─────────────────────────────────────

export const whsmithProduct: ScrapePreset = {
  id: 'whsmith-product',
  name: 'WHSmith Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, author, ISBN and images from a WHSmith product page.',
  matchDomains: ['whsmith.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [itemprop="author"], [class*="author"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    isbn:           '[itemprop="isbn"], [class*="isbn"], td[data-label*="ISBN"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const theBookPeopleProduct: ScrapePreset = {
  id: 'the-book-people-product',
  name: 'The Book People Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, author and images from a The Book People product page.',
  matchDomains: ['thebookpeople.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="author"], [class*="author"], [itemprop="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const hiveProduct: ScrapePreset = {
  id: 'hive-product',
  name: 'Hive Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, author and images from a Hive.co.uk product page.',
  matchDomains: ['hive.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="author"], [class*="author"], [itemprop="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const blackwellsProduct: ScrapePreset = {
  id: 'blackwells-product',
  name: 'Blackwell\'s Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, author, ISBN and images from a Blackwell\'s product page.',
  matchDomains: ['blackwells.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="author"], [class*="author"], [itemprop="brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    isbn:           '[itemprop="isbn"], [class*="isbn"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 7: Pets ──────────────────────────────────────

export const zooplusProduct: ScrapePreset = {
  id: 'zooplus-product',
  name: 'zooplus Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a zooplus product page.',
  matchDomains: ['zooplus.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-name"], h1[itemprop="name"], h1[data-testid="product-title"]',
    price:          '[data-testid="product-price"], [itemprop="price"]@content, [class*="product-price"] [class*="price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const jollyesProduct: ScrapePreset = {
  id: 'jollyes-product',
  name: 'Jollyes Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Jollyes product page.',
  matchDomains: ['jollyes.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const viovetProduct: ScrapePreset = {
  id: 'viovet-product',
  name: 'VioVet Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a VioVet product page.',
  matchDomains: ['viovet.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const monsterPetProduct: ScrapePreset = {
  id: 'monster-pet-product',
  name: 'Monster Pet Supplies Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a Monster Pet Supplies product page.',
  matchDomains: ['monsterpetsupplies.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── UK Product Presets — Group 8: Home ──────────────────────────────────────

export const homebaseProduct: ScrapePreset = {
  id: 'homebase-product',
  name: 'Homebase Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Homebase product page.',
  matchDomains: ['homebase.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const oakFurniturelandProduct: ScrapePreset = {
  id: 'oak-furnitureland-product',
  name: 'Oak Furnitureland Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from an Oak Furnitureland product page.',
  matchDomains: ['oakfurnitureland.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const coxAndCoxProduct: ScrapePreset = {
  id: 'cox-and-cox-product',
  name: 'Cox & Cox Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a Cox & Cox product page.',
  matchDomains: ['coxandcox.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const gardenTradingProduct: ScrapePreset = {
  id: 'garden-trading-product',
  name: 'Garden Trading Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a Garden Trading product page.',
  matchDomains: ['gardentrading.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const wickesProduct: ScrapePreset = {
  id: 'wickes-product',
  name: 'Wickes Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand, description and images from a Wickes product page.',
  matchDomains: ['wickes.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const furnitureBoxProduct: ScrapePreset = {
  id: 'furniture-box-product',
  name: 'Furniture Box Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a Furniture Box product page.',
  matchDomains: ['furniturebox.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const furnitureVillageProduct: ScrapePreset = {
  id: 'furniture-village-product',
  name: 'Furniture Village Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, description and images from a Furniture Village product page.',
  matchDomains: ['furniturevillage.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const laRedouteUkProduct: ScrapePreset = {
  id: 'la-redoute-uk-product',
  name: 'La Redoute UK Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from a La Redoute product page.',
  matchDomains: ['laredoute.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="original-price"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

export const jewelleryBoxProduct: ScrapePreset = {
  id: 'jewellery-box-product',
  name: 'The Jewellery Box Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, original price, brand and images from The Jewellery Box product page.',
  matchDomains: ['thejewellerybox.co.uk'],
  strategy: 'auto',
  waitFor: { type: 'networkidle' },
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[itemprop="name"], h1[class*="product-name"], h1[class*="product-title"]',
    price:          '[itemprop="price"]@content, [class*="product-price"] [class*="price"], [class*="selling-price"]',
    original_price: '[class*="was-price"], [class*="rrp"], del[class*="price"]',
    brand:          '[itemprop="brand"], [class*="product-brand"], [class*="brand-name"]',
    description:    '[itemprop="description"], [class*="product-description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[itemprop="image"]@src, all:[class*="product-image"] img@src, all:[class*="product-gallery"] img@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};

// ─── Jessops ────────────────────────────────────────────────────────────────

export const jessopsCategory: ScrapePreset = {
  id: 'jessops-category',
  name: 'Jessops Category Listing',
  category: 'ecommerce',
  description: 'Discovers products from a Jessops category page.',
  matchDomains: ['jessops.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-card"] [class*="product-name"], all:[class*="product-card"] h2, all:[class*="product-card"] h3',
    all_urls:   'all:[class*="product-card"] a@href',
    all_prices: 'all:[class*="product-card"] [class*="price"]',
    all_images: 'all:[class*="product-card"] img@src',
  },
};

export const jessopsProduct: ScrapePreset = {
  id: 'jessops-product',
  name: 'Jessops Product',
  category: 'ecommerce',
  description: 'Extracts product title, price, brand, description and images from a Jessops product page.',
  matchDomains: ['jessops.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1[class*="product-title"], h1[class*="product-name"], h1',
    price:          '[class*="selling-price"], [class*="product-price"] [class*="price"], [itemprop="price"]@content',
    original_price: '[class*="was-price"], del[class*="price"], [class*="rrp"]',
    brand:          '[class*="product-brand"], [itemprop="brand"]',
    description:    '[class*="product-description"], [itemprop="description"]',
    in_stock:       'button[class*="add-to-basket"]:not([disabled]), button[class*="add-to-cart"]:not([disabled])',
    images:         'all:[class*="product-gallery"] img@src, all:[class*="product-image"] img@src, all:[itemprop="image"]@src',
  },
  postProcess(raw) {
    return {
      ...raw,
      price:          parsePrice(raw.price as string | null),
      original_price: parsePrice(raw.original_price as string | null),
      in_stock:       !!(raw.in_stock),
      images:         Array.isArray(raw.images) ? (raw.images as string[]).filter(s => s.startsWith('http')) : [],
    };
  },
};
