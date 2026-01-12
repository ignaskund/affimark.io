'use client';

import { useState, useEffect } from 'react';
import { Package, ScanLine, Store, BarChart3, Loader2 } from 'lucide-react';

interface AgentContext {
  profile: {
    full_name: string;
    handle?: string;
    content_categories: string[];
  };
  inventory: {
    total_items: number;
    active_items: number;
    draft_items: number;
  };
  scans: {
    total_scans: number;
    pending_suggestions: number;
  };
  shop: {
    is_published: boolean;
    total_items: number;
    visible_items: number;
    shop_url?: string;
  };
  analytics: {
    clicks_last_30d: number;
    conversions_last_30d: number;
  };
}

export interface AgentContextPanelProps {
  userId?: string;
}

export function AgentContextPanel({ userId }: AgentContextPanelProps) {
  const [context, setContext] = useState<AgentContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function fetchContext() {
      try {
        const response = await fetch('/api/agent/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch context');
        }

        const data = await response.json();
        setContext(data.context);
      } catch (error) {
        console.error('[AgentContextPanel] Error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContext();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <div className="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (!context) {
    return null;
  }

  const stats = [
    {
      icon: Package,
      label: 'Inventory',
      value: context.inventory.total_items,
      sub: `${context.inventory.active_items} active`,
      color: 'text-blue-400',
    },
    {
      icon: ScanLine,
      label: 'Scans',
      value: context.scans.total_scans,
      sub: `${context.scans.pending_suggestions} pending`,
      color: 'text-yellow-400',
    },
    {
      icon: Store,
      label: 'Shop',
      value: context.shop.is_published ? 'Published' : 'Draft',
      sub: `${context.shop.visible_items} visible items`,
      color: context.shop.is_published ? 'text-green-400' : 'text-gray-400',
    },
    {
      icon: BarChart3,
      label: 'Performance',
      value: context.analytics.clicks_last_30d,
      sub: `${context.analytics.conversions_last_30d} conversions`,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <h3 className="mb-4 text-sm font-semibold text-white">What I Know</h3>

      <div className="space-y-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="flex items-start gap-3">
              <div className={`mt-0.5 flex-shrink-0 ${stat.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">{stat.label}</span>
                  <span className={`text-sm font-semibold ${stat.color}`}>
                    {stat.value}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {context.shop.shop_url && (
        <div className="mt-4 rounded-md bg-gray-800/50 p-3">
          <p className="text-xs text-gray-400">Shop URL</p>
          <a
            href={`https://${context.shop.shop_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            {context.shop.shop_url}
          </a>
        </div>
      )}

      {context.profile.content_categories.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-400">Your Niche</p>
          <div className="flex flex-wrap gap-1">
            {context.profile.content_categories.map((category, index) => (
              <span
                key={index}
                className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
