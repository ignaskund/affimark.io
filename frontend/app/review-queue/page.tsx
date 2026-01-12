'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { supabase } from '@/lib/supabase-client';

type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'in_inventory';

interface ScanSuggestion {
  id: string;
  scan_run_id: string;
  detected_product_name: string;
  detected_brand?: string | null;
  detected_category?: string | null;
  context_snippet?: string | null;
  confidence_score: number;
  status: SuggestionStatus;
  created_at: string;
  reviewed_at?: string | null;
}

interface ScanRun {
  id: string;
  source_type: string;
  source_title?: string | null;
  source_url?: string | null;
}

interface SuggestionWithScan extends ScanSuggestion {
  scan_run?: ScanRun | null;
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionWithScan[]>([]);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>(
    'pending',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // Check authentication
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data.session) {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      } else {
        setAuthStatus('authenticated');
        setUserId(data.session.user.id);
      }
    }

    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        setAuthStatus('authenticated');
        setUserId(session.user.id);
      } else {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !userId) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

        // 1) Get recent scan runs
        const scansRes = await fetch(
          `${backendUrl}/api/scanner/scans?limit=50`,
          {
            headers: {
              'X-User-ID': userId,
            },
          },
        );

        if (!scansRes.ok) {
          throw new Error('Failed to load scans');
        }

        const scansJson = await scansRes.json();
        const scans: ScanRun[] = scansJson.scans || [];

        // 2) For each scan, load its suggestions
        const allSuggestions: SuggestionWithScan[] = [];

        for (const scan of scans) {
          const detailsRes = await fetch(
            `${backendUrl}/api/scanner/scans/${scan.id}`,
            {
              headers: {
                'X-User-ID': userId,
              },
            },
          );

          if (!detailsRes.ok) continue;

          const detailsJson = await detailsRes.json();
          const suggs: ScanSuggestion[] = detailsJson.suggestions || [];
          suggs.forEach((s) =>
            allSuggestions.push({
              ...s,
              scan_run: scan,
            }),
          );
        }

        setSuggestions(allSuggestions);
      } catch (err: any) {
        console.error('Review queue load error', err);
        setError(err.message || 'Failed to load review queue');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [statusFilter, authStatus, userId]);

  const filteredSuggestions = suggestions.filter((s) =>
    statusFilter === 'all' ? true : s.status === statusFilter,
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkUpdate = async (status: SuggestionStatus) => {
    if (selectedIds.size === 0 || !userId) return;
    setIsUpdating(true);
    setError(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

      const res = await fetch(
        `${backendUrl}/api/scanner/suggestions/bulk-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
          },
          body: JSON.stringify({
            suggestion_ids: Array.from(selectedIds),
            status,
          }),
        },
      );

      if (!res.ok) {
        throw new Error('Failed to update suggestions');
      }

      const json = await res.json();
      const updated: ScanSuggestion[] = json.suggestions || [];

      setSuggestions((prev) =>
        prev.map((s) => {
          const u = updated.find((us) => us.id === s.id);
          return u ? { ...s, ...u } : s;
        }),
      );
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Bulk update error', err);
      setError(err.message || 'Failed to update suggestions');
    } finally {
      setIsUpdating(false);
    }
  };

  const singleUpdate = async (id: string, status: SuggestionStatus) => {
    if (!userId) return;
    setIsUpdating(true);
    setError(null);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

      const res = await fetch(
        `${backendUrl}/api/scanner/suggestions/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!res.ok) {
        throw new Error('Failed to update suggestion');
      }

      const json = await res.json();
      const updated: ScanSuggestion = json.suggestion;

      setSuggestions((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      console.error('Single update error', err);
      setError(err.message || 'Failed to update suggestion');
    } finally {
      setIsUpdating(false);
    }
  };

  if (authStatus === 'loading' || (authStatus === 'authenticated' && isLoading)) {
    return (
      <AppShell>
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 animate-spin text-purple-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-4 text-gray-400">Loading review queue...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Review Queue</h1>
          <p className="text-gray-400">
            AI-detected product suggestions from your scanned content. Approve,
            edit, or reject before they enter your inventory.
          </p>
        </div>
        <button
          onClick={() => router.push('/scanner')}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          New Scan
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Filters + bulk actions */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as SuggestionStatus | 'all')
          }
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="in_inventory">In Inventory</option>
          <option value="all">All</option>
        </select>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-3 py-2 text-sm text-purple-100">
            <span className="mr-2 font-medium">
              {selectedIds.size} selected
            </span>
            <button
              disabled={isUpdating}
              onClick={() => bulkUpdate('approved')}
              className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={isUpdating}
              onClick={() => bulkUpdate('rejected')}
              className="rounded bg-gray-800 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {filteredSuggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-12">
          <p className="text-lg text-white">No suggestions to review</p>
          <p className="mt-2 text-sm text-gray-400">
            Run a scan from the scanner page to generate monetization
            suggestions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleSelect(s.id)}
                className="mt-2 h-4 w-4 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500"
              />

              <div className="flex-1">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {s.detected_product_name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      {s.detected_brand && (
                        <span className="rounded-full bg-gray-800 px-2 py-0.5">
                          Brand: {s.detected_brand}
                        </span>
                      )}
                      {s.detected_category && (
                        <span className="rounded-full bg-gray-800 px-2 py-0.5">
                          Category: {s.detected_category}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          s.confidence_score >= 80
                            ? 'bg-green-600/20 text-green-300'
                            : s.confidence_score >= 60
                            ? 'bg-yellow-600/20 text-yellow-300'
                            : 'bg-gray-600/20 text-gray-300'
                        }`}
                      >
                        Confidence: {s.confidence_score.toFixed(0)}%
                      </span>
                      {s.scan_run && (
                        <span className="rounded-full bg-gray-800 px-2 py-0.5">
                          Source: {s.scan_run.source_title || s.scan_run.source_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      s.status === 'approved'
                        ? 'bg-green-500/10 text-green-300'
                        : s.status === 'rejected'
                        ? 'bg-red-500/10 text-red-300'
                        : s.status === 'in_inventory'
                        ? 'bg-blue-500/10 text-blue-300'
                        : 'bg-yellow-500/10 text-yellow-300'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                {s.context_snippet && (
                  <p className="mt-2 text-sm text-gray-300">
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      Context:&nbsp;
                    </span>
                    <span className="italic">{s.context_snippet}</span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>
                    Detected{' '}
                    {new Date(s.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {s.reviewed_at && (
                    <>
                      <span>•</span>
                      <span>
                        Reviewed{' '}
                        {new Date(s.reviewed_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  disabled={isUpdating}
                  onClick={() => singleUpdate(s.id, 'approved')}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={isUpdating}
                  onClick={() => singleUpdate(s.id, 'rejected')}
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}

