/**
 * Datafeedr API Client
 * Access 950M+ products from 35+ affiliate networks via single API
 * Networks: Amazon, Awin, Impact, ShareASale, CJ, Rakuten, etc.
 *
 * API Docs: https://datafeedr.github.io/datafeedr-api-docs/
 * Query format: `query` is an ARRAY of filter expressions like ["name LIKE headphones"]
 * Operators: LIKE, =, !=, <, >, <=, >=, IN, NOT IN, EMPTY, NOT EMPTY
 * Search operators within LIKE: AND (space), OR (|), NOT (-), PHRASE ("...")
 */

export interface DatafeedrSearchParams {
  query: string;
  /** Pre-built Datafeedr filter expressions, added verbatim to the query array */
  rawFilters?: string[];
  source_ids?: number[];
  source_names?: string[];
  merchant_ids?: number[];
  price_min?: number;
  price_max?: number;
  currency?: string;
  limit?: number;
  offset?: number;
  sort?:
    | 'price_asc'
    | 'price_desc'
    | 'relevance'
    | 'name_asc'
    | 'name_desc'
    | 'merchant_asc'
    | 'merchant_desc';
  in_stock?: boolean;
  /** @deprecated Use source_ids or source_names instead */
  network_ids?: number[];
}

export interface DatafeedrProduct {
  _id: string; // Datafeedr product ID
  name: string;
  merchant: string;
  merchant_id: number;
  network: string;
  network_id: number;
  price: number;
  currency: string;
  saleprice?: number;
  finalprice: number; // The actual price (sale or regular)
  url: string; // Affiliate link
  image?: string;
  brand?: string;
  description?: string;
  ean?: string;
  upc?: string;
  sku?: string;
  category?: string;
  availability?: string; // 'in stock', 'out of stock'
  direct_url?: string;   // Merchant's product page URL (no affiliate tracking)
  time_updated: number;  // Unix timestamp
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function normalizeAmountFromDatafeedr(rawAmount: number | undefined, currency?: string): number | undefined {
  if (rawAmount === undefined || rawAmount === null || Number.isNaN(rawAmount)) {
    return undefined;
  }

  const normalizedCurrency = (currency || '').toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return rawAmount;
  }

  // Datafeedr typically returns amount in minor units (e.g. 1800 -> 18.00).
  return rawAmount / 100;
}

export interface DatafeedrSearchResponse {
  status: 'found' | 'not_found';
  found_count: number;
  products: DatafeedrProduct[];
  query: string;
  time: number; // API response time in ms
}

/**
 * Build the Datafeedr query array from our search params.
 * Datafeedr expects `query` as an array of filter strings like:
 *   ["name LIKE headphones", "price >= 50", "network_id IN 2,3"]
 */
function buildQueryArray(params: DatafeedrSearchParams): string[] {
  const queryFilters: string[] = [];

  // Raw filters pass through verbatim (for sku=, any LIKE, etc.)
  if (params.rawFilters && params.rawFilters.length > 0) {
    queryFilters.push(...params.rawFilters);
  }

  // Main search term — use `name LIKE` for matching product names
  if (params.query && params.query.trim().length > 0) {
    const simplified = simplifySearchQuery(params.query);
    if (simplified.length > 0) {
      queryFilters.push(`name LIKE ${simplified}`);
    }
  }

  // Network filter by name (preferred — no ID maintenance needed)
  if (params.source_names && params.source_names.length > 0) {
    queryFilters.push(`source LIKE ${params.source_names.join('|')}`);
  }

  // Network filter by ID (Datafeedr field is `source_id`, space-separated)
  if (params.source_ids && params.source_ids.length > 0) {
    queryFilters.push(`source_id IN ${params.source_ids.join(' ')}`);
  } else if (params.network_ids && params.network_ids.length > 0) {
    queryFilters.push(`source_id IN ${params.network_ids.join(' ')}`);
  }

  // Merchant filter (space-separated per Datafeedr docs)
  if (params.merchant_ids && params.merchant_ids.length > 0) {
    queryFilters.push(`merchant_id IN ${params.merchant_ids.join(' ')}`);
  }

  // Price range
  if (params.price_min !== undefined) {
    queryFilters.push(`finalprice >= ${params.price_min}`);
  }
  if (params.price_max !== undefined) {
    queryFilters.push(`finalprice <= ${params.price_max}`);
  }

  // Currency
  if (params.currency) {
    queryFilters.push(`currency = ${params.currency}`);
  }

  // Note: Datafeedr's `availability` field is not populated by most merchants.
  // Stock freshness is handled post-search by preferring recently-updated products
  // in the scoring layer (time_updated checked after results are returned).

  return queryFilters;
}

/**
 * Simplify a search query for better Datafeedr results.
 * Strips price/intent qualifiers, stopwords, and packing noise so only
 * product-identifying terms reach the `name LIKE` filter.
 * e.g. "affordable vitamin c serum under 20 euros" → "vitamin c serum"
 */
