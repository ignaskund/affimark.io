/**
 * Action API Routes
 *
 * Endpoints for executing and managing fix actions:
 * - POST /api/actions/execute - Execute a recommendation
 * - GET /api/actions/pending - Get pending actions
 * - POST /api/actions/:id/complete - Mark action as completed
 * - POST /api/actions/:id/cancel - Cancel a pending action
 * - GET /api/actions/history - Get action history
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { ActionExecutor } from '../services/action-executor';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RAINFOREST_API_KEY?: string;
  SERPAPI_KEY?: string;
  IMPACT_ACCOUNT_SID?: string;
  IMPACT_AUTH_TOKEN?: string;
  AMAZON_ASSOCIATES_TAG?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/actions/execute
 * Execute a recommendation to fix an issue
 */
app.post('/execute', async (c) => {
  try {
    const body = await c.req.json();
    const { recommendation_id, user_id, executed_by = 'user' } = body;

    if (!recommendation_id || !user_id) {
      return c.json({
        success: false,
        error: 'recommendation_id and user_id are required'
      }, 400);
    }

    const executor = new ActionExecutor({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
      rainforestApiKey: c.env.RAINFOREST_API_KEY,
      serpApiKey: c.env.SERPAPI_KEY,
      impactAccountSid: c.env.IMPACT_ACCOUNT_SID,
      impactAuthToken: c.env.IMPACT_AUTH_TOKEN,
      amazonAssociatesTag: c.env.AMAZON_ASSOCIATES_TAG
    });

    const result = await executor.executeRecommendation(
      recommendation_id,
      user_id,
      executed_by
    );

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result);

  } catch (error) {
    console.error('Error executing action:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action'
    }, 500);
  }
});

/**
 * GET /api/actions/pending
 * Get all pending actions for a user
 */
app.get('/pending', async (c) => {
  try {
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({
        success: false,
        error: 'user_id is required'
      }, 400);
    }

    const executor = new ActionExecutor({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY
    });

    const pendingActions = await executor.getPendingActions(userId);

    return c.json({
      success: true,
      actions: pendingActions,
      count: pendingActions.length
    });

  } catch (error) {
    console.error('Error fetching pending actions:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch actions'
    }, 500);
  }
});

/**
 * POST /api/actions/:id/complete
 * Mark an action as completed
 */
app.post('/:id/complete', async (c) => {
  try {
    const actionId = c.req.param('id');
    const body = await c.req.json();
    const { result_message } = body;

    const executor = new ActionExecutor({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY
    });

    const result = await executor.completeAction(actionId, result_message);

    if (!result.success) {
      return c.json(result, 400);
    }

    // Also resolve the associated issue
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: action } = await supabase
      .from('link_audit_actions')
      .select('issue_id')
      .eq('id', actionId)
      .single();

    if (action?.issue_id) {
      await supabase
        .from('link_health_issues')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'user',
          resolution_note: result_message || 'Fixed via action executor'
        })
        .eq('id', action.issue_id);
    }

    return c.json({
      success: true,
      message: 'Action completed and issue resolved'
    });

  } catch (error) {
    console.error('Error completing action:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete action'
    }, 500);
  }
});

/**
 * POST /api/actions/:id/cancel
 * Cancel a pending action
 */
app.post('/:id/cancel', async (c) => {
  try {
    const actionId = c.req.param('id');
    const body = await c.req.json();
    const { reason } = body;

    const executor = new ActionExecutor({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY
    });

    const result = await executor.failAction(
      actionId,
      reason || 'Cancelled by user'
    );

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json({
      success: true,
      message: 'Action cancelled'
    });

  } catch (error) {
    console.error('Error cancelling action:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel action'
    }, 500);
  }
});

/**
 * GET /api/actions/history
 * Get action history for a user
 */
app.get('/history', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status'); // 'pending', 'completed', 'failed'

    if (!userId) {
      return c.json({
        success: false,
        error: 'user_id is required'
      }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('link_audit_actions')
      .select('*, issue_recommendations(*), link_health_issues(*)', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: actions, error, count } = await query
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch actions: ${error.message}`);
    }

    return c.json({
      success: true,
      actions: actions || [],
      total: count || 0
    });

  } catch (error) {
    console.error('Error fetching action history:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history'
    }, 500);
  }
});

/**
 * GET /api/actions/:id
 * Get action details
 */
app.get('/:id', async (c) => {
  try {
    const actionId = c.req.param('id');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: action, error } = await supabase
      .from('link_audit_actions')
      .select('*, issue_recommendations(*), link_health_issues!inner(*, link_health_status(*))')
      .eq('id', actionId)
      .single();

    if (error || !action) {
      return c.json({
        success: false,
        error: 'Action not found'
      }, 404);
    }

    return c.json({
      success: true,
      action
    });

  } catch (error) {
    console.error('Error fetching action:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch action'
    }, 500);
  }
});

export default app;
