'use client';

import { useState } from 'react';
import IssueDetailModal from './IssueDetailModal';
import { getIssueDetails, snoozeIssue } from '@/lib/api/audit-api';

/**
 * Priority Fix List
 * Auto-ranked issues by revenue impact
 */

interface Issue {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  revenue_impact_estimate?: number;
  created_at: string;
  link_url?: string;
  issue_type?: string;
  evidence?: Record<string, any>;
}

interface PriorityFixListProps {
  issues: Issue[];
  userId: string;
  onIssueResolved?: () => void;
  className?: string;
}

export function PriorityFixList({
  issues,
  userId,
  onIssueResolved,
  className = '',
}: PriorityFixListProps) {
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Get top 5 issues by revenue impact
  const topIssues = [...issues]
    .sort((a, b) => (b.revenue_impact_estimate || 0) - (a.revenue_impact_estimate || 0))
    .slice(0, 5);

  const handleFix = async (issue: Issue) => {
    setLoading(true);
    try {
      const result = await getIssueDetails(issue.id);
      if (result.success && result.issue) {
        setSelectedIssue(result.issue);
        setRecommendations(result.recommendations || []);
      } else {
        alert('Failed to load issue details');
      }
    } catch (error) {
      alert('Error loading issue details');
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (issueId: string) => {
    if (confirm('Snooze this issue? It will be marked as acknowledged.')) {
      const result = await snoozeIssue(issueId);
      if (result.success) {
        onIssueResolved?.();
      } else {
        alert('Failed to snooze issue');
      }
    }
  };

  if (topIssues.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-8 text-center ${className}`}>
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          All Clear!
        </h3>
        <p className="text-gray-600">
          No priority issues detected. Your links are healthy!
        </p>
      </div>
    );
  }

  function getDaysOld(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / 86400000);
  }

  function getUrgencyLabel(daysOld: number): string {
    if (daysOld < 1) return 'Just detected';
    if (daysOld === 1) return '1 day old';
    if (daysOld < 7) return `${daysOld} days old`;
    return 'Over a week old!';
  }

  function getUrgencyColor(daysOld: number): string {
    if (daysOld < 3) return 'text-yellow-600';
    if (daysOld < 7) return 'text-orange-600';
    return 'text-red-600';
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          🎯 Priority Fix List
        </h3>
        <p className="text-sm text-gray-600">
          Fix these first for maximum revenue recovery
        </p>
      </div>

      {/* Issues List */}
      <div className="divide-y divide-gray-200">
        {topIssues.map((issue, index) => {
          const daysOld = getDaysOld(issue.created_at);
          const urgencyLabel = getUrgencyLabel(daysOld);
          const urgencyColor = getUrgencyColor(daysOld);

          return (
            <div key={issue.id} className="p-6 hover:bg-gray-50 transition-colors">
              {/* Priority Number */}
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg mr-4 shadow-md">
                  {index + 1}
                </div>

                <div className="flex-grow">
                  {/* Title */}
                  <h4 className="text-lg font-bold text-gray-900 mb-1">
                    {issue.title}
                  </h4>

                  {/* Description */}
                  {issue.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {issue.description}
                    </p>
                  )}

                  {/* Link URL */}
                  {issue.link_url && (
                    <a
                      href={issue.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-700 mb-2 inline-block"
                    >
                      {issue.link_url.length > 60
                        ? issue.link_url.substring(0, 60) + '...'
                        : issue.link_url}
                    </a>
                  )}

                  {/* Metrics */}
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    {/* Revenue Impact */}
                    {issue.revenue_impact_estimate && issue.revenue_impact_estimate > 0 && (
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-red-600">
                          Lost revenue: €{issue.revenue_impact_estimate}/month
                        </span>
                      </div>
                    )}

                    {/* Urgency */}
                    <div className="flex items-center">
                      <span className={`text-sm font-semibold ${urgencyColor}`}>
                        ⏰ {urgencyLabel}
                      </span>
                    </div>

                    {/* Severity Badge */}
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : issue.severity === 'warning'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => handleFix(issue)}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all text-sm shadow-md disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Fix Now'}
                    </button>
                    <button
                      onClick={() => handleSnooze(issue.id)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all text-sm"
                    >
                      Snooze
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {issues.length > 5 && (
        <div className="p-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            +{issues.length - 5} more issue{issues.length - 5 > 1 ? 's' : ''} not shown
          </p>
        </div>
      )}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          recommendations={recommendations}
          userId={userId}
          onClose={() => {
            setSelectedIssue(null);
            setRecommendations([]);
          }}
          onIssueResolved={() => {
            setSelectedIssue(null);
            setRecommendations([]);
            onIssueResolved?.();
          }}
        />
      )}
    </div>
  );
}
