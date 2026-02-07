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
    <div className="rounded-xl shadow-lg p-8 text-white" style={{ background: 'linear-gradient(to bottom right, var(--color-brand), var(--color-brand-strong))' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">Total Earnings (Last 30 Days)</p>
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
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPositive ? 'bg-white/20' : 'bg-black/20'}`}>
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-white" />
          ) : (
            <TrendingDown className="h-5 w-5 text-white" />
          )}
          <span className="text-sm font-semibold text-white">
            {isPositive ? '+' : ''}
            {growthRate.toFixed(1)}% vs last month
          </span>
        </div>
      )}

      {!hasGrowth && (
        <p className="text-white/80 text-sm">
          Connect more storefronts to track growth
        </p>
      )}
    </div>
  );
}
