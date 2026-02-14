'use client';

import { Database, Clock, CheckCircle2 } from 'lucide-react';
import type { ConfidenceLevel, EvidenceSummary } from '@/types/verifier';

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  evidence: EvidenceSummary;
}

const LEVEL_CONFIG: Record<ConfidenceLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  HIGH: {
    label: 'High Confidence',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  MED: {
    label: 'Medium Confidence',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  LOW: {
    label: 'Low Confidence',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
};

export default function ConfidenceIndicator({ level, evidence }: ConfidenceIndicatorProps) {
  const config = LEVEL_CONFIG[level];

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Data Confidence</span>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.color} ${config.bgColor} border ${config.borderColor}`}>
          {config.label}
        </div>
      </div>

      {/* Evidence Sources */}
      <div className="space-y-2">
        {evidence.sources.map((source, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-gray-400">
              <Database className="w-3 h-3" />
              {source.name}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span>{source.count} {source.count === 1 ? 'point' : 'points'}</span>
              {source.recency_days > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {source.recency_days}d ago
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between text-xs text-gray-500">
        <span>{evidence.total_data_points} total data points</span>
        <span>Cross-source agreement: {evidence.cross_source_agreement}</span>
      </div>
    </div>
  );
}
