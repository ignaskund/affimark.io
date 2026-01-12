
/**
 * Analytics API Routes
 * Shop and product performance analytics
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { AnalyticsAggregationService } from '../services/analytics-aggregation';
import { ConversionSyncService } from '../services/conversion-sync';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  BACKEND_API_KEY?: string;
  // Optional affiliate keys (may be undefined in local/dev)
  IMPACT_API_KEY?: string;
  AMAZON_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/analytics/shop
 * Get shop-level analytics
 */
app.get('/shop', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const days = parseInt(c.req.query('days') || '30');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const analyticsService = new AnalyticsAggregationService(supabase);

    const analytics = await analyticsService.getShopAnalytics(userId, days);

    return c.json({ analytics });
  } catch (error) {
    console.error('[Analytics] Shop analytics error:', error);
    return c.json({ error: 'Failed to fetch shop analytics' }, 500);
  }
});

/**
 * GET /api/analytics/products
 * Get analytics for all products
 */
app.get('/products', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const days = parseInt(c.req.query('days') || '30');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Get shop analytics which includes top products
    const analyticsService = new AnalyticsAggregationService(supabase);
    const shopAnalytics = await analyticsService.getShopAnalytics(userId, days);

    return c.json({
      top_products: shopAnalytics.top_products,
      underperforming_products: shopAnalytics.underperforming_products,
    });
  } catch (error) {
    console.error('[Analytics] Products analytics error:', error);
    return c.json({ error: 'Failed to fetch product analytics' }, 500);
  }
});

/**
 * GET /api/analytics/product/:productId
 * Get detailed analytics for a specific product
 */
app.get('/product/:productId', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const productId = c.req.param('productId');
    const days = parseInt(c.req.query('days') || '30');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const analyticsService = new AnalyticsAggregationService(supabase);

    const analytics = await analyticsService.getProductAnalytics(userId, productId, days);

    if (!analytics) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json({ analytics });
  } catch (error) {
    console.error('[Analytics] Product analytics error:', error);
    return c.json({ error: 'Failed to fetch product analytics' }, 500);
  }
});

/**
 * GET /api/analytics/trends
 * Get historical trend data
 */
app.get('/trends', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const period = (c.req.query('period') || 'daily') as 'daily' | 'weekly' | 'monthly';
    const days = parseInt(c.req.query('days') || '90');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const analyticsService = new AnalyticsAggregationService(supabase);

    const trends = await analyticsService.getTrends(userId, period, days);

    return c.json({ trends });
  } catch (error) {
    console.error('[Analytics] Trends error:', error);
    return c.json({ error: 'Failed to fetch trends' }, 500);
  }
});

/**
 * GET /api/analytics/export
 * Export analytics to CSV
 */
app.get('/export', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const days = parseInt(c.req.query('days') || '30');
    const format = c.req.query('format') || 'csv';

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const analyticsService = new AnalyticsAggregationService(supabase);

    const analytics = await analyticsService.getShopAnalytics(userId, days);

    if (format === 'csv') {
      // Generate CSV for top products
      const csvLines = [
        'Product Name,Clicks,Conversions,Revenue,Conversion Rate',
        ...analytics.top_products.map(p =>
          `"${p.product_name}",${p.clicks},${p.conversions},${p.revenue.toFixed(2)},${p.conversion_rate.toFixed(2)}%`
        ),
      ];

      const csv = csvLines.join('\n');

      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`,
      });
    } else if (format === 'json') {
      return c.json({ analytics });
    }

    return c.json({ error: 'Invalid format. Use csv or json' }, 400);
  } catch (error) {
    console.error('[Analytics] Export error:', error);
    return c.json({ error: 'Failed to export analytics' }, 500);
  }
});

/**
 * POST /api/analytics/sync-conversions
 * Sync conversions from affiliate networks
 */
app.post('/sync-conversions', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const conversionService = new ConversionSyncService(
      supabase,
      c.env.IMPACT_API_KEY,
      c.env.AMAZON_API_KEY
    );

    const result = await conversionService.syncAllNetworks(userId);

    return c.json({
      message: 'Conversion sync completed',
      synced: result.synced,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Analytics] Conversion sync error:', error);
    return c.json({ error: 'Failed to sync conversions' }, 500);
  }
});

/**
 * POST /api/analytics/import-conversions
 * Import conversions from CSV
 */
app.post('/import-conversions', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const { csvContent, network } = await c.req.json();

    if (!csvContent || !network) {
      return c.json({ error: 'CSV content and network required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const conversionService = new ConversionSyncService(supabase);

    const result = await conversionService.importConversionsFromCSV(
      userId,
      csvContent,
      network
    );

    return c.json({
      message: 'Conversion import completed',
      imported: result.imported,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Analytics] Import error:', error);
    return c.json({ error: 'Failed to import conversions' }, 500);
  }
});

export default app;
