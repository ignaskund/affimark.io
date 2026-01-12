import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AdapterFactory,
  ProductSearchParams,
  ProductSearchResult,
  ProductData,
  MerchantEnv,
  MerchantError
} from '../merchants';

export class ProductDataService {
  private supabase: SupabaseClient;
  private env: MerchantEnv;

  // Cache duration in milliseconds
  private readonly CACHE_DURATION = {
    amazon: 24 * 60 * 60 * 1000,      // 24 hours for Amazon (prices change frequently)
    shopify: 7 * 24 * 60 * 60 * 1000, // 7 days for Shopify (creator's own products)
    gumroad: 7 * 24 * 60 * 60 * 1000, // 7 days for Gumroad (digital products, stable)
  };

  constructor(supabaseUrl: string, supabaseKey: string, env: MerchantEnv) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.env = env;
  }

  /**
   * Search products across one or multiple merchants
   */
  async searchProducts(
    params: ProductSearchParams,
    merchantKeys?: string[]
  ): Promise<ProductSearchResult> {
    try {
      // If no merchants specified, search all available
      const merchants = merchantKeys || AdapterFactory.getAvailableMerchants();

      // Search each merchant
      const searchPromises = merchants.map(async (merchantKey) => {
        try {
          // Get merchant ID from database
          const { data: merchant } = await this.supabase
            .from('merchants')
            .select('id, merchant_key')
            .eq('merchant_key', merchantKey)
            .eq('is_active', true)
            .single();

          if (!merchant) {
            console.warn(`Merchant ${merchantKey} not found in database`);
            return { products: [], total: 0, page: 1, limit: 0, has_more: false };
          }

          // Create adapter
          const adapter = AdapterFactory.createAdapter(merchantKey, this.env);

          // Search
          const result = await adapter.search(params);

          // Cache results
          await this.cacheProducts(result.products, merchantKey);

          return result;

        } catch (error) {
          console.error(`Search error for ${merchantKey}:`, error);
          // Don't fail entire search if one merchant fails
          return { products: [], total: 0, page: 1, limit: 0, has_more: false };
        }
      });

      // Wait for all searches to complete
      const results = await Promise.all(searchPromises);

      // Combine results
      const allProducts = results.flatMap(r => r.products);
      const totalCount = results.reduce((sum, r) => sum + r.total, 0);

      // Apply pagination to combined results
      const page = params.page || 1;
      const limit = params.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = allProducts.slice(startIndex, endIndex);

      return {
        products: paginatedProducts,
        total: totalCount,
        page,
        limit,
        has_more: endIndex < allProducts.length,
      };

    } catch (error) {
      console.error('Product search error:', error);
      throw error;
    }
  }

  /**
   * Get product details (checks cache first)
   */
  async getProduct(merchantKey: string, externalId: string): Promise<ProductData> {
    try {
      // Check cache first
      const cached = await this.getCachedProduct(merchantKey, externalId);
      if (cached) {
        console.log(`Cache hit for ${merchantKey}:${externalId}`);
        return cached;
      }

      // Cache miss - fetch from API
      console.log(`Cache miss for ${merchantKey}:${externalId}, fetching from API`);
      const adapter = AdapterFactory.createAdapter(merchantKey, this.env);
      const product = await adapter.getProduct(externalId);

      // Cache the result
      await this.cacheProduct(product, merchantKey);

      return product;

    } catch (error) {
      console.error('Get product error:', error);
      throw error;
    }
  }

  /**
   * Refresh cached product data
   */
  async refreshProduct(merchantKey: string, externalId: string): Promise<ProductData> {
    try {
      // Fetch fresh data from API
      const adapter = AdapterFactory.createAdapter(merchantKey, this.env);
      const product = await adapter.getProduct(externalId);

      // Update cache
      await this.updateCachedProduct(product, merchantKey);

      return product;

    } catch (error) {
      console.error('Refresh product error:', error);
      throw error;
    }
  }

  /**
   * Bulk refresh products (for scheduled jobs)
   */
  async refreshProducts(products: Array<{ merchantKey: string; externalId: string }>) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ product: any; error: string }>,
    };

    for (const product of products) {
      try {
        await this.refreshProduct(product.merchantKey, product.externalId);
        results.success++;

        // Rate limiting: small delay between requests
        await this.delay(100);

      } catch (error) {
        console.error(`Failed to refresh ${product.merchantKey}:${product.externalId}`, error);
        results.failed++;
        results.errors.push({
          product,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Cache product data
   */
  private async cacheProduct(product: ProductData, merchantKey: string): Promise<void> {
    try {
      const cacheDuration = this.getCacheDuration(merchantKey);
      const expiresAt = new Date(Date.now() + cacheDuration);

      await this.supabase
        .from('products')
        .upsert({
          merchant_id: product.merchant_id,
          external_id: product.external_id,
          product_name: product.product_name,
          description: product.description,
          current_price: product.price,
          currency: product.currency,
          image_url: product.image_url,
          product_url: product.product_url,
          category: product.category,
          brand: product.brand,
          is_available: product.availability === 'in_stock',
          data_cache: product.data_cache,
          last_refreshed: new Date().toISOString(),
          // Note: expires_at would need to be added to products table
        }, {
          onConflict: 'merchant_id,external_id',
        });

    } catch (error) {
      console.error('Cache product error:', error);
      // Don't throw - caching failure shouldn't break the request
    }
  }

  /**
   * Cache multiple products (bulk operation)
   */
  private async cacheProducts(products: ProductData[], merchantKey: string): Promise<void> {
    try {
      const records = products.map(product => ({
        merchant_id: product.merchant_id,
        external_id: product.external_id,
        product_name: product.product_name,
        description: product.description,
        current_price: product.price,
        currency: product.currency,
        image_url: product.image_url,
        product_url: product.product_url,
        category: product.category,
        brand: product.brand,
        is_available: product.availability === 'in_stock',
        data_cache: product.data_cache,
        last_refreshed: new Date().toISOString(),
      }));

      // Batch insert/update
      await this.supabase
        .from('products')
        .upsert(records, {
          onConflict: 'merchant_id,external_id',
        });

    } catch (error) {
      console.error('Bulk cache error:', error);
    }
  }

  /**
   * Get cached product
   */
  private async getCachedProduct(
    merchantKey: string,
    externalId: string
  ): Promise<ProductData | null> {
    try {
      // Get merchant ID
      const { data: merchant } = await this.supabase
        .from('merchants')
        .select('id')
        .eq('merchant_key', merchantKey)
        .single();

      if (!merchant) return null;

      // Get cached product
      const { data: cached } = await this.supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('external_id', externalId)
        .single();

      if (!cached) return null;

      // Check if cache is still valid
      const cacheDuration = this.getCacheDuration(merchantKey);
      const lastRefreshed = new Date(cached.last_refreshed).getTime();
      const now = Date.now();

      if (now - lastRefreshed > cacheDuration) {
        console.log('Cache expired for', merchantKey, externalId);
        return null; // Cache expired
      }

      // Transform from database format to ProductData
      return {
        merchant_id: cached.merchant_id,
        external_id: cached.external_id,
        product_name: cached.product_name,
        description: cached.description || '',
        price: cached.current_price,
        currency: cached.currency,
        image_url: cached.image_url,
        product_url: cached.product_url,
        category: cached.category,
        brand: cached.brand,
        availability: cached.is_available ? 'in_stock' : 'out_of_stock',
        data_cache: cached.data_cache,
      };

    } catch (error) {
      console.error('Get cached product error:', error);
      return null;
    }
  }

  /**
   * Update cached product
   */
  private async updateCachedProduct(product: ProductData, merchantKey: string): Promise<void> {
    // Same as cacheProduct - upsert handles update
    await this.cacheProduct(product, merchantKey);
  }

  /**
   * Get cache duration for merchant
   */
  private getCacheDuration(merchantKey: string): number {
    const key = merchantKey.toLowerCase() as keyof typeof this.CACHE_DURATION;
    return this.CACHE_DURATION[key] || this.CACHE_DURATION.amazon;
  }

  /**
   * Helper: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get products that need refresh (for scheduled job)
   */
  async getProductsNeedingRefresh(limit: number = 100): Promise<Array<{ merchantKey: string; externalId: string; productId: string }>> {
    try {
      // Get products that haven't been refreshed recently
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: products } = await this.supabase
        .from('products')
        .select(`
          id,
          external_id,
          last_refreshed,
          merchant:merchant_id (
            merchant_key
          )
        `)
        .lt('last_refreshed', oneDayAgo)
        .limit(limit);

      if (!products) return [];

      return products.map((p: any) => ({
        productId: p.id,
        merchantKey: p.merchant.merchant_key,
        externalId: p.external_id,
      }));

    } catch (error) {
      console.error('Get products needing refresh error:', error);
      return [];
    }
  }
}
