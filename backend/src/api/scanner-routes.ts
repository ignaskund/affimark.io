/**
 * Content Scanner API
 * Scan transcripts for product mentions and generate suggestions
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { ScannerService } from '../services/scanner';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

// Supabase client helper
const getSupabase = (c: { env: Env }) => {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );
};

/**
 * Create or reuse an inventory item for a given suggestion and user.
 * Best-effort: tries to find a matching product by name; if not found,
 * it will not create a new product row to avoid polluting the catalog.
 */
async function ensureInventoryFromSuggestion(
  supabase: any,
  suggestion: any,
  userId: string
): Promise<{ inventory_item_id: string | null }> {
  try {
    const name: string | undefined = suggestion?.detected_product_name;
    if (!name || !userId) {
      return { inventory_item_id: null };
    }

    // Try to find an existing product with a similar name
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .ilike('product_name', `%${name}%`)
      .limit(1)
      .single();

    if (productError || !product) {
      // No product match; caller can handle this (e.g., show in UI)
      return { inventory_item_id: null };
    }

    // Check if inventory item already exists for this user + product
    const { data: existingInventory, error: existingError } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .limit(1)
      .single();

    if (!existingError && existingInventory) {
      return { inventory_item_id: existingInventory.id };
    }

    // Create a new draft inventory item
    const { data: newInventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        product_id: product.id,
        category: suggestion?.detected_category || null,
        status: 'draft',
        custom_title: name,
      })
      .select('id')
      .single();

    if (inventoryError || !newInventory) {
      console.error('ensureInventoryFromSuggestion: failed to insert inventory', inventoryError);
      return { inventory_item_id: null };
    }

    return { inventory_item_id: newInventory.id };
  } catch (err) {
    console.error('ensureInventoryFromSuggestion error:', err);
    return { inventory_item_id: null };
  }
}

/**
 * Create scan run
 * POST /api/scanner/scan
 *
 * Body: {
 *   source_type: 'youtube' | 'twitch' | 'tiktok' | 'upload' | 'url',
 *   source_url?: string,
 *   source_title?: string,
 *   transcript_text: string,
 *   transcript_metadata?: object
 * }
 */
app.post('/scan', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const {
      source_type,
      source_url,
      source_title,
      transcript_text,
      transcript_metadata,
    } = body;

    if (!source_type || !transcript_text) {
      return c.json({ error: 'source_type and transcript_text required' }, 400);
    }

    // Create scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        user_id: userId,
        source_type,
        source_url,
        source_title,
        transcript_text,
        transcript_metadata: transcript_metadata || {},
        status: 'pending',
      })
      .select()
      .single();

    if (scanError) throw scanError;

    // Trigger async processing (would call AI service here)
    // For now, just return the scan run
    return c.json({
      success: true,
      scan_run: scanRun,
      message: 'Scan created. Processing will begin shortly.',
    });
  } catch (error: any) {
    console.error('Create scan error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Process scan run (detect products using AI)
 * POST /api/scanner/process/:scan_id
 *
 * This would typically be called by a background worker
 */
app.post('/process/:scan_id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const scanId = c.req.param('scan_id');
    const startTime = Date.now();

    // Get scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanError) throw scanError;

    // Update status to processing
    await supabase
      .from('scan_runs')
      .update({ status: 'processing' })
      .eq('id', scanId);

    // Call AI-powered scanner service (Claude) to detect products
    const scanner = new ScannerService({
      supabase,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    });

    const detectedProducts = await scanner.processScan({
      id: scanRun.id,
      user_id: scanRun.user_id,
      transcript_text: scanRun.transcript_text,
    });

    const suggestions = await scanner.writeSuggestions(
      scanId,
      scanRun.user_id,
      detectedProducts,
    );

    // Update scan run status
    const processingTime = Date.now() - startTime;
    await supabase
      .from('scan_runs')
      .update({
        status: 'completed',
        products_detected: suggestions?.length || 0,
        suggestions_generated: suggestions?.length || 0,
        completed_at: new Date().toISOString(),
        processing_time_ms: processingTime,
      })
      .eq('id', scanId);

    return c.json({
      success: true,
      suggestions,
      processing_time_ms: processingTime,
    });
  } catch (error: any) {
    console.error('Process scan error:', error);

    // Update scan status to failed
    const supabase = getSupabase(c);
    await supabase
      .from('scan_runs')
      .update({
        status: 'failed',
        error_message: error.message,
      })
      .eq('id', c.req.param('scan_id'));

    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get scan runs for user
 * GET /api/scanner/scans
 */
app.get('/scans', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = supabase
      .from('scan_runs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    return c.json({
      scans: data || [],
      total: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Get scans error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get single scan run with suggestions
 * GET /api/scanner/scans/:scan_id
 */
app.get('/scans/:scan_id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const scanId = c.req.param('scan_id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .select('*')
      .eq('id', scanId)
      .eq('user_id', userId)
      .single();

    if (scanError) throw scanError;

    // Get suggestions
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('scan_suggestions')
      .select('*')
      .eq('scan_run_id', scanId)
      .order('confidence_score', { ascending: false });

    if (suggestionsError) throw suggestionsError;

    return c.json({
      scan: scanRun,
      suggestions: suggestions || [],
    });
  } catch (error: any) {
    console.error('Get scan error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Update suggestion status (approve/reject)
 * PATCH /api/scanner/suggestions/:suggestion_id
 *
 * Body: {
 *   status: 'approved' | 'rejected' | 'in_inventory'
 * }
 */
app.patch('/suggestions/:suggestion_id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const suggestionId = c.req.param('suggestion_id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { status } = body;

    if (!status || !['approved', 'rejected', 'in_inventory'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Update suggestion
    const { data, error } = await supabase
      .from('scan_suggestions')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    let inventoryItemId: string | null = null;
    if (status === 'in_inventory') {
      const result = await ensureInventoryFromSuggestion(supabase, data, userId);
      inventoryItemId = result.inventory_item_id;
    }

    return c.json({ suggestion: data, inventory_item_id: inventoryItemId });
  } catch (error: any) {
    console.error('Update suggestion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Bulk update suggestions
 * POST /api/scanner/suggestions/bulk-update
 *
 * Body: {
 *   suggestion_ids: string[],
 *   status: 'approved' | 'rejected' | 'in_inventory'
 * }
 */
app.post('/suggestions/bulk-update', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { suggestion_ids, status } = body;

    if (!suggestion_ids || !Array.isArray(suggestion_ids) || suggestion_ids.length === 0) {
      return c.json({ error: 'suggestion_ids array required' }, 400);
    }

    if (!status || !['approved', 'rejected', 'in_inventory'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Bulk update
    const { data, error } = await supabase
      .from('scan_suggestions')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .in('id', suggestion_ids)
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    let inventoryMap: Record<string, string | null> = {};
    if (status === 'in_inventory' && Array.isArray(data)) {
      for (const suggestion of data) {
        const result = await ensureInventoryFromSuggestion(
          supabase,
          suggestion,
          userId
        );
        inventoryMap[suggestion.id] = result.inventory_item_id;
      }
    }

    return c.json({
      success: true,
      updated: data?.length || 0,
      suggestions: data,
      inventory_items: inventoryMap,
    });
  } catch (error: any) {
    console.error('Bulk update suggestions error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Delete scan run
 * DELETE /api/scanner/scans/:scan_id
 */
app.delete('/scans/:scan_id', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');
    const scanId = c.req.param('scan_id');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { error } = await supabase
      .from('scan_runs')
      .delete()
      .eq('id', scanId)
      .eq('user_id', userId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete scan error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
