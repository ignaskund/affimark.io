'use client';

/**
 * Issues List Component
 *
 * Displays filterable/sortable list of link health issues with:
 * - Severity badges
 * - Revenue impact column
 * - Quick action buttons per row
 * - Filtering by severity/status
 */

import { useState } from 'react';

interface Issue {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  issue_type: string;
  revenue_impact_estimate?: number;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive' | 'wont_fix';
  created_at: string;
  link_url?: string;
}

interface IssuesListProps {
  issues: Issue[];
  onResolve?: (issueId: string) => void;
  onSnooze?: (issueId: string) => void;
  onViewDetails?: (issueId: string) => void;
  className?: string;
}

export function IssuesList({
  issues,
  onResolve,
  onSnooze,
  onViewDetails,
  className = ''
}: IssuesListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [sortBy, setSortBy] = useState<'severity' | 'revenue' | 'date'>('severity');

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
    return true;
  });

  // Sort issues
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    } else if (sortBy === 'revenue') {
      return (b.revenue_impact_estimate || 0) - (a.revenue_impact_estimate || 0);
    } else {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const getSeverityBadge = (severity: 'critical' | 'warning' | 'info') => {
    const variants = {
      critical: { bg: 'bg-red-100', text: 'text-red-700', emoji: '🚨' },
      warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', emoji: '⚠️' },
      info: { bg: 'bg-blue-100', text: 'text-blue-700', emoji: 'ℹ️' }
    };
    const variant = variants[severity];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant.bg} ${variant.text}`}>
        <span className="mr-1">{variant.emoji}</span>
        {severity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      open: { bg: 'bg-gray-100', text: 'text-gray-700' },
      acknowledged: { bg: 'bg-blue-100', text: 'text-blue-700' },
      resolved: { bg: 'bg-green-100', text: 'text-green-700' },
      false_positive: { bg: 'bg-gray-100', text: 'text-gray-500' },
      wont_fix: { bg: 'bg-gray-100', text: 'text-gray-500' }
    };
    const variant = variants[status] || variants.open;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${variant.bg} ${variant.text}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header with Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Issues ({sortedIssues.length})
          </h3>

          <div className="flex items-center space-x-3">
            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="severity">Sort by Severity</option>
              <option value="revenue">Sort by Impact</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      {sortedIssues.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p className="text-lg">No issues found</p>
          <p className="text-sm mt-1">All your links are healthy! 🎉</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue Impact
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <button
                        onClick={() => onViewDetails?.(issue.id)}
                        className="text-sm font-medium text-gray-900 hover:text-indigo-600 text-left"
                      >
                        {issue.title}
                      </button>
                      {issue.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {issue.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimestamp(issue.created_at)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getSeverityBadge(issue.severity)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(issue.status)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {issue.revenue_impact_estimate ? (
                      <span className="text-sm font-medium text-gray-900">
                        ${issue.revenue_impact_estimate.toFixed(0)}/mo
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {issue.status === 'open' && (
                        <>
                          <button
                            onClick={() => onSnooze?.(issue.id)}
                            className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                            title="Snooze"
                          >
                            ⏸️
                          </button>
                          <button
                            onClick={() => onResolve?.(issue.id)}
                            className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                            title="Resolve"
                          >
                            ✓
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onViewDetails?.(issue.id)}
                        className="text-indigo-600 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50"
                        title="View Details"
                      >
                        →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}
