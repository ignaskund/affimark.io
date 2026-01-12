/**
 * Link Audit API Routes
 *
 * Endpoints:
 * - POST /api/audit/run - Trigger manual audit
 * - GET /api/audit/status/:run_id - Get audit progress
 * - GET /api/audit/history - Get audit run history
 * - GET /api/health/status - Get current health for all links
 * - GET /api/health/status/:link_id - Get specific link health
 * - GET /api/health/score - Get Revenue Health Score
 * - GET /api/issues - List issues with filtering
 * - GET /api/issues/:id - Get issue details
 * - POST /api/issues/:id/resolve - Mark issue resolved
 * - POST /api/issues/:id/snooze - Snooze issue
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { LinkAuditOrchestrator } from '../services/link-audit-orchestrator';
import type {
  RunAuditRequest,
  RunAuditResponse,
  GetHealthStatusRequest,
  GetHealthStatusResponse,
  GetIssuesRequest,
  GetIssuesResponse,
  GetAuditHistoryRequest,
  GetAuditHistoryResponse,
  AuditType,
  IssueStatus,
  IssueSeverity,
  IssueType
} from '../../../LINK_AUDIT_TYPES';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RAINFOREST_API_KEY?: string;
  SERPAPI_KEY?: string;
  IMPACT_ACCOUNT_SID?: string;
  IMPACT_AUTH_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/audit/run
 * Trigger a manual audit for a user
 */
