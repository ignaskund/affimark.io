'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';
import ConfidenceScore from './ConfidenceScore';
import AlternativeCard from './AlternativeCard';
import InsightBadge from './InsightBadge';

interface ActionStep {
  step: number;
  instruction: string;
  url?: string;
}

interface Insight {
  type: 'opportunity' | 'action' | 'tip' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

interface Alternative {
  program_id: string;
  network: string;
  network_display: string;
  brand_name: string;
  match_type: string;
  commission_rate_low: number;
  commission_rate_high: number;
  commission_type: string;
  cookie_duration: number;
  requires_application: boolean;
  approval_difficulty: string;
  confidence_score: number;
  last_verified: string;
  regions: string[];
  potential_gain: {
    monthly_low: number;
    monthly_high: number;
    yearly_low: number;
    yearly_high: number;
  };
  action_steps: ActionStep[];
  signup_url?: string;
}

export interface ProductResult {
  productId: string;
  productName: string;
  brand: { name: string; detected_from: string; confidence: number };
  category: { name: string; detected_from: string };
  current: {
    url: string;
    platform: string;
    platform_name: string;
    commission_rate: number;
    commission_type: string;
    cookie_duration: number;
    cookie_unit: 'hours' | 'days';
    has_tracking: boolean;
  };
  alternatives: Alternative[];
  insights: Insight[];
  error?: string;
}

interface ProductResultCardProps {
  result: ProductResult;
  defaultExpanded?: boolean;
  onAction?: (action: 'saved' | 'applied' | 'dismissed', programId: string, analysisId: string) => void;
  actionLoading?: boolean;
}

export default function ProductResultCard({
  result,
  defaultExpanded = false,
  onAction,
  actionLoading,
}: ProductResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);

  const hasAlternatives = result.alternatives.length > 0;
  const bestAlt = result.alternatives[0];
  const additionalAlts = result.alternatives.slice(1);
  const hasTracking = result.current.has_tracking;
  const highPriorityInsights = result.insights.filter(i => i.priority === 'high');

  // Determine card status for header icon
  const getStatusIcon = () => {
    if (!hasTracking) {
      return (
        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
      );
    }
    if (hasAlternatives) {
      return (
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
      );
    }
    if (highPriorityInsights.length > 0) {
      return (
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-amber-400" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
        <Check className="w-5 h-5 text-emerald-400" />
      </div>
    );
  };

  const cookieDisplay = result.current.cookie_unit === 'hours'
    ? `${result.current.cookie_duration}h`
    : `${result.current.cookie_duration}d`;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          {getStatusIcon()}
          <div>
            <h4 className="font-medium text-foreground">
              {result.productName || result.brand.name}
            </h4>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {result.brand.name && (
                <span className="text-muted-foreground">{result.brand.name}</span>
              )}
              {result.category.name && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{result.category.name}</span>
                </>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {result.current.platform_name} {result.current.commission_rate}%
              </span>
              {hasAlternatives && (
                <>
                  <span className="text-emerald-400">→</span>
                  <span className="text-emerald-400 font-medium">
                    {bestAlt.commission_rate_low}-{bestAlt.commission_rate_high}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!hasTracking ? (
            <span className="text-sm font-medium text-red-400">No tracking</span>
          ) : hasAlternatives ? (
            <span className="text-sm font-medium text-emerald-400">
              +€{bestAlt.potential_gain.monthly_high.toFixed(0)}/mo
            </span>
          ) : highPriorityInsights.length > 0 ? (
            <span className="text-sm text-amber-400">
              {result.insights.length} tip{result.insights.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-sm text-emerald-400">Optimal</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Current State Box */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Current
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground font-medium">
                  {result.current.platform_name}
                </span>
                <span className="text-muted-foreground">
                  Commission: {result.current.commission_rate}%
                </span>
                <span className="text-muted-foreground">
                  Cookie: {cookieDisplay}
                </span>
              </div>
              {hasTracking && !hasAlternatives && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Competitive program
                </span>
              )}
            </div>
            {!hasTracking && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                No affiliate tracking detected. You are sending traffic but not earning commissions.
              </div>
            )}
          </div>

          {/* Best Alternative */}
          {hasAlternatives && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Better-paying alternatives ({result.alternatives.length})
              </p>
              <AlternativeCard
                alternative={bestAlt}
                rank={0}
                onAction={onAction ? (action, programId) => onAction(action, programId, result.productId) : undefined}
                actionLoading={actionLoading}
              />
            </div>
          )}

          {/* Additional Alternatives (collapsed) */}
          {additionalAlts.length > 0 && (
            <>
              {!showAllAlternatives ? (
                <button
                  onClick={() => setShowAllAlternatives(true)}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
                >
                  Show {additionalAlts.length} more alternative{additionalAlts.length !== 1 ? 's' : ''}
                  <ChevronDown className="w-4 h-4" />
                </button>
              ) : (
                <div className="space-y-3">
                  {additionalAlts.map((alt, idx) => (
                    <AlternativeCard
                      key={alt.program_id}
                      alternative={alt}
                      rank={idx + 1}
                      onAction={onAction ? (action, programId) => onAction(action, programId, result.productId) : undefined}
                      actionLoading={actionLoading}
                    />
                  ))}
                  <button
                    onClick={() => setShowAllAlternatives(false)}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
                  >
                    Show less
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Insights */}
          {result.insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Insights
              </p>
              {result.insights.map((insight, idx) => (
                <InsightBadge key={idx} insight={insight} />
              ))}
            </div>
          )}

          {/* No alternatives AND no insights: optimal */}
          {!hasAlternatives && result.insights.length === 0 && hasTracking && (
            <div className="text-center py-4">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="font-medium text-foreground">Optimal program</p>
              <p className="text-sm text-muted-foreground mt-1">
                No better-paying alternatives found for this product
              </p>
            </div>
          )}

          {/* Error state */}
          {result.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
