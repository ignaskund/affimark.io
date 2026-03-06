'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  RefreshCw,
  ArrowRight,
  HelpCircle,
  TrendingDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskBreakdown {
  merchantRisk: number;
  refundRisk: number;
  demandEvidence: number;
  programFriction: number;
}

interface AuditProduct {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  price: number | null;
  platform: string;
  productUrl: string | null;
  verdict: 'keep' | 'review' | 'replace' | 'unanalyzed';
  riskScore: number | null;
  riskBreakdown: RiskBreakdown | null;
  warnings: string[];
  confidence: number;
  commissionRate: number | null;
  cookieDuration: number | null;
}

interface PortfolioSummary {
  totalProducts: number;
  analyzed: number;
  highRisk: number;
  moderateRisk: number;
  stable: number;
  unanalyzed: number;
  revenueStabilityIndex: number;
  merchantConcentration: { topMerchant: string; percentage: number };
  avgMerchantStability: number;
  avgRefundRisk: number;
  avgCommissionDurability: number;
}

interface AuditResult {
  portfolioSummary: PortfolioSummary;
  products: AuditProduct[];
  topRisks: Array<{ title: string; riskScore: number; warnings: string[] }>;
}

// ─── Helper Components ───────────────────────────────────────────────────────

function RiskBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor =
    value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 w-48 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums w-12 text-right ${textColor}`}>
        {value}/100
      </span>
    </div>
  );
}

function StabilityGauge({ index }: { index: number }) {
  const label =
    index >= 70 ? 'Low Risk' : index >= 50 ? 'Moderate Risk' : 'High Risk';
  const labelColor =
    index >= 70 ? 'text-emerald-400' : index >= 50 ? 'text-amber-400' : 'text-red-400';
  const barColor =
    index >= 70 ? 'bg-emerald-500' : index >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-400">Revenue Stability Index</p>
          <p className={`text-5xl font-bold tabular-nums ${labelColor}`}>{index}</p>
          <p className={`text-sm font-medium ${labelColor}`}>/100 — {label}</p>
        </div>
        <BarChart3 className="w-12 h-12 text-gray-700" />
      </div>
      <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, index)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {index >= 70
          ? 'Your portfolio has strong, stable revenue sources.'
          : index >= 50
          ? 'Your portfolio has moderate risk exposure. Some products need attention.'
          : 'Your portfolio has significant fragile revenue. Take action on red-flagged products.'}
      </p>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: AuditProduct['verdict'] }) {
  const configs = {
    keep: { icon: CheckCircle2, color: 'text-emerald-400', dot: '🟢', bg: 'bg-emerald-500/10' },
    review: { icon: AlertCircle, color: 'text-amber-400', dot: '🟡', bg: 'bg-amber-500/10' },
    replace: { icon: TrendingDown, color: 'text-red-400', dot: '🔴', bg: 'bg-red-500/10' },
    unanalyzed: { icon: HelpCircle, color: 'text-gray-500', dot: '⚪', bg: 'bg-gray-800/50' },
  };
  const cfg = configs[verdict];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {verdict.toUpperCase()}
    </span>
  );
}

function CountCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${color}`}>
      <p className="text-3xl font-bold tabular-nums">{count}</p>
      <p className="text-xs font-medium mt-1 uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioAuditPage() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio/audit', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Audit failed (${res.status})`);
      }
      const data = await res.json();
      setAudit(data);
    } catch (e: any) {
      setError(e.message || 'Failed to run portfolio audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <div className="inline-flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <p className="text-lg">Analyzing your portfolio…</p>
        </div>
        <p className="text-sm text-gray-500">
          Scoring each product across 4 risk dimensions. This takes ~15 seconds.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-lg text-red-300">{error}</p>
        <button
          onClick={runAudit}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!audit) return null;

  const { portfolioSummary: s, products, topRisks } = audit;
  const needsAttention = s.highRisk + s.moderateRisk;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Stability Audit</h1>
          <p className="text-sm text-gray-400 mt-1">
            {s.totalProducts} products · {s.analyzed} analyzed
          </p>
        </div>
        <button
          onClick={runAudit}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Re-run
        </button>
      </div>

      {/* Stability Gauge */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
        <StabilityGauge index={s.revenueStabilityIndex} />
      </div>

      {/* Verdict Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CountCard
          label="Stable"
          count={s.stable}
          color="border-emerald-500/30 text-emerald-400"
        />
        <CountCard
          label="Review"
          count={s.moderateRisk}
          color="border-amber-500/30 text-amber-400"
        />
        <CountCard
          label="Replace"
          count={s.highRisk}
          color="border-red-500/30 text-red-400"
        />
        <CountCard
          label="Unanalyzed"
          count={s.unanalyzed}
          color="border-gray-700 text-gray-500"
        />
      </div>

      {/* Risk Breakdown Bars */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Portfolio Risk Breakdown
        </h2>
        <RiskBar label="Merchant Stability" value={s.avgMerchantStability} />
        <RiskBar label="Refund Risk" value={s.avgRefundRisk} />
        <RiskBar label="Commission Durability" value={Math.min(100, s.avgCommissionDurability)} />

        {/* Merchant concentration */}
        <div className="pt-2 border-t border-gray-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Merchant Concentration:</span>
            <span className="font-medium text-white">
              {s.merchantConcentration.percentage}% {s.merchantConcentration.topMerchant}
            </span>
            {s.merchantConcentration.percentage >= 60 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3" /> high
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Products Sorted by Risk
          {needsAttention > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 normal-case">
              {needsAttention} need action
            </span>
          )}
        </h2>

        {products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}

        {products.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center text-gray-500">
            <p>No products found. Complete onboarding to import your storefront products.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product: p }: { product: AuditProduct }) {
  const isActionable = p.verdict === 'review' || p.verdict === 'replace';
  const borderColor =
    p.verdict === 'replace'
      ? 'border-red-500/30'
      : p.verdict === 'review'
      ? 'border-amber-500/30'
      : p.verdict === 'keep'
      ? 'border-emerald-500/20'
      : 'border-gray-800';

  return (
    <div
      className={`rounded-xl border bg-gray-900/60 p-4 space-y-3 ${borderColor}`}
    >
      {/* Top row: title + verdict + risk score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <VerdictBadge verdict={p.verdict} />
            {p.riskScore != null && (
              <span className="text-xs text-gray-500">Risk: {p.riskScore}/100</span>
            )}
          </div>
          <p className="text-sm font-medium text-white mt-1 line-clamp-1">{p.title}</p>
        </div>
        {isActionable && p.productUrl && (
          <Link
            href={`/dashboard/product-finder?url=${encodeURIComponent(p.productUrl)}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-xs font-medium transition-colors whitespace-nowrap"
          >
            Find Alternative
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Risk bars (only for analyzed products) */}
      {p.riskBreakdown && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Merchant', value: p.riskBreakdown.merchantRisk },
            { label: 'Refund Risk', value: p.riskBreakdown.refundRisk },
            { label: 'Demand', value: p.riskBreakdown.demandEvidence },
            { label: 'Program', value: p.riskBreakdown.programFriction },
          ].map(({ label, value }) => {
            const color =
              value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
            const textColor =
              value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{label}</span>
                  <span className={`text-[10px] font-bold ${textColor}`}>{value}</span>
                </div>
                <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Warnings + meta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {p.warnings.slice(0, 2).map((w, i) => (
            <span
              key={i}
              className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded"
            >
              {w}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {p.commissionRate != null && (
            <span>{p.commissionRate.toFixed(1)}% commission</span>
          )}
          {p.cookieDuration != null && (
            <span>{p.cookieDuration}d cookie</span>
          )}
          {p.platform && <span className="capitalize">{p.platform}</span>}
        </div>
      </div>
    </div>
  );
}
