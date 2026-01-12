/**
 * Shops API
 * Manage creator shops and shop items
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
 * Get user's shop
 * GET /api/shops/me
 */
app.get('/me', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Shop might not exist yet
      if (error.code === 'PGRST116') {
        return c.json({ shop: null });
      }
      throw error;
    }

    return c.json({ shop: data });
  } catch (error: any) {
    console.error('Error fetching shop:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get public shop by handle
 * GET /api/shops/:handle
 */
app.get('/:handle', async (c) => {
  try {
    const supabase = getSupabase(c);
    const handle = c.req.param('handle');

    // Get shop via profile handle
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        handle,
        full_name,
        bio,
        avatar_url,
        shops (*)
      `)
      .eq('handle', handle)
      .single();

    if (profileError) throw profileError;

    const shop = profile.shops?.[0];

    if (!shop) {
      return c.json({ error: 'Shop not found' }, 404);
    }

    // Only return shop if public (or if user is owner)
    const userId = c.req.header('X-User-ID');
    if (!shop.is_public && shop.user_id !== userId) {
      return c.json({ error: 'Shop not found' }, 404);
    }

    // Get shop items
    const { data: items, error: itemsError } = await supabase
      .from('shop_items_detailed')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('is_visible', true)
      .order('section')
      .order('sort_order');

    if (itemsError) throw itemsError;

    return c.json({
      shop: {
        ...shop,
        creator: {
          id: profile.id,
          handle: profile.handle,
          name: profile.full_name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
        },
        items,
      },
    });
  } catch (error: any) {
    console.error('Error fetching public shop:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Create or update shop
 * POST /api/shops
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
      shop_name,
      shop_tagline,
      shop_description,
      banner_image_url,
      theme_color,
      is_public,
      show_out_of_stock,
      embed_mode_enabled,
      meta_title,
      meta_description,
    } = body;

    // Upsert shop
    const { data, error } = await supabase
      .from('shops')
      .upsert({
        user_id: userId,
        shop_name,
        shop_tagline,
        shop_description,
        banner_image_url,
        theme_color,
        is_public,
        show_out_of_stock,
        embed_mode_enabled,
        meta_title,
        meta_description,
        updated_at: new Date().toISOString(),
        published_at: is_public ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ shop: data });
  } catch (error: any) {
    console.error('Error creating/updating shop:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get shop items
 * GET /api/shops/me/items
 */
app.get('/me/items', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (shopError) {
      if (shopError.code === 'PGRST116') {
        return c.json({ items: [] });
      }
      throw shopError;
    }

    // Get shop items
    const { data, error } = await supabase
      .from('shop_items')
      .select(`
        *,
        inventory_item:inventory_item_id (
          *,
          product:product_id (*),
          affiliate_link:affiliate_link_id (*)
        )
      `)
      .eq('shop_id', shop.id)
      .order('section')
      .order('sort_order');

    if (error) throw error;

    return c.json({ items: data });
  } catch (error: any) {
    console.error('Error fetching shop items:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Add item to shop
 * POST /api/shops/items
 */
app.post('/items', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { inventory_item_id, section, is_visible, is_featured } = body;

    if (!inventory_item_id) {
      return c.json({ error: 'inventory_item_id required' }, 400);
    }

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (shopError) throw shopError;

    // Check if item already in shop
    const { data: existing } = await supabase
      .from('shop_items')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('inventory_item_id', inventory_item_id)
      .single();

    if (existing) {
      return c.json({ error: 'Item already in shop' }, 409);
    }

    // Add item to shop
    const { data, error } = await supabase
      .from('shop_items')
      .insert({
        shop_id: shop.id,
        inventory_item_id,
        section: section || 'Uncategorized',
        is_visible: is_visible !== undefined ? is_visible : true,
        is_featured: is_featured || false,
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error adding shop item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Bulk add items to shop
 * POST /api/shops/items/bulk-add
 *
 * Body: {
 *   inventory_item_ids: string[],
 *   section?: string,
 *   is_visible?: boolean
 * }
 */
app.post('/items/bulk-add', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { inventory_item_ids, section, is_visible } = body;

    if (!Array.isArray(inventory_item_ids) || inventory_item_ids.length === 0) {
      return c.json({ error: 'inventory_item_ids array required' }, 400);
    }

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (shopError) throw shopError;

    // Get existing shop items to prevent duplicates
    const { data: existingItems } = await supabase
      .from('shop_items')
      .select('inventory_item_id')
      .eq('shop_id', shop.id)
      .in('inventory_item_id', inventory_item_ids);

    const existingIds = new Set(existingItems?.map((item) => item.inventory_item_id));
    const newItemIds = inventory_item_ids.filter((id) => !existingIds.has(id));

    if (newItemIds.length === 0) {
      return c.json({
        success: true,
        added: 0,
        skipped: inventory_item_ids.length,
        message: 'All items already in shop',
      });
    }

    // Bulk insert
    const itemsToInsert = newItemIds.map((inventory_item_id, index) => ({
      shop_id: shop.id,
      inventory_item_id,
      section: section || 'Uncategorized',
      is_visible: is_visible !== undefined ? is_visible : true,
      is_featured: false,
      sort_order: index,
    }));

    const { data, error } = await supabase
      .from('shop_items')
      .insert(itemsToInsert)
      .select();

    if (error) throw error;

    return c.json({
      success: true,
      added: data?.length || 0,
      skipped: existingIds.size,
      items: data,
    });
  } catch (error: any) {
    console.error('Error bulk adding shop items:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Update shop item
 * PATCH /api/shops/items/:id
 */
app.patch('/items/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const itemId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { section, sort_order, is_visible, is_featured } = body;

    // Verify ownership via shop
    const { data: shopItem, error: verifyError } = await supabase
      .from('shop_items')
      .select('shop_id, shops!inner(user_id)')
      .eq('id', itemId)
      .single();

    if (verifyError) throw verifyError;

    if (shopItem.shops.user_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const updates: any = {};
    if (section !== undefined) updates.section = section;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_visible !== undefined) updates.is_visible = is_visible;
    if (is_featured !== undefined) updates.is_featured = is_featured;

    const { data, error } = await supabase
      .from('shop_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error updating shop item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Remove item from shop
 * DELETE /api/shops/items/:id
 */
app.delete('/items/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const itemId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify ownership via shop
    const { data: shopItem, error: verifyError } = await supabase
      .from('shop_items')
      .select('shop_id, shops!inner(user_id)')
      .eq('id', itemId)
      .single();

    if (verifyError) throw verifyError;

    if (shopItem.shops.user_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const { error } = await supabase
      .from('shop_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error removing shop item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Reorder shop items (bulk update)
 * POST /api/shops/items/reorder
 */
app.post('/items/reorder', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { items } = body; // Array of {id, section, sort_order}

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'items array required' }, 400);
    }

    // Get user's shop to verify ownership
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (shopError) throw shopError;

    // Update each item
    const results = await Promise.all(
      items.map(async (item) => {
        const { id, section, sort_order } = item;
        const { data, error } = await supabase
          .from('shop_items')
          .update({ section, sort_order })
          .eq('id', id)
          .eq('shop_id', shop.id)
          .select()
          .single();

        if (error) {
          console.error(`Error updating shop item ${id}:`, error);
          return null;
        }

        return data;
      })
    );

    const successful = results.filter((r) => r !== null);

    return c.json({
      success: true,
      updated: successful.length,
      items: successful,
    });
  } catch (error: any) {
    console.error('Error reordering shop items:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
