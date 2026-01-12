/**
 * Commission Optimization API Routes
 *
 * Endpoints for commission rate analysis and optimization suggestions
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { CommissionOptimizer } from '../services/commission-optimizer';

type Bindings = Env;

const commissionRoutes = new Hono<{ Bindings: Bindings }>();

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
 * POST /api/commission/analyze
 * Analyze all user's SmartWrappers for commission opportunities
 */
commissionRoutes.post('/analyze', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);
    const optimizer = new CommissionOptimizer(supabase);

    const opportunities = await optimizer.analyzeUserSmartWrappers(userId);

    return c.json({
      opportunities,
      totalPotentialGain: opportunities.reduce((sum, o) => sum + o.estimatedMonthlyGain, 0),
    });
  } catch (error: any) {
    console.error('Commission analysis error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/commission/alerts
 * Get pending commission optimization alerts
 */
commissionRoutes.get('/alerts', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);

    const { data: alerts, error } = await supabase
      .from('commission_alerts')
      .select(`
        *,
        redirect_links!inner (
          short_code,
          link_label,
          product_name
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('estimated_monthly_gain', { ascending: false });

    if (error) {
      throw error;
    }

    return c.json({ alerts: alerts || [] });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/commission/alerts/:id/apply
 * Apply commission optimization suggestion
 */
commissionRoutes.post('/alerts/:id/apply', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    // Get alert
    const { data: alert, error: fetchError } = await supabase
      .from('commission_alerts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !alert) {
      return c.json({ error: 'Alert not found' }, 404);
    }

    // Mark alert as applied
    await supabase
      .from('commission_alerts')
      .update({ status: 'applied' })
      .eq('id', id);

    return c.json({
      success: true,
      message: `Switched to ${alert.suggested_retailer} - estimated gain: $${alert.estimated_monthly_gain}/month`,
    });
  } catch (error: any) {
    console.error('Apply alert error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/commission/alerts/:id/dismiss
 * Dismiss commission optimization suggestion
 */
commissionRoutes.post('/alerts/:id/dismiss', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: alert } = await supabase
      .from('commission_alerts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!alert) {
      return c.json({ error: 'Alert not found' }, 404);
    }

    // Mark as dismissed
    await supabase
      .from('commission_alerts')
      .update({ status: 'dismissed' })
      .eq('id', id);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Dismiss alert error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/commission/rates
 * Get commission rates by retailer
 */
commissionRoutes.get('/rates', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const retailer = c.req.query('retailer');
  const category = c.req.query('category') || 'default';

  try {
    const supabase = getSupabase(c);
    const optimizer = new CommissionOptimizer(supabase);

    if (retailer) {
      const rate = optimizer.getCommissionRate(retailer, category);
      return c.json({ retailer, category, rate });
    }

    // Return all rates
    const { data: rates, error } = await supabase
      .from('commission_rates')
      .select('*')
      .order('retailer');

    if (error) {
      throw error;
    }

    return c.json({ rates: rates || [] });
  } catch (error: any) {
    console.error('Get rates error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default commissionRoutes;
