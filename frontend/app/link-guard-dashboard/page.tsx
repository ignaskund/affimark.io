'use client';

/**
 * Link Guard Dashboard Page
 * Complete Link Guard dashboard with all components
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { getRevenueHealthDashboard, runAudit, resolveIssue, snoozeIssue, getHealthStatus } from '@/lib/api/audit-api';
import { HealthOverview } from '@/components/dashboard/HealthOverview';
import { CriticalAlertsBanner } from '@/components/dashboard/CriticalAlertsBanner';
import { LinkHealthTable } from '@/components/dashboard/LinkHealthTable';
import { PriorityFixList } from '@/components/dashboard/PriorityFixList';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default function LinkGuardDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);

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

      // Load dashboard and links in parallel
      const [dashboardData, healthStatus] = await Promise.all([
        getRevenueHealthDashboard(userId!),
        getHealthStatus(userId!),
      ]);

      setDashboard(dashboardData);
      setLinks(healthStatus.links || []);
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
      // Reload dashboard after audit completes
      setTimeout(async () => {
        const [dashboardData, healthStatus] = await Promise.all([
          getRevenueHealthDashboard(userId),
          getHealthStatus(userId),
        ]);
        setDashboard(dashboardData);
        setLinks(healthStatus.links || []);
        setRunningAudit(false);
      }, 5000);
    } else {
      alert('Failed to run audit: ' + result.error);
      setRunningAudit(false);
    }
  };

  // Handle fix issue
  const handleFixIssue = async (issueId: string) => {
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
  const handleSnoozeIssue = async (issueId: string) => {
    const result = await snoozeIssue(issueId);
    if (result.success) {
      // Reload dashboard
      if (userId) {
        const data = await getRevenueHealthDashboard(userId);
        setDashboard(data);
      }
    }
  };

  // Loading state
  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Link Monetization Guard</h1>
          <p className="mt-2 text-gray-600">
            Monitor your affiliate link health and protect your revenue
          </p>
        </div>

        {/* Health Overview */}
        <HealthOverview
          healthScore={dashboard.health_score}
          scoreTrend={dashboard.score_trend}
          scoreChange={dashboard.score_change}
          estimatedMonthlyLoss={dashboard.estimated_monthly_loss}
          linksTotal={dashboard.links_total}
          linksHealthy={dashboard.links_healthy}
          linksBroken={dashboard.links_broken}
          criticalIssues={dashboard.issues_by_severity.critical}
          className="mb-8"
        />

        {/* Critical Alerts Banner */}
        {dashboard.issues_by_severity.critical > 0 && (
          <CriticalAlertsBanner
            criticalIssuesCount={dashboard.issues_by_severity.critical}
            estimatedLoss={dashboard.estimated_monthly_loss}
            onViewIssues={() => {
              // Scroll to issues section
              document.getElementById('issues-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onFixFirst={() => {
              if (dashboard.top_issues.length > 0) {
                handleFixIssue(dashboard.top_issues[0].id);
              }
            }}
            className="mb-8"
          />
        )}

        {/* Quick Actions */}
        <QuickActions
          onAddLink={() => router.push('/onboarding/link-setup')}
          onRunAudit={handleRunAudit}
          onExportReport={() => {
            alert('Export feature coming soon!');
          }}
          onSettings={() => router.push('/settings')}
          isRunningAudit={runningAudit}
          className="mb-8"
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="issues-section">
          {/* Main Content - Link Health Table */}
          <div className="lg:col-span-2">
            <LinkHealthTable
              links={links}
              onViewDetails={(linkId) => {
                alert(`View details for link: ${linkId}`);
              }}
              onFixLink={(linkId) => {
                alert(`Fix link: ${linkId}`);
              }}
            />
          </div>

          {/* Sidebar - Priority Fix List */}
          <div className="lg:col-span-1">
            <PriorityFixList
              issues={dashboard.top_issues}
              userId={userId!}
              onIssueResolved={async () => {
                // Reload dashboard when issue is resolved
                const [dashboardData, healthStatus] = await Promise.all([
                  getRevenueHealthDashboard(userId!),
                  getHealthStatus(userId!),
                ]);
                setDashboard(dashboardData);
                setLinks(healthStatus.links || []);
              }}
            />
          </div>
        </div>

        {/* Empty State for New Users */}
        {dashboard.links_total === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mt-8">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to Link Guard!
            </h3>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Add your first link-in-bio page to start monitoring your affiliate links 24/7
            </p>
            <button
              onClick={() => router.push('/onboarding/link-setup')}
              className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all text-lg"
            >
              Add Your First Link Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
