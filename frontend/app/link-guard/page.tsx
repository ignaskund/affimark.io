'use client';

/**
 * Link Guard Dashboard
 *
 * Revenue Health Score dashboard showing:
 * - Overall health score with trend
 * - Issue breakdown by severity
 * - Top issues by revenue impact
 * - Link health statistics
 * - Quick actions (Run Audit, View All Issues)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HealthScoreCard } from '@/components/audit/HealthScoreCard';
import { IssuesList } from '@/components/audit/IssuesList';
import { getRevenueHealthDashboard, runAudit, resolveIssue, snoozeIssue } from '@/lib/api/audit-api';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LinkGuardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);

  // Get current user
  useEffect(() => {
    async function getUser() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        router.push('/sign-in');
      }
    }
    getUser();
  }, [router]);

  // Load dashboard data
  useEffect(() => {
    if (!userId) return;

    async function loadDashboard() {
      setLoading(true);
      const data = await getRevenueHealthDashboard(userId!);
      setDashboard(data);
      setLoading(false);
    }

    loadDashboard();
  }, [userId]);

  // Handle run audit
  const handleRunAudit = async () => {
    if (!userId) return;

    setRunningAudit(true);
    const result = await runAudit(userId, 'full', true);

    if (result.success) {
      // Reload dashboard after a short delay to allow audit to complete
      setTimeout(async () => {
        const data = await getRevenueHealthDashboard(userId);
        setDashboard(data);
        setRunningAudit(false);
      }, 5000);
    } else {
      alert('Failed to run audit: ' + result.error);
      setRunningAudit(false);
    }
  };

  // Handle resolve issue
  const handleResolve = async (issueId: string) => {
    const result = await resolveIssue(issueId);
    if (result.success) {
      // Reload dashboard
      if (userId) {
        const data = await getRevenueHealthDashboard(userId);
        setDashboard(data);
      }
    }
  };

  // Handle snooze issue
  const handleSnooze = async (issueId: string) => {
    const result = await snoozeIssue(issueId);
    if (result.success) {
      // Reload dashboard
      if (userId) {
        const data = await getRevenueHealthDashboard(userId);
        setDashboard(data);
      }
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Link Guard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Link Monetization Guard</h1>
          <p className="mt-2 text-gray-600">
            Monitor your affiliate link health and protect your revenue
          </p>
        </div>

        {/* Health Score Card */}
        <HealthScoreCard
          score={dashboard.health_score}
          trend={dashboard.score_trend}
          scoreChange={dashboard.score_change}
          lastAuditedAt={dashboard.last_audit_at}
          className="mb-8"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Total Links</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{dashboard.links_total}</div>
            <div className="mt-1 text-sm text-gray-600">
              {dashboard.links_healthy} healthy
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Critical Issues</div>
            <div className="mt-2 text-3xl font-bold text-red-600">
              {dashboard.issues_by_severity.critical}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Require immediate action
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Warnings</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">
              {dashboard.issues_by_severity.warning}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Need attention soon
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Est. Monthly Loss</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              ${dashboard.estimated_monthly_loss.toFixed(0)}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              From current issues
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-8 flex items-center space-x-4">
          <button
            onClick={handleRunAudit}
            disabled={runningAudit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {runningAudit ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running Audit...
              </>
            ) : (
              '🔄 Run Audit Now'
            )}
          </button>

          <p className="text-sm text-gray-500">
            {dashboard.last_audit_at ? (
              `Last audited ${formatTimestamp(dashboard.last_audit_at)}`
            ) : (
              'Never audited'
            )}
          </p>
        </div>

        {/* Issues List */}
        {dashboard.top_issues.length > 0 && (
          <IssuesList
            issues={dashboard.top_issues}
            onResolve={handleResolve}
            onSnooze={handleSnooze}
            className="mb-8"
          />
        )}

        {/* Empty State */}
        {dashboard.top_issues.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              All Links Are Healthy!
            </h3>
            <p className="text-gray-500">
              No issues detected. Your affiliate links are in perfect shape.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}
