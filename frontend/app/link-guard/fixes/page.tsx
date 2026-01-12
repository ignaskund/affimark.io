'use client';

/**
 * Pending Fixes Approval Queue
 * Shows all pending fixes waiting for user approval
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { getPendingActions, completeAction, cancelAction } from '@/lib/api/audit-api';

export default function PendingFixesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

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

  // Load pending actions
  useEffect(() => {
    if (!userId) return;

    async function loadActions() {
      setLoading(true);
      const result = await getPendingActions(userId!);
      setPendingActions(result.actions || []);
      setLoading(false);
    }

    loadActions();
  }, [userId]);

  const handleApprove = async (actionId: string) => {
    setProcessing(actionId);
    const result = await completeAction(actionId, 'Approved and applied via dashboard');

    if (result.success) {
      // Remove from list
      setPendingActions(pendingActions.filter(a => a.id !== actionId));
      alert('Fix applied successfully!');
    } else {
      alert(`Failed to apply fix: ${result.error}`);
    }
    setProcessing(null);
  };

  const handleReject = async (actionId: string) => {
    if (!confirm('Are you sure you want to reject this fix?')) return;

    setProcessing(actionId);
    const result = await cancelAction(actionId, 'Rejected by user');

    if (result.success) {
      // Remove from list
      setPendingActions(pendingActions.filter(a => a.id !== actionId));
    } else {
      alert(`Failed to reject fix: ${result.error}`);
    }
    setProcessing(null);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'generated_link': 'Generate Link',
      'replaced_link': 'Replace Link',
      'switched_program': 'Switch Program',
      'removed_link': 'Remove Link',
      'snoozed_issue': 'Snooze Issue'
    };
    return labels[actionType] || actionType;
  };

  const getActionTypeIcon = (actionType: string) => {
    const icons: Record<string, string> = {
      'generated_link': '🔗',
      'replaced_link': '🔄',
      'switched_program': '💱',
      'removed_link': '🗑️',
      'snoozed_issue': '⏸️'
    };
    return icons[actionType] || '⚙️';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pending fixes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Pending Fixes</h1>
          <p className="mt-2 text-gray-600">
            Review and approve automated fixes for your link issues
          </p>
        </div>

        {/* Stats */}
        {pendingActions.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
              <div>
                <p className="text-indigo-100 text-sm">Pending Fixes</p>
                <p className="text-4xl font-bold">{pendingActions.length}</p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm">Est. Revenue Recovery</p>
                <p className="text-4xl font-bold">
                  €{Math.floor(pendingActions.reduce((sum, action) => {
                    return sum + (action.action_data?.alternative?.estimated_revenue_gain || 0);
                  }, 0))}
                  <span className="text-lg">/mo</span>
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm">Action Required</p>
                <p className="text-2xl font-bold mt-2">Review & Approve</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Actions List */}
        {pendingActions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              No Pending Fixes
            </h3>
            <p className="text-gray-600 mb-8">
              All automated fixes have been reviewed. New fixes will appear here when issues are detected.
            </p>
            <button
              onClick={() => router.push('/link-guard-dashboard')}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">
                        {getActionTypeIcon(action.action_type)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {getActionTypeLabel(action.action_type)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Issue: {action.link_health_issues?.title || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created {new Date(action.executed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {action.action_data?.alternative?.estimated_revenue_gain && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Potential Gain</p>
                        <p className="text-2xl font-bold text-green-600">
                          +€{Math.floor(action.action_data.alternative.estimated_revenue_gain)}<span className="text-sm">/mo</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 bg-gray-50">
                  {/* Old Link */}
                  {action.action_data?.old_link && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-red-600 mb-1">OLD LINK (Will be removed)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={action.action_data.old_link}
                          readOnly
                          className="flex-1 px-3 py-2 bg-white border border-red-300 rounded text-sm text-gray-700"
                        />
                        <button
                          onClick={() => handleCopyLink(action.action_data.old_link)}
                          className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* New Link */}
                  {action.action_data?.new_link && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-green-600 mb-1">NEW LINK (Will be added)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={action.action_data.new_link}
                          readOnly
                          className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm text-gray-700 font-semibold"
                        />
                        <button
                          onClick={() => handleCopyLink(action.action_data.new_link)}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alternative Details */}
                  {action.action_data?.alternative && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Network</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {action.action_data.alternative.network}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Merchant</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {action.action_data.alternative.merchant_name}
                        </p>
                      </div>
                      {action.action_data.alternative.commission_rate && (
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Commission</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {(action.action_data.alternative.commission_rate * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => handleReject(action.id)}
                    disabled={processing === action.id}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {processing === action.id ? 'Processing...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleApprove(action.id)}
                    disabled={processing === action.id}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing === action.id ? 'Applying...' : '✓ Approve & Apply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
