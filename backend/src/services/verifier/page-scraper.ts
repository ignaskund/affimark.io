/**
 * Page Scraper for Product Verifier
 *
 * Uses Cloudflare Browser Rendering to extract product data from URLs.
 * Falls back to simple fetch for static pages.
 * Caches results in product_scrape_cache (24h TTL).
 */

import { createClient } from '@supabase/supabase-js';
import type { Env } from '../../index';
import type { PlatformType } from './url-normalizer';

export interface ScrapedProductData {
  title: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: {
    amount: number | null;
    currency: string;
    original_amount: number | null; // if on sale
  };
  rating: number | null;
  review_count: number | null;
  availability: string | null;
  image_url: string | null;
  variants: Array<{ name: string; price?: number; available?: boolean }>;
  claims: string[]; // badges, labels like "Best Seller", "Amazon's Choice"
  seller_name: string | null;
  region_availability: string[];
  raw_meta: Record<string, string>;
}

interface CacheEntry {
  normalized_url: string;
  platform: string | null;
  extracted_data: ScrapedProductData;
  scraped_at: string;
  expires_at: string;
}

/**
 * Scrape product data from a URL with caching
 */
export async function scrapeProductPage(
  normalizedUrl: string,
  platform: PlatformType,
  env: Env
): Promise<ScrapedProductData> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Check cache first
  const cached = await getCachedScrape(normalizedUrl, supabase);
  if (cached) return cached;

  // Try Browser Rendering first (for JS-heavy sites), fall back to fetch
  let html: string;
  try {
    html = await fetchWithBrowser(normalizedUrl, env);
  } catch {
    html = await fetchSimple(normalizedUrl);
  }

  // Extract product data from HTML
  const data = extractProductData(html, platform, normalizedUrl);

  // Cache the result
  await cacheScrape(normalizedUrl, platform, data, supabase);

  return data;
}

/**
 * Fetch page using Cloudflare Browser Rendering
 */
async function fetchWithBrowser(url: string, env: Env): Promise<string> {
  if (!env.BROWSER) {
    throw new Error('Browser Rendering not available');
  }

  // Use Cloudflare Browser Rendering API
  // @ts-ignore - Cloudflare Browser binding
  const browser = await env.BROWSER.connect();

  try {
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait briefly for dynamic content
    await page.waitForTimeout(2000);

    const html = await page.content();
    await page.close();
    return html;
  } finally {
    await browser.disconnect();
  }
}

/**
 * Simple fetch fallback for static pages
 */
async function fetchSimple(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Extract product data from HTML using platform-specific and generic parsers
 */
function extractProductData(
  html: string,
  platform: PlatformType,
  url: string
): ScrapedProductData {
  const data: ScrapedProductData = {
    title: null,
    brand: null,
    category: null,
    description: null,
    price: { amount: null, currency: 'EUR', original_amount: null },
    rating: null,
    review_count: null,
    availability: null,
    image_url: null,
    variants: [],
    claims: [],
    seller_name: null,
    region_availability: [],
    raw_meta: {},
  };

  // Extract meta tags first (most reliable across all platforms)
  extractMetaTags(html, data);

  // Platform-specific extraction
  switch (platform) {
    case 'amazon':
      extractAmazonData(html, data);
      break;
    case 'zalando':
      extractZalandoData(html, data);
      break;
    case 'shopify':
      extractShopifyData(html, data);
      break;
    default:
      extractGenericData(html, data);
      break;
  }

  // Try JSON-LD structured data (works across many platforms)
  extractJsonLd(html, data);

  // Detect currency from URL domain
  if (!data.price.currency || data.price.currency === 'EUR') {
    data.price.currency = detectCurrencyFromUrl(url);
  }

  return data;
}

/**
 * Extract Open Graph and standard meta tags
 */
function extractMetaTags(html: string, data: ScrapedProductData): void {
  const metaPatterns: Array<{ pattern: RegExp; field: keyof ScrapedProductData | string }> = [
    { pattern: /og:title['"]\s*content=['"](.*?)['"]/i, field: 'title' },
    { pattern: /og:description['"]\s*content=['"](.*?)['"]/i, field: 'description' },
    { pattern: /og:image['"]\s*content=['"](.*?)['"]/i, field: 'image_url' },
    { pattern: /product:price:amount['"]\s*content=['"]([\d.,]+)['"]/i, field: 'price_amount' },
    { pattern: /product:price:currency['"]\s*content=['"](.*?)['"]/i, field: 'price_currency' },
    { pattern: /product:brand['"]\s*content=['"](.*?)['"]/i, field: 'brand' },
  ];

  for (const { pattern, field } of metaPatterns) {
    const match = html.match(pattern);
    if (!match) continue;

    const value = decodeHtmlEntities(match[1].trim());

    if (field === 'title' && !data.title) data.title = value;
    if (field === 'description' && !data.description) data.description = value;
    if (field === 'image_url' && !data.image_url) data.image_url = value;
    if (field === 'brand' && !data.brand) data.brand = value;
    if (field === 'price_amount') {
      const price = parsePrice(value);
      if (price !== null && !data.price.amount) data.price.amount = price;
    }
    if (field === 'price_currency') {
      data.price.currency = value.toUpperCase();
    }

    data.raw_meta[field] = value;
  }

  // Also try <title> tag
  if (!data.title) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      data.title = decodeHtmlEntities(titleMatch[1].trim());
    }
  }
}

