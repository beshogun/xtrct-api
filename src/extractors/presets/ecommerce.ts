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
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1[class*="product-title"], h1[class*="Title"]' },
  outputFormats: ['structured'],
  selectors: {
    // Currys uses React — classes are stable but may include hash suffixes; prefer attribute selectors where possible
    title:          'h1[class*="product-title"], h1[class*="ProductTitle"], h1[data-component="ProductTitle"]',
    price:          '[class*="price__current"] span, [data-component="PriceBlock"] [class*="current"], [class*="productPrice"] [class*="current"]',
    original_price: '[class*="price__previous"], [data-component="PriceBlock"] [class*="previous"], [class*="was-price"]',
    in_stock:       'button[data-component="AddToBasket"], button[class*="add-to-basket"]:not([disabled]), [class*="availability"][class*="InStock"]',
    brand:          '[class*="brand-name"] a, [data-component="BrandName"], nav[aria-label="breadcrumb"] li:nth-child(3) a',
    mpn:            'td[data-component="SpecValue"]:first-of-type, [class*="spec-table"] tr:first-child td:last-child, [data-spec-key="Model Number"] + td',
    rating:         '[class*="rating__score"], [data-component="RatingScore"], [class*="StarRating"] [class*="score"]',
    review_count:   '[class*="rating__count"], [data-component="ReviewCount"], [class*="review-count"]',
    images:         'all:[class*="product-image"] img@src, all:[data-component="ProductImages"] img@src, all:.swiper-slide img@src',
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

export const johnLewisProduct: ScrapePreset = {
  id: 'johnlewis-product',
  name: 'John Lewis Product',
  category: 'ecommerce',
  description: 'Extracts product title, price (including Was/Now), availability, brand, MPN, rating and images from a John Lewis product page.',
  matchDomains: ['johnlewis.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1[data-testid="product-title"], h1[class*="ProductDetails"]' },
  outputFormats: ['structured'],
  selectors: {
    // John Lewis uses a Next.js front end with data-testid attributes — these tend to be stable
    title:          'h1[data-testid="product-title"], h1[class*="styled__Title"]',
    price:          '[data-testid="product-price"] [class*="price-now"], [data-testid="product-price"] span:first-child',
    original_price: '[data-testid="product-price"] [class*="price-was"], [class*="was-price"], del[class*="price"]',
    in_stock:       'button[data-testid="add-to-bag"]:not([disabled]), [data-testid="add-to-bag"], [class*="AddToBag"]:not([disabled])',
    brand:          '[data-testid="product-brand"], a[href*="/brand/"] h2, [class*="BrandName"]',
    mpn:            '[data-testid="product-code"], [class*="productCode"], [class*="product-code"]',
    rating:         '[data-testid="overall-rating"] [class*="score"], [class*="RatingSummary"] [class*="score"]',
    review_count:   '[data-testid="review-count"], [class*="reviewCount"], a[href*="reviews"] span',
    images:         'all:[data-testid="product-image"] img@src, all:[class*="ProductGallery"] img@src, all:[class*="gallery"] img@src',
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
    price:          '[class*="ProductPrice"] [class*="current"], [itemprop="price"]@content, [class*="price-now"]',
    original_price: '[class*="ProductPrice"] [class*="was"], [class*="price-was"], del[class*="price"]',
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
  waitFor: { type: 'selector', value: 'div[data-asin]:not([data-asin=""])' },
  outputFormats: ['structured'],
  selectors: {
    // data-asin attribute on the result item — use as unique product key
    all_asins:  'all:div[data-asin]:not([data-asin=""])@data-asin',
    all_titles: 'all:div[data-asin]:not([data-asin=""]) h2 a span',
    all_urls:   'all:div[data-asin]:not([data-asin=""]) h2 a@href',
    all_prices: 'all:div[data-asin]:not([data-asin=""]) .a-price .a-offscreen',
    all_images: 'all:div[data-asin]:not([data-asin=""]) img.s-image@src',
    all_brands: 'all:div[data-asin]:not([data-asin=""]) .s-line-clamp-1 h2, all:div[data-asin]:not([data-asin=""]) span.a-size-base-plus',
  },
};

export const currysCategory: ScrapePreset = {
  id: 'currys-category',
  name: 'Currys Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a Currys category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-component="ProductCard"], [class*="product-card"], article[class*="ProductCard"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-component="ProductCard"] [data-component="Title"], all:article[class*="product-card"] h3, all:[class*="ProductCard"] h3',
    all_urls:   'all:[data-component="ProductCard"] a[data-component="Link"]@href, all:article[class*="product-card"] a@href, all:[class*="ProductCard"] a[class*="link"]@href',
    all_prices: 'all:[data-component="ProductCard"] [data-component="PriceBlock"] [class*="current"], all:article[class*="product-card"] [class*="price-current"]',
    all_images: 'all:[data-component="ProductCard"] img@src, all:article[class*="product-card"] img@src',
  },
};

export const argosCategory: ScrapePreset = {
  id: 'argos-category',
  name: 'Argos Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from an Argos category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="product-card"], [class*="ProductCard"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-test="product-card"] [data-test="product-title"], all:[data-test="product-card"] h3',
    all_urls:   'all:[data-test="product-card"] a[data-test="component-link"]@href, all:[data-test="product-card"] a@href',
    all_prices: 'all:[data-test="product-card"] [data-test="price-display"], all:[data-test="product-card"] [class*="PriceDisplay"]',
    all_images: 'all:[data-test="product-card"] img[data-test="product-tile-image"]@src, all:[data-test="product-card"] img@src',
  },
};

