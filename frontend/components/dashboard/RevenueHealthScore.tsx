'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RevenueHealthScoreProps {
  score: number;
  audit: any;
}

export default function RevenueHealthScore({ score, audit }: RevenueHealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50';
    if (score >= 50) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 50) return 'At Risk';
    return 'Critical';
  };

  return (
    <div className={`rounded-lg shadow-lg p-8 mb-8 ${getScoreBgColor(score)}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Revenue Health Score</h2>
          <div className="flex items-baseline gap-4">
            <span className={`text-6xl font-bold ${getScoreColor(score)}`}>
              {Math.round(score)}
            </span>
            <span className="text-2xl text-gray-400">/100</span>
          </div>
          <p className={`mt-2 text-sm font-medium ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </p>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white">
            {score >= 80 ? (
              <>
                <TrendingUp className="text-green-600" size={20} />
                <span className="text-sm font-medium text-green-600">All Clear</span>
              </>
            ) : score >= 50 ? (
              <>
                <Minus className="text-yellow-600" size={20} />
                <span className="text-sm font-medium text-yellow-600">Needs Attention</span>
              </>
            ) : (
              <>
                <TrendingDown className="text-red-600" size={20} />
                <span className="text-sm font-medium text-red-600">Action Required</span>
              </>
            )}
          </div>

          {audit && (
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between gap-8">
                <span>Critical Issues:</span>
                <span className="font-semibold text-red-600">{audit.critical_issues || 0}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>Warnings:</span>
                <span className="font-semibold text-yellow-600">{audit.warning_issues || 0}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>Links Audited:</span>
                <span className="font-semibold">{audit.links_audited || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
