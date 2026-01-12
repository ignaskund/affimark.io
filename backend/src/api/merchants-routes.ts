/**
 * Merchants API
 * Manage supported merchants and creator credentials
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

// Supabase client helper
const getSupabase = (c: any) => {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

/**
 * Get all merchants
 * GET /api/merchants
 */
app.get('/', async (c) => {
  try {
    const supabase = getSupabase(c);

    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true)
      .order('merchant_name');

    if (error) throw error;

    return c.json({ merchants: data });
  } catch (error: any) {
    console.error('Error fetching merchants:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get user's merchant credentials
 * GET /api/merchants/credentials
 */
app.get('/credentials', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabase
      .from('merchant_credentials')
      .select(`
        *,
        merchants:merchant_id (
          id,
          merchant_slug,
          merchant_name,
          merchant_type,
          logo_url
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    return c.json({ credentials: data });
  } catch (error: any) {
    console.error('Error fetching merchant credentials:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get merchant connections status
 * GET /api/merchants/connections
 */
app.get('/connections', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all merchants
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    if (merchantsError) throw merchantsError;

    // Get user's credentials
    const { data: credentials, error: credError } = await supabase
      .from('merchant_credentials')
      .select('*')
      .eq('user_id', userId);

    if (credError) throw credError;

    // Build connections array
    const connections = merchants?.map((merchant) => {
      const cred = credentials?.find((c) => c.merchant_id === merchant.id);
      return {
        merchant_key: merchant.merchant_slug,
        merchant_name: merchant.merchant_name,
        is_connected: cred?.is_connected || false,
        credentials: cred ? {
          shopDomain: cred.api_key, // For Shopify, we store domain as api_key
          accessToken: cred.access_token,
        } : undefined,
      };
    });

    return c.json({ connections });
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Connect merchant (add/update credentials)
 * POST /api/merchants/connect
 */
app.post('/connect', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      merchant_id,
      api_key,
      api_secret,
      access_token,
      refresh_token,
      affiliate_id,
    } = body;

    if (!merchant_id) {
      return c.json({ error: 'merchant_id required' }, 400);
    }

    // Upsert merchant credentials
    const { data, error } = await supabase
      .from('merchant_credentials')
      .upsert({
        user_id: userId,
        merchant_id,
        api_key,
        api_secret,
        access_token,
        refresh_token,
        affiliate_id,
        is_connected: true,
        last_verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ credential: data });
  } catch (error: any) {
    console.error('Error connecting merchant:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Disconnect merchant
 * DELETE /api/merchants/:merchant_id/disconnect
 */
app.delete('/:merchant_id/disconnect', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const merchantId = c.req.param('merchant_id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { error } = await supabase
      .from('merchant_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('merchant_id', merchantId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting merchant:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Disconnect merchant (POST version for easier frontend usage)
 * POST /api/merchants/disconnect
 */
app.post('/disconnect', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { merchant_key } = body;

    if (!merchant_key) {
      return c.json({ error: 'merchant_key required' }, 400);
    }

    // Get merchant ID from slug
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('merchant_slug', merchant_key)
      .single();

    if (!merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    const { error } = await supabase
      .from('merchant_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('merchant_id', merchant.id);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting merchant:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
