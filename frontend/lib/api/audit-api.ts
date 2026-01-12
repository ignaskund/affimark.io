/**
 * Link Audit API Client
 *
 * Frontend client for Link Monetization Guard API endpoints.
 * All functions return typed responses matching LINK_AUDIT_TYPES.ts
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// Types (simplified versions for frontend)
export interface HealthStatus {
  success: boolean;
  health_score: number;
  links: any[];
  issues_summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface IssuesResponse {
  success: boolean;
  issues: any[];
  total: number;
  recommendations: Record<string, any[]>;
}

export interface AuditHistoryResponse {
  success: boolean;
  audit_runs: any[];
  health_history: any[];
}

/**
 * Run a manual audit
 */
export async function runAudit(
  userId: string,
  auditType: 'full' | 'incremental' | 'emergency' = 'full',
  force: boolean = false
): Promise<{ success: boolean; audit_run_id?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/audit/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, audit_type: auditType, force })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run audit'
    };
  }
}

/**
 * Get audit run status
 */
export async function getAuditStatus(
  runId: string
): Promise<{ success: boolean; audit_run?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/audit/status/${runId}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get audit status'
    };
  }
}

/**
 * Get audit history
 */
export async function getAuditHistory(
  userId: string,
  days: number = 30,
  limit: number = 50
): Promise<AuditHistoryResponse> {
  try {
    const params = new URLSearchParams({
      user_id: userId,
      days: days.toString(),
      limit: limit.toString()
    });

    const response = await fetch(`${API_BASE}/api/audit/history?${params}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      audit_runs: [],
      health_history: []
    };
  }
}

/**
 * Get current health status
 */
export async function getHealthStatus(
  userId: string,
  linkIds?: string[]
): Promise<HealthStatus> {
  try {
    const params = new URLSearchParams({ user_id: userId });
    if (linkIds && linkIds.length > 0) {
      params.append('link_ids', linkIds.join(','));
    }

    const response = await fetch(`${API_BASE}/api/health/status?${params}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      health_score: 0,
      links: [],
      issues_summary: { critical: 0, warning: 0, info: 0 }
    };
  }
}

/**
 * Get specific link health
 */
export async function getLinkHealth(
  linkId: string
): Promise<{ success: boolean; link?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/health/status/${linkId}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get link health'
    };
  }
}

/**
 * Get issues with filtering
 */
export async function getIssues(
  userId: string,
  filters: {
    status?: 'open' | 'acknowledged' | 'resolved' | 'false_positive' | 'wont_fix';
    severity?: 'critical' | 'warning' | 'info';
    issue_type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<IssuesResponse> {
  try {
    const params = new URLSearchParams({ user_id: userId });

    if (filters.status) params.append('status', filters.status);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.issue_type) params.append('issue_type', filters.issue_type);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE}/api/issues?${params}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      issues: [],
      total: 0,
      recommendations: {}
    };
  }
}

/**
 * Get issue details
 */
export async function getIssueDetails(
  issueId: string
): Promise<{ success: boolean; issue?: any; recommendations?: any[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/issues/${issueId}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issue details'
    };
  }
}

/**
 * Resolve an issue
 */
export async function resolveIssue(
  issueId: string,
  resolutionNote?: string
): Promise<{ success: boolean; issue?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/issues/${issueId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: resolutionNote, resolved_by: 'user' })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve issue'
    };
  }
}

/**
 * Snooze an issue (mark as acknowledged)
 */
export async function snoozeIssue(
  issueId: string
): Promise<{ success: boolean; issue?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/issues/${issueId}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to snooze issue'
    };
  }
}

/**
 * Get Revenue Health Dashboard data
 */
