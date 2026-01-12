/**
 * Rainforest API Adapter (Amazon Products)
 * Wrapper for Rainforest API to search and fetch Amazon products
 * Docs: https://www.rainforestapi.com/docs
 */

import { BaseAdapter } from './base-adapter';
import {
  ProductSearchParams,
  ProductSearchResult,
  ProductData,
  AffiliateLinkParams,
  MerchantEnv,
  MerchantError,
  MerchantErrorType
} from './types';

interface RainforestSearchResponse {
  request_info: {
    success: boolean;
  };
  search_results: Array<{
    asin: string;
    title: string;
    link: string;
    image: string;
    rating?: number;
    ratings_total?: number;
    prices?: Array<{
      symbol: string;
      value: number;
      currency: string;
      raw: string;
    }>;
    is_prime?: boolean;
  }>;
  pagination?: {
    total_results: number;
    current_page: number;
  };
}

interface RainforestProductResponse {
  request_info: {
    success: boolean;
  };
  product: {
    asin: string;
    title: string;
    link: string;
    main_image: {
      link: string;
    };
    images?: Array<{
      link: string;
    }>;
    rating?: number;
    ratings_total?: number;
    feature_bullets?: string[];
    description?: string;
    brand?: string;
    buybox_winner?: {
      price: {
        symbol: string;
        value: number;
        currency: string;
        raw: string;
      };
      availability: {
        type: string;
        raw: string;
      };
    };
    categories?: Array<{
      name: string;
    }>;
    specifications?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export class RainforestAdapter extends BaseAdapter {
  private readonly BASE_URL = 'https://api.rainforestapi.com/request';

  constructor(env: MerchantEnv) {
    super(env);
    this.requireEnvVars('RAINFOREST_API_KEY');
  }

  getMerchantName(): string {
    return 'Amazon';
  }

  getMerchantKey(): string {
    return 'amazon';
  }

  /**
   * Search Amazon products via Rainforest API
   */
  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    try {
      const queryParams: Record<string, any> = {
        api_key: this.env.RAINFOREST_API_KEY,
        type: 'search',
        amazon_domain: 'amazon.com',
        search_term: params.query,
        page: params.page || 1,
      };

      // Add filters if provided
      if (params.filters?.minPrice) {
        queryParams.min_price = params.filters.minPrice;
      }
      if (params.filters?.maxPrice) {
        queryParams.max_price = params.filters.maxPrice;
      }

      const url = `${this.BASE_URL}?${this.buildQueryString(queryParams)}`;

      const response = await this.makeRequest<RainforestSearchResponse>(url, {
        method: 'GET',
      });

      if (!response.request_info.success) {
        throw new MerchantError(
          'Rainforest API request failed',
          MerchantErrorType.API_ERROR
        );
      }

      // Get merchant_id from database
      const merchantId = await this.getMerchantId();

      // Transform results to our format
      const products: ProductData[] = response.search_results.map(item => ({
        merchant_id: merchantId,
        external_id: item.asin,
        product_name: item.title,
        description: '', // Not available in search results
        price: item.prices?.[0]?.value || 0,
        currency: item.prices?.[0]?.currency || 'USD',
        image_url: item.image,
        product_url: item.link,
        rating: item.rating,
        review_count: item.ratings_total,
        availability: 'unknown' as const, // Search doesn't provide availability
        data_cache: item,
      }));

      const limit = params.limit || 20;
      const total = response.pagination?.total_results || products.length;

      return {
        products,
        total,
        page: params.page || 1,
        limit,
        has_more: (params.page || 1) * limit < total,
      };

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Rainforest search error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get detailed product information
   */
  async getProduct(externalId: string): Promise<ProductData> {
    try {
      const queryParams = {
        api_key: this.env.RAINFOREST_API_KEY,
        type: 'product',
        amazon_domain: 'amazon.com',
        asin: externalId,
      };

      const url = `${this.BASE_URL}?${this.buildQueryString(queryParams)}`;

      const response = await this.makeRequest<RainforestProductResponse>(url, {
        method: 'GET',
      });

      if (!response.request_info.success) {
        throw new MerchantError(
          'Failed to fetch product details',
          MerchantErrorType.API_ERROR
        );
      }

      const product = response.product;
      const merchantId = await this.getMerchantId();

      // Determine availability
      let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
      if (product.buybox_winner?.availability) {
        const avail = product.buybox_winner.availability.type.toLowerCase();
        if (avail === 'in_stock') availability = 'in_stock';
        else if (avail.includes('out')) availability = 'out_of_stock';
      }

      // Extract additional images
      const additionalImages = product.images?.map(img => img.link) || [];

      // Build specifications object
      const specifications: Record<string, any> = {};
      product.specifications?.forEach(spec => {
        specifications[spec.name] = spec.value;
      });

      return {
        merchant_id: merchantId,
        external_id: product.asin,
        product_name: product.title,
        description: product.description || '',
        price: product.buybox_winner?.price.value || 0,
        currency: product.buybox_winner?.price.currency || 'USD',
        image_url: product.main_image.link,
        additional_images: additionalImages,
        product_url: product.link,
        category: product.categories?.[0]?.name,
        brand: product.brand,
        availability,
        rating: product.rating,
        review_count: product.ratings_total,
        features: product.feature_bullets,
        specifications,
        data_cache: product,
      };

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Rainforest product fetch error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Generate Amazon affiliate link
   */
  async getAffiliateLink(params: AffiliateLinkParams): Promise<string> {
    try {
      // Extract ASIN from product URL
      const asin = this.extractAsinFromUrl(params.productUrl);
      if (!asin) {
        throw new MerchantError(
          'Could not extract ASIN from product URL',
          MerchantErrorType.INVALID_PARAMS
        );
      }

      // Build Amazon affiliate link
      // Format: https://www.amazon.com/dp/{ASIN}/?tag={AFFILIATE_TAG}
      const baseUrl = `https://www.amazon.com/dp/${asin}`;
      const queryParams: Record<string, string> = {
        tag: params.affiliateId,
      };

      // Add sub-ID if provided
      if (params.subId) {
        queryParams.linkId = params.subId;
      }

      // Add custom params
      if (params.customParams) {
        Object.assign(queryParams, params.customParams);
      }

      const queryString = this.buildQueryString(queryParams);
      return `${baseUrl}?${queryString}`;

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Failed to generate affiliate link: ${(error as Error).message}`,
        MerchantErrorType.UNKNOWN_ERROR,
        error
      );
    }
  }

  /**
   * Validate Rainforest API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Make a minimal test request
      const queryParams = {
        api_key: this.env.RAINFOREST_API_KEY,
        type: 'search',
        amazon_domain: 'amazon.com',
        search_term: 'test',
        page: 1,
      };

      const url = `${this.BASE_URL}?${this.buildQueryString(queryParams)}`;

      const response = await this.makeRequest<RainforestSearchResponse>(url, {
        method: 'GET',
      });

      return response.request_info.success;

    } catch (error) {
      console.error('Rainforest credential validation failed:', error);
      return false;
    }
  }

  /**
   * Helper: Extract ASIN from Amazon URL
   */
  private extractAsinFromUrl(url: string): string | null {
    // Handle various Amazon URL formats
    // https://www.amazon.com/dp/B08N5WRWNW
    // https://www.amazon.com/product-name/dp/B08N5WRWNW
    // https://www.amazon.com/gp/product/B08N5WRWNW

    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /asin=([A-Z0-9]{10})/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Helper: Get merchant ID from database
   */
  private async getMerchantId(): Promise<string> {
    // In production, this would query the merchants table
    // For now, we'll assume the merchant_id is known
    // This should be cached or looked up once during adapter initialization
    return 'amazon-merchant-id'; // Placeholder
  }
}
