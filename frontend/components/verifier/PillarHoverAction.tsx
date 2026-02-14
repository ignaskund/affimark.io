'use client';

import { useState } from 'react';
import { TrendingUp, Shield, DollarSign, Search, ChevronDown, ChevronUp } from 'lucide-react';

// --- Types ---

type RankMode = 'balanced' | 'demand_first' | 'trust_first' | 'economics_first';

type PillarType = 'product_viability' | 'offer_merchant' | 'economics';

interface PillarHoverActionProps {
  pillar: PillarType;
  score: number;
  breakdown?: Record<string, number>;
  details?: Record<string, string>;
  maxScores?: Record<string, number>;
  currentMode: RankMode;
  onRerank: (mode: RankMode) => void;
  isLoading?: boolean;
}

// --- Pillar Config ---

const PILLAR_CONFIG: Record<PillarType, {
  label: string;
  icon: typeof TrendingUp;
  color: string;
  hoverAction: string;
  targetMode: RankMode;
}> = {
  product_viability: {
    label: 'Product Viability',
    icon: TrendingUp,
    color: 'text-blue-400',
    hoverAction: 'Find higher-demand alternatives',
    targetMode: 'demand_first',
  },
  offer_merchant: {
    label: 'Offer & Merchant',
    icon: Shield,
    color: 'text-purple-400',
    hoverAction: 'Find more trusted brands',
    targetMode: 'trust_first',
  },
  economics: {
    label: 'Economics',
    icon: DollarSign,
    color: 'text-emerald-400',
    hoverAction: 'Find higher-margin programs',
    targetMode: 'economics_first',
  },
};

// --- Score Color ---

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 45) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-green-500';
  if (score >= 45) return 'bg-amber-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

// --- Format Label ---

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// --- Main Component ---

export default function PillarHoverAction({
  pillar,
  score,
  breakdown,
  details,
  maxScores,
  currentMode,
  onRerank,
  isLoading = false,
}: PillarHoverActionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = PILLAR_CONFIG[pillar];
  const Icon = config.icon;
  const isActiveMode = currentMode === config.targetMode;

  const handleRerank = () => {
    if (!isActiveMode && !isLoading) {
      onRerank(config.targetMode);
    }
  };

  return (
    <div
      className="relative rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Card */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <span className="text-sm font-medium text-gray-300">{config.label}</span>
          </div>
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score}
          </span>
        </div>

        {/* Score Bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Breakdown Toggle */}
        {breakdown && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 mt-2 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isExpanded ? 'Hide details' : 'Show breakdown'}
          </button>
        )}

        {/* Expanded Breakdown */}
        {isExpanded && breakdown && (
          <div className="mt-3 space-y-2">
            {Object.entries(breakdown).map(([key, value]) => {
              const max = maxScores?.[key] || 25;
              const pct = (value / max) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">{formatLabel(key)}</span>
                    <span className="text-gray-500">{value}/{max}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getBarColor(pct)}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  {details?.[key] && (
                    <p className="text-[10px] text-gray-600 mt-0.5">{details[key]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover Action Overlay */}
      {isHovered && !isExpanded && (
        <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center transition-opacity">
          <button
            onClick={handleRerank}
            disabled={isActiveMode || isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isActiveMode
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">
              {isActiveMode ? 'Currently prioritizing' : config.hoverAction}
            </span>
          </button>
        </div>
      )}

      {/* Active Mode Indicator */}
      {isActiveMode && (
        <div className="absolute top-2 right-2">
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded">
            Active
          </span>
        </div>
      )}
    </div>
  );
}
