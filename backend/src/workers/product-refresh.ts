/**
 * Product Refresh Worker
 * Scheduled job to refresh product data (prices, availability)
 * Runs daily via Cloudflare Workers Cron
 */

import { ProductDataService } from '../services/product-data';
import { MerchantEnv } from '../merchants';

/**
 * Scheduled handler for Cloudflare Workers
 * Triggered by cron expression defined in wrangler.toml
 */
export async function handleProductRefresh(env: any): Promise<Response> {
  console.log('[Product Refresh] Starting scheduled refresh job');

  try {
    const merchantEnv: MerchantEnv = {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
      RAINFOREST_API_KEY: env.RAINFOREST_API_KEY,
      SHOPIFY_APP_CLIENT_ID: env.SHOPIFY_APP_CLIENT_ID,
      SHOPIFY_APP_CLIENT_SECRET: env.SHOPIFY_APP_CLIENT_SECRET,
      SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
      GUMROAD_ACCESS_TOKEN: env.GUMROAD_ACCESS_TOKEN,
      IMPACT_ACCOUNT_SID: env.IMPACT_ACCOUNT_SID,
      IMPACT_AUTH_TOKEN: env.IMPACT_AUTH_TOKEN,
    };

    const productService = new ProductDataService(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      merchantEnv
    );

    // Get products that need refresh
    // Limit to 100 per run to avoid timeouts
    const productsToRefresh = await productService.getProductsNeedingRefresh(100);

    if (productsToRefresh.length === 0) {
      console.log('[Product Refresh] No products need refresh');
      return new Response(JSON.stringify({
        success: true,
        message: 'No products need refresh',
        refreshed: 0,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Product Refresh] Found ${productsToRefresh.length} products to refresh`);

    // Refresh products
    const results = await productService.refreshProducts(productsToRefresh);

    console.log(`[Product Refresh] Completed: ${results.success} successful, ${results.failed} failed`);

    // Log errors if any
    if (results.errors.length > 0) {
      console.error('[Product Refresh] Errors:', results.errors);
    }

    return new Response(JSON.stringify({
      success: true,
      results: {
        total: productsToRefresh.length,
        successful: results.success,
        failed: results.failed,
        errors: results.errors,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Product Refresh] Job failed:', error);

    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Manual trigger endpoint for testing
 * POST /api/workers/refresh-products
 */
export async function handleManualRefresh(env: any, limit?: number): Promise<Response> {
  console.log('[Product Refresh] Manual refresh triggered');

  try {
    const merchantEnv: MerchantEnv = {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
      RAINFOREST_API_KEY: env.RAINFOREST_API_KEY,
      SHOPIFY_APP_CLIENT_ID: env.SHOPIFY_APP_CLIENT_ID,
      SHOPIFY_APP_CLIENT_SECRET: env.SHOPIFY_APP_CLIENT_SECRET,
      SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
      GUMROAD_ACCESS_TOKEN: env.GUMROAD_ACCESS_TOKEN,
    };

    const productService = new ProductDataService(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      merchantEnv
    );

    const productsToRefresh = await productService.getProductsNeedingRefresh(limit || 10);

    if (productsToRefresh.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No products need refresh',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = await productService.refreshProducts(productsToRefresh);

    return new Response(JSON.stringify({
      success: true,
      results: {
        total: productsToRefresh.length,
        successful: results.success,
        failed: results.failed,
        errors: results.errors,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
