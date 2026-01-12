'use client';

import { AlertCircle, CheckCircle2, Clock, DollarSign, Shield, TrendingDown } from 'lucide-react';

interface LossSummary {
  total_issues: number;
  total_loss_low: number;
  total_loss_high: number;
  resolved_count: number;
  pending_count: number;
}

interface LossEntry {
  id: string;
  issue_type: string;
  detected_at: string;
  resolved_at: string | null;
  duration_hours: number | null;
  estimated_clicks_low: number | null;
  estimated_clicks_high: number | null;
  estimated_loss_low: number | null;
  estimated_loss_high: number | null;
  resolution_type: string | null;
  tracked_products?: {
    product_name: string;
    platform: string;
    product_url: string;
  } | null;
}

interface RevenueLossLedgerProps {
  summary: LossSummary | null;
  lossEntries: LossEntry[];
}

export default function RevenueLossLedger({ summary, lossEntries }: RevenueLossLedgerProps) {
  const getIssueTypeLabel = (issueType: string): string => {
    const labels: Record<string, string> = {
      broken_link: '🔗 Broken Link',
      out_of_stock: '📦 Out of Stock',
      redirect_error: '🔄 Redirect Error',
      affiliate_tag_missing: '🏷️ Missing Tag',
    };
    return labels[issueType] || issueType;
  };

  const getIssueIcon = (issueType: string) => {
    const icons: Record<string, typeof AlertCircle> = {
      broken_link: AlertCircle,
      out_of_stock: Clock,
      redirect_error: TrendingDown,
      affiliate_tag_missing: DollarSign,
    };
    const Icon = icons[issueType] || AlertCircle;
    return <Icon className="h-5 w-5" />;
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

  if (!summary || lossEntries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <Shield className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            All Systems Healthy
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            No revenue loss incidents detected in the last 30 days. We're monitoring your links 24/7 to keep it
            that way.
          </p>
        </div>
      </div>
    );
  }

  const totalSaved = ((summary.total_loss_low || 0) + (summary.total_loss_high || 0)) / 2;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue Protected</p>
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            €{totalSaved.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 30 days (est.)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Issues Detected</p>
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{summary.total_issues}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 30 days</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolved</p>
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{summary.resolved_count}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {summary.pending_count} pending
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loss Range</p>
            <TrendingDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            €{summary.total_loss_low?.toFixed(0)} - €{summary.total_loss_high?.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Estimated impact</p>
        </div>
      </div>

      {/* Loss Entries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Incident History</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Every issue caught before it cost you money
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {lossEntries.map((entry) => (
            <div
              key={entry.id}
              className={`p-6 ${
                !entry.resolved_at
                  ? 'bg-amber-50/50 dark:bg-amber-900/10'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              } transition-colors`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`p-3 rounded-lg ${
                    entry.resolved_at
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {getIssueIcon(entry.issue_type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                          {getIssueTypeLabel(entry.issue_type)}
                        </span>
                        {entry.resolved_at ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                            ✓ Resolved
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded animate-pulse">
                            ⚠ Active Issue
                          </span>
                        )}
                      </div>

                      {entry.tracked_products && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          {entry.tracked_products.product_name}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <span>Detected: {new Date(entry.detected_at).toLocaleString()}</span>
                        {entry.duration_hours && (
                          <span className="font-medium">
                            Duration: {entry.duration_hours.toFixed(1)}h
                          </span>
                        )}
                        {entry.estimated_clicks_low && entry.estimated_clicks_high && (
                          <span>
                            Affected clicks: {entry.estimated_clicks_low}-{entry.estimated_clicks_high}
                          </span>
                        )}
                      </div>

                      {entry.resolved_at && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            Resolved {new Date(entry.resolved_at).toLocaleString()} via{' '}
                            {getResolutionTypeLabel(entry.resolution_type)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Revenue Impact */}
                    {(entry.estimated_loss_low !== null || entry.estimated_loss_high !== null) && (
                      <div className="text-right ml-6">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {entry.resolved_at ? 'Revenue Protected' : 'Revenue at Risk'}
                        </p>
                        <p
                          className={`text-xl font-bold ${
                            entry.resolved_at
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          €{entry.estimated_loss_low?.toFixed(0)} - €{entry.estimated_loss_high?.toFixed(0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explainer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How We Calculate Protected Revenue
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          Revenue estimates are based on your historical traffic patterns, average click-through rates, and typical
          conversion rates. We show ranges (low-high) to account for variability. These are estimates—not guarantees—of
          revenue that would have been at risk without early detection.
        </p>
      </div>
    </div>
  );
}