/**
 * Extract JSON-LD structured data (Schema.org Product)
 */
function extractJsonLd(html: string, data: ScrapedProductData): void {
  const jsonLdRegex = /<script[^>]*type=['"]\s*application\/ld\+json\s*['"]\s*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      const products = findProductInJsonLd(parsed);

      for (const product of products) {
        if (!data.title && product.name) data.title = product.name;
        if (!data.brand && product.brand?.name) data.brand = product.brand.name;
        if (!data.brand && typeof product.brand === 'string') data.brand = product.brand;
        if (!data.description && product.description) data.description = product.description;
        if (!data.image_url && product.image) {
          data.image_url = Array.isArray(product.image) ? product.image[0] : product.image;
        }

        // Rating
        if (!data.rating && product.aggregateRating?.ratingValue) {
          data.rating = parseFloat(product.aggregateRating.ratingValue);
        }
        if (!data.review_count && product.aggregateRating?.reviewCount) {
          data.review_count = parseInt(product.aggregateRating.reviewCount, 10);
        }

        // Price from offers
        const offers = product.offers;
        if (offers && !data.price.amount) {
          if (Array.isArray(offers)) {
            const offer = offers[0];
            data.price.amount = parsePrice(offer?.price);
            if (offer?.priceCurrency) data.price.currency = offer.priceCurrency;
            if (offer?.availability) data.availability = normalizeAvailability(offer.availability);
          } else {
            data.price.amount = parsePrice(offers.price || offers.lowPrice);
            if (offers.priceCurrency) data.price.currency = offers.priceCurrency;
            if (offers.availability) data.availability = normalizeAvailability(offers.availability);
          }
        }

        // Category
        if (!data.category && product.category) {
          data.category = typeof product.category === 'string'
            ? product.category
            : product.category?.name || null;
        }
      }
    } catch {
      // JSON parse failed, skip this block
    }
  }
}

/**
 * Recursively find Product objects in JSON-LD
 */
function findProductInJsonLd(obj: any): any[] {
  const products: any[] = [];

  if (!obj) return products;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      products.push(...findProductInJsonLd(item));
    }
    return products;
  }

  if (typeof obj === 'object') {
    const type = obj['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
      products.push(obj);
    }
    // Check @graph
    if (obj['@graph']) {
      products.push(...findProductInJsonLd(obj['@graph']));
    }
  }

  return products;
}

/**
 * Amazon-specific data extraction
 */
