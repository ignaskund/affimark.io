'use client';

import { useState } from 'react';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Store,
  Package,
} from 'lucide-react';
import type { ReviewAnalysis, ThemeAnalysis } from '@/types/verifier';

interface ReviewThemesProps {
  analysis: ReviewAnalysis;
}

const THEME_LABELS: Record<string, string> = {
  quality: 'Quality',
  shipping: 'Shipping',
  support: 'Customer Support',
  value: 'Value for Money',
  durability: 'Durability',
  sizing: 'Sizing/Fit',
  ease_of_use: 'Ease of Use',
  packaging: 'Packaging',
  accuracy: 'As Described',
  performance: 'Performance',
};

function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    case 'negative':
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return 'text-emerald-400';
    case 'negative':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

function getDealbreakerColor(likelihood: string): string {
  switch (likelihood) {
    case 'high':
      return 'bg-red-500/20 text-red-400';
    case 'medium':
      return 'bg-amber-500/20 text-amber-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export default function ReviewThemes({ analysis }: ReviewThemesProps) {
  const [expanded, setExpanded] = useState(false);

  const hasThemes = analysis.themes.length > 0;
  const overallColor =
    analysis.overall_sentiment === 'positive'
      ? 'text-emerald-400'
      : analysis.overall_sentiment === 'negative'
      ? 'text-red-400'
      : 'text-amber-400';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Review Themes</h3>
            <p className="text-xs text-gray-500">
              {hasThemes
                ? `${analysis.themes.length} themes detected`
                : 'No theme data available'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium capitalize ${overallColor}`}>
            {analysis.overall_sentiment}
          </span>
          <span className="text-xs text-gray-500">({analysis.sentiment_score}/100)</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800">
          {/* Merchant vs Product Blame */}
          <div className="pt-4">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Issue Attribution
            </h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-gray-300">Merchant</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {analysis.merchant_vs_product_blame.merchant_issues_pct}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${analysis.merchant_vs_product_blame.merchant_issues_pct}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs text-gray-300">Product</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {analysis.merchant_vs_product_blame.product_issues_pct}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{
                      width: `${analysis.merchant_vs_product_blame.product_issues_pct}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {analysis.merchant_vs_product_blame.explanation}
            </p>
          </div>

          {/* Theme List */}
          {hasThemes && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Detected Themes
              </h4>
              <div className="space-y-2">
                {analysis.themes.slice(0, 6).map((theme, idx) => (
                  <ThemeRow key={idx} theme={theme} />
                ))}
              </div>
            </div>
          )}

          {/* Key Insights Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Refund Drivers */}
            <div>
              <h4 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">
                Refund Drivers
              </h4>
              <div className="space-y-1">
                {analysis.refund_drivers.map((driver, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-300">{driver}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Positive Angles */}
            <div>
              <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">
                Positive Angles
              </h4>
              <div className="space-y-1">
                {analysis.positive_angles.map((angle, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <ThumbsUp className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-300">{angle}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Objections */}
            <div>
              <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">
                Objections to Handle
              </h4>
              <div className="space-y-1">
                {analysis.objection_points.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <Minus className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-300">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeRow({ theme }: { theme: ThemeAnalysis }) {
  const label = THEME_LABELS[theme.theme] || theme.theme;

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/30">
      <div className="flex items-center gap-2">
        {getSentimentIcon(theme.sentiment)}
        <span className={`text-sm ${getSentimentColor(theme.sentiment)}`}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{theme.frequency.toFixed(0)}% mention</span>
        {theme.sentiment === 'negative' && theme.dealbreaker_likelihood !== 'low' && (
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded ${getDealbreakerColor(
              theme.dealbreaker_likelihood
            )}`}
          >
            {theme.dealbreaker_likelihood === 'high' ? 'Dealbreaker' : 'Risk'}
          </span>
        )}
      </div>
    </div>
  );
}
