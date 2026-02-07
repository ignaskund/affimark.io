'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ProblemsResolvedProps {
  actions: any[];
  completedCount: number;
}

export default function ProblemsResolved({ actions, completedCount }: ProblemsResolvedProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Problems Resolved</h3>
        <p className="text-sm text-gray-500 mt-1">{completedCount} fixed in last 30 days</p>
      </div>

      <div className="p-6">
        {actions && actions.length > 0 ? (
          <>
            <div className="space-y-4 mb-4">
              {actions.slice(0, 3).map((action) => (
                <div key={action.id} className="flex items-start gap-3">
                  <CheckCircle2 className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {action.action_type
                        .split('_')
                        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {action.link_health_issues?.title || 'Issue resolved'}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                    Pending
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/link-guard/fixes"
              className="block w-full text-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View All Fixes
            </Link>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto text-gray-400 mb-3" size={40} />
            <p className="text-sm text-gray-600">No pending fixes</p>
            <p className="text-xs text-gray-500 mt-1">
              Issues will appear here when detected
            </p>
          </div>
        )}
      </div>

      {completedCount > 0 && (
        <div className="px-6 py-4 border-t border-gray-200" style={{ background: 'var(--color-success-soft)' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium" style={{ color: 'var(--color-success)' }}>
              {completedCount} problems resolved this month
            </span>
            <Link
              href="/link-guard/fixes"
              className="flex items-center gap-1"
              style={{ color: 'var(--color-success)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              History
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
