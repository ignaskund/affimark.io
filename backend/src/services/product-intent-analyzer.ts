/**
 * Product Intent Analyzer
 * Uses AI to extract category, brand, and search intent from product URLs
 */

import { aiComplete, extractJson } from './ai-client';

export interface ProductIntent {
  category: string; // "Electronics", "Home & Garden", etc.
  subcategory?: string; // "Table Lamps", "Wireless Headphones", etc.
  brand?: string; // "Philips", "Sony", "Apple", etc.
  priceRange?: 'budget' | 'mid-range' | 'premium';
  keywords: string[]; // ["smart", "LED", "dimmable"]
  searchQuery: string; // "smart LED desk lamp"
  confidence: number; // 0-100
}

/**
 * Analyze a product URL and extract search intent using AI
 */
export async function analyzeProductIntent(url: string, env?: any): Promise<ProductIntent> {
  console.log('[Intent Analyzer] Analyzing URL:', url);

  const apiKey = env?.OPENAI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);

  if (!apiKey) {
    console.warn('[Intent Analyzer] No OPENAI_API_KEY in env — AI analysis skipped');
  }

  const isAmazonUrl = /amazon\.[a-z.]+/i.test(url);

  // ── AMAZON URLS: Enrich first to get the real product title ──────────
  // OpenAI cannot visit URLs. A bare /dp/ASIN URL has zero product info in it.
  // Always resolve the actual product name before feeding anything to AI.
  if (isAmazonUrl) {
    try {
      const enrichedIntent = await enrichAmazonIntent(url, env);
      if (enrichedIntent && enrichedIntent.confidence > 30) {
        console.log('[Intent Analyzer] Amazon enrichment got product:', enrichedIntent.searchQuery);

        // Upgrade with AI now that we have a real product name to analyse
        if (apiKey && enrichedIntent.searchQuery) {
          try {
            const aiUpgraded = await analyzeWithAITitle(enrichedIntent.searchQuery, apiKey);
            if (aiUpgraded.confidence >= 60) {
              const merged: ProductIntent = {
                ...enrichedIntent,
                category: aiUpgraded.category || enrichedIntent.category,
                subcategory: aiUpgraded.subcategory || enrichedIntent.subcategory,
                brand: enrichedIntent.brand || aiUpgraded.brand,
                priceRange: aiUpgraded.priceRange || enrichedIntent.priceRange,
                keywords: aiUpgraded.keywords?.length ? aiUpgraded.keywords : enrichedIntent.keywords,
                searchQuery: aiUpgraded.searchQuery || enrichedIntent.searchQuery,
                confidence: 90,
              };
              console.log('[Intent Analyzer] AI-upgraded intent:', merged);
              return merged;
            }
          } catch (err) {
            console.warn('[Intent Analyzer] AI upgrade failed, using enriched intent:', err);
          }
        }

        return enrichedIntent;
      }
    } catch (error) {
      console.error('[Intent Analyzer] Amazon enrichment failed:', error);
    }
  }

  // ── NON-AMAZON URLS: AI can extract intent from meaningful URL structure ─
  // e.g. /products/sony-wh1000xm5-noise-cancelling or /nike-air-max-270
  if (apiKey) {
    try {
      const aiIntent = await analyzeWithAI(url, apiKey);
      if (aiIntent.confidence >= 60) {
        console.log('[Intent Analyzer] AI URL analysis successful:', aiIntent);
        return aiIntent;
      }
    } catch (error) {
      console.error('[Intent Analyzer] AI analysis failed:', error);
    }
  }

  // ── FINAL FALLBACK: parse whatever we can from URL structure ─────────
  console.log('[Intent Analyzer] Using URL structure fallback');
  return analyzeFromUrlStructure(url);
}

/**
 * Use AI to extract structured search intent from a PRODUCT TITLE.
 * This is the primary AI path — always called with a real product name,
 * never with a raw URL containing no product info.
 */
