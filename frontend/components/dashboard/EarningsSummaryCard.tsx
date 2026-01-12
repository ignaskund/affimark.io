'use client';

import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface EarningsSummaryProps {
  totalEarnings: number;
  growthRate: number | null;
  currency: string;
}

export default function EarningsSummaryCard({ totalEarnings, growthRate, currency }: EarningsSummaryProps) {
  const hasGrowth = growthRate !== null && growthRate !== undefined;
  const isPositive = growthRate && growthRate > 0;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 rounded-xl shadow-lg p-8 text-white">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-blue-100 text-sm font-medium mb-1">Total Earnings (Last 30 Days)</p>
          <h2 className="text-4xl font-bold tracking-tight">
            {currency === 'EUR' && '€'}
            {currency === 'GBP' && '£'}
            {currency === 'USD' && '$'}
            {totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
          <DollarSign className="h-8 w-8" />
        </div>
      </div>

      {hasGrowth && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-green-200" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-200" />
          )}
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-100' : 'text-red-100'}`}>
            {isPositive ? '+' : ''}
            {growthRate.toFixed(1)}% vs last month
          </span>
        </div>
      )}

      {!hasGrowth && (
        <p className="text-blue-100 text-sm">
          Connect more storefronts to track growth
        </p>
      )}
    </div>
  );
}