export async function getRevenueHealthDashboard(
  userId: string
): Promise<{
  success: boolean;
  health_score: number;
  score_trend: 'up' | 'down' | 'stable';
  score_change: number;
  issues_by_severity: { critical: number; warning: number; info: number };
  estimated_monthly_loss: number;
  top_issues: any[];
  links_total: number;
  links_healthy: number;
  links_broken: number;
  last_audit_at?: string;
  next_audit_at?: string;
}> {
  try {
    // Get health status and issues in parallel
    const [healthStatus, issues, history] = await Promise.all([
      getHealthStatus(userId),
      getIssues(userId, { status: 'open' }),
      getAuditHistory(userId, 7, 10) // Last 7 days
    ]);

    if (!healthStatus.success) {
      throw new Error('Failed to get health status');
    }

    // Calculate top issues by revenue impact
    const topIssues = issues.issues
      .sort((a, b) => (b.revenue_impact_estimate || 0) - (a.revenue_impact_estimate || 0))
      .slice(0, 5);

    // Calculate estimated monthly loss
    const estimatedLoss = issues.issues
      .reduce((sum, issue) => sum + (issue.revenue_impact_estimate || 0), 0);

    // Determine trend
    let scoreTrend: 'up' | 'down' | 'stable' = 'stable';
    let scoreChange = 0;

    if (history.health_history.length >= 2) {
      const latest = history.health_history[0];
      const previous = history.health_history[1];
      scoreChange = latest.health_score - previous.health_score;
      if (scoreChange > 5) scoreTrend = 'up';
      else if (scoreChange < -5) scoreTrend = 'down';
    }

    // Get last/next audit times
    const lastAuditRun = history.audit_runs[0];

    return {
      success: true,
      health_score: healthStatus.health_score,
      score_trend: scoreTrend,
      score_change: scoreChange,
      issues_by_severity: healthStatus.issues_summary,
      estimated_monthly_loss: estimatedLoss,
      top_issues: topIssues,
      links_total: healthStatus.links.length,
      links_healthy: healthStatus.links.filter(l => !l.is_broken && !l.is_stock_out).length,
      links_broken: healthStatus.links.filter(l => l.is_broken).length,
      last_audit_at: lastAuditRun?.completed_at,
      next_audit_at: lastAuditRun?.next_audit_at
    };

  } catch (error) {
    return {
      success: false,
      health_score: 0,
      score_trend: 'stable',
      score_change: 0,
      issues_by_severity: { critical: 0, warning: 0, info: 0 },
      estimated_monthly_loss: 0,
      top_issues: [],
      links_total: 0,
      links_healthy: 0,
      links_broken: 0
    };
  }
}

// =====================================================
// ACTION API FUNCTIONS
// =====================================================

/**
 * Execute a recommendation to fix an issue
 */
export async function executeRecommendation(
  recommendationId: string,
  userId: string
): Promise<{
  success: boolean;
  action_id?: string;
  new_link?: string;
  old_link?: string;
  instructions?: string[];
  estimated_revenue_gain?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/actions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recommendation_id: recommendationId,
        user_id: userId,
        executed_by: 'user'
      })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute recommendation'
    };
  }
}

/**
 * Get pending actions (fixes waiting for user approval)
 */
export async function getPendingActions(
  userId: string
): Promise<{
  success: boolean;
  actions: any[];
  count: number;
}> {
  try {
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${API_BASE}/api/actions/pending?${params}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      actions: [],
      count: 0
    };
  }
}

/**
 * Complete an action (mark as done)
 */
export async function completeAction(
  actionId: string,
  resultMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/actions/${actionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_message: resultMessage })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete action'
    };
  }
}

/**
 * Cancel a pending action
 */
export async function cancelAction(
  actionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/actions/${actionId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel action'
    };
  }
}

/**
 * Get action history
 */
export async function getActionHistory(
  userId: string,
  status?: 'pending' | 'completed' | 'failed',
  limit: number = 50,
  offset: number = 0
): Promise<{
  success: boolean;
  actions: any[];
  total: number;
}> {
  try {
    const params = new URLSearchParams({
      user_id: userId,
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${API_BASE}/api/actions/history?${params}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      actions: [],
      total: 0
    };
  }
}

/**
 * Get action details
 */
export async function getActionDetails(
  actionId: string
): Promise<{
  success: boolean;
  action?: any;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/actions/${actionId}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get action details'
    };
  }
}
