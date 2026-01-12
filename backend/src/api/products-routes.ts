/**
 * Products API Routes
 * Search and fetch product data from various merchants
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { ProductDataService } from '../services/product-data';
import { MerchantEnv } from '../merchants';

const app = new Hono();

// Helper to get Supabase client
const getSupabase = (c: any) => {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );
};

// Helper to get ProductDataService
const getProductService = (c: any): ProductDataService => {
  const env: MerchantEnv = {
    SUPABASE_URL: c.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: c.env.SUPABASE_SERVICE_KEY,
    RAINFOREST_API_KEY: c.env.RAINFOREST_API_KEY,
    SHOPIFY_APP_CLIENT_ID: c.env.SHOPIFY_APP_CLIENT_ID,
    SHOPIFY_APP_CLIENT_SECRET: c.env.SHOPIFY_APP_CLIENT_SECRET,
    SHOPIFY_API_KEY: c.env.SHOPIFY_API_KEY,
    GUMROAD_ACCESS_TOKEN: c.env.GUMROAD_ACCESS_TOKEN,
    IMPACT_ACCOUNT_SID: c.env.IMPACT_ACCOUNT_SID,
    IMPACT_AUTH_TOKEN: c.env.IMPACT_AUTH_TOKEN,
  };

  return new ProductDataService(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY,
    env
  );
};

/**
 * Search products across merchants
 * POST /api/products/search
 *
 * Body:
 * {
 *   query: string,
 *   merchants?: string[],  // Optional: ['amazon', 'shopify']
 *   page?: number,
 *   limit?: number,
 *   filters?: {
 *     minPrice?: number,
 *     maxPrice?: number,
 *     category?: string,
 *     brand?: string,
 *     inStockOnly?: boolean
 *   }
 * }
 */
app.post('/search', async (c) => {
  try {
    const body = await c.req.json();
    const { query, merchants, page, limit, filters } = body;

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    const productService = getProductService(c);

    const result = await productService.searchProducts(
      {
        query: query.trim(),
        page: page || 1,
        limit: limit || 20,
        filters: filters || {},
      },
      merchants
    );

    return c.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    console.error('Product search error:', error);
    return c.json({
      success: false,
      error: error.message || 'Product search failed',
    }, 500);
  }
});

/**
 * Get single product details
 * GET /api/products/:merchantKey/:externalId
 */
app.get('/:merchantKey/:externalId', async (c) => {
  try {
    const merchantKey = c.req.param('merchantKey');
    const externalId = c.req.param('externalId');

    if (!merchantKey || !externalId) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const productService = getProductService(c);

    const product = await productService.getProduct(merchantKey, externalId);

    return c.json({
      success: true,
      product,
    });

  } catch (error: any) {
    console.error('Get product error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch product',
    }, 500);
  }
});

/**
 * Refresh product data (force cache update)
 * POST /api/products/refresh
 *
 * Body:
 * {
 *   products: Array<{
 *     merchantKey: string,
 *     externalId: string
 *   }>
 * }
 */
app.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return c.json({ error: 'Products array is required' }, 400);
    }

    const productService = getProductService(c);

    const results = await productService.refreshProducts(products);

    return c.json({
      success: true,
      results: {
        total: products.length,
        updated: results.success,
        failed: results.failed,
        errors: results.errors,
      },
    });

  } catch (error: any) {
    console.error('Refresh products error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to refresh products',
    }, 500);
  }
});

/**
 * Import products from external source
 * POST /api/products/import
 *
 * Body:
 * {
 *   source: 'shopify' | 'gumroad',
 *   credentials: {
 *     // For Shopify:
 *     shopDomain: string,
 *     accessToken: string
 *     // For Gumroad:
 *     // (uses environment GUMROAD_ACCESS_TOKEN)
 *   }
 * }
 */
app.post('/import', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const { source, credentials } = body;

    if (!source) {
      return c.json({ error: 'Source parameter is required' }, 400);
    }

    const supabase = getSupabase(c);

    // Import based on source
    if (source === 'shopify') {
      if (!credentials?.shopDomain || !credentials?.accessToken) {
        return c.json({ error: 'Shopify credentials required (shopDomain, accessToken)' }, 400);
      }

      // Import Shopify products
      const { ShopifyAdapter } = await import('../merchants');
      const env: MerchantEnv = {
        SUPABASE_URL: c.env.SUPABASE_URL,
        SUPABASE_SERVICE_KEY: c.env.SUPABASE_SERVICE_KEY,
      };

      const adapter = new ShopifyAdapter(env, credentials.shopDomain, credentials.accessToken);
      const products = await adapter.importAllProducts();

      // Save to inventory
      const inventoryRecords = products.map(product => ({
        user_id: userId,
        product_id: null, // Will be created if doesn't exist
        merchant_id: product.merchant_id,
        external_product_id: product.external_id,
        product_name: product.product_name,
        product_url: product.product_url,
        image_url: product.image_url,
        current_price: product.price,
        status: 'active',
      }));

      const { data, error } = await supabase
        .from('inventory_items')
        .insert(inventoryRecords)
        .select();

      if (error) throw error;

      return c.json({
        success: true,
        imported: data.length,
        skipped: products.length - data.length,
        products: data,
      });

    } else if (source === 'gumroad') {
      // Import Gumroad products
      const { GumroadAdapter } = await import('../merchants');
      const env: MerchantEnv = {
        SUPABASE_URL: c.env.SUPABASE_URL,
        SUPABASE_SERVICE_KEY: c.env.SUPABASE_SERVICE_KEY,
        GUMROAD_ACCESS_TOKEN: c.env.GUMROAD_ACCESS_TOKEN,
      };

      const adapter = new GumroadAdapter(env);
      const products = await adapter.importAllProducts();

      // Save to inventory
      const inventoryRecords = products.map(product => ({
        user_id: userId,
        product_id: null,
        merchant_id: product.merchant_id,
        external_product_id: product.external_id,
        product_name: product.product_name,
        product_url: product.product_url,
        image_url: product.image_url,
        current_price: product.price,
        status: 'active',
      }));

      const { data, error } = await supabase
        .from('inventory_items')
        .insert(inventoryRecords)
        .select();

      if (error) throw error;

      return c.json({
        success: true,
        imported: data.length,
        skipped: products.length - data.length,
        products: data,
      });

    } else {
      return c.json({ error: `Unsupported import source: ${source}` }, 400);
    }

  } catch (error: any) {
    console.error('Import products error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to import products',
    }, 500);
  }
});

/**
 * Get products from a specific merchant
 * GET /api/products/merchant/:merchantKey
 */
app.get('/merchant/:merchantKey', async (c) => {
  try {
    const merchantKey = c.req.param('merchantKey');
    const query = c.req.query('q') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!merchantKey) {
      return c.json({ error: 'Merchant key required' }, 400);
    }

    const productService = getProductService(c);

    const result = await productService.searchProducts(
      {
        query: query || 'popular', // Default query if none provided
        page,
        limit,
      },
      [merchantKey]
    );

    return c.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    console.error('Get merchant products error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch merchant products',
    }, 500);
  }
});

export default app;
