/**
 * Affiliate Links API
 * Manage creator's affiliate links and discount codes
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
 * Get all affiliate links for user
 * GET /api/affiliate-links
 */
app.get('/', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const merchantId = c.req.query('merchant_id');
    const isActive = c.req.query('is_active');

    let query = supabase
      .from('affiliate_links')
      .select(`
        *,
        merchant:merchant_id (
          id,
          merchant_name,
          merchant_slug,
          logo_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    return c.json({ links: data });
  } catch (error: any) {
    console.error('Error fetching affiliate links:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get single affiliate link
 * GET /api/affiliate-links/:id
 */
app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const linkId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabase
      .from('affiliate_links')
      .select(`
        *,
        merchant:merchant_id (*)
      `)
      .eq('id', linkId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return c.json({ link: data });
  } catch (error: any) {
    console.error('Error fetching affiliate link:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Create affiliate link
 * POST /api/affiliate-links
 *
 * Body: {
 *   merchant_id: string,
 *   affiliate_url: string,
 *   discount_code?: string,
 *   commission_rate?: number,
 *   notes?: string
 * }
 */
app.post('/', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      merchant_id,
      affiliate_url,
      discount_code,
      commission_rate,
      notes,
    } = body;

    if (!merchant_id || !affiliate_url) {
      return c.json({ error: 'merchant_id and affiliate_url required' }, 400);
    }

    const { data, error } = await supabase
      .from('affiliate_links')
      .insert({
        user_id: userId,
        merchant_id,
        affiliate_url,
        discount_code,
        commission_rate,
        notes,
        is_active: true,
      })
      .select(`
        *,
        merchant:merchant_id (*)
      `)
      .single();

    if (error) throw error;

    return c.json({ link: data });
  } catch (error: any) {
    console.error('Error creating affiliate link:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Update affiliate link
 * PATCH /api/affiliate-links/:id
 */
app.patch('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const linkId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      affiliate_url,
      discount_code,
      commission_rate,
      notes,
      is_active,
    } = body;

    const updates: any = { updated_at: new Date().toISOString() };

    if (affiliate_url !== undefined) updates.affiliate_url = affiliate_url;
    if (discount_code !== undefined) updates.discount_code = discount_code;
    if (commission_rate !== undefined) updates.commission_rate = commission_rate;
    if (notes !== undefined) updates.notes = notes;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('affiliate_links')
      .update(updates)
      .eq('id', linkId)
      .eq('user_id', userId)
      .select(`
        *,
        merchant:merchant_id (*)
      `)
      .single();

    if (error) throw error;

    return c.json({ link: data });
  } catch (error: any) {
    console.error('Error updating affiliate link:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Delete affiliate link
 * DELETE /api/affiliate-links/:id
 */
app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const linkId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { error } = await supabase
      .from('affiliate_links')
      .delete()
      .eq('id', linkId)
      .eq('user_id', userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting affiliate link:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Link affiliate link to inventory item
 * POST /api/affiliate-links/:id/link-inventory
 *
 * Body: {
 *   inventory_item_id: string
 * }
 */
app.post('/:id/link-inventory', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const linkId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { inventory_item_id } = body;

    if (!inventory_item_id) {
      return c.json({ error: 'inventory_item_id required' }, 400);
    }

    // Verify affiliate link ownership
    const { data: link } = await supabase
      .from('affiliate_links')
      .select('id')
      .eq('id', linkId)
      .eq('user_id', userId)
      .single();

    if (!link) {
      return c.json({ error: 'Affiliate link not found' }, 404);
    }

    // Update inventory item with affiliate link
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        affiliate_link_id: linkId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory_item_id)
      .eq('user_id', userId)
      .select(`
        *,
        product:product_id (*),
        affiliate_link:affiliate_link_id (*)
      `)
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error linking affiliate link:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
