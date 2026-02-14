/**
 * Datafeedr API Client
 * Access 950M+ products from 35+ affiliate networks via single API
 * Networks: Amazon, Awin, Impact, ShareASale, CJ, Rakuten, etc.
 */

export interface DatafeedrSearchParams {
  query: string; // Search keywords
  network_ids?: number[]; // Specific networks (1=Amazon, 2=Awin, etc.)
  merchant_ids?: number[]; // Specific merchants
  price_min?: number;
  price_max?: number;
  currency?: string; // 'USD', 'EUR', 'GBP'
  limit?: number; // Max 100
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
  time_updated: number; // Unix timestamp
}

export interface DatafeedrSearchResponse {
  status: 'found' | 'not_found';
  found_count: number;
  products: DatafeedrProduct[];
  query: string;
  time: number; // API response time in ms
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

  const payload = {
    aid: accessId,
    akey: secretKey,
    query: params.query,
    limit: params.limit || 50,
    offset: params.offset || 0,
    sort: params.sort || 'relevance',
    filter: buildFilters(params),
  };

  const response = await fetch('https://api.datafeedr.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Datafeedr API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(`Datafeedr API error: ${data.message}`);
  }

  console.log(`[Datafeedr] Found ${data.found_count} products`);

  return {
    status: data.status,
    found_count: data.found_count || 0,
    products: data.products || [],
    query: params.query,
    time: data.time || 0,
  };
}

/**
 * Build filter array for Datafeedr API
 */
function buildFilters(params: DatafeedrSearchParams): any[] {
  const filters: any[] = [];

  // Network filter
  if (params.network_ids && params.network_ids.length > 0) {
    filters.push({
      field: 'network_id',
      operator: 'in',
      value: params.network_ids,
    });
  }

  // Merchant filter
  if (params.merchant_ids && params.merchant_ids.length > 0) {
    filters.push({
      field: 'merchant_id',
      operator: 'in',
      value: params.merchant_ids,
    });
  }

  // Price range
  if (params.price_min !== undefined) {
    filters.push({
      field: 'finalprice',
      operator: '>=',
      value: params.price_min,
    });
  }

  if (params.price_max !== undefined) {
    filters.push({
      field: 'finalprice',
      operator: '<=',
      value: params.price_max,
    });
  }

  // Currency
  if (params.currency) {
    filters.push({
      field: 'currency',
      operator: '=',
      value: params.currency,
    });
  }

  // In stock
  if (params.in_stock === true) {
    filters.push({
      field: 'availability',
      operator: '=',
      value: 'in stock',
    });
  }

  return filters;
}

/**
 * Get network ID by name
 */
export function getNetworkId(networkName: string): number | undefined {
  const networks: Record<string, number> = {
    amazon: 1,
    awin: 2,
    shareasale: 3,
    cj: 4, // Commission Junction
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
  const networkIds = options.networks?.map(n => getNetworkId(n)).filter(Boolean) as
    | number[]
    | undefined;

  return searchDatafeedr(
    {
      query: category,
      network_ids: networkIds,
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
  // Build search query
  let query = originalProduct.category;
  if (originalProduct.brand && !options.excludeBrand) {
    query = `${originalProduct.brand} ${query}`;
  }

  // Price range: -20% to +20% of original
  let priceMin: number | undefined;
  let priceMax: number | undefined;
  if (originalProduct.price) {
    priceMin = originalProduct.price * 0.8;
    priceMax = originalProduct.price * 1.2;
  }

  const networkIds = options.networks?.map(n => getNetworkId(n)).filter(Boolean) as
    | number[]
    | undefined;

  return searchDatafeedr(
    {
      query,
      network_ids: networkIds,
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

  const data = await response.json();
  return data.merchant;
}

/**
 * Convert Datafeedr product to AffiMark AlternativeProduct format
 */
export function convertToAlternativeProduct(product: DatafeedrProduct): any {
  return {
    id: product._id,
    url: product.url,
    name: product.name,
    brand: product.brand || product.merchant,
    category: product.category || 'General',
    imageUrl: product.image,
    price: product.finalprice,
    currency: product.currency,
    originalPrice: product.saleprice ? product.price : undefined,
    rating: undefined, // Datafeedr doesn't provide ratings
    reviewCount: undefined,
    affiliateNetwork: product.network,
    merchant: product.merchant,
    inStock: product.availability === 'in stock',
    lastUpdated: new Date(product.time_updated * 1000).toISOString(),
  };
}
