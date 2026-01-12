/**
 * Base Merchant Adapter
 * Abstract interface that all merchant adapters must implement
 */

import {
  ProductSearchParams,
  ProductSearchResult,
  ProductData,
  AffiliateLinkParams,
  MerchantEnv,
  MerchantError,
  MerchantErrorType
} from './types';

/**
 * Base adapter interface
 * All merchant adapters must implement these methods
 */
export interface BaseMerchantAdapter {
  /**
   * Search for products
   * @param params Search parameters
   * @returns Paginated search results
   */
  search(params: ProductSearchParams): Promise<ProductSearchResult>;

  /**
   * Get single product details
   * @param externalId Product ID from merchant's system
   * @returns Product data
   */
  getProduct(externalId: string): Promise<ProductData>;

  /**
   * Generate affiliate link for a product
   * @param params Affiliate link parameters
   * @returns Affiliate URL
   */
  getAffiliateLink(params: AffiliateLinkParams): Promise<string>;

  /**
   * Validate merchant credentials
   * @returns True if credentials are valid
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Get merchant's display name
   */
  getMerchantName(): string;

  /**
   * Get merchant's identifier (matches database merchants.merchant_key)
   */
  getMerchantKey(): string;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseAdapter implements BaseMerchantAdapter {
  protected env: MerchantEnv;

  constructor(env: MerchantEnv) {
    this.env = env;
  }

  // Abstract methods - must be implemented by each adapter
  abstract search(params: ProductSearchParams): Promise<ProductSearchResult>;
  abstract getProduct(externalId: string): Promise<ProductData>;
  abstract getAffiliateLink(params: AffiliateLinkParams): Promise<string>;
  abstract validateCredentials(): Promise<boolean>;
  abstract getMerchantName(): string;
  abstract getMerchantKey(): string;

  /**
   * Helper: Make HTTP request with retry logic
   */
  protected async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          if (attempt < retries - 1) {
            await this.delay(retryAfter * 1000);
            continue;
          }
          throw new MerchantError(
            'Rate limit exceeded',
            MerchantErrorType.RATE_LIMIT_ERROR
          );
        }

        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          throw new MerchantError(
            'Authentication failed - check API credentials',
            MerchantErrorType.AUTHENTICATION_ERROR
          );
        }

        // Handle not found
        if (response.status === 404) {
          throw new MerchantError(
            'Resource not found',
            MerchantErrorType.NOT_FOUND
          );
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new MerchantError(
            `API error: ${response.status} - ${errorText}`,
            MerchantErrorType.API_ERROR
          );
        }

        const data = await response.json();
        return data as T;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication or not found errors
        if (
          error instanceof MerchantError &&
          (error.type === MerchantErrorType.AUTHENTICATION_ERROR ||
           error.type === MerchantErrorType.NOT_FOUND)
        ) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    // All retries failed
    throw new MerchantError(
      `Request failed after ${retries} attempts: ${lastError?.message}`,
      MerchantErrorType.NETWORK_ERROR,
      lastError
    );
  }

  /**
   * Helper: Delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Validate required environment variables
   */
  protected requireEnvVars(...vars: (keyof MerchantEnv)[]): void {
    const missing = vars.filter(v => !this.env[v]);
    if (missing.length > 0) {
      throw new MerchantError(
        `Missing required environment variables: ${missing.join(', ')}`,
        MerchantErrorType.AUTHENTICATION_ERROR
      );
    }
  }

  /**
   * Helper: Normalize price string to number
   */
  protected normalizePrice(priceStr: string | number): number {
    if (typeof priceStr === 'number') return priceStr;

    // Remove currency symbols, commas, spaces
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);

    if (isNaN(price)) return 0;
    return price;
  }

  /**
   * Helper: Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  /**
   * Helper: Build query string from object
   */
  protected buildQueryString(params: Record<string, any>): string {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
    return pairs.join('&');
  }
}
