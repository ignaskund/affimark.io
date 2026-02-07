'use client';

import { Plus, Play, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface QuickActionsProps {
  userId: string;
  trackedPages: any[];
  hasRedirectLinks: boolean;
}

export default function QuickActions({ userId, trackedPages, hasRedirectLinks }: QuickActionsProps) {
  const [isRunningAudit, setIsRunningAudit] = useState(false);

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const response = await fetch('/api/link-audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to run audit:', error);
    } finally {
      setIsRunningAudit(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Quick Actions</h3>
      </div>

      <div className="p-6 space-y-3">
        {/* Add Link Page */}
        {trackedPages.length === 0 && (
          <Link
            href="/onboarding/link-setup"
            className="flex items-center gap-3 w-full px-4 py-3 bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30 rounded-lg transition-colors group"
          >
            <div className="p-2 bg-[var(--color-brand)]/20 rounded-lg group-hover:bg-[var(--color-brand)]/30 transition-colors">
              <Plus className="text-[var(--color-brand-strong)]" size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--color-text)]">Add Link Page</p>
              <p className="text-xs text-[var(--color-text-muted)]">Start monitoring your links</p>
            </div>
          </Link>
        )}

        {/* Run Audit Now */}
        {trackedPages.length > 0 && (
          <button
            onClick={handleRunAudit}
            disabled={isRunningAudit}
            className="flex items-center gap-3 w-full px-4 py-3 bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-2 bg-[var(--color-brand)]/20 rounded-lg group-hover:bg-[var(--color-brand)]/30 transition-colors">
              <Play className="text-[var(--color-brand-strong)]" size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {isRunningAudit ? 'Running Audit...' : 'Run Audit Now'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Check all links for issues</p>
            </div>
          </button>
        )}

        {/* Enable Autopilot */}
        {!hasRedirectLinks && trackedPages.length > 0 && (
          <Link
            href="/smartwrappers/create"
            className="flex items-center gap-3 w-full px-4 py-3 bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30 rounded-lg transition-colors group"
          >
            <div className="p-2 bg-[var(--color-brand)]/20 rounded-lg group-hover:bg-[var(--color-brand)]/30 transition-colors">
              <Link2 className="text-[var(--color-brand-strong)]" size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--color-text)]">Create SmartWrapper</p>
              <p className="text-xs text-[var(--color-text-muted)]">Auto-fix with waterfall routing</p>
            </div>
          </Link>
        )}
      </div>

      {/* Monitored Pages List */}
      {trackedPages.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Monitored Pages
          </h4>
          <div className="space-y-2">
            {trackedPages.slice(0, 3).map((page) => (
              <div key={page.id} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-gray-700 truncate flex-1">
                  {page.page_url.replace(/^https?:\/\//, '')}
                </span>
                <span className="text-xs text-gray-400">
                  {page.link_count || 0} links
                </span>
              </div>
            ))}
          </div>

          {trackedPages.length > 3 && (
            <Link
              href="/link-guard"
              className="block mt-3 text-xs text-[var(--color-brand)] hover:text-[var(--color-brand-strong)] font-medium"
            >
              View all {trackedPages.length} pages →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