async function analyzeWithAITitle(productTitle: string, apiKey: string): Promise<ProductIntent> {
  const prompt = `You are a product search expert for an affiliate marketing platform. Given a product title, your job is to produce a precise search query that will find genuinely similar products in an affiliate product database.

Product: "${productTitle}"

CRITICAL RULES for searchQuery:
- Must be a SPECIFIC product type, never a generic category
- 2-4 words MAX
- NO brand names
- Examples of GOOD queries: "lavender essential oil", "wireless noise-cancelling headphones", "retinol face serum", "bluetooth selfie stick", "yoga mat thick non-slip"
- Examples of BAD queries: "beauty", "electronics", "body care", "health product", "lifestyle item"
- The query must describe WHAT THE PRODUCT IS, not what category it belongs to

Extract:
1. category: one of Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors, Toys & Games, Books & Media, Food & Beverage, Automotive, Pet Supplies, Office & School, Arts & Crafts
2. subcategory: very specific type, e.g. "Essential Oils", "Noise-Cancelling Headphones", "Retinol Serum", "Resistance Bands"
3. brand: recognised brand from title, or null
4. priceRange: "budget" / "mid-range" / "premium"
5. keywords: 3-5 specific product attributes e.g. ["organic", "100ml", "citrus scent"]
6. searchQuery: the 2-4 word specific product type query (see rules above)
7. confidence: 0-100

Return ONLY valid JSON:
{
  "category": "...",
  "subcategory": "...",
  "brand": "...",
  "priceRange": "budget|mid-range|premium",
  "keywords": ["...", "..."],
  "searchQuery": "...",
  "confidence": 90
}`;

  const text = await aiComplete({ prompt, maxTokens: 300, apiKey });
  const intent = extractJson(text);

  if (!intent || !intent.category || !intent.searchQuery) {
    throw new Error('Invalid intent structure from AI title analysis');
  }

  return intent;
}

/**
 * Use AI (GPT-4o-mini) to extract intent from a product URL.
 * Only useful when the URL path contains readable product information
 * (e.g. /nike-air-max-270-running-shoes or /products/sony-headphones).
 * Do NOT call this with bare Amazon /dp/ASIN URLs — they have no product info.
 */
async function analyzeWithAI(url: string, apiKey: string): Promise<ProductIntent> {
  const prompt = `You are a product search expert for an affiliate marketing platform. Analyze this product URL and extract a precise search query to find similar products.

URL: ${url}

CRITICAL RULES for searchQuery:
- Must be a SPECIFIC product type, never a generic category word
- 2-4 words MAX, NO brand names
- Good: "retinol face serum", "wireless earbuds", "yoga mat", "selfie stick bluetooth"
- Bad: "beauty", "electronics", "health", "lifestyle product"
- If you cannot identify the specific product type from the URL, set confidence below 50

Extract:
1. category: Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors, Toys & Games, Books & Media, Food & Beverage, Automotive, Pet Supplies, Office & School, Arts & Crafts
2. subcategory: specific product type e.g. "Face Serum", "Wireless Earbuds", "Running Shoes"
3. brand: only if clearly in URL path, else null
4. priceRange: "budget" / "mid-range" / "premium"
5. keywords: specific attributes from URL slug
6. searchQuery: 2-4 word specific product type (see rules)
7. confidence: 0-100 (low if URL has no readable product name)

Return ONLY valid JSON:
{
  "category": "...",
  "subcategory": "...",
  "brand": "...",
  "priceRange": "budget|mid-range|premium",
  "keywords": ["...", "..."],
  "searchQuery": "...",
  "confidence": 85
}`;

  const text = await aiComplete({ prompt, maxTokens: 300, apiKey });
  const intent = extractJson(text);

  if (!intent || !intent.category || !intent.searchQuery) {
    throw new Error('Invalid intent structure from AI');
  }

  return intent;
}