export const johnLewisCategory: ScrapePreset = {
  id: 'johnlewis-category',
  name: 'John Lewis Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from a John Lewis category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-testid="product-card-anchor"], [class*="ProductCard"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-testid="product-card-anchor"] [class*="ProductTitle"], all:[data-testid="product-card-anchor"] h2, all:[class*="ProductCard"] h2',
    all_urls:   'all:a[data-testid="product-card-anchor"]@href, all:[class*="ProductCard"] a[data-testid]@href',
    all_prices: 'all:[data-testid="product-card-anchor"] [data-testid="price"], all:[data-testid="product-card-anchor"] [class*="price"]',
    all_images: 'all:[data-testid="product-card-anchor"] img@src, all:[class*="ProductCard"] img@src',
  },
};

export const aoCategory: ScrapePreset = {
  id: 'ao-category',
  name: 'AO.com Category Listing',
  category: 'ecommerce',
  description: 'Discovers product listings from an AO.com category page.',
  matchDomains: [],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[class*="product-tile"], [class*="ProductTile"], [data-testid="product-tile"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[class*="product-tile"] [class*="product-name"], all:[class*="product-tile"] h2, all:[data-testid="product-tile"] h3',
    all_urls:   'all:[class*="product-tile"] a@href, all:[data-testid="product-tile"] a@href',
    all_prices: 'all:[class*="product-tile"] [class*="price"], all:[data-testid="product-tile"] [class*="price"]',
    all_images: 'all:[class*="product-tile"] img@src, all:[data-testid="product-tile"] img@src',
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
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-testid="product-block"], [class*="ProductBlock"]' },
  outputFormats: ['structured'],
  selectors: {
    all_titles: 'all:[data-testid="product-block"] [data-testid="product-name"], all:[class*="ProductBlock"] h3',
    all_urls:   'all:[data-testid="product-block"] a@href, all:[class*="ProductBlock"] a@href',
    all_prices: 'all:[data-testid="product-block"] [data-testid="product-price"], all:[class*="ProductBlock"] [class*="price"]',
    all_images: 'all:[data-testid="product-block"] img@src, all:[class*="ProductBlock"] img@src',
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