function extractAmazonData(html: string, data: ScrapedProductData): void {
  // Title from #productTitle
  if (!data.title) {
    const titleMatch = html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
    if (titleMatch) data.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Brand from #bylineInfo or brand link
  if (!data.brand) {
    const brandMatch = html.match(/id="bylineInfo"[^>]*>.*?(?:Visit the |Brand: )(.*?)(?:<| Store)/is);
    if (brandMatch) data.brand = decodeHtmlEntities(brandMatch[1].trim());
  }

  // Price
  if (!data.price.amount) {
    // Look for price whole + fraction pattern
    const priceMatch = html.match(/class="a-price-whole"[^>]*>([\d,.]+)<.*?class="a-price-fraction"[^>]*>(\d+)</s);
    if (priceMatch) {
      const whole = priceMatch[1].replace(/[.,]/g, '');
      const fraction = priceMatch[2];
      data.price.amount = parseFloat(`${whole}.${fraction}`);
    }
  }

  // Rating
  if (!data.rating) {
    const ratingMatch = html.match(/(\d[.,]\d)\s*(?:out of|von)\s*5/i);
    if (ratingMatch) data.rating = parseFloat(ratingMatch[1].replace(',', '.'));
  }

  // Review count
  if (!data.review_count) {
    const reviewMatch = html.match(/id="acrCustomerReviewText"[^>]*>([\d.,]+)/i);
    if (reviewMatch) data.review_count = parseInt(reviewMatch[1].replace(/[.,]/g, ''), 10);
  }

  // Badges/Claims
  const badges = [
    /class="[^"]*bestseller[^"]*"/i,
    /Amazon.*?s\s*Choice/i,
    /Climate Pledge Friendly/i,
    /(\d+[Kk]?\+)\s*bought\s+in\s+past\s+month/i,
  ];
  for (const badge of badges) {
    const match = html.match(badge);
    if (match) {
      if (match[1]) {
        data.claims.push(`${match[1]} bought in past month`);
      } else {
        const text = match[0].replace(/<[^>]+>/g, '').trim().substring(0, 50);
        if (text) data.claims.push(text);
      }
    }
  }

  // Availability
  if (!data.availability) {
    const availMatch = html.match(/id="availability"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    if (availMatch) {
      const text = availMatch[1].replace(/<[^>]+>/g, '').trim();
      data.availability = text.toLowerCase().includes('in stock') ? 'in_stock' : 'out_of_stock';
    }
  }
}

/**
 * Zalando-specific data extraction
 */
function extractZalandoData(html: string, data: ScrapedProductData): void {
  // Zalando uses heavily structured JSON-LD, handled by extractJsonLd
  // Additional extraction for Zalando-specific fields

  // Brand from data attribute
  if (!data.brand) {
    const brandMatch = html.match(/data-brand-name=['"](.*?)['"]/i);
    if (brandMatch) data.brand = decodeHtmlEntities(brandMatch[1]);
  }
}

/**
 * Shopify-specific data extraction
 */
function extractShopifyData(html: string, data: ScrapedProductData): void {
  // Shopify stores often have product JSON in a script tag
  const shopifyJsonMatch = html.match(/var\s+meta\s*=\s*(\{[\s\S]*?\});\s*(?:for|var|<\/script)/);
  if (shopifyJsonMatch) {
    try {
      const meta = JSON.parse(shopifyJsonMatch[1]);
      if (meta.product) {
        if (!data.title) data.title = meta.product.title;
        if (!data.brand) data.brand = meta.product.vendor;
        if (!data.category) data.category = meta.product.type;
      }
    } catch {
      // parse failed
    }
  }

  // Also look for Shopify product JSON
  const productJsonMatch = html.match(/product:\s*(\{[\s\S]*?\})\s*,?\s*(?:collection|template)/);
  if (productJsonMatch) {
    try {
      const product = JSON.parse(productJsonMatch[1]);
      if (!data.title) data.title = product.title;
      if (!data.brand) data.brand = product.vendor;
      if (product.variants && Array.isArray(product.variants)) {
        data.variants = product.variants.map((v: any) => ({
          name: v.title || v.name,
          price: v.price ? v.price / 100 : undefined, // Shopify prices in cents
          available: v.available,
        }));
      }
    } catch {
      // parse failed
    }
  }
}

/**
 * Generic data extraction for unknown platforms
 */
function extractGenericData(html: string, data: ScrapedProductData): void {
  // Try common price patterns
  if (!data.price.amount) {
    const pricePatterns = [
      /class="[^"]*price[^"]*"[^>]*>[^<]*?([\d]+[.,]\d{2})/i,
      /itemprop="price"[^>]*content=['"]([\d.,]+)['"]/i,
      /data-price=['"]([\d.,]+)['"]/i,
    ];
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        data.price.amount = parsePrice(match[1]);
        if (data.price.amount) break;
      }
    }
  }

  // Try common rating patterns
  if (!data.rating) {
    const ratingMatch = html.match(/itemprop="ratingValue"[^>]*content=['"]([\d.,]+)['"]/i);
    if (ratingMatch) data.rating = parseFloat(ratingMatch[1].replace(',', '.'));
  }

  // Try common review count patterns
  if (!data.review_count) {
    const countMatch = html.match(/itemprop="reviewCount"[^>]*content=['"]([\d]+)['"]/i);
    if (countMatch) data.review_count = parseInt(countMatch[1], 10);
  }
}

// --- Utility Functions ---

function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  // Handle European format (1.234,56) and US format (1,234.56)
  const cleaned = value.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // If has both . and , figure out which is decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European: 1.234,56
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    // US: 1,234.56
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  if (cleaned.includes(',')) {
    // Could be European decimal or US thousands separator
    const parts = cleaned.split(',');
    if (parts[parts.length - 1].length === 2) {
      // Likely European decimal: 234,56
      return parseFloat(cleaned.replace(',', '.'));
    }
    // Likely US thousands: 1,234
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  return parseFloat(cleaned);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAvailability(schemaAvailability: string): string {
  const lower = schemaAvailability.toLowerCase();
  if (lower.includes('instock') || lower.includes('in_stock')) return 'in_stock';
  if (lower.includes('outofstock') || lower.includes('out_of_stock')) return 'out_of_stock';
  if (lower.includes('preorder')) return 'preorder';
  if (lower.includes('limited')) return 'limited';
  return 'unknown';
}

function detectCurrencyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('.de') || hostname.includes('.fr') || hostname.includes('.it') ||
        hostname.includes('.es') || hostname.includes('.nl') || hostname.includes('.at')) return 'EUR';
    if (hostname.includes('.co.uk')) return 'GBP';
    if (hostname.includes('.com') && !hostname.includes('.com.')) return 'USD';
    if (hostname.includes('.se')) return 'SEK';
    if (hostname.includes('.dk')) return 'DKK';
    if (hostname.includes('.pl')) return 'PLN';
    if (hostname.includes('.ch')) return 'CHF';
    return 'EUR'; // Default for EU-first platform
  } catch {
    return 'EUR';
  }
}

// --- Cache Functions ---

async function getCachedScrape(normalizedUrl: string, supabase: any): Promise<ScrapedProductData | null> {
  try {
    const { data } = await supabase
      .from('product_scrape_cache')
      .select('extracted_data, expires_at')
      .eq('normalized_url', normalizedUrl)
      .single();

    if (!data) return null;

    // Check expiration
    if (new Date(data.expires_at) < new Date()) return null;

    return data.extracted_data as ScrapedProductData;
  } catch {
    return null;
  }
}

async function cacheScrape(
  normalizedUrl: string,
  platform: PlatformType,
  data: ScrapedProductData,
  supabase: any
): Promise<void> {
  try {
    await supabase
      .from('product_scrape_cache')
      .upsert({
        normalized_url: normalizedUrl,
        platform,
        extracted_data: data,
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: 'normalized_url',
      });
  } catch {
    // Cache write failure is non-critical
  }
}
