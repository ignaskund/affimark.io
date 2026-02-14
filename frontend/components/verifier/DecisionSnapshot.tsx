'use client';

import { TrendingUp, AlertTriangle, Info, ThumbsUp, AlertCircle } from 'lucide-react';
import type { DecisionSnapshot as DecisionSnapshotType } from '@/types/verifier';
import VerdictBadge from './VerdictBadge';
import ConfidenceIndicator from './ConfidenceIndicator';

interface DecisionSnapshotProps {
  snapshot: DecisionSnapshotType;
  onApprove: () => void;
}

export default function DecisionSnapshot({
  snapshot,
  onApprove,
}: DecisionSnapshotProps) {
  const { product, scores, confidence, verdict, insights, economics } = snapshot;

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white truncate">
            {product.title || 'Product Analysis'}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            {product.brand && <span>{product.brand}</span>}
            {product.brand && product.merchant && <span>·</span>}
            <span>{product.merchant}</span>
            {product.price.amount && (
              <>
                <span>·</span>
                <span className="text-white font-medium">
                  {product.price.currency} {product.price.amount.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>
        <VerdictBadge status={verdict.status} size="lg" />
      </div>

      {/* Hard Stop Banner */}
      {verdict.hard_stop_flags.length > 0 && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Critical issues detected</p>
              <ul className="mt-1 space-y-0.5">
                {verdict.hard_stop_flags.map((flag, i) => (
                  <li key={i} className="text-xs text-red-300/80">
                    {formatFlag(flag)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Band + Confidence */}
      <div className="grid grid-cols-2 gap-4">
        {/* Earnings Band */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-gray-300">Earning Potential</span>
          </div>
          <div className="text-xl font-bold text-white">
            {economics.earning_band.currency} {economics.earning_band.low.toFixed(0)} – {economics.earning_band.high.toFixed(0)}
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <p>Commission: {economics.commission.rate_pct_low}-{economics.commission.rate_pct_high}% ({economics.commission.network})</p>
            <p>Cookie: {economics.cookie_days} days</p>
            <p>Est. conversion: {economics.assumptions.conversion_rate}%</p>
          </div>
        </div>

        {/* Confidence */}
        <ConfidenceIndicator
          level={confidence.level as any}
          evidence={confidence.evidence}
        />
      </div>

      {/* Pros & Risks */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pros */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-gray-300">Top Strengths</span>
          </div>
          <ul className="space-y-2">
            {insights.top_pros.map((pro, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">+</span>
                {pro}
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-gray-300">Top Risks</span>
          </div>
          <ul className="space-y-2">
            {insights.top_risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">!</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Assumptions */}
      {insights.key_assumptions.length > 0 && (
        <div className="p-3 rounded-lg border border-gray-800/50 bg-gray-900/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Key Assumptions</span>
          </div>
          <ul className="space-y-1">
            {insights.key_assumptions.map((assumption, i) => (
              <li key={i} className="text-xs text-gray-500">• {assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onApprove}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
        >
          Use Original Product
        </button>
        <span className="text-xs text-gray-500">
          or select an alternative below
        </span>
      </div>
    </div>
  );
}

function formatFlag(flag: string): string {
  const labels: Record<string, string> = {
    MERCHANT_RISK_EXTREME: 'Merchant has very low trust rating',
    COMPLIANCE_RISK_HIGH: 'Product page contains problematic claims',
    EVIDENCE_TOO_THIN: 'Not enough data for reliable analysis',
    PRODUCT_PAGE_NOT_FOUND: 'Could not identify product on this page',
    OUT_OF_STOCK: 'Product is currently out of stock',
  };
  return labels[flag] || flag.replace(/_/g, ' ').toLowerCase();
}
