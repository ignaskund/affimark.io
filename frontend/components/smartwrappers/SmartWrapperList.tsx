'use client';

import { useState } from 'react';
import { Link2, Copy, ExternalLink, BarChart3, Pencil, Trash2, Power, PowerOff, CheckCircle2 } from 'lucide-react';

interface SmartWrapper {
  id: string;
  short_code: string;
  name: string | null;
  destination_url: string;
  fallback_url: string | null;
  fallback_active: boolean;
  auto_fallback_enabled: boolean;
  click_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SmartWrapperListProps {
  smartwrappers: SmartWrapper[];
}

export default function SmartWrapperList({ smartwrappers: initialSmartWrappers }: SmartWrapperListProps) {
  const [smartwrappers, setSmartWrappers] = useState(initialSmartWrappers);
  const [copying, setCopying] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleCopy = async (shortCode: string) => {
    const url = `https://go.affimark.com/${shortCode}`;
    await navigator.clipboard.writeText(url);
    setCopying(shortCode);
    setTimeout(() => setCopying(null), 2000);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setToggling(id);

    try {
      const response = await fetch(`/api/smartwrappers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (response.ok) {
        setSmartWrappers(smartwrappers.map((sw) =>
          sw.id === id ? { ...sw, is_active: !currentStatus } : sw
        ));
      }
    } catch (err) {
      console.error('Failed to toggle SmartWrapper:', err);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SmartWrapper? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/smartwrappers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSmartWrappers(smartwrappers.filter((sw) => sw.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete SmartWrapper:', err);
    }
  };

  if (smartwrappers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {smartwrappers.map((sw) => (
        <div
          key={sw.id}
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${
            sw.is_active
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-gray-300 dark:border-gray-600 opacity-60'
          } overflow-hidden`}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {sw.name || 'Unnamed SmartWrapper'}
                  </h3>
                  {!sw.is_active && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded">
                      Inactive
                    </span>
                  )}
                  {sw.auto_fallback_enabled && (
                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Auto-Fallback
                    </span>
                  )}
                  {sw.fallback_active && (
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded animate-pulse">
                      🔄 Fallback Active
                    </span>
                  )}
                </div>

                {/* Short Link */}
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400 break-all">
                    go.affimark.com/{sw.short_code}
                  </code>
                  <button
                    onClick={() => handleCopy(sw.short_code)}
                    className="ml-auto px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                  >
                    {copying === sw.short_code ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Destination URL */}
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span className="font-medium">Destination:</span>{' '}
                  <span className="break-all">{sw.destination_url}</span>
                </div>

                {/* Fallback URL */}
                {sw.fallback_url && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Fallback:</span>{' '}
                    <span className="break-all">{sw.fallback_url}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Clicks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {sw.click_count.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Created</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(sw.created_at).toLocaleDateString()}
                </p>
              </div>
              {sw.updated_at !== sw.created_at && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(sw.updated_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.open(`https://go.affimark.com/${sw.short_code}/debug`, '_blank')}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Redirect Chain
              </button>

              <button
                onClick={() => window.location.href = `/dashboard/smartwrappers/${sw.id}/analytics`}
                className="flex-1 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </button>

              <button
                onClick={() => handleToggle(sw.id, sw.is_active)}
                disabled={toggling === sw.id}
                className={`px-4 py-2 ${
                  sw.is_active
                    ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
                } disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2`}
                title={sw.is_active ? 'Disable' : 'Enable'}
              >
                {sw.is_active ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={() => handleDelete(sw.id)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
