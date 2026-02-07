'use client';

/**
 * Link Health Table
 * Complete link inventory with status, issues, and actions
 */

import { useState } from 'react';

interface Link {
  id: string;
  original_url: string;
  final_url?: string;
  is_monetized: boolean;
  affiliate_network?: string;
  is_broken: boolean;
  is_stock_out: boolean;
  health_score: number;
  issue_count: number;
  last_checked_at: string;
}

interface LinkHealthTableProps {
  links: Link[];
  onViewDetails: (linkId: string) => void;
  onFixLink: (linkId: string) => void;
  className?: string;
}

export function LinkHealthTable({
  links,
  onViewDetails,
  onFixLink,
  className = '',
}: LinkHealthTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
  const [monetizationFilter, setMonetizationFilter] = useState<'all' | 'monetized' | 'unmonetized'>('all');
  const [sortBy, setSortBy] = useState<'health' | 'status' | 'checked'>('health');

  // Filter links
  const filteredLinks = links.filter((link) => {
    // Search filter
    if (searchTerm && !link.original_url.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const status = getLinkStatus(link);
      if (statusFilter === 'healthy' && status !== 'healthy') return false;
      if (statusFilter === 'warning' && status !== 'warning') return false;
      if (statusFilter === 'critical' && status !== 'critical') return false;
    }

    // Monetization filter
    if (monetizationFilter !== 'all') {
      if (monetizationFilter === 'monetized' && !link.is_monetized) return false;
      if (monetizationFilter === 'unmonetized' && link.is_monetized) return false;
    }

    return true;
  });

  // Sort links
  const sortedLinks = [...filteredLinks].sort((a, b) => {
    if (sortBy === 'health') {
      return a.health_score - b.health_score; // Lower scores first (worse health)
    } else if (sortBy === 'status') {
      const statusOrder = { critical: 3, warning: 2, healthy: 1 };
      return statusOrder[getLinkStatus(b)] - statusOrder[getLinkStatus(a)];
    } else {
      return new Date(b.last_checked_at).getTime() - new Date(a.last_checked_at).getTime();
    }
  });

  function getLinkStatus(link: Link): 'healthy' | 'warning' | 'critical' {
    if (link.is_broken || link.issue_count > 2) return 'critical';
    if (link.is_stock_out || link.issue_count > 0 || !link.is_monetized) return 'warning';
    return 'healthy';
  }

  function getStatusBadge(link: Link) {
    const status = getLinkStatus(link);
    const variants = {
      healthy: { bg: 'bg-green-100', text: 'text-green-700', emoji: '✅', label: 'Healthy' },
      warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', emoji: '⚠️', label: 'Warning' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', emoji: '🔴', label: 'Critical' },
    };
    const variant = variants[status];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${variant.bg} ${variant.text}`}>
        <span className="mr-1">{variant.emoji}</span>
        {variant.label}
      </span>
    );
  }

  function getIssueText(link: Link): string {
    if (link.is_broken) return 'Broken Link (404)';
    if (link.is_stock_out) return 'Out of Stock';
    if (!link.is_monetized) return 'Not Monetized';
    if (link.issue_count > 0) return `${link.issue_count} issue${link.issue_count > 1 ? 's' : ''}`;
    return 'No issues';
  }

  function truncateUrl(url: string, maxLength: number = 50): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header with Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Links ({sortedLinks.length})
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search links..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent"
            />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-sm border border-[var(--color-border)] rounded-md px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>

            {/* Monetization Filter */}
            <select
              value={monetizationFilter}
              onChange={(e) => setMonetizationFilter(e.target.value as any)}
              className="text-sm border border-[var(--color-border)] rounded-md px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent"
            >
              <option value="all">All Links</option>
              <option value="monetized">Monetized</option>
              <option value="unmonetized">Unmonetized</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-[var(--color-border)] rounded-md px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent"
            >
              <option value="health">Sort by Health</option>
              <option value="status">Sort by Status</option>
              <option value="checked">Sort by Last Checked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {sortedLinks.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p className="text-lg">No links found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Link
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Checked
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLinks.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-brand)' }}
                        title={link.original_url}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-brand-strong)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-brand)'}
                      >
                        {truncateUrl(link.original_url)}
                      </a>
                      <div className="flex items-center mt-1">
                        <div className={`w-2 h-2 rounded-full mr-2 ${link.health_score >= 90 ? 'bg-green-500' :
                            link.health_score >= 70 ? 'bg-yellow-500' :
                              'bg-red-500'
                          }`} />
                        <span className="text-xs text-gray-500">
                          Health: {link.health_score}/100
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(link)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm ${getLinkStatus(link) === 'critical' ? 'text-red-600 font-semibold' :
                        getLinkStatus(link) === 'warning' ? 'text-yellow-600' :
                          'text-gray-500'
                      }`}>
                      {getIssueText(link)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {link.is_monetized ? (
                      <span className="text-sm text-gray-900 font-medium">
                        {link.affiliate_network || 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Not monetized</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {formatTimestamp(link.last_checked_at)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {getLinkStatus(link) !== 'healthy' && (
                        <button
                          onClick={() => onFixLink(link.id)}
                          className="px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--color-brand)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-brand-strong)';
                            e.currentTarget.style.background = 'var(--color-brand-soft)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-brand)';
                            e.currentTarget.style.background = 'transparent';
                          }}
                          title="Fix"
                        >
                          🔧
                        </button>
                      )}
                      <button
                        onClick={() => onViewDetails(link.id)}
                        className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
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