app.post('/run', async (c) => {
  try {
    const body: RunAuditRequest = await c.req.json();
    const { user_id, audit_type = 'full', force = false } = body;

    if (!user_id) {
      return c.json({ success: false, error: 'user_id is required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Check if audit already running recently (unless forced)
    if (!force) {
      const { data: recentRuns } = await supabase
        .from('link_audit_runs')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'running')
        .limit(1);

      if (recentRuns && recentRuns.length > 0) {
        return c.json({
          success: false,
          error: 'Audit already running. Use force=true to override.'
        }, 409);
      }
    }

    // Initialize orchestrator
    const orchestrator = new LinkAuditOrchestrator({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
      rainforestApiKey: c.env.RAINFOREST_API_KEY,
      serpApiKey: c.env.SERPAPI_KEY,
      impactAccountSid: c.env.IMPACT_ACCOUNT_SID,
      impactAuthToken: c.env.IMPACT_AUTH_TOKEN
    });

    // Run audit (async, don't await)
    const auditPromise = orchestrator.runAudit(user_id, audit_type as AuditType);

    // Get audit run ID immediately
    const { auditRunId } = await auditPromise;

    const response: RunAuditResponse = {
      success: true,
      audit_run_id: auditRunId,
      message: 'Audit started successfully'
    };

    return c.json(response);

  } catch (error) {
    console.error('Error starting audit:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/audit/status/:run_id
 * Get audit run status and progress
 */
app.get('/status/:run_id', async (c) => {
  try {
    const runId = c.req.param('run_id');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: auditRun, error } = await supabase
      .from('link_audit_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error || !auditRun) {
      return c.json({ success: false, error: 'Audit run not found' }, 404);
    }

    return c.json({
      success: true,
      audit_run: auditRun
    });

  } catch (error) {
    console.error('Error fetching audit status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/audit/history
 * Get audit run history for a user
 */
app.get('/history', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const days = parseInt(c.req.query('days') || '30');
    const limit = parseInt(c.req.query('limit') || '50');

    if (!userId) {
      return c.json({ success: false, error: 'user_id is required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: auditRuns, error: runsError } = await supabase
      .from('link_audit_runs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: healthHistory, error: historyError } = await supabase
      .from('revenue_health_history')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', cutoffDate.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (runsError || historyError) {
      throw new Error('Failed to fetch audit history');
    }

    const response: GetAuditHistoryResponse = {
      success: true,
      audit_runs: auditRuns || [],
      health_history: healthHistory || []
    };

    return c.json(response);

  } catch (error) {
    console.error('Error fetching audit history:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/health/status
 * Get current health status for all user's links
 */
app.get('/health/status', async (c) => {
  try {
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({ success: false, error: 'user_id is required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: links, error: linksError } = await supabase
      .from('link_health_status')
      .select('*')
      .eq('user_id', userId)
      .order('health_score', { ascending: true });

    const { data: issues, error: issuesError } = await supabase
      .from('link_health_issues')
      .select('severity')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (linksError || issuesError) {
      throw new Error('Failed to fetch health status');
    }

    // Calculate health score using database function
    const { data: scoreData, error: scoreError } = await supabase
      .rpc('calculate_revenue_health_score', { p_user_id: userId });

    const healthScore = scoreError ? 0 : (scoreData || 0);

    const issuesSummary = {
      critical: issues?.filter(i => i.severity === 'critical').length || 0,
      warning: issues?.filter(i => i.severity === 'warning').length || 0,
      info: issues?.filter(i => i.severity === 'info').length || 0
    };

    const response: GetHealthStatusResponse = {
      success: true,
      health_score: healthScore,
      links: links || [],
      issues_summary: issuesSummary
    };

    return c.json(response);

  } catch (error) {
    console.error('Error fetching health status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/health/status/:link_id
 * Get specific link health details
 */
app.get('/health/status/:link_id', async (c) => {
  try {
    const linkId = c.req.param('link_id');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: link, error } = await supabase
      .from('link_health_status')
      .select('*')
      .eq('id', linkId)
      .single();

    if (error || !link) {
      return c.json({ success: false, error: 'Link not found' }, 404);
    }

    return c.json({
      success: true,
      link
    });

  } catch (error) {
    console.error('Error fetching link health:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/issues
 * List issues with filtering
 */
app.get('/issues', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const status = c.req.query('status') as IssueStatus | undefined;
    const severity = c.req.query('severity') as IssueSeverity | undefined;
    const issueType = c.req.query('issue_type') as IssueType | undefined;
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!userId) {
      return c.json({ success: false, error: 'user_id is required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('link_health_issues')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (issueType) query = query.eq('issue_type', issueType);

    const { data: issues, error: issuesError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (issuesError) {
      throw new Error('Failed to fetch issues');
    }

    // Fetch recommendations for each issue
    const issueIds = issues?.map(i => i.id) || [];
    const { data: recommendations } = await supabase
      .from('issue_recommendations')
      .select('*')
      .in('issue_id', issueIds);

    const recommendationsMap: Record<string, any[]> = {};
    recommendations?.forEach(rec => {
      if (!recommendationsMap[rec.issue_id]) {
        recommendationsMap[rec.issue_id] = [];
      }
      recommendationsMap[rec.issue_id].push(rec);
    });

    const response: GetIssuesResponse = {
      success: true,
      issues: issues || [],
      total: count || 0,
      recommendations: recommendationsMap
    };

    return c.json(response);

  } catch (error) {
    console.error('Error fetching issues:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/issues/:id
 * Get issue details with recommendations
 */
app.get('/issues/:id', async (c) => {
  try {
    const issueId = c.req.param('id');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: issue, error: issueError } = await supabase
      .from('link_health_issues')
      .select('*')
      .eq('id', issueId)
      .single();

    if (issueError || !issue) {
      return c.json({ success: false, error: 'Issue not found' }, 404);
    }

    const { data: recommendations } = await supabase
      .from('issue_recommendations')
      .select('*')
      .eq('issue_id', issueId)
      .order('priority', { ascending: false });

    return c.json({
      success: true,
      issue,
      recommendations: recommendations || []
    });

  } catch (error) {
    console.error('Error fetching issue:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/issues/:id/resolve
 * Mark issue as resolved
 */
app.post('/issues/:id/resolve', async (c) => {
  try {
    const issueId = c.req.param('id');
    const body = await c.req.json();
    const { resolution_note, resolved_by = 'user' } = body;

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('link_health_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by,
        resolution_note,
        updated_at: new Date().toISOString()
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to resolve issue');
    }

    return c.json({
      success: true,
      issue: data
    });

  } catch (error) {
    console.error('Error resolving issue:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/issues/:id/snooze
 * Snooze issue (mark as acknowledged)
 */
app.post('/issues/:id/snooze', async (c) => {
  try {
    const issueId = c.req.param('id');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('link_health_issues')
      .update({
        status: 'acknowledged',
        updated_at: new Date().toISOString()
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to snooze issue');
    }

    return c.json({
      success: true,
      issue: data
    });

  } catch (error) {
    console.error('Error snoozing issue:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
