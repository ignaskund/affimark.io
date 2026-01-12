'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ScanRun {
  id: string;
  source_type: 'youtube' | 'twitch' | 'tiktok' | 'upload' | 'url';
  source_url?: string;
  source_title?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  products_detected: number;
  suggestions_generated: number;
  processing_time_ms?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function ScanHistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchScans();
  }, [statusFilter]);

  const fetchScans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      params.append('limit', '50');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/scans?${params}`,
        {
          headers: {
            'X-User-ID': 'current-user-id', // TODO: Get from auth context
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch scan history');
      }

      const data = await response.json();
      setScans(data.scans || []);
    } catch (err) {
      console.error('Fetch scans error:', err);
      setError('Failed to load scan history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (scanId: string) => {
    if (!confirm('Delete this scan? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/scans/${scanId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete scan');
      }

      setScans((prev) => prev.filter((s) => s.id !== scanId));
    } catch (err) {
      console.error('Delete scan error:', err);
      alert('Failed to delete scan');
    }
  };

  const handleViewScan = (scanId: string) => {
    // In a real app, would navigate to scan details page
    // For now, just redirect to scanner page
    router.push('/scanner');
  };

  const statusColors = {
    pending: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
    processing: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    completed: 'border-green-500/50 bg-green-500/10 text-green-400',
    failed: 'border-red-500/50 bg-red-500/10 text-red-400',
  };

  const sourceTypeIcons = {
    youtube: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    twitch: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
      </svg>
    ),
    tiktok: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
    upload: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    url: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  };

  if (isLoading) {
    return (
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
          <p className="mt-4 text-gray-400">Loading scan history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Scan History</h1>
          <p className="text-gray-400">View and manage your content scan history</p>
        </div>
        <Link
          href="/scanner"
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Scan
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Scan List */}
      {scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-12">
          <svg
            className="mb-4 h-16 w-16 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg text-white">No scans yet</p>
          <p className="mt-2 text-sm text-gray-400">
            Start by scanning your first transcript
          </p>
          <Link
            href="/scanner"
            className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Create Scan
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700"
            >
              {/* Source Icon */}
              <div className="flex-shrink-0 text-gray-400">
                {sourceTypeIcons[scan.source_type]}
              </div>

              {/* Scan Info */}
              <div className="flex-1">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">
                      {scan.source_title || `${scan.source_type} scan`}
                    </h3>
                    {scan.source_url && (
                      <a
                        href={scan.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-purple-400"
                      >
                        {scan.source_url}
                      </a>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusColors[scan.status]}`}
                  >
                    {scan.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>
                    {new Date(scan.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {scan.status === 'completed' && (
                    <>
                      <span>•</span>
                      <span>{scan.suggestions_generated} suggestions</span>
                      {scan.processing_time_ms && (
                        <>
                          <span>•</span>
                          <span>{(scan.processing_time_ms / 1000).toFixed(1)}s</span>
                        </>
                      )}
                    </>
                  )}
                  {scan.status === 'failed' && scan.error_message && (
                    <>
                      <span>•</span>
                      <span className="text-red-400">{scan.error_message}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {scan.status === 'completed' && (
                  <button
                    onClick={() => handleViewScan(scan.id)}
                    className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
                  >
                    View
                  </button>
                )}
                <button
                  onClick={() => handleDelete(scan.id)}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
