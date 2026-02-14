/**
 * URL Normalizer for Product Verifier
 *
 * Normalizes product URLs, identifies merchant/platform,
 * detects region, and extracts product identifiers.
 */

export interface NormalizedUrl {
  original: string;
  normalized: string;
  merchant: string;
  platform: PlatformType;
  region: string | null;
  product_id: string | null;
  is_product_page: boolean;
}

export type PlatformType =
  | 'amazon'
  | 'shopify'
  | 'awin'
  | 'impact'
  | 'tradedoubler'
  | 'ltk'
  | 'zalando'
  | 'aboutyou'
  | 'asos'
  | 'sephora'
  | 'douglas'
  | 'mediamarkt'
  | 'saturn'
  | 'unknown';

// Tracking params to strip from URLs
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid',
  'ref', 'ref_', 'src', 'source',
  'srsltid', 'mc_cid', 'mc_eid',
  '_ga', '_gl', 'yclid',
]);

// Affiliate params to preserve (do NOT strip)
const AFFILIATE_PARAMS = new Set([
  'tag', 'ascsubtag', 'linkCode', 'linkId',
  'awc', 'awinaffid', 'clickref',
  'irclickid', 'sharedid',
  'tduid', 'subid',
]);

// Platform detection patterns
const PLATFORM_PATTERNS: Array<{
  pattern: RegExp;
  platform: PlatformType;
  merchant: string;
  regionExtractor?: (url: URL) => string | null;
  productIdExtractor?: (url: URL) => string | null;
}> = [
  // Amazon (various TLDs)
  {
    pattern: /amazon\.(de|co\.uk|com|fr|it|es|nl|pl|se|com\.be|com\.tr|co\.jp|ca|com\.au|in|com\.br|com\.mx|sg|ae|sa)/i,
    platform: 'amazon',
    merchant: 'Amazon',
    regionExtractor: (url) => {
      const tldMap: Record<string, string> = {
        'de': 'DE', 'co.uk': 'UK', 'com': 'US', 'fr': 'FR',
        'it': 'IT', 'es': 'ES', 'nl': 'NL', 'pl': 'PL',
        'se': 'SE', 'com.be': 'BE', 'com.tr': 'TR',
        'co.jp': 'JP', 'ca': 'CA', 'com.au': 'AU',
        'in': 'IN', 'com.br': 'BR', 'com.mx': 'MX',
        'sg': 'SG', 'ae': 'AE', 'sa': 'SA',
      };
      const match = url.hostname.match(/amazon\.(.+)/);
      return match ? (tldMap[match[1]] || null) : null;
    },
    productIdExtractor: (url) => {
      // Extract ASIN from /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
      const dpMatch = url.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (dpMatch) return dpMatch[1].toUpperCase();
      const gpMatch = url.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (gpMatch) return gpMatch[1].toUpperCase();
      return null;
    },
  },
  // Zalando
  {
    pattern: /zalando\.(de|co\.uk|fr|it|es|nl|pl|se|be|at|ch|fi|dk|no|ie|ee|lv|lt|sk|si|hr|cz)/i,
    platform: 'zalando',
    merchant: 'Zalando',
    regionExtractor: (url) => {
      const match = url.hostname.match(/zalando\.(.+)/);
      if (!match) return null;
      const tldMap: Record<string, string> = {
        'de': 'DE', 'co.uk': 'UK', 'fr': 'FR', 'it': 'IT',
        'es': 'ES', 'nl': 'NL', 'pl': 'PL', 'se': 'SE',
        'be': 'BE', 'at': 'AT', 'ch': 'CH',
      };
      return tldMap[match[1]] || match[1].toUpperCase();
    },
    productIdExtractor: (url) => {
      // Zalando URLs like /product-name.html or /product-name/SKU.html
      const match = url.pathname.match(/([A-Z0-9]+-[A-Z0-9]+)\.html/i);
      return match ? match[1] : null;
    },
  },
  // About You
  {
    pattern: /aboutyou\.(de|com|fr|it|es|nl|pl|at|ch|be)/i,
    platform: 'aboutyou',
    merchant: 'About You',
    regionExtractor: (url) => {
      const match = url.hostname.match(/aboutyou\.(.+)/);
      return match ? match[1].toUpperCase() : null;
    },
  },
  // ASOS
  {
    pattern: /asos\.com/i,
    platform: 'asos',
    merchant: 'ASOS',
    regionExtractor: () => 'EU',
    productIdExtractor: (url) => {
      const match = url.pathname.match(/prd\/(\d+)/i);
      return match ? match[1] : null;
    },
  },
  // Sephora
  {
    pattern: /sephora\.(de|com|fr|it|es|co\.uk)/i,
    platform: 'sephora',
    merchant: 'Sephora',
    regionExtractor: (url) => {
      const match = url.hostname.match(/sephora\.(.+)/);
      return match ? match[1].toUpperCase() : null;
    },
  },
  // Douglas
  {
    pattern: /douglas\.(de|nl|at|pl|it|fr|es)/i,
    platform: 'douglas',
    merchant: 'Douglas',
    regionExtractor: (url) => {
      const match = url.hostname.match(/douglas\.(.+)/);
      return match ? match[1].toUpperCase() : null;
    },
  },
  // MediaMarkt
  {
    pattern: /mediamarkt\.(de|nl|at|es|it|pl|be|se)/i,
    platform: 'mediamarkt',
    merchant: 'MediaMarkt',
    regionExtractor: (url) => {
      const match = url.hostname.match(/mediamarkt\.(.+)/);
      return match ? match[1].toUpperCase() : null;
    },
  },
  // Saturn
  {
    pattern: /saturn\.de/i,
    platform: 'saturn',
    merchant: 'Saturn',
    regionExtractor: () => 'DE',
  },
  // LTK
  {
    pattern: /ltk\.to|liketoknow\.it|shopltk\.com/i,
    platform: 'ltk',
    merchant: 'LTK',
    regionExtractor: () => 'GLOBAL',
  },
  // Awin tracking links
  {
    pattern: /awin1\.com|prf\.hn/i,
    platform: 'awin',
    merchant: 'Awin Network',
    regionExtractor: () => null,
  },
  // Impact tracking links
  {
    pattern: /impact\.com|impactradius\.com|sjv\.io/i,
    platform: 'impact',
    merchant: 'Impact Network',
    regionExtractor: () => null,
  },
  // Tradedoubler
  {
    pattern: /tradedoubler\.com|clk\.tradedoubler/i,
    platform: 'tradedoubler',
    merchant: 'Tradedoubler Network',
    regionExtractor: () => null,
  },
];

