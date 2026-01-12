/**
 * Inventory API
 * Manage creator's product inventory
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
 * Get user's inventory
 * GET /api/inventory
 */
app.get('/', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get query params for filtering
    const status = c.req.query('status'); // 'draft', 'active', 'archived'
    const category = c.req.query('category');

    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        product:product_id (
          id,
          product_name,
          product_url,
          current_price,
          list_price,
          currency,
          is_available,
          image_url,
          brand,
          category,
          merchant:merchant_id (
            merchant_name,
            merchant_slug,
            logo_url
          )
        ),
        affiliate_link:affiliate_link_id (
          affiliate_url,
          discount_code,
          commission_rate
        )
      `)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    return c.json({ items: data });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get single inventory item
 * GET /api/inventory/:id
 */
app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const itemId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        product:product_id (*),
        affiliate_link:affiliate_link_id (*)
      `)
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error fetching inventory item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Add item to inventory
 * POST /api/inventory
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
      product_id,
      affiliate_link_id,
      custom_title,
      custom_description,
      custom_image_url,
      category,
      tags,
      status,
    } = body;

    if (!product_id) {
      return c.json({ error: 'product_id required' }, 400);
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        product_id,
        affiliate_link_id,
        custom_title,
        custom_description,
        custom_image_url,
        category,
        tags: tags || [],
        status: status || 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error adding inventory item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Add product to inventory (from product search)
 * POST /api/inventory/add
 *
 * Body: {
 *   merchant_id: string,
 *   external_product_id: string,
 *   product_name: string,
 *   product_url: string,
 *   image_url?: string,
 *   current_price?: number,
 *   currency?: string,
 *   category?: string,
 *   brand?: string
 * }
 */
app.post('/add', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      merchant_id,
      external_product_id,
      product_name,
      product_url,
      image_url,
      current_price,
      currency,
      category,
      brand,
    } = body;

    if (!merchant_id || !external_product_id || !product_name || !product_url) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 1. Check if product exists in products table
    let productId: string | null = null;

    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchant_id)
      .eq('merchant_product_id', external_product_id)
      .single();

    if (existingProduct) {
      productId = existingProduct.id;
    } else {
      // Create product if it doesn't exist
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          merchant_id,
          merchant_product_id: external_product_id,
          product_name,
          product_url,
          image_url,
          current_price,
          currency: currency || 'USD',
          category,
          brand,
          is_available: true,
          last_refreshed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (productError) throw productError;
      productId = newProduct.id;
    }

    // 2. Check if already in inventory
    const { data: existingInventory } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (existingInventory) {
      return c.json({
        error: 'Product already in inventory',
      }, 409);
    }

    // 3. Add to inventory
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        product_id: productId,
        category,
        status: 'draft',
        sort_order: 0,
      })
      .select(`
        *,
        product:product_id (*),
        affiliate_link:affiliate_link_id (*)
      `)
      .single();

    if (inventoryError) throw inventoryError;

    return c.json({
      success: true,
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Add to inventory error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Update inventory item
 * PATCH /api/inventory/:id
 */
app.patch('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const itemId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      custom_title,
      custom_description,
      custom_image_url,
      category,
      tags,
      status,
      sort_order,
    } = body;

    const updates: any = { updated_at: new Date().toISOString() };

    if (custom_title !== undefined) updates.custom_title = custom_title;
    if (custom_description !== undefined) updates.custom_description = custom_description;
    if (custom_image_url !== undefined) updates.custom_image_url = custom_image_url;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    if (status !== undefined) updates.status = status;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return c.json({ item: data });
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Delete inventory item
 * DELETE /api/inventory/:id
 */
app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const itemId = c.req.param('id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Bulk update inventory items (reorder, status changes)
 * POST /api/inventory/bulk
 */
app.post('/bulk', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { updates } = body; // Array of {id, ...fields}

    if (!Array.isArray(updates) || updates.length === 0) {
      return c.json({ error: 'updates array required' }, 400);
    }

    // Update each item
    const results = await Promise.all(
      updates.map(async (update) => {
        const { id, ...fields } = update;
        const { data, error } = await supabase
          .from('inventory_items')
          .update(fields)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error(`Error updating item ${id}:`, error);
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
    console.error('Error bulk updating inventory:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
