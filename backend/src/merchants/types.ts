/**
 * Merchant Adapter Types
 * Shared interfaces for all merchant integrations
 */

/**
 * Product search parameters
 */
export interface ProductSearchParams {
  query: string;
  page?: number;
  limit?: number;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    category?: string;
    brand?: string;
    inStockOnly?: boolean;
  };
}

/**
 * Normalized product data structure
 * All merchant adapters should return this format
 */
export interface ProductData {
  // Merchant info
  merchant_id: string;           // UUID from merchants table
  external_id: string;           // Product ID from external merchant API

  // Basic product info
  product_name: string;
  description: string;

  // Pricing
  price: number;                 // Price in decimal format (e.g., 99.99)
  currency: string;              // ISO currency code (USD, EUR, etc.)
  original_price?: number;       // For products on sale

  // Images & URLs
  image_url: string;             // Primary product image
  additional_images?: string[];  // Additional product images
  product_url: string;           // Direct link to product page

  // Categories & Classification
  category?: string;
  subcategory?: string;
  brand?: string;

  // Availability
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  stock_quantity?: number;

  // Ratings & Reviews (if available)
  rating?: number;               // Average rating (e.g., 4.5)
  review_count?: number;

  // Additional data
  specifications?: Record<string, any>;  // Product specs
  features?: string[];                   // Key features list

  // Raw data cache (for debugging & future use)
  data_cache: Record<string, any>;       // Full API response
}

/**
 * Product search result with pagination
 */
export interface ProductSearchResult {
  products: ProductData[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

/**
 * Affiliate link generation params
 */
export interface AffiliateLinkParams {
  productUrl: string;
  affiliateId: string;
  subId?: string;              // Sub-ID for tracking
  customParams?: Record<string, string>;
}

/**
 * Error types for merchant operations
 */
export enum MerchantErrorType {
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NOT_FOUND = 'not_found',
  INVALID_PARAMS = 'invalid_params',
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Custom merchant error
 */
export class MerchantError extends Error {
  constructor(
    message: string,
    public type: MerchantErrorType,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MerchantError';
  }
}

/**
 * Environment bindings for merchant adapters
 */
export interface MerchantEnv {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // Amazon / Rainforest / Scrapingdog
  RAINFOREST_API_KEY?: string;
  SCRAPINGDOG_API_KEY?: string;  // Alternative cheaper API
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AMAZON_ASSOCIATE_TAG?: string;

  // Shopify
  SHOPIFY_APP_CLIENT_ID?: string;
  SHOPIFY_APP_CLIENT_SECRET?: string;
  SHOPIFY_API_KEY?: string;

  // Gumroad
  GUMROAD_ACCESS_TOKEN?: string;

  // Impact.com
  IMPACT_ACCOUNT_SID?: string;
  IMPACT_AUTH_TOKEN?: string;

  // ShareASale
  SHAREASALE_API_TOKEN?: string;
  SHAREASALE_API_SECRET?: string;
  SHAREASALE_AFFILIATE_ID?: string;
}
