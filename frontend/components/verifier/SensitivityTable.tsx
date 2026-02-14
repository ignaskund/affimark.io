'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  Zap,
} from 'lucide-react';
import type { EconomicsSensitivity, SensitivityScenario } from '@/types/verifier';

interface SensitivityTableProps {
  sensitivity: EconomicsSensitivity;
}

function getFragilityColor(fragility: string): string {
  switch (fragility) {
    case 'stable':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'moderate':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'high':
      return 'text-red-400';
    case 'medium':
      return 'text-amber-400';
    default:
      return 'text-gray-400';
  }
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatCurrency(n: number, currency: string): string {
  return `${currency}${n.toFixed(0)}`;
}

export default function SensitivityTable({ sensitivity }: SensitivityTableProps) {
  const [expanded, setExpanded] = useState(false);

  const { earning_band } = sensitivity;
  const rangeStr = `${earning_band.currency}${earning_band.min.toFixed(0)} - ${earning_band.currency}${earning_band.max.toFixed(0)}`;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Earnings Sensitivity</h3>
            <p className="text-xs text-gray-500">Monthly range: {rangeStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full border capitalize ${getFragilityColor(
              sensitivity.fragility
            )}`}
          >
            {sensitivity.fragility}
          </span>
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
          {/* Scenarios Table */}
          <div className="pt-4">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Scenario Comparison
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 text-gray-500 font-medium">Scenario</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conv.</th>
                    <th className="text-right py-2 text-gray-500 font-medium">AOV</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Refunds</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  <ScenarioRow
                    scenario={sensitivity.pessimistic_scenario}
                    icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    currency={earning_band.currency}
                  />
                  <ScenarioRow
                    scenario={sensitivity.base_scenario}
                    icon={<Minus className="w-3.5 h-3.5 text-gray-400" />}
                    currency={earning_band.currency}
                    highlight
                  />
                  <ScenarioRow
                    scenario={sensitivity.optimistic_scenario}
                    icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                    currency={earning_band.currency}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Driver */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
            <Zap className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-xs text-gray-400">Key Driver: </span>
              <span className="text-xs text-white font-medium">{sensitivity.key_driver}</span>
            </div>
          </div>

          {/* Sensitivity Factors */}
          {sensitivity.sensitivity_factors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Sensitivity Factors
              </h4>
              <div className="space-y-2">
                {sensitivity.sensitivity_factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/30"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 mt-0.5 ${getImpactColor(factor.impact)}`}
                      />
                      <div>
                        <span className="text-sm text-gray-300">{factor.factor}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{factor.explanation}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium capitalize ${getImpactColor(factor.impact)}`}
                    >
                      {factor.impact}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakeven Analysis */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700">
            <Target className="w-4 h-4 text-blue-400" />
            <div className="flex-1">
              <span className="text-xs text-gray-400">Breakeven for {earning_band.currency}100/mo: </span>
              <span className="text-xs text-white font-medium">
                {sensitivity.breakeven_analysis.clicks_needed_for_100.toLocaleString()} clicks
              </span>
            </div>
            <span
              className={`text-xs ${
                sensitivity.breakeven_analysis.realistic ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {sensitivity.breakeven_analysis.realistic ? 'Achievable' : 'Challenging'}
            </span>
          </div>

          {/* Fragility Explanation */}
          <p className="text-xs text-gray-500 italic">{sensitivity.fragility_explanation}</p>
        </div>
      )}
    </div>
  );
}

function ScenarioRow({
  scenario,
  icon,
  currency,
  highlight = false,
}: {
  scenario: SensitivityScenario;
  icon: React.ReactNode;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-gray-800 ${highlight ? 'bg-gray-800/30' : ''}`}>
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className={`${highlight ? 'text-white font-medium' : 'text-gray-300'}`}>
            {scenario.label}
          </span>
        </div>
      </td>
      <td className="py-2.5 text-right text-gray-400">{formatPercent(scenario.conversion_rate)}</td>
      <td className="py-2.5 text-right text-gray-400">{formatCurrency(scenario.aov, currency)}</td>
      <td className="py-2.5 text-right text-gray-400">{formatPercent(scenario.refund_rate)}</td>
      <td className="py-2.5 text-right">
        <span className={`font-medium ${highlight ? 'text-white' : 'text-gray-300'}`}>
          {formatCurrency(scenario.monthly_earnings.net, currency)}
        </span>
      </td>
    </tr>
  );
}
