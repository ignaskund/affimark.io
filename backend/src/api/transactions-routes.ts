/**
 * Affiliate Transactions API Routes
 * Unified earnings data with multi-currency normalization
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { CSVImporterService } from '../services/csv-importer';
import { CurrencyConverterService } from '../services/currency-converter';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  BACKEND_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/transactions
 * Get all transactions for user with filters
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 * - platform: 'amazon_de', 'awin', etc.
 * - limit: number (default 100)
 */
app.get('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date') || new Date().toISOString().split('T')[0];
    const platform = c.req.query('platform');
    const limit = parseInt(c.req.query('limit') || '100');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('affiliate_transactions')
      .select('*')
      .eq('user_id', userId)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('[Transactions] Fetch error:', error);
      return c.json({ error: 'Failed to fetch transactions' }, 500);
    }

    return c.json({ transactions });
  } catch (error) {
    console.error('[Transactions] Unexpected error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/transactions/summary
 * Get earnings summary (total, breakdown by platform, growth)
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 */
app.get('/summary', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date') || new Date().toISOString().split('T')[0];

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Get total earnings
    const { data: totalData } = await supabase.rpc('get_total_earnings', {
      p_user_id: userId,
      p_start_date: startDate || null,
      p_end_date: endDate,
    });

    // Get growth rate
    const { data: growthData } = await supabase.rpc('get_earnings_growth', {
      p_user_id: userId,
      p_months_back: 1,
    });

    // Get top storefronts
    const { data: storefrontsData } = await supabase.rpc('get_top_storefronts', {
      p_user_id: userId,
      p_limit: 5,
      p_start_date: startDate || null,
      p_end_date: endDate,
    });

    // Get breakdown by platform
    let query = supabase
      .from('affiliate_transactions')
      .select('platform, commission_eur, clicks, orders')
      .eq('user_id', userId)
      .lte('transaction_date', endDate);

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    const { data: transactions } = await query;

    const breakdown = transactions?.reduce((acc: any, t: any) => {
      if (!acc[t.platform]) {
        acc[t.platform] = {
          platform: t.platform,
          commission: 0,
          clicks: 0,
          orders: 0,
        };
      }
      acc[t.platform].commission += parseFloat(t.commission_eur || 0);
      acc[t.platform].clicks += t.clicks || 0;
      acc[t.platform].orders += t.orders || 0;
      return acc;
    }, {});

    return c.json({
      summary: {
        total_earnings: totalData || 0,
        growth_rate: growthData,
        breakdown: breakdown ? Object.values(breakdown) : [],
        top_storefronts: storefrontsData || [],
      },
    });
  } catch (error) {
    console.error('[Transactions] Summary error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/transactions/import
 * Import transactions from CSV upload
 *
 * Body: {
 *   connected_account_id: string,
 *   platform: 'amazon_de' | 'amazon_uk' | 'ltk' | etc.,
 *   csv_data: string (base64 or raw CSV text)
 * }
 */
app.post('/import', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const { connected_account_id, platform, csv_data } = body;

    if (!connected_account_id || !platform || !csv_data) {
      return c.json({ error: 'Account ID, platform, and CSV data required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('id', connected_account_id)
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Import CSV
    const importerService = new CSVImporterService(supabase);
    const currencyService = new CurrencyConverterService(supabase);

    const result = await importerService.importCSV({
      userId,
      connectedAccountId: connected_account_id,
      platform,
      csvData: csv_data,
      currencyConverter: currencyService,
    });

    // Update account sync status
    await supabase
      .from('connected_accounts')
      .update({
        sync_status: result.success ? 'success' : 'error',
        sync_error: result.error || null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connected_account_id);

    return c.json({
      success: result.success,
      imported_count: result.importedCount,
      skipped_count: result.skippedCount,
      error: result.error,
    });
  } catch (error) {
    console.error('[Transactions] Import error:', error);
    return c.json({ error: 'Import failed' }, 500);
  }
});

export default app;
