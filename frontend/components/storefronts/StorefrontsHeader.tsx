'use client';

import { Store, TrendingUp } from 'lucide-react';

interface StorefrontsHeaderProps {
  accountCount: number;
}

export default function StorefrontsHeader({ accountCount }: StorefrontsHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Store className="h-8 w-8 text-blue-600" />
            Connected Storefronts
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {accountCount === 0
              ? 'Connect your affiliate platforms to start tracking earnings'
              : `Managing ${accountCount} connected ${
                  accountCount === 1 ? 'storefront' : 'storefronts'
                }`}
          </p>
        </div>

        {accountCount > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span>Multi-platform tracking active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