/**
 * Normalize a product URL: strip tracking params, detect platform/merchant/region
 */
export function normalizeUrl(rawUrl: string): NormalizedUrl {
  let urlStr = rawUrl.trim();

  // Add protocol if missing
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return {
      original: rawUrl,
      normalized: rawUrl,
      merchant: 'Unknown',
      platform: 'unknown',
      region: null,
      product_id: null,
      is_product_page: false,
    };
  }

  // Strip tracking params (preserve affiliate params)
  const params = new URLSearchParams(url.search);
  const paramsToDelete: string[] = [];
  params.forEach((_value, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase()) && !AFFILIATE_PARAMS.has(key.toLowerCase())) {
      paramsToDelete.push(key);
    }
  });
  paramsToDelete.forEach(key => params.delete(key));
  url.search = params.toString();

  // Remove trailing slashes and hash
  url.hash = '';
  let normalized = url.toString().replace(/\/+$/, '');

  // Detect platform
  let platform: PlatformType = 'unknown';
  let merchant = extractMerchantFromDomain(url.hostname);
  let region: string | null = null;
  let productId: string | null = null;

  for (const pattern of PLATFORM_PATTERNS) {
    if (pattern.pattern.test(url.hostname)) {
      platform = pattern.platform;
      merchant = pattern.merchant;
      region = pattern.regionExtractor?.(url) || null;
      productId = pattern.productIdExtractor?.(url) || null;
      break;
    }
  }

  // Detect if Shopify store
  if (platform === 'unknown') {
    if (isShopifyStore(url)) {
      platform = 'shopify';
    }
  }

  // Check if this looks like a product page
  const isProductPage = detectProductPage(url, platform);

  return {
    original: rawUrl,
    normalized,
    merchant,
    platform,
    region,
    product_id: productId,
    is_product_page: isProductPage,
  };
}

/**
 * Extract a readable merchant name from domain
 */
function extractMerchantFromDomain(hostname: string): string {
  // Remove www. and TLD
  const parts = hostname.replace(/^www\./, '').split('.');
  if (parts.length >= 2) {
    // Use the main domain part (e.g., "nike" from "nike.com")
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return hostname;
}

/**
 * Detect if URL is a Shopify store
 */
function isShopifyStore(url: URL): boolean {
  // Check for /products/ path pattern (Shopify convention)
  if (url.pathname.includes('/products/')) return true;
  // Check for myshopify.com domain
  if (url.hostname.includes('myshopify.com')) return true;
  return false;
}

/**
 * Detect if URL looks like a product page vs category/collection/blog
 */
function detectProductPage(url: URL, platform: PlatformType): boolean {
  const path = url.pathname.toLowerCase();

  // Known product page patterns
  if (platform === 'amazon') {
    return path.includes('/dp/') || path.includes('/gp/product/');
  }
  if (platform === 'shopify') {
    return path.includes('/products/') && !path.endsWith('/products/') && !path.endsWith('/products');
  }
  if (platform === 'zalando') {
    return path.endsWith('.html') && !path.includes('/catalog/') && !path.includes('/filter/');
  }

  // Generic product page detection
  const productPatterns = [
    /\/product[s]?\//i,
    /\/p\//i,
    /\/item\//i,
    /\/dp\//i,
    /\/prd\//i,
    /\/sku\//i,
    /\d{4,}\.html/i, // numeric ID .html
  ];

  const nonProductPatterns = [
    /\/collections?\//i,
    /\/categor/i,
    /\/search/i,
    /\/blog/i,
    /\/page\//i,
    /\/filter/i,
    /\/brand\//i,
  ];

  // If matches non-product pattern, likely not a product page
  if (nonProductPatterns.some(p => p.test(path))) return false;

  // If matches product pattern, likely a product page
  if (productPatterns.some(p => p.test(path))) return true;

  // If URL has a deep path (3+ segments), more likely a product
  const segments = path.split('/').filter(Boolean);
  return segments.length >= 2;
}

/**
 * Validate that a URL is suitable for analysis
 */
export function validateUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return { valid: false, error: 'URL is required' };
  }

  let urlStr = rawUrl.trim();
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }

  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    if (!url.hostname.includes('.')) {
      return { valid: false, error: 'Invalid domain name' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