function simplifySearchQuery(query: string): string {
  // Step 1: Remove multi-word price/comparison phrases before tokenising
  let simplified = query
    .replace(/\b(less than|more than|under|over|around|about|up to|starting at)\b\s*[\d€$£]*/gi, '')
    .replace(/\b[\d,.]+\s*(euros?|dollars?|gbp|usd|eur|£|\$|€)\b/gi, '') // "20 euros", "$50"
    .replace(/[€$£]\s*[\d,.]+/gi, '')                                      // "€20", "$50"
    .replace(/\d+-pack/gi, '')
    .replace(/gift\s*set/gi, '')
    .replace(/\([^)]*\)/g, '')   // parenthetical content
    .replace(/\[[^\]]*\]/g, '')  // bracketed content
    .replace(/–|—/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 2: Remove individual noise words that never appear in product titles
  const NOISE_WORDS = new Set([
    // Price intent
    'affordable', 'cheap', 'budget', 'luxury', 'premium', 'expensive',
    'best', 'good', 'top', 'great', 'nice', 'amazing', 'quality',
    // Quantity/comparison markers
    'under', 'over', 'around', 'about', 'below', 'above',
    // Currency (as standalone words after the regex above)
    'euros', 'euro', 'dollars', 'dollar', 'pounds', 'usd', 'eur', 'gbp',
    // Stopwords that add no product signal
    'for', 'the', 'and', 'with', 'from', 'that', 'this', 'very', 'really',
    'to', 'in', 'of', 'a', 'an', 'is', 'are', 'my', 'me', 'i',
    // Packing/generic product noise
    'gift', 'set', 'pack', 'bundle', 'kit', 'combo', 'edition',
  ]);

  const words = simplified
    .split(/\s+/)
    .filter(w => w.length > 1 && !NOISE_WORDS.has(w.toLowerCase()));

  // Step 3: Keep at most 5 product-identifying words
  return words.slice(0, 5).join(' ');
}

/**
 * Convert our sort format to Datafeedr's sort array format.
 * Datafeedr uses ["+price"], ["-price"], ["+relevance"], etc.
 */
function convertSort(sort?: string): string[] {
  switch (sort) {
    case 'price_asc': return ['+price'];
    case 'price_desc': return ['-price'];
    case 'name_asc': return ['+name'];
    case 'name_desc': return ['-name'];
    case 'merchant_asc': return ['+merchant'];
    case 'merchant_desc': return ['-merchant'];
    case 'relevance':
    default:
      return ['+relevance'];
  }
}

/**
 * Search products via Datafeedr API
 */
