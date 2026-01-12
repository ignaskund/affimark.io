/**
 * Shopify API Adapter
 * Import products from Shopify stores
 * Docs: https://shopify.dev/docs/api/admin-rest
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

interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle: string;
  images: Array<{
    id: number;
    src: string;
  }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    compare_at_price?: string;
    inventory_quantity?: number;
    available?: boolean;
  }>;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

export class ShopifyAdapter extends BaseAdapter {
  private shopDomain: string = '';
  private accessToken: string = '';

  constructor(env: MerchantEnv, shopDomain?: string, accessToken?: string) {
    super(env);

    // Shopify adapter requires shop-specific credentials
    if (shopDomain && accessToken) {
      this.shopDomain = shopDomain;
      this.accessToken = accessToken;
    }
  }

  /**
   * Set shop credentials (for per-creator connections)
   */
  setShopCredentials(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
  }

  getMerchantName(): string {
    return 'Shopify';
  }

  getMerchantKey(): string {
    return 'shopify';
  }

  /**
   * Search/list products from Shopify store
   * Note: Shopify doesn't have a native search API, so we filter by title
   */
  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    try {
      this.validateShopCredentials();

      const limit = params.limit || 50;
      const page = params.page || 1;

      // Shopify uses limit & page_info for pagination (or limit & page for older versions)
      const url = `https://${this.shopDomain}/admin/api/2024-01/products.json?limit=${limit}`;

      const response = await this.makeRequest<ShopifyProductsResponse>(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      });

      const merchantId = await this.getMerchantId();

      // Filter products by query if provided
      let products = response.products;
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        products = products.filter(p =>
          p.title.toLowerCase().includes(queryLower) ||
          p.body_html?.toLowerCase().includes(queryLower) ||
          p.vendor?.toLowerCase().includes(queryLower)
        );
      }

      // Transform to our format
      const transformedProducts: ProductData[] = products.map(product =>
        this.transformShopifyProduct(product, merchantId)
      );

      return {
        products: transformedProducts,
        total: transformedProducts.length,
        page,
        limit,
        has_more: products.length >= limit,
      };

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Shopify search error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get single product from Shopify
   */
  async getProduct(externalId: string): Promise<ProductData> {
    try {
      this.validateShopCredentials();

      const url = `https://${this.shopDomain}/admin/api/2024-01/products/${externalId}.json`;

      const response = await this.makeRequest<{ product: ShopifyProduct }>(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      });

      const merchantId = await this.getMerchantId();
      return this.transformShopifyProduct(response.product, merchantId);

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Shopify product fetch error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Generate product link (not affiliate, but direct Shopify product URL)
   */
  async getAffiliateLink(params: AffiliateLinkParams): Promise<string> {
    // Shopify products don't use traditional affiliate links
    // Return the product URL as-is, or add tracking parameters
    try {
      const url = new URL(params.productUrl);

      // Add custom tracking parameters if provided
      if (params.subId) {
        url.searchParams.set('ref', params.subId);
      }

      if (params.customParams) {
        for (const [key, value] of Object.entries(params.customParams)) {
          url.searchParams.set(key, value);
        }
      }

      return url.toString();

    } catch (error) {
      throw new MerchantError(
        `Failed to generate Shopify link: ${(error as Error).message}`,
        MerchantErrorType.INVALID_PARAMS,
        error
      );
    }
  }

  /**
   * Validate Shopify store credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      this.validateShopCredentials();

      // Test API access by fetching shop info
      const url = `https://${this.shopDomain}/admin/api/2024-01/shop.json`;

      await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      });

      return true;

    } catch (error) {
      console.error('Shopify credential validation failed:', error);
      return false;
    }
  }

  /**
   * Import all products from a Shopify store
   * Used for bulk import feature
   */
  async importAllProducts(): Promise<ProductData[]> {
    try {
      this.validateShopCredentials();

      const allProducts: ProductData[] = [];
      let hasMore = true;
      let sinceId = 0;

      const merchantId = await this.getMerchantId();

      while (hasMore) {
        const url = `https://${this.shopDomain}/admin/api/2024-01/products.json?limit=250&since_id=${sinceId}`;

        const response = await this.makeRequest<ShopifyProductsResponse>(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
          },
        });

        if (response.products.length === 0) {
          hasMore = false;
          break;
        }

        // Transform and add to results
        const transformed = response.products.map(p =>
          this.transformShopifyProduct(p, merchantId)
        );
        allProducts.push(...transformed);

        // Update since_id for next page
        sinceId = response.products[response.products.length - 1].id;

        // Rate limiting: Shopify allows 2 requests/second
        await this.delay(500);
      }

      return allProducts;

    } catch (error) {
      if (error instanceof MerchantError) throw error;
      throw new MerchantError(
        `Shopify bulk import error: ${(error as Error).message}`,
        MerchantErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Helper: Transform Shopify product to our format
   */
  private transformShopifyProduct(product: ShopifyProduct, merchantId: string): ProductData {
    // Get primary variant (usually first one)
    const primaryVariant = product.variants[0];

    // Calculate availability based on inventory
    let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
    if (primaryVariant.available !== undefined) {
      availability = primaryVariant.available ? 'in_stock' : 'out_of_stock';
    } else if (primaryVariant.inventory_quantity !== undefined) {
      availability = primaryVariant.inventory_quantity > 0 ? 'in_stock' : 'out_of_stock';
    }

    // Get price
    const price = this.normalizePrice(primaryVariant.price);
    const originalPrice = primaryVariant.compare_at_price
      ? this.normalizePrice(primaryVariant.compare_at_price)
      : undefined;

    // Get images
    const imageUrl = product.images[0]?.src || '';
    const additionalImages = product.images.slice(1).map(img => img.src);

    // Build product URL
    const productUrl = `https://${this.shopDomain}/products/${product.handle}`;

    // Strip HTML from description
    const description = product.body_html
      ? this.stripHtml(product.body_html)
      : '';

    return {
      merchant_id: merchantId,
      external_id: product.id.toString(),
      product_name: product.title,
      description,
      price,
      currency: 'USD', // Shopify default, should be fetched from shop settings
      original_price: originalPrice,
      image_url: imageUrl,
      additional_images: additionalImages,
      product_url: productUrl,
      category: product.product_type,
      brand: product.vendor,
      availability,
      stock_quantity: primaryVariant.inventory_quantity,
      data_cache: product,
    };
  }

  /**
   * Helper: Validate shop credentials are set
   */
  private validateShopCredentials() {
    if (!this.shopDomain || !this.accessToken) {
      throw new MerchantError(
        'Shop credentials not set. Call setShopCredentials() first.',
        MerchantErrorType.AUTHENTICATION_ERROR
      );
    }
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
      .trim();
  }

  /**
   * Helper: Get merchant ID from database
   */
  private async getMerchantId(): Promise<string> {
    return 'shopify-merchant-id'; // Placeholder
  }
}
