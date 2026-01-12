/**
 * Gumroad API Adapter
 * Import digital products from Gumroad
 * Docs: https://app.gumroad.com/api
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

interface GumroadProduct {
  id: string;
  name: string;
  description: string;
  custom_permalink: string;
  custom_receipt?: string;
  preview_url?: string;
  thumbnail_url?: string;
  formatted_price: string;
  price: number;
  currency: string;
  short_url: string;
  url: string;
  sales_count?: number;
  sales_usd_cents?: number;
  published: boolean;
  shown_on_profile?: boolean;
  file_info?: Record<string, any>;
}

interface GumroadProductsResponse {
  success: boolean;
  products: GumroadProduct[];
}

interface GumroadProductResponse {
  success: boolean;
  product: GumroadProduct;
}

export class GumroadAdapter extends BaseAdapter {
  private readonly BASE_URL = 'https://api.gumroad.com/v2';

  constructor(env: MerchantEnv) {
    super(env);
    this.requireEnvVars('GUMROAD_ACCESS_TOKEN');
  }

  getMerchantName(): string {
    return 'Gumroad';
  }

  getMerchantKey(): string {
    return 'gumroad';
  }

  /**
   * Search/list Gumroad products
   * Note: Gumroad API doesn't have search, so we fetch all and filter
   */
  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    try {
      const url = `${this.BASE_URL}/products?access_token=${this.env.GUMROAD_ACCESS_TOKEN}`;

      const response = await this.makeRequest<GumroadProductsResponse>(url, {
        method: 'GET',
      });

      if (!response.success) {
        throw new MerchantError(
          'Gumroad API request failed',
          MerchantErrorType.API_ERROR
        );
      }

      const merchantId = await this.getMerchantId();

      // Filter products by query if provided
      let products = response.products;
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        products = products.filter(p =>
          p.name.toLowerCase().includes(queryLower) ||
          p.description?.toLowerCase().includes(queryLower)
        );
      }

      // Filter by published status
      products = products.filter(p => p.published);

      // Apply pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = products.slice(startIndex, endIndex);

      // Transform to our format
      const transformedProducts: ProductData[] = paginatedProducts.map(product =>
        this.transformGumroadProduct(product, merchantId)
      );

      return {
        products: transformedProducts,
        total: products.length,
        page,
        limit,
        has_more: endIndex < products.length,
      };

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Gumroad search error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get single Gumroad product
   */
  async getProduct(externalId: string): Promise<ProductData> {
    try {
      const url = `${this.BASE_URL}/products/${externalId}?access_token=${this.env.GUMROAD_ACCESS_TOKEN}`;

      const response = await this.makeRequest<GumroadProductResponse>(url, {
        method: 'GET',
      });

      if (!response.success) {
        throw new MerchantError(
          'Failed to fetch Gumroad product',
          MerchantErrorType.API_ERROR
        );
      }

      const merchantId = await this.getMerchantId();
      return this.transformGumroadProduct(response.product, merchantId);

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Gumroad product fetch error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Generate Gumroad affiliate link
   * Gumroad uses recommended_by parameter for affiliates
   */
  async getAffiliateLink(params: AffiliateLinkParams): Promise<string> {
    try {
      // Gumroad affiliate links use format:
      // https://gumroad.com/l/{permalink}?recommended_by={affiliate_code}

      const url = new URL(params.productUrl);

      // Add affiliate parameter
      url.searchParams.set('recommended_by', params.affiliateId);

      // Add sub-ID if provided
      if (params.subId) {
        url.searchParams.set('source', params.subId);
      }

      // Add custom params
      if (params.customParams) {
        for (const [key, value] of Object.entries(params.customParams)) {
          url.searchParams.set(key, value);
        }
      }

      return url.toString();

    } catch (error) {
      throw new MerchantError(
        `Failed to generate Gumroad affiliate link: ${(error as Error).message}`,
        MerchantErrorType.INVALID_PARAMS,
        error
      );
    }
  }

  /**
   * Validate Gumroad API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Test by fetching user's products
      const url = `${this.BASE_URL}/products?access_token=${this.env.GUMROAD_ACCESS_TOKEN}`;

      const response = await this.makeRequest<GumroadProductsResponse>(url, {
        method: 'GET',
      });

      return response.success;

    } catch (error) {
      console.error('Gumroad credential validation failed:', error);
      return false;
    }
  }

  /**
   * Import all Gumroad products
   * Useful for bulk import feature
   */
  async importAllProducts(): Promise<ProductData[]> {
    try {
      const url = `${this.BASE_URL}/products?access_token=${this.env.GUMROAD_ACCESS_TOKEN}`;

      const response = await this.makeRequest<GumroadProductsResponse>(url, {
        method: 'GET',
      });

      if (!response.success) {
        throw new MerchantError(
          'Failed to import Gumroad products',
          MerchantErrorType.API_ERROR
        );
      }

      const merchantId = await this.getMerchantId();

      // Only import published products
      const publishedProducts = response.products.filter(p => p.published);

      return publishedProducts.map(product =>
        this.transformGumroadProduct(product, merchantId)
      );

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Gumroad bulk import error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Helper: Transform Gumroad product to our format
   */
  private transformGumroadProduct(product: GumroadProduct, merchantId: string): ProductData {
    // Gumroad products are digital, so always "in stock"
    const availability: 'in_stock' | 'out_of_stock' | 'unknown' =
      product.published ? 'in_stock' : 'out_of_stock';

    // Price is in cents for USD, but API also provides formatted price
    const price = product.price / 100; // Convert cents to dollars

    // Use thumbnail or preview image
    const imageUrl = product.thumbnail_url || product.preview_url || '';

    // Gumroad URLs can be short_url or full url
    const productUrl = product.url || product.short_url;

    // Clean description (may contain HTML)
    const description = product.description
      ? this.stripHtml(product.description)
      : '';

    return {
      merchant_id: merchantId,
      external_id: product.id,
      product_name: product.name,
      description,
      price,
      currency: product.currency || 'USD',
      image_url: imageUrl,
      product_url: productUrl,
      category: 'Digital Product', // Gumroad doesn't categorize
      availability,
      features: this.extractFeatures(product),
      data_cache: product,
    };
  }

  /**
   * Helper: Extract features from Gumroad product
   */
  private extractFeatures(product: GumroadProduct): string[] {
    const features: string[] = [];

    // Add info about what's included
    if (product.file_info) {
      const fileInfo = product.file_info;
      if (fileInfo.pdf) features.push('Includes PDF');
      if (fileInfo.video) features.push('Includes Video');
      if (fileInfo.audio) features.push('Includes Audio');
    }

    // Add sales info if available
    if (product.sales_count && product.sales_count > 0) {
      features.push(`${product.sales_count} sales`);
    }

    return features;
  }

  /**
   * Helper: Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Helper: Get merchant ID from database
   */
  private async getMerchantId(): Promise<string> {
    return 'gumroad-merchant-id'; // Placeholder
  }
}
