'use client';

import { AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react';

interface ReliabilityStat {
  platform: string;
  uptime_percentage: number;
  total_issues: number;
}

interface RecentIssue {
  id: string;
  issue_type: string;
  detected_at: string;
  resolved_at: string | null;
  duration_hours: number | null;
  estimated_loss_low: number | null;
  estimated_loss_high: number | null;
  resolution_type: string | null;
  tracked_products?: {
    product_name: string;
    platform: string;
    product_url: string;
  };
}

interface PlatformReliabilityDashboardProps {
  reliabilityStats: ReliabilityStat[];
  recentIssues: RecentIssue[];
  platformCounts: Record<string, number>;
}

export default function PlatformReliabilityDashboard({
  reliabilityStats,
  recentIssues,
  platformCounts,
}: PlatformReliabilityDashboardProps) {
  const getIssueTypeLabel = (issueType: string): string => {
    const labels: Record<string, string> = {
      broken_link: '🔗 Broken Link',
      out_of_stock: '📦 Out of Stock',
      redirect_error: '🔄 Redirect Error',
      affiliate_tag_missing: '🏷️ Missing Tag',
    };
    return labels[issueType] || issueType;
  };

  const getResolutionTypeLabel = (resolutionType: string | null): string => {
    if (!resolutionType) return 'Pending';
    const labels: Record<string, string> = {
      manual: 'Manual Fix',
      auto_fallback: 'Auto-Fallback',
      auto_recovered: 'Auto-Recovered',
    };
    return labels[resolutionType] || resolutionType;
  };

  const getUptimeColor = (uptime: number): string => {
    if (uptime >= 99) return 'text-green-600 dark:text-green-400';
    if (uptime >= 95) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getUptimeBarColor = (uptime: number): string => {
    if (uptime >= 99) return 'bg-green-500';
    if (uptime >= 95) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (reliabilityStats.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Reliability Data Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Start tracking products to see platform reliability metrics. We'll monitor uptime and detect issues
            automatically.
          </p>
        </div>
      </div>
    );
  }

  const totalTrackedProducts = Object.values(platformCounts).reduce((sum, count) => sum + count, 0);
  const totalIssues = reliabilityStats.reduce((sum, stat) => sum + stat.total_issues, 0);
  const avgUptime =
    reliabilityStats.reduce((sum, stat) => sum + stat.uptime_percentage, 0) / reliabilityStats.length;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Uptime</p>
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className={`text-3xl font-bold ${getUptimeColor(avgUptime)}`}>{avgUptime.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 30 days</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Issues</p>
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalIssues}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 30 days</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tracked Products</p>
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalTrackedProducts}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Across all platforms</p>
        </div>
      </div>

      {/* Platform Reliability Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Platform Stability (Last 30 Days)</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Based on health checks for your tracked products
          </p>
        </div>

        <div className="p-6 space-y-6">
          {reliabilityStats.map((stat) => (
            <div key={stat.platform} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                    {stat.platform}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {platformCounts[stat.platform] || 0} products
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getUptimeColor(stat.uptime_percentage)}`}>
                      {stat.uptime_percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">uptime</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{stat.total_issues}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">issues</p>
                  </div>
                </div>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${getUptimeBarColor(stat.uptime_percentage)} transition-all`}
                  style={{ width: `${stat.uptime_percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Issues */}
      {recentIssues.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Issues</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Latest 20 detected issues</p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentIssues.map((issue) => (
              <div key={issue.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium">{getIssueTypeLabel(issue.issue_type)}</span>
                      {issue.resolved_at ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                          ✓ Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded animate-pulse">
                          ⚠ Pending
                        </span>
                      )}
                    </div>

                    {issue.tracked_products && (
                      <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                        {issue.tracked_products.product_name}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>Detected: {new Date(issue.detected_at).toLocaleString()}</span>
                      {issue.duration_hours && (
                        <span>Duration: {issue.duration_hours.toFixed(1)}h</span>
                      )}
                      {issue.resolution_type && (
                        <span>Fixed: {getResolutionTypeLabel(issue.resolution_type)}</span>
                      )}
                    </div>
                  </div>

                  {(issue.estimated_loss_low !== null || issue.estimated_loss_high !== null) && (
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Prevented Loss</p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        €{issue.estimated_loss_low?.toFixed(0)} - €{issue.estimated_loss_high?.toFixed(0)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
