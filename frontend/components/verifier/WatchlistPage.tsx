'use client';

import { useState, useEffect } from 'react';
import { Eye, Bell, Trash2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import type { WatchlistItem, VerifierAlert, VerdictStatus } from '@/types/verifier';
import VerdictBadge from './VerdictBadge';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

interface WatchlistPageProps {
  userId: string;
}

export default function WatchlistPage({ userId }: WatchlistPageProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<VerifierAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [watchlistRes, alertsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/verifier/watchlist`, { headers }),
        fetch(`${BACKEND_URL}/api/verifier/alerts`, { headers }),
      ]);

      if (watchlistRes.ok) {
        const data = await watchlistRes.json();
        setItems(data.items || []);
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      setError('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/verifier/watchlist/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch {
      // Ignore error
    }
  };

  const handleMarkRead = async (alertId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/verifier/alerts/${alertId}/read`, {
        method: 'PUT',
        headers,
      });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch {
      // Ignore error
    }
  };

  const unreadAlerts = alerts.filter(a => !a.is_read);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Watchlist</h2>
          <p className="text-sm text-gray-400 mt-1">
            {items.length} products monitored
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerts */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Bell className="w-4 h-4 text-amber-400" />
            {unreadAlerts.length} new alert{unreadAlerts.length > 1 ? 's' : ''}
          </div>
          <div className="space-y-2">
            {unreadAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-amber-300">{alert.title}</p>
                  {alert.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{alert.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleMarkRead(alert.id)}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Items */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Eye className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No products in your watchlist yet.</p>
          <p className="text-sm mt-1">Analyze a product and add it to watch for changes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <WatchlistCard
              key={item.id}
              item={item}
              alertCount={alerts.filter(a => a.watchlist_id === item.id && !a.is_read).length}
              onRemove={() => handleRemove(item.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

interface WatchlistCardProps {
  item: WatchlistItem;
  alertCount: number;
  onRemove: () => void;
}

function WatchlistCard({ item, alertCount, onRemove }: WatchlistCardProps) {
  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">{item.product_name}</h4>
            {alertCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                {alertCount} alert{alertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            {item.brand && <span>{item.brand}</span>}
            {item.brand && item.merchant && <span>·</span>}
            <span>{item.merchant}</span>
          </div>

          {/* Last Snapshot Scores */}
          {item.last_snapshot && (
            <div className="flex items-center gap-3 mt-3">
              <VerdictBadge status={item.last_snapshot.verdict as VerdictStatus} size="sm" />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>PV: {item.last_snapshot.scores.product_viability}</span>
                <span>OM: {item.last_snapshot.scores.offer_merchant}</span>
                <span>EC: {item.last_snapshot.scores.economics_feasibility}</span>
              </div>
            </div>
          )}

          {/* Last Checked */}
          {item.last_checked_at && (
            <p className="text-xs text-gray-600 mt-2">
              Last checked: {new Date(item.last_checked_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
