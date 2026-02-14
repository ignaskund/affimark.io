'use client';

import { CheckCircle2, ArrowRight, TrendingUp, Shield, DollarSign } from 'lucide-react';
import type { RankedAlternative } from '@/types/verifier';

interface WinnerProps {
  winner: RankedAlternative;
  reason: string;
  onSelect: (id: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-green-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTagStyle(tag: string): string {
  const positivePatterns = ['Trusted', 'Strong', 'High', 'Verified', 'Long', 'Trending'];
  const isPositive = positivePatterns.some(p => tag.includes(p));

  if (isPositive) {
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

export default function WinnerRecommendationCard({ winner, reason, onSelect }: WinnerProps) {
  const commissionStr = winner.commission_rate_low === winner.commission_rate_high
    ? `${winner.commission_rate_low}%`
    : `${winner.commission_rate_low}-${winner.commission_rate_high}%`;

  return (
    <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
              Best Alternative
            </span>
            <h3 className="text-lg font-semibold text-white mt-0.5">
              {winner.brand}
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-400">{winner.rank_score}</span>
          <span className="text-xs text-gray-500 block">score</span>
        </div>
      </div>

      {/* Product Title */}
      <p className="text-sm text-gray-300 mb-4 line-clamp-1">
        {winner.title}
      </p>

      {/* Mini Score Bars (using flat properties) */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <ScoreBar
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Demand"
          score={winner.product_viability}
        />
        <ScoreBar
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Trust"
          score={winner.offer_merchant}
        />
        <ScoreBar
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Economics"
          score={winner.economics}
        />
      </div>

      {/* Commission & Cookie */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Commission: </span>
          <span className="text-white font-medium">{commissionStr}</span>
        </div>
        <div>
          <span className="text-gray-500">Cookie: </span>
          <span className="text-white font-medium">{winner.cookie_days}d</span>
        </div>
        <div>
          <span className="text-gray-500">via </span>
          <span className="text-gray-300">{winner.network}</span>
        </div>
      </div>

      {/* Tags */}
      {winner.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {winner.tags.map((tag, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 text-xs rounded-full border ${getTagStyle(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Reason */}
      <p className="text-xs text-gray-500 mb-4">
        {reason}
      </p>

      {/* CTA */}
      <button
        onClick={() => onSelect(winner.id)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
      >
        Use this product
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ScoreBar({
  icon,
  label,
  score,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-white font-medium ml-auto">{score}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getScoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
