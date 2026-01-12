/**
 * Connected Accounts API Routes
 * Multi-storefront connections (Amazon DE/UK/US, Awin, LTK, ShopMy, etc.)
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  BACKEND_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/accounts
 * Get all connected accounts for user
 */
app.get('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: accounts, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Accounts] Fetch error:', error);
      return c.json({ error: 'Failed to fetch accounts' }, 500);
    }

    return c.json({ accounts });
  } catch (error) {
    console.error('[Accounts] Unexpected error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/accounts
 * Create new connected account
 *
 * Body: {
 *   platform: 'amazon_de' | 'amazon_uk' | 'awin' | 'ltk' | 'shopmy' | 'tradedoubler',
 *   storefront_name: string,
 *   account_identifier: string,
 *   region?: string
 * }
 */
app.post('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const { platform, storefront_name, account_identifier, region } = body;

    if (!platform || !account_identifier) {
      return c.json({ error: 'Platform and account identifier required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: account, error } = await supabase
      .from('connected_accounts')
      .insert({
        user_id: userId,
        platform,
        storefront_name,
        account_identifier,
        region,
        sync_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[Accounts] Create error:', error);
      return c.json({ error: 'Failed to create account' }, 500);
    }

    return c.json({ account }, 201);
  } catch (error) {
    console.error('[Accounts] Unexpected error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/accounts/:id
 * Update connected account
 */
app.put('/:id', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const accountId = c.req.param('id');
    const body = await c.req.json();
    const { storefront_name, is_active } = body;

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: account, error } = await supabase
      .from('connected_accounts')
      .update({
        storefront_name,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Accounts] Update error:', error);
      return c.json({ error: 'Failed to update account' }, 500);
    }

    return c.json({ account });
  } catch (error) {
    console.error('[Accounts] Unexpected error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/accounts/:id
 * Delete connected account
 */
app.delete('/:id', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const accountId = c.req.param('id');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { error } = await supabase
      .from('connected_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Accounts] Delete error:', error);
      return c.json({ error: 'Failed to delete account' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('[Accounts] Unexpected error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