export async function searchDatafeedr(
  params: DatafeedrSearchParams,
  accessId: string,
  secretKey: string
): Promise<DatafeedrSearchResponse> {
  console.log('[Datafeedr] Searching:', params.query);

  const queryArray = buildQueryArray(params);
  console.log('[Datafeedr] Query filters:', queryArray);

  const payload: Record<string, any> = {
    aid: accessId,
    akey: secretKey,
    query: queryArray,
    fields: [
      'name', 'brand', 'price', 'finalprice', 'saleprice',
      'currency', 'url', 'direct_url', 'image', 'merchant', 'merchant_id',
      'network', 'network_id', 'category', 'availability',
      'ean', 'upc', 'sku', 'description', 'time_updated',
    ],
    limit: Math.min(params.limit || 50, 100),
    sort: convertSort(params.sort),
  };

  if (params.offset) {
    payload.offset = params.offset;
  }

  const controller = new AbortController();
  const timeoutMs = 12000; // Keep Datafeedr call bounded for UX SLA
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.datafeedr.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Datafeedr request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Datafeedr] API error ${response.status}:`, errorBody);
    throw new Error(`Datafeedr API error: ${response.status} - ${errorBody}`);
  }

  const data: any = await response.json();

  if (data.status === 'error') {
    console.error('[Datafeedr] API returned error:', data.message);
    throw new Error(`Datafeedr API error: ${data.message}`);
  }

  const foundCount = data.found_count || data.total_found || 0;
  console.log(`[Datafeedr] Found ${foundCount} products`);

  return {
    status: foundCount > 0 ? 'found' : 'not_found',
    found_count: foundCount,
    products: data.products || [],
    query: params.query,
    time: data.time || 0,
  };
}

/**
 * Map user-facing storefront keys to Datafeedr `source LIKE` terms.
 * Uses text matching against the network's `source` field, which is more
 * resilient than maintaining numeric IDs that Datafeedr can reassign.
 */
const STOREFRONT_TO_SOURCE_NAME: Record<string, string> = {
  amazon: 'amazon',
  amazon_de: 'amazon',
  amazon_uk: 'amazon',
  amazon_us: 'amazon',
  amazon_fr: 'amazon',
  amazon_it: 'amazon',
  amazon_es: 'amazon',
  awin: 'awin',
  shareasale: 'shareasale',
  cj: 'commission junction',
  impact: 'impact',
  tradedoubler: 'tradedoubler',
  rakuten: 'rakuten',
  pepperjam: 'pepperjam',
  linkshare: 'linkshare',
  webgains: 'webgains',
  partnerize: 'partnerize',
  ltk: 'rewardstyle',       // LTK (formerly RewardStyle) — network name in Datafeedr
  rewardstyle: 'rewardstyle',
  shopmy: 'shopmy',         // ShopMy if listed as a Datafeedr source
};

/**
 * Resolve an array of user storefront keys to unique Datafeedr source names
 * suitable for `source LIKE name1|name2` queries.
 */
export function resolveSourceNames(storefrontKeys: string[]): string[] {
  const names = new Set<string>();
  for (const key of storefrontKeys) {
    const name = STOREFRONT_TO_SOURCE_NAME[key.toLowerCase()];
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * @deprecated Use resolveSourceNames + source_names param for search filtering.
 * These IDs are placeholders and may not match real Datafeedr source_ids.
 */
export function getNetworkId(networkName: string): number | undefined {
  const networks: Record<string, number> = {
    amazon: 1,
    awin: 2,
    shareasale: 3,
    cj: 4,
    rakuten: 5,
    impact: 6,
    tradedoubler: 7,
    pepperjam: 8,
    linkshare: 9,
    'amazon_de': 1,
    'amazon_uk': 1,
    'amazon_fr': 1,
    'amazon_it': 1,
    'amazon_es': 1,
  };

  return networks[networkName.toLowerCase()];
}

/**
 * Fetch all networks from Datafeedr API to discover real source_ids.
 * Results should be cached (they rarely change).
 */
export async function fetchNetworks(
  accessId: string,
  secretKey: string
): Promise<Array<{ _id: number; name: string; group: string; product_count: number }>> {
  const response = await fetch('https://api.datafeedr.com/networks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aid: accessId,
      akey: secretKey,
      fields: ['name', 'group', 'product_count'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Datafeedr networks API error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.networks || [];
}

/**
 * Search by category
 */
export async function searchByCategory(
  category: string,
  options: {
    priceRange?: [number, number];
    networks?: string[];
    limit?: number;
  },
  accessId: string,
  secretKey: string
): Promise<DatafeedrSearchResponse> {
  const sourceNames = options.networks ? resolveSourceNames(options.networks) : undefined;

  return searchDatafeedr(
    {
      query: category,
      source_names: sourceNames && sourceNames.length > 0 ? sourceNames : undefined,
      price_min: options.priceRange?.[0],
      price_max: options.priceRange?.[1],
      limit: options.limit || 50,
      in_stock: true,
    },
    accessId,
    secretKey
  );
}

/**
 * Find product alternatives by brand and category
 */
export async function findAlternatives(
  originalProduct: {
    category: string;
    brand?: string;
    price?: number;
  },
  options: {
    excludeBrand?: boolean;
    networks?: string[];
    limit?: number;
  },
  accessId: string,
  secretKey: string
): Promise<DatafeedrSearchResponse> {
  let query = originalProduct.category;
  if (originalProduct.brand && !options.excludeBrand) {
    query = `${originalProduct.brand} ${query}`;
  }

  let priceMin: number | undefined;
  let priceMax: number | undefined;
  if (originalProduct.price) {
    priceMin = originalProduct.price * 0.8;
    priceMax = originalProduct.price * 1.2;
  }

  const sourceNames = options.networks ? resolveSourceNames(options.networks) : undefined;

  return searchDatafeedr(
    {
      query,
      source_names: sourceNames && sourceNames.length > 0 ? sourceNames : undefined,
      price_min: priceMin,
      price_max: priceMax,
      limit: options.limit || 50,
      in_stock: true,
    },
    accessId,
    secretKey
  );
}

/**
 * Get merchant info
 */
export async function getMerchantInfo(
  merchantId: number,
  accessId: string,
  secretKey: string
): Promise<any> {
  const payload = {
    aid: accessId,
    akey: secretKey,
    merchant_id: merchantId,
  };

  const response = await fetch('https://api.datafeedr.com/merchant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data: any = await response.json();
  return data.merchant;
}

/**
 * Convert Datafeedr product to AffiMark AlternativeProduct format
 */
export function convertToAlternativeProduct(product: DatafeedrProduct): any {
  let lastUpdated: string | undefined;
  try {
    if (product.time_updated && product.time_updated > 0) {
      lastUpdated = new Date(product.time_updated * 1000).toISOString();
    }
  } catch {
    // Invalid timestamp — skip
  }

  const normalizedPrice = normalizeAmountFromDatafeedr(product.finalprice, product.currency);
  const normalizedOriginalPrice = normalizeAmountFromDatafeedr(
    product.saleprice ? product.price : undefined,
    product.currency
  );

  return {
    id: product._id || String(product._id),
    url: product.url,
    directUrl: product.direct_url,
    name: product.name,
    brand: product.brand || product.merchant,
    category: product.category || 'General',
    imageUrl: product.image,
    price: normalizedPrice ?? 0,
    currency: product.currency,
    originalPrice: normalizedOriginalPrice,
    description: product.description,
    affiliateNetwork: product.network,
    merchant: product.merchant,
    inStock: product.availability === 'out of stock' || product.availability === 'out-of-stock'
      ? false
      : true,  // Treat empty/unknown availability as likely in-stock (most merchants don't set this field)
    lastUpdated,
  };
}
