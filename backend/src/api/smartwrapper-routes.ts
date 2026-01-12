/**
 * SmartWrapper Management API Routes
 *
 * Endpoints for creating and managing SmartWrappers with priority chains.
 * This is the core of the waterfall routing system.
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

type Bindings = Env;

const smartwrapperRoutes = new Hono<{ Bindings: Bindings }>();

// Helper to get Supabase client
function getSupabase(c: any) {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );
}

// Helper to get user ID from auth header
async function getUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase(c);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

/**
 * POST /api/smartwrappers
 * Create new SmartWrapper (simple version for V2 Creator Ops)
 */
smartwrapperRoutes.post('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const {
    name,
    destination_url,
    fallback_url,
    auto_fallback_enabled = false,
  } = body;

  if (!destination_url || !destination_url.trim()) {
    return c.json({ error: 'Destination URL is required' }, 400);
  }

  try {
    const supabase = getSupabase(c);

    // Generate short code
    const { data: codeData, error: codeError } = await supabase.rpc('generate_short_code');

    if (codeError || !codeData) {
      throw new Error(`Failed to generate short code: ${codeError?.message}`);
    }

    const shortCode = codeData as string;

    // Extract affiliate tag from URL if possible
    let affiliateTag = null;
    try {
      const url = new URL(destination_url);
      affiliateTag = url.searchParams.get('tag') ||
                     url.searchParams.get('ref') ||
                     url.searchParams.get('aff') ||
                     url.searchParams.get('aid');
    } catch (e) {
      // Invalid URL, skip tag extraction
    }

    // Create SmartWrapper
    const { data: smartwrapper, error: swError } = await supabase
      .from('smartwrappers')
      .insert({
        user_id: userId,
        short_code: shortCode,
        name: name?.trim() || null,
        destination_url: destination_url.trim(),
        fallback_url: fallback_url?.trim() || null,
        auto_fallback_enabled,
        affiliate_tag: affiliateTag,
        is_active: true,
      })
      .select()
      .single();

    if (swError) {
      throw new Error(`Failed to create SmartWrapper: ${swError.message}`);
    }

    return c.json({
      smartwrapper: {
        ...smartwrapper,
        short_url: `https://go.affimark.com/${smartwrapper.short_code}`,
      },
    });
  } catch (error: any) {
    console.error('Create SmartWrapper error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/smartwrappers
 * List all user's SmartWrappers
 */
smartwrapperRoutes.get('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);

    const { data: smartwrappers, error } = await supabase
      .from('smartwrappers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const swWithUrls = (smartwrappers || []).map((sw) => ({
      ...sw,
      short_url: `https://go.affimark.com/${sw.short_code}`,
    }));

    return c.json({ smartwrappers: swWithUrls, total: swWithUrls.length });
  } catch (error: any) {
    console.error('List SmartWrappers error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/smartwrappers/:id
 * Get single SmartWrapper with all details
 */
smartwrapperRoutes.get('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    const { data, error } = await supabase
      .from('smartwrappers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    return c.json({
      smartwrapper: {
        ...data,
        short_url: `https://go.affimark.com/${data.short_code}`,
      },
    });
  } catch (error: any) {
    console.error('Get SmartWrapper error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * PATCH /api/smartwrappers/:id
 * Update SmartWrapper
 */
smartwrapperRoutes.patch('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  const body = await c.req.json();

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: existing } = await supabase
      .from('smartwrappers')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    // Update SmartWrapper
    const updateData: any = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) updateData.name = body.name?.trim() || null;
    if (body.destination_url !== undefined) updateData.destination_url = body.destination_url.trim();
    if (body.fallback_url !== undefined) updateData.fallback_url = body.fallback_url?.trim() || null;
    if (body.auto_fallback_enabled !== undefined) updateData.auto_fallback_enabled = body.auto_fallback_enabled;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from('smartwrappers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json({
      smartwrapper: {
        ...data,
        short_url: `https://go.affimark.com/${data.short_code}`,
      },
    });
  } catch (error: any) {
    console.error('Update SmartWrapper error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DELETE /api/smartwrappers/:id
 * Hard delete SmartWrapper
 */
smartwrapperRoutes.delete('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: existing } = await supabase
      .from('smartwrappers')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    // Delete (CASCADE will handle smartwrapper_clicks)
    await supabase
      .from('smartwrappers')
      .delete()
      .eq('id', id);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete SmartWrapper error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default smartwrapperRoutes;