/**
 * Enrich Amazon URL with product data.
 *
 * Attempts in order:
 *   1. Rainforest API (if key present)
 *   2. URL slug extraction (e.g. /Sony-WH-1000XM5/dp/ASIN)
 *   3. Amazon page scrape (clean URL, robust headers)
 *
 * Returns null only if ALL methods fail.
 */
async function enrichAmazonIntent(url: string, env?: any): Promise<ProductIntent | null> {
  const asinMatch = url.match(/(?:\/dp\/|\/gp\/product\/|\/ASIN\/)([A-Z0-9]{10})/i);
  if (!asinMatch) return null;

  const asin = asinMatch[1];
  console.log(`[Intent Analyzer] Amazon ASIN detected: ${asin}`);

  // ── 1. Rainforest API ────────────────────────────────────────────
  if (env?.RAINFOREST_API_KEY) {
    try {
      const rfResponse = await fetch(
        `https://api.rainforestapi.com/request?api_key=${env.RAINFOREST_API_KEY}&type=product&asin=${asin}&amazon_domain=amazon.com`
      );
      if (rfResponse.ok) {
        const data: any = await rfResponse.json();
        const product = data?.product;
        if (product?.title) {
          console.log(`[Intent Analyzer] Rainforest enrichment: "${product.title}"`);
          const categoryName = product.categories?.[0]?.name || 'General';
          const mappedCategory = mapAmazonCategory(categoryName);
          const searchQuery = buildSearchQuery(product.title, product.brand);
          return {
            category: mappedCategory,
            subcategory: categoryName,
            brand: product.brand || inferBrandFromTitle(product.title) || undefined,
            priceRange: inferPriceRange(product.buybox_winner?.price?.value),
            keywords: extractKeywordsFromTitle(product.title),
            searchQuery,
            confidence: 85,
          };
        }
      }
    } catch (error) {
      console.error('[Intent Analyzer] Rainforest API failed:', error);
    }
  }

  // ── 1.5. Keepa API (free tier, no account needed for basic lookups) ─
  // Keepa provides Amazon product data and has a generous free tier.
  // Falls back gracefully if unavailable.
  if (env?.KEEPA_API_KEY) {
    try {
      const keepaRes = await fetch(
        `https://api.keepa.com/product?key=${env.KEEPA_API_KEY}&domain=1&asin=${asin}&stats=0&offers=0`
      );
      if (keepaRes.ok) {
        const keepaData: any = await keepaRes.json();
        const product = keepaData?.products?.[0];
        const title = product?.title;
        if (title && title.length > 5) {
          console.log(`[Intent Analyzer] Keepa enrichment: "${title}"`);
          const categoryName = product?.categoryTree?.[0]?.name || 'General';
          const mappedCategory = mapAmazonCategory(categoryName);
          const brand = product?.brand;
          return {
            category: mappedCategory,
            subcategory: categoryName,
            brand: brand || inferBrandFromTitle(title) || undefined,
            priceRange: 'mid-range',
            keywords: extractKeywordsFromTitle(title),
            searchQuery: buildSearchQuery(title, brand),
            confidence: 85,
          };
        }
      }
    } catch (error) {
      console.error('[Intent Analyzer] Keepa API failed:', error);
    }
  }

  // ── 2. URL slug extraction ───────────────────────────────────────
  // Amazon URLs often contain the product name before /dp/:
  //   /Sony-WH-1000XM5-Noise-Cancelling-Headphones/dp/B09XS7JWHH
  const slugIntent = extractIntentFromAmazonSlug(url, asin);
  if (slugIntent) {
    console.log(`[Intent Analyzer] URL slug extraction: "${slugIntent.searchQuery}"`);
    return slugIntent;
  }

  // ── 3. Amazon page scrape ────────────────────────────────────────
  // Strip tracking params and use a clean canonical URL for better success rate
  const cleanUrl = `https://www.amazon.com/dp/${asin}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const pageResponse = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (pageResponse.ok) {
      const html = await pageResponse.text();

      // Try multiple extraction strategies
      const productTitleMatch = html.match(/id="productTitle"[^>]*>\s*([^<]+)/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      const jsonLdMatch = html.match(/"name"\s*:\s*"([^"]{10,200})"/);

      const rawTitle = (
        productTitleMatch?.[1]?.trim() ||
        ogTitleMatch?.[1]?.trim() ||
        jsonLdMatch?.[1]?.trim() ||
        titleMatch?.[1]?.trim() ||
        ''
      );

      if (rawTitle && rawTitle.length > 5) {
        const cleanTitle = rawTitle
          .replace(/^Amazon\.\w+\s*:\s*/i, '')
          .replace(/\s*[-–|]\s*Amazon\.\w+.*$/i, '')
          .trim();

        // Reject generic/garbage titles that aren't actual product names
        const isGarbageTitle = isGenericPageTitle(cleanTitle);

        if (cleanTitle.length > 10 && !isGarbageTitle) {
          console.log(`[Intent Analyzer] Page scrape title: "${cleanTitle}"`);
          const searchQuery = buildSearchQuery(cleanTitle, undefined);
          const inferredBrand = inferBrandFromTitle(cleanTitle);

          const breadcrumbMatch = html.match(/class="a-link-normal a-color-tertiary"[^>]*>([^<]+)/g);
          let category = 'General';
          if (breadcrumbMatch && breadcrumbMatch.length > 0) {
            const firstCrumb = breadcrumbMatch[0].replace(/<[^>]+>/g, '').trim();
            if (firstCrumb) category = mapAmazonCategory(firstCrumb);
          }

          return {
            category,
            subcategory: '',
            brand: inferredBrand,
            priceRange: 'mid-range',
            keywords: extractKeywordsFromTitle(cleanTitle),
            searchQuery,
            confidence: 60,
          };
        } else {
          console.warn(`[Intent Analyzer] Rejected garbage title: "${cleanTitle}"`);
        }
      }

      console.warn(`[Intent Analyzer] Page fetched but no title extracted (HTML length: ${html.length})`);
    } else {
      console.warn(`[Intent Analyzer] Amazon page returned ${pageResponse.status}`);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn('[Intent Analyzer] Amazon page scrape timed out');
    } else {
      console.error('[Intent Analyzer] Page scrape failed:', error?.message || error);
    }
  } finally {
    clearTimeout(timer);
  }

  // ── 4. Last resort: Datafeedr SKU lookup for the ASIN ─────────────
  // If we can find the product in Datafeedr by SKU/any, use its name as the query
  if (env?.DATAFEEDR_ACCESS_ID && env?.DATAFEEDR_SECRET_KEY) {
    try {
      const { searchDatafeedr } = await import('./datafeedr-client');

      // Try SKU exact match first, then any-field
      for (const rawFilter of [`sku = ${asin}`, `any LIKE ${asin}`]) {
        const res = await searchDatafeedr(
          { query: '', rawFilters: [rawFilter], limit: 1 },
          env.DATAFEEDR_ACCESS_ID,
          env.DATAFEEDR_SECRET_KEY,
        );
        const product = res.products?.[0];
        if (product?.name) {
          console.log(`[Intent Analyzer] Datafeedr ASIN lookup found: "${product.name}"`);
          const searchQuery = buildSearchQuery(product.name, product.brand);
          const inferredBrand = product.brand || inferBrandFromTitle(product.name);
          const category = product.category ? mapAmazonCategory(product.category) : 'General';
          return {
            category,
            subcategory: product.category || '',
            brand: inferredBrand,
            priceRange: inferPriceRange(product.finalprice ? product.finalprice / 100 : undefined),
            keywords: extractKeywordsFromTitle(product.name),
            searchQuery,
            confidence: 70,
          };
        }
      }
    } catch (error) {
      console.error('[Intent Analyzer] Datafeedr ASIN lookup failed:', error);
    }
  }

  // ── 5. AI ASIN knowledge lookup ───────────────────────────────────
  // OpenAI was trained on Amazon product data and knows many ASINs.
  // Ask it directly: "What product is ASIN X?" — this is far more reliable
  // than asking it to analyse a bare /dp/ASIN URL with no product info.
  const aiKey = env?.OPENAI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);

  if (aiKey) {
    try {
      const lookupText = await aiComplete({
        prompt: `What Amazon product has ASIN ${asin}?
If you know the product, return JSON. If you don't know, set confidence to 0.

Return ONLY valid JSON:
{
  "productName": "full product title",
  "brand": "brand name or null",
  "category": "one of: Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors, Toys & Games, Books & Media, Food & Beverage, Automotive, Pet Supplies, Office & School, Arts & Crafts",
  "subcategory": "specific subcategory e.g. Essential Oils, Wireless Headphones",
  "searchQuery": "3-5 word query to find similar products (no brand name)",
  "confidence": 0
}`,
        maxTokens: 200,
        apiKey: aiKey,
      });

      const parsed = extractJson(lookupText);
      if (parsed && parsed.confidence > 30 && parsed.searchQuery && parsed.productName) {
        console.log(`[Intent Analyzer] AI ASIN lookup: "${parsed.productName}" → query: "${parsed.searchQuery}"`);
        return {
          category: parsed.category || 'General',
          subcategory: parsed.subcategory || '',
          brand: parsed.brand || inferBrandFromTitle(parsed.productName),
          priceRange: 'mid-range',
          keywords: extractKeywordsFromTitle(parsed.productName),
          searchQuery: parsed.searchQuery,
          confidence: parsed.confidence,
        };
      }
    } catch (error) {
      console.error('[Intent Analyzer] AI ASIN lookup failed:', error);
    }
  }

  // ── 6. All methods exhausted ────────────────────────────────────
  console.warn(`[Intent Analyzer] All enrichment methods failed for ASIN ${asin}`);
  return {
    category: 'General',
    subcategory: '',
    brand: undefined,
    priceRange: 'mid-range',
    keywords: [],
    searchQuery: asin,
    confidence: 10,
  };
}

/**
 * Extract a meaningful product name from the Amazon URL slug.
 * Works for URLs like: /Sony-WH-1000XM5-Cancelling-Headphones/dp/B09XS7JWHH
 */
function extractIntentFromAmazonSlug(url: string, asin: string): ProductIntent | null {
  try {
    const pathname = new URL(url).pathname;
    // Match the slug before /dp/ASIN
    const slugMatch = pathname.match(/\/([^/]{5,})\/dp\//i);
    if (!slugMatch) return null;

    const slug = slugMatch[1];
    // Convert hyphens to spaces and filter out noise
    const words = slug
      .split('-')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (words.length < 2) return null;

    // Skip if the slug is just the ASIN or random IDs
    if (words.length === 1 && /^[A-Z0-9]{10}$/i.test(words[0])) return null;

    const title = words.join(' ');
    const searchQuery = buildSearchQuery(title, undefined);
    const inferredBrand = inferBrandFromTitle(title);

    console.log(`[Intent Analyzer] Amazon slug: "${slug}" → query: "${searchQuery}"`);

    return {
      category: 'General',
      subcategory: '',
      brand: inferredBrand,
      priceRange: 'mid-range',
      keywords: extractKeywordsFromTitle(title),
      searchQuery,
      confidence: 50,
    };
  } catch {
    return null;
  }
}

/**
 * Detect titles that are generic page names rather than actual product titles.
 * Amazon serves these when bot-detection triggers or the product page redirects.
 */
function isGenericPageTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  const garbage = [
    /^amazon\.\w+$/,           // "Amazon.com", "Amazon.de"
    /^amazon$/,
    /^sign\s*in/,
    /^log\s*in/,
    /^page\s*not\s*found/,
    /^404/,
    /^error/,
    /^access\s*denied/,
    /^robot\s*check/,
    /^captcha/,
    /^sorry/,
    /^unavailable/,
    /^something\s*went\s*wrong/,
    /^just\s*a\s*moment/,      // Cloudflare challenge
    /^attention\s*required/,
    /^online\s*shopping/,       // Amazon generic homepage title
    /^shop\s*now/,
  ];
  return garbage.some(rx => rx.test(lower));
}

function inferBrandFromTitle(title: string): string | undefined {
  const cleaned = title
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;

  const lowerTitle = cleaned.toLowerCase();
  const cutoffWords = new Set([
    'hydrating', 'lip', 'balm', 'gloss', 'set', 'kit', 'pack', 'gift', 'with',
    'for', 'by', 'the', 'and', 'shade', 'color', 'size',
  ]);
  const words = cleaned.split(' ');
  const brandParts: string[] = [];

  for (let i = 0; i < words.length && i < 3; i += 1) {
    const word = words[i];
    const lowerWord = word.toLowerCase();
    if (/^\d/.test(lowerWord)) break;
    if (/(pack|set|bundle|kit)$/.test(lowerWord)) break;
    if (cutoffWords.has(lowerWord)) break;
    // stop when title starts with generic product words
    if (i === 0 && ['set', 'pack', 'bundle', 'collection'].includes(lowerWord)) break;
    brandParts.push(word);
  }

  if (brandParts.length === 0) return undefined;
  const candidate = brandParts.join(' ').trim();
  if (candidate.length < 3) return undefined;
  if (candidate.length > 30) return undefined;
  if (!lowerTitle.startsWith(candidate.toLowerCase())) return undefined;
  return candidate;
}

/**
 * Build a concise search query from a product title
 * E.g., "Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black" → "Sony wireless noise cancelling headphones"
 */
function buildSearchQuery(title: string, brand?: string): string {
  // Remove common noise from titles
  const cleaned = title
    .replace(/\([^)]*\)/g, '') // Remove parenthetical info
    .replace(/\[[^\]]*\]/g, '') // Remove bracketed info
    .replace(/[-–]\s*(black|white|silver|blue|red|pink|gray|grey|gold)\s*$/i, '') // Remove trailing color
    .replace(/,\s*\d+\s*(pack|count|ct|pcs?)\s*$/i, '') // Remove pack counts at end
    .replace(/\s+/g, ' ')
    .trim();

  // Take first 6 meaningful words (skip model numbers that are just alphanumeric)
  const words = cleaned.split(' ').filter(w => w.length > 1);
  const meaningfulWords = words.slice(0, 8);

  // If brand is known, ensure it's included
  let query = meaningfulWords.join(' ');
  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }

  // Limit to ~60 chars
  if (query.length > 60) {
    query = query.substring(0, 60).replace(/\s\S*$/, '');
  }

  return query;
}

/**
 * Extract keywords from a product title
 */
function extractKeywordsFromTitle(title: string): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'has', 'are', 'was', 'been', 'will']);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 10);
}

/**
 * Map Amazon category names to our standard categories
 */
function mapAmazonCategory(amazonCategory: string): string {
  const lower = amazonCategory.toLowerCase();
  const mapping: Record<string, string[]> = {
    'Electronics': ['electronics', 'computers', 'cell phones', 'camera', 'audio', 'headphones', 'tv'],
    'Fashion': ['clothing', 'shoes', 'jewelry', 'watches', 'accessories', 'handbags'],
    'Home & Garden': ['home', 'kitchen', 'garden', 'furniture', 'bedding', 'bath', 'patio'],
    'Beauty & Health': ['beauty', 'health', 'personal care', 'skin care', 'makeup', 'vitamins'],
    'Sports & Outdoors': ['sports', 'outdoors', 'fitness', 'exercise'],
    'Toys & Games': ['toys', 'games'],
    'Books & Media': ['books', 'music', 'movies', 'kindle'],
    'Food & Beverage': ['grocery', 'food', 'beverages', 'gourmet'],
    'Automotive': ['automotive', 'car'],
    'Pet Supplies': ['pet supplies', 'dog', 'cat'],
    'Office & School': ['office', 'school', 'industrial'],
    'Arts & Crafts': ['arts', 'crafts', 'sewing'],
  };

  for (const [category, keywords] of Object.entries(mapping)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  return 'General';
}

/**
 * Infer price range from a numeric price
 */
function inferPriceRange(price?: number): 'budget' | 'mid-range' | 'premium' {
  if (!price) return 'mid-range';
  if (price < 30) return 'budget';
  if (price > 200) return 'premium';
  return 'mid-range';
}

/**
 * Fallback: Extract intent from URL structure without AI
 */
function analyzeFromUrlStructure(url: string): ProductIntent {
  const urlLower = url.toLowerCase();
  const pathParts = new URL(url).pathname.split('/').filter(Boolean);

  // Extract potential brand from domain
  const domain = new URL(url).hostname.replace('www.', '');
  const domainParts = domain.split('.');
  const potentialBrand = domainParts[0];

  // Extract keywords from URL path
  const keywords: string[] = [];
  const commonKeywords = [
    'smart',
    'wireless',
    'led',
    'pro',
    'plus',
    'premium',
    'lite',
    'mini',
    'max',
    'ultra',
    'portable',
    'rechargeable',
  ];

  for (const keyword of commonKeywords) {
    if (urlLower.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  // Detect price range
  let priceRange: 'budget' | 'mid-range' | 'premium' = 'mid-range';
  if (urlLower.match(/\b(lite|basic|essential|mini|budget)\b/)) {
    priceRange = 'budget';
  } else if (urlLower.match(/\b(pro|plus|premium|deluxe|ultra|max)\b/)) {
    priceRange = 'premium';
  }

  // Basic category detection from common e-commerce domains
  let category = 'General';
  let subcategory = '';

  if (urlLower.includes('amazon')) {
    // For Amazon, try to extract product name from the URL slug before /dp/
    const slugMatch = urlLower.match(/\/([^/]{5,})\/dp\//);
    if (slugMatch) {
      const slugWords = slugMatch[1].split('-').filter(w => w.length > 1).join(' ');
      if (slugWords.length > 5) {
        const brand = inferBrandFromTitle(slugWords);
        return {
          category: 'General',
          subcategory: '',
          brand: brand,
          priceRange,
          keywords: extractKeywordsFromTitle(slugWords),
          searchQuery: buildSearchQuery(slugWords, undefined),
          confidence: 45,
        };
      }
    }
  }

  // Build search query from path parts (skip ASINs, IDs, tracking params)
  const relevantParts = pathParts
    .filter(part =>
      part.length > 3 &&
      !part.match(/^(dp|gp|product|item|ref|ref_)$/) &&
      !/^[A-Z0-9]{10}$/i.test(part) &&
      !part.includes('=')
    )
    .slice(-2);
  const searchQuery = relevantParts.join(' ').replace(/[-_]/g, ' ').substring(0, 50);

  return {
    category,
    subcategory,
    brand: potentialBrand.charAt(0).toUpperCase() + potentialBrand.slice(1),
    priceRange,
    keywords,
    searchQuery: searchQuery || 'product',
    confidence: 30, // Low confidence for fallback analysis
  };
}

/**
 * Infer product category from title keywords — instant, no AI call.
 * Used as fallback when AI is unavailable.
 */
function inferCategoryFromTitle(title: string): string {
  const lower = title.toLowerCase();
  const categoryMatches: [string, string[]][] = [
    ['Beauty & Health', ['serum', 'moisturizer', 'lipstick', 'foundation', 'mascara', 'skincare', 'makeup', 'vitamin', 'supplement', 'shampoo', 'conditioner', 'perfume', 'blush', 'eyeshadow', 'toner', 'concealer', 'primer', 'retinol', 'collagen', 'spf', 'sunscreen']],
    ['Electronics', ['headphones', 'earbuds', 'earphone', 'phone', 'tablet', 'laptop', 'camera', 'speaker', 'charger', 'cable', 'bluetooth', 'smartwatch', 'keyboard', 'mouse', 'gaming', 'monitor', 'lens', 'tripod', 'microphone']],
    ['Fashion', ['dress', 'shirt', 'shoes', 'bag', 'jacket', 'pants', 'skirt', 'boots', 'sneakers', 'jeans', 'coat', 'handbag', 'sandals', 'heels', 'leggings', 'blouse', 'trousers', 'cardigan', 'sweater', 'loafers']],
    ['Home & Garden', ['chair', 'lamp', 'cushion', 'vase', 'candle', 'rug', 'curtain', 'mirror', 'shelf', 'pan', 'pot', 'knife', 'mug', 'pillow', 'duvet', 'towel', 'storage', 'organizer', 'planter', 'diffuser']],
    ['Sports & Outdoors', ['yoga', 'gym', 'fitness', 'running', 'cycling', 'camping', 'hiking', 'sports', 'exercise', 'mat', 'resistance band', 'dumbbell', 'protein', 'creatine', 'trekking', 'backpack']],
    ['Pet Supplies', ['dog', 'cat', 'pet', 'puppy', 'kitten', 'leash', 'collar', 'treat', 'litter', 'paw']],
    ['Food & Beverage', ['coffee', 'tea', 'snack', 'protein bar', 'smoothie', 'olive oil', 'honey', 'matcha', 'energy drink']],
  ];

  for (const [category, keywords] of categoryMatches) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'General';
}

/**
 * Analyze product intent from a product TITLE (not a URL).
 * Uses the same AI analysis as URL-based intent but skips URL parsing.
 * Used by profile-builder to categorize storefront products from transaction names.
 */
export async function analyzeProductTitle(title: string, env?: any): Promise<ProductIntent> {
  if (!title || title.trim().length < 3) {
    return {
      category: 'General', subcategory: '', brand: undefined,
      priceRange: 'mid-range', keywords: [], searchQuery: title || 'product', confidence: 0,
    };
  }

  const apiKey = env?.OPENAI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);

  if (apiKey) {
    try {
      const aiIntent = await analyzeWithAITitle(title.trim(), apiKey);
      if (aiIntent.confidence >= 50) return aiIntent;
    } catch (err) {
      console.warn('[Intent Analyzer] Title AI analysis failed, using keyword fallback:', err);
    }
  }

  // Keyword-based fallback (instant, no API call)
  return {
    category: inferCategoryFromTitle(title),
    subcategory: '',
    brand: inferBrandFromTitle(title),
    priceRange: 'mid-range',
    keywords: extractKeywordsFromTitle(title),
    searchQuery: buildSearchQuery(title, undefined),
    confidence: 30,
  };
}

/**
 * Batch analyze multiple product names (used by profile-builder for storefront categorization).
 * Processes in batches of 5 with short delays to respect rate limits.
 */
export async function analyzeMultipleNames(names: string[], env?: any): Promise<ProductIntent[]> {
  console.log(`[Intent Analyzer] Batch analyzing ${names.length} product names`);

  const batchSize = 5;
  const results: ProductIntent[] = [];

  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(name => analyzeProductTitle(name, env)));
    results.push(...batchResults);

    if (i + batchSize < names.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

/**
 * Batch analyze multiple URLs (useful for storefront analysis)
 */
export async function analyzeMultipleIntents(urls: string[]): Promise<ProductIntent[]> {
  console.log(`[Intent Analyzer] Batch analyzing ${urls.length} URLs`);

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  const results: ProductIntent[] = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(analyzeProductIntent));
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Extract dominant categories from a list of intents
 */
export function extractDominantCategories(intents: ProductIntent[]): Array<{
  category: string;
  count: number;
  percentage: number;
}> {
  const categoryMap = new Map<string, number>();

  for (const intent of intents) {
    const count = categoryMap.get(intent.category) || 0;
    categoryMap.set(intent.category, count + 1);
  }

  const total = intents.length;
  const categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: count / total,
    }))
    .sort((a, b) => b.count - a.count);

  return categories;
}
