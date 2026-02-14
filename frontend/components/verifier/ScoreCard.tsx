'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScoreCardProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  breakdown?: {
    [key: string]: number;
  };
  details?: Record<string, string>;
  maxScores?: Record<string, number>;
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 45) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getBarColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-green-500';
  if (pct >= 45) return 'bg-amber-500';
  if (pct >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export default function ScoreCard({
  label,
  score,
  icon,
  breakdown,
  details,
  maxScores,
}: ScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-300">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
      </div>

      {/* Score Bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(score, 100)}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Expand/Collapse */}
      {breakdown && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 mt-2 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide details' : 'Show breakdown'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2.5">
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
                        className={`h-full rounded-full ${getBarColor(value, max)}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    {details?.[key] && (
                      <p className="text-[11px] text-gray-600 mt-0.5">{details[key]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
