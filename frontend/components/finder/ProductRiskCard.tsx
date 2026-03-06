'use client';

import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

export interface OriginalProductRisk {
  overall: number;
  merchantRisk: number;
  programFriction: number;
  demandEvidence: number;
  refundRisk: number;
  confidence: number;
  warnings: string[];
  requiresVerification: boolean;
}

interface ProductRiskCardProps {
  productTitle: string;
  productPrice?: number | null;
  productCurrency?: string;
  risk: OriginalProductRisk;
}

function RiskBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const color =
    value >= 70
      ? 'bg-emerald-500'
      : value >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  const textColor =
    value >= 70
      ? 'text-emerald-400'
      : value >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  const isLow = value < 50;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>
          {value}
          {isLow && <AlertTriangle className="inline w-3 h-3 ml-1" />}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export default function ProductRiskCard({
  productTitle,
  productPrice,
  productCurrency,
  risk,
}: ProductRiskCardProps) {
  const currencySymbol =
    productCurrency === 'EUR' ? '€' : productCurrency === 'GBP' ? '£' : '$';

  const verdictLabel =
    risk.overall >= 70
      ? 'STABLE'
      : risk.overall >= 50
      ? 'REVIEW'
      : 'REPLACE';

  const verdictColor =
    risk.overall >= 70
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : risk.overall >= 50
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-red-400 bg-red-500/10 border-red-500/30';

  const VerdictIcon =
    risk.overall >= 70
      ? CheckCircle2
      : AlertCircle;

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 space-y-4">
      {/* Header */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-1">
          This Product&apos;s Risk Profile
        </p>
        <p className="text-sm text-white font-medium line-clamp-2">
          {productTitle}
          {productPrice != null && (
            <span className="text-gray-400 ml-2">
              — {currencySymbol}{productPrice.toFixed(2)}
            </span>
          )}
        </p>
      </div>

      {/* Risk bars */}
      <div className="space-y-2.5">
        <RiskBar label="Merchant Stability" value={risk.merchantRisk} />
        <RiskBar label="Refund Risk" value={risk.refundRisk} />
        <RiskBar label="Commission Durability" value={risk.programFriction} />
        <RiskBar label="Demand Evidence" value={risk.demandEvidence} />
      </div>

      {/* Warnings */}
      {risk.warnings.length > 0 && (
        <div className="space-y-1">
          {risk.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400/90">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Verdict */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${verdictColor}`}>
        <VerdictIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Verdict: <span className="font-bold">{verdictLabel}</span>
          {risk.overall < 70 && ' — consider alternatives below'}
        </span>
      </div>
    </div>
  );
}
