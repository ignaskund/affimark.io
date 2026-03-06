'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';

interface PortfolioSummary {
  revenueStabilityIndex: number;
  highRisk: number;
  moderateRisk: number;
  stable: number;
  totalProducts: number;
  analyzed: number;
  avgMerchantStability: number;
  avgRefundRisk: number;
  avgCommissionDurability: number;
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor =
    value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${textColor}`}>
        {value}
      </span>
    </div>
  );
}

export default function PortfolioHealthCard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/portfolio/audit', {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setSummary(data.portfolioSummary || null);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const needsAttention = summary ? summary.highRisk + summary.moderateRisk : 0;
  const indexColor = summary
    ? summary.revenueStabilityIndex >= 70
      ? 'text-emerald-400'
      : summary.revenueStabilityIndex >= 50
      ? 'text-amber-400'
      : 'text-red-400'
    : 'text-gray-500';

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Portfolio Health</h3>
            <p className="text-xs text-muted-foreground">Revenue Stability Audit</p>
          </div>
        </div>
        <Link
          href="/dashboard/portfolio-audit"
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          Full audit
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Analyzing portfolio…
        </div>
      ) : error || !summary ? (
        <div className="text-sm text-muted-foreground py-2">
          <Link href="/dashboard/portfolio-audit" className="text-emerald-400 hover:underline">
            Run your first portfolio audit →
          </Link>
        </div>
      ) : (
        <>
          {/* Index + attention count */}
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-3xl font-bold tabular-nums ${indexColor}`}>
                {summary.revenueStabilityIndex}
              </span>
              <span className="text-sm text-muted-foreground ml-1">/100</span>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue Stability Index</p>
            </div>
            {needsAttention > 0 && (
              <Link
                href="/dashboard/portfolio-audit"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {needsAttention} need attention
              </Link>
            )}
          </div>

          {/* Mini risk bars */}
          <div className="space-y-2 pt-1">
            <MiniBar label="Merchant Stability" value={summary.avgMerchantStability} />
            <MiniBar label="Refund Risk" value={summary.avgRefundRisk} />
            <MiniBar
              label="Commission Durability"
              value={Math.min(100, summary.avgCommissionDurability)}
            />
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
            <span className="text-emerald-400 font-medium">{summary.stable} stable</span>
            {summary.moderateRisk > 0 && (
              <span className="text-amber-400 font-medium">{summary.moderateRisk} review</span>
            )}
            {summary.highRisk > 0 && (
              <span className="text-red-400 font-medium">{summary.highRisk} replace</span>
            )}
            <span className="ml-auto">{summary.totalProducts} products total</span>
          </div>
        </>
      )}
    </div>
  );
}
