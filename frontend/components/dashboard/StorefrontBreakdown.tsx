'use client';

import Link from 'next/link';
import { Store, ArrowRight } from 'lucide-react';

interface Storefront {
  platform: string;
  storefront_name: string | null;
  total_commission: number;
  total_clicks: number;
  total_orders: number;
}

interface StorefrontBreakdownProps {
  storefronts: Storefront[];
  totalEarnings: number;
  currency: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  amazon_de: '🇩🇪',
  amazon_uk: '🇬🇧',
  amazon_us: '🇺🇸',
  amazon_fr: '🇫🇷',
  amazon_es: '🇪🇸',
  amazon_it: '🇮🇹',
  awin: '🔗',
  ltk: '💄',
  shopmy: '🛍️',
  tradedoubler: '🔗',
};

export default function StorefrontBreakdown({ storefronts, totalEarnings, currency }: StorefrontBreakdownProps) {
  if (storefronts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Storefronts Connected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your first storefront to see earnings breakdown
          </p>
          <Link
            href="/dashboard/storefronts"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Connect Storefront
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Breakdown by Storefront
        </h3>
        <Link
          href="/dashboard/storefronts"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-4">
        {storefronts.map((storefront, index) => {
          const percentage = totalEarnings > 0 ? (storefront.total_commission / totalEarnings) * 100 : 0;
          const icon = PLATFORM_ICONS[storefront.platform] || '🔗';

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {storefront.storefront_name || storefront.platform}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {storefront.total_clicks.toLocaleString()} clicks •{' '}
                      {storefront.total_orders} orders
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {currency === 'EUR' && '€'}
                    {currency === 'GBP' && '£'}
                    {currency === 'USD' && '$'}
                    {storefront.total_commission.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
