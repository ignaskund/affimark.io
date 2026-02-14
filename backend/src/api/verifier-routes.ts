/**
 * Product Verifier API Routes
 *
 * POST /api/verifier/analyze              - Start analysis (returns snapshot + recommendations)
 * GET  /api/verifier/session/:id          - Get session state
 * POST /api/verifier/session/:id/rerank   - Rerank with new mode (hover action)
 * POST /api/verifier/session/:id/playbook - Generate playbook
 * POST /api/verifier/session/:id/watchlist - Add to watchlist
 * GET  /api/verifier/watchlist            - List watchlist
 * DELETE /api/verifier/watchlist/:id      - Remove from watchlist
 * GET  /api/verifier/alerts               - Get alerts
 * PUT  /api/verifier/alerts/:id/read      - Mark alert as read
 * GET  /api/verifier/recent               - Get recent sessions
 * POST /api/verifier/session/:id/telemetry - Log telemetry
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createClient } from '@supabase/supabase-js';
import { analyzeUrl, rerankAlternatives, getPlaybook, addToWatchlist, type RerankRequest } from '../services/verifier/verifier-orchestrator';
import type { RankMode } from '../services/verifier/intent-router';

const verifierRoutes = new Hono<{ Bindings: Env }>();

// --- Middleware: Extract user ID ---
function getUserId(c: any): string | null {
  return c.req.header('x-user-id') || null;
}

// --- POST /analyze ---
verifierRoutes.post('/analyze', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { product_url, user_context } = body;

    if (!product_url) {
      return c.json({ error: 'product_url is required' }, 400);
    }

    const result = await analyzeUrl(
      { product_url, user_context },
      userId,
      c.env
    );

    return c.json(result);
  } catch (error: any) {
    console.error('Analyze error:', error);
    return c.json({ error: error.message || 'Analysis failed' }, 500);
  }
});

// --- GET /session/:id ---
// Returns full session with snapshot + recommendations
verifierRoutes.get('/session/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const sessionId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('verifier_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const productData = data.product_data as any;
  const economicsDetails = data.economics_details as any;

  // Format response to match AnalyzeResponse structure
  return c.json({
    session_id: data.id,
    status: data.status,
    snapshot: {
      product: {
        title: productData?.title || null,
        brand: productData?.brand || null,
        category: productData?.category || null,
        merchant: data.merchant,
        price: productData?.price || { amount: null, currency: 'EUR' },
        region_availability: productData?.region_availability || (data.region ? [data.region] : []),
      },
      scores: {
        product_viability: data.product_viability_score,
        offer_merchant: data.offer_merchant_score,
        economics: data.economics_score,
      },
      score_breakdowns: data.score_breakdowns || {},
      confidence: {
        level: data.confidence,
        evidence: data.evidence_summary || {},
      },
      verdict: {
        status: data.verdict,
        primary_action: data.primary_action,
        hard_stop_flags: data.hard_stop_flags || [],
      },
      insights: {
        top_pros: data.top_pros || [],
        top_risks: data.top_risks || [],
        key_assumptions: data.key_assumptions || [],
      },
      economics: economicsDetails || {},
      coverage: data.coverage || { overall_score: 0.5, by_pillar: {}, missing_signals: [], data_quality: 'PARTIAL' },
    },
    recommendations: {
      mode: data.rank_mode || 'balanced',
      routing: data.routing || {},
      winner: data.winner || null,
      buckets: data.buckets || [],
      total_candidates: (data.ranked_alternatives || []).length,
      can_rerank: (data.ranked_alternatives || []).length > 1,
    },
  });
});

// --- POST /session/:id/rerank ---
// Triggered by pillar hover actions (e.g., "Find higher-demand alternatives")
verifierRoutes.post('/session/:id/rerank', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const sessionId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { mode } = body as { mode: RankMode };

    const validModes: RankMode[] = ['balanced', 'demand_first', 'trust_first', 'economics_first'];
    if (!mode || !validModes.includes(mode)) {
      return c.json({
        error: 'Valid mode is required: balanced, demand_first, trust_first, or economics_first'
      }, 400);
    }

    const result = await rerankAlternatives(sessionId, userId, mode, c.env);

    return c.json({
      session_id: sessionId,
      ...result,
    });
  } catch (error: any) {
    console.error('Rerank error:', error);
    return c.json({ error: error.message || 'Failed to rerank alternatives' }, 500);
  }
});

// --- POST /session/:id/playbook ---
verifierRoutes.post('/session/:id/playbook', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const sessionId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { selected_alternative_id } = body;

    const playbook = await getPlaybook(
      sessionId,
      userId,
      selected_alternative_id || null,
      c.env
    );

    return c.json({
      session_id: sessionId,
      playbook,
    });
  } catch (error: any) {
    console.error('Playbook error:', error);
    return c.json({ error: error.message || 'Failed to generate playbook' }, 500);
  }
});

// --- POST /session/:id/watchlist ---
verifierRoutes.post('/session/:id/watchlist', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const sessionId = c.req.param('id');

  try {
    const result = await addToWatchlist(sessionId, userId, c.env);
    return c.json(result);
  } catch (error: any) {
    console.error('Watchlist add error:', error);
    return c.json({ error: error.message || 'Failed to add to watchlist' }, 500);
  }
});

// --- GET /watchlist ---
verifierRoutes.get('/watchlist', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('verifier_watchlist')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch watchlist' }, 500);
  }

  return c.json({ items: data || [] });
});

// --- DELETE /watchlist/:id ---
verifierRoutes.delete('/watchlist/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const watchlistId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('verifier_watchlist')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', watchlistId)
    .eq('user_id', userId);

  if (error) {
    return c.json({ error: 'Failed to remove from watchlist' }, 500);
  }

  return c.json({ success: true });
});

// --- GET /alerts ---
verifierRoutes.get('/alerts', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('verifier_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return c.json({ error: 'Failed to fetch alerts' }, 500);
  }

  return c.json({
    alerts: data || [],
    unread_count: (data || []).filter((a: any) => !a.is_read).length,
  });
});

// --- PUT /alerts/:id/read ---
verifierRoutes.put('/alerts/:id/read', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const alertId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('verifier_alerts')
    .update({ is_read: true })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) {
    return c.json({ error: 'Failed to mark alert as read' }, 500);
  }

  return c.json({ success: true });
});

// --- GET /recent ---
verifierRoutes.get('/recent', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('verifier_sessions')
    .select('id, url, merchant, platform, status, verdict, product_viability_score, offer_merchant_score, economics_score, confidence, rank_mode, winner, product_data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return c.json({ error: 'Failed to fetch recent sessions' }, 500);
  }

  return c.json({
    sessions: (data || []).map((s: any) => ({
      id: s.id,
      url: s.url,
      merchant: s.merchant,
      platform: s.platform,
      status: s.status,
      verdict: s.verdict,
      scores: {
        product_viability: s.product_viability_score,
        offer_merchant: s.offer_merchant_score,
        economics: s.economics_score,
      },
      confidence: s.confidence,
      rank_mode: s.rank_mode,
      has_winner: s.winner !== null,
      product_title: s.product_data?.title || null,
      product_brand: s.product_data?.brand || null,
      created_at: s.created_at,
    })),
  });
});

// --- POST /session/:id/telemetry ---
verifierRoutes.post('/session/:id/telemetry', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const sessionId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const body = await c.req.json();
    const { event, data: eventData } = body;

    if (!event) {
      return c.json({ error: 'event is required' }, 400);
    }

    // Append to telemetry_events array
    const { data: session } = await supabase
      .from('verifier_sessions')
      .select('telemetry_events')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const events = (session.telemetry_events as any[]) || [];
    events.push({
      event,
      timestamp: new Date().toISOString(),
      data: eventData || {},
    });

    await supabase
      .from('verifier_sessions')
      .update({ telemetry_events: events })
      .eq('id', sessionId);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to log telemetry' }, 500);
  }
});

// --- POST /library/save ---
verifierRoutes.post('/library/save', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { session_id, notes, tags } = body;

    if (!session_id) {
      return c.json({ error: 'session_id is required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Get session data
    const { data: session } = await supabase
      .from('verifier_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const productData = session.product_data as any;

    const { data, error } = await supabase
      .from('verifier_library')
      .insert({
        user_id: userId,
        session_id,
        product_name: productData?.title || 'Unknown',
        brand: productData?.brand || session.merchant,
        category: productData?.category,
        verdict: session.verdict,
        scores: {
          product_viability: session.product_viability_score,
          offer_merchant: session.offer_merchant_score,
          economics_feasibility: session.economics_score,
        },
        notes: notes || null,
        tags: tags || [],
      })
      .select('id')
      .single();

    if (error) {
      return c.json({ error: 'Failed to save to library' }, 500);
    }

    return c.json({ library_id: data.id });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save' }, 500);
  }
});

export default verifierRoutes;
