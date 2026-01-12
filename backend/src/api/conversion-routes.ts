/**
 * Conversion Tracking API Routes
 *
 * Track conversions (sales, signups, etc.) from SmartWrapper clicks
 * Calculate revenue and ROI metrics
 *
 * Integration methods:
 * 1. Postback URL (affiliate network calls us when sale completes)
 * 2. Manual conversion upload
 * 3. JavaScript pixel tracking
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

type Bindings = Env;

const conversionRoutes = new Hono<{ Bindings: Bindings }>();

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
 * POST /api/conversions
 * Record a conversion (manual upload or postback)
 */
conversionRoutes.post('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const {
    smartwrapperId,
    clickId, // Optional: _am tracking ID from click
    conversionType = 'sale', // 'sale', 'signup', 'lead', 'other'
    revenue = 0,
    commission = 0,
    orderValue = 0,
    orderId,
    metadata = {},
  } = body;

  if (!smartwrapperId) {
    return c.json({ error: 'smartwrapperId required' }, 400);
  }

  try {
    const supabase = getSupabase(c);

    // Verify SmartWrapper ownership
    const { data: sw } = await supabase
      .from('redirect_links')
      .select('id, user_id')
      .eq('id', smartwrapperId)
      .eq('user_id', userId)
      .single();

    if (!sw) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    // Try to find matching click if clickId provided
    let clickRecordId = null;
    if (clickId) {
      const { data: clickRecord } = await supabase
        .from('redirect_link_clicks')
        .select('id')
        .eq('redirect_link_id', smartwrapperId)
        .or(`id.eq.${clickId}`)
        .order('clicked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      clickRecordId = clickRecord?.id;
    }

    // Record conversion
    const { data: conversion, error } = await supabase
      .from('conversions')
      .insert({
        smartwrapper_id: smartwrapperId,
        user_id: userId,
        click_id: clickRecordId,
        conversion_type: conversionType,
        revenue,
        commission,
        order_value: orderValue,
        order_id: orderId,
        metadata,
        converted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update A/B test conversions if click is part of a test
    if (clickRecordId) {
      await updateAbTestConversions(supabase, smartwrapperId, clickRecordId);
    }

    return c.json({ conversion });
  } catch (error: any) {
    console.error('Record conversion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/conversions/smartwrappers/:id
 * Get conversions for a SmartWrapper
 */
conversionRoutes.get('/smartwrappers/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  const period = c.req.query('period') || '30d';

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: sw } = await supabase
      .from('redirect_links')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!sw) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    // Calculate date range
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get conversions
    const { data: conversions, error } = await supabase
      .from('conversions')
      .select('*')
      .eq('smartwrapper_id', id)
      .gte('converted_at', startDate)
      .order('converted_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate summary stats
    const summary = {
      totalConversions: conversions?.length || 0,
      totalRevenue: conversions?.reduce((sum, c) => sum + (c.revenue || 0), 0) || 0,
      totalCommission: conversions?.reduce((sum, c) => sum + (c.commission || 0), 0) || 0,
      avgOrderValue: 0,
      conversionRate: 0,
    };

    if (summary.totalConversions > 0) {
      summary.avgOrderValue = summary.totalRevenue / summary.totalConversions;
    }

    // Get click count for conversion rate
    const { count: clickCount } = await supabase
      .from('redirect_link_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('redirect_link_id', id)
      .gte('clicked_at', startDate);

    if (clickCount && clickCount > 0) {
      summary.conversionRate = (summary.totalConversions / clickCount) * 100;
    }

    return c.json({
      conversions: conversions || [],
      summary,
    });
  } catch (error: any) {
    console.error('Get conversions error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/conversions/revenue
 * Get revenue summary for all SmartWrappers
 */
conversionRoutes.get('/revenue', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const period = c.req.query('period') || '30d';

  try {
    const supabase = getSupabase(c);

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get all conversions for user
    const { data: conversions, error } = await supabase
      .from('conversions')
      .select(`
        *,
        redirect_links!inner (
          short_code,
          link_label,
          product_name
        )
      `)
      .eq('user_id', userId)
      .gte('converted_at', startDate);

    if (error) {
      throw error;
    }

    // Group by SmartWrapper
    const bySmartWrapper: { [key: string]: any } = {};

    for (const conv of conversions || []) {
      const swId = conv.smartwrapper_id;
      if (!bySmartWrapper[swId]) {
        bySmartWrapper[swId] = {
          smartwrapperId: swId,
          shortCode: conv.redirect_links.short_code,
          label: conv.redirect_links.link_label || conv.redirect_links.product_name,
          conversions: 0,
          revenue: 0,
          commission: 0,
        };
      }

      bySmartWrapper[swId].conversions++;
      bySmartWrapper[swId].revenue += conv.revenue || 0;
      bySmartWrapper[swId].commission += conv.commission || 0;
    }

    const summary = {
      totalConversions: conversions?.length || 0,
      totalRevenue: conversions?.reduce((sum, c) => sum + (c.revenue || 0), 0) || 0,
      totalCommission: conversions?.reduce((sum, c) => sum + (c.commission || 0), 0) || 0,
      topPerformers: Object.values(bySmartWrapper)
        .sort((a: any, b: any) => b.commission - a.commission)
        .slice(0, 5),
    };

    return c.json({ summary });
  } catch (error: any) {
    console.error('Get revenue summary error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/conversions/postback
 * Postback endpoint for affiliate networks
 * Public endpoint (no auth) - uses secret token instead
 */
conversionRoutes.post('/postback', async (c) => {
  const body = await c.req.json();
  const {
    token, // Secret token to verify source
    clickId, // Our _am tracking ID
    revenue,
    commission,
    orderId,
    status = 'approved', // 'pending', 'approved', 'rejected'
  } = body;

  // Verify token (in production, would check against user's secret)
  if (!token || !clickId) {
    return c.json({ error: 'Invalid postback' }, 400);
  }

  try {
    const supabase = getSupabase(c);

    // Find click record
    const { data: click } = await supabase
      .from('redirect_link_clicks')
      .select('id, redirect_link_id, redirect_links!inner(user_id)')
      .eq('id', clickId)
      .single();

    if (!click) {
      return c.json({ error: 'Click not found' }, 404);
    }

    // Record conversion
    await supabase.from('conversions').insert({
      smartwrapper_id: click.redirect_link_id,
      user_id: (click.redirect_links as any).user_id,
      click_id: click.id,
      conversion_type: 'sale',
      revenue: revenue || 0,
      commission: commission || 0,
      order_id: orderId,
      status,
      converted_at: new Date().toISOString(),
      metadata: { source: 'postback' },
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Postback error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Helper: Update A/B test conversion counts
 */
async function updateAbTestConversions(
  supabase: any,
  smartwrapperId: string,
  clickId: string
): Promise<void> {
  try {
    // Get active A/B test
    const { data: abTest } = await supabase
      .from('ab_tests')
      .select('id, variant_a_url, variant_b_url')
      .eq('smartwrapper_id', smartwrapperId)
      .eq('status', 'running')
      .maybeSingle();

    if (!abTest) return;

    // Get click details to know which variant
    const { data: click } = await supabase
      .from('redirect_link_clicks')
      .select('destination_url')
      .eq('id', clickId)
      .single();

    if (!click) return;

    // Determine which variant and increment conversion count
    if (click.destination_url === abTest.variant_a_url) {
      await supabase
        .from('ab_tests')
        .update({ variant_a_conversions: supabase.raw('variant_a_conversions + 1') })
        .eq('id', abTest.id);
    } else if (click.destination_url === abTest.variant_b_url) {
      await supabase
        .from('ab_tests')
        .update({ variant_b_conversions: supabase.raw('variant_b_conversions + 1') })
        .eq('id', abTest.id);
    }
  } catch (error) {
    console.error('Update A/B conversions error:', error);
  }
}

export default conversionRoutes;
