'use client';

import { useState } from 'react';
import {
  TrendingUp,
  ExternalLink,
  Check,
  Star,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Zap,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

interface Alternative {
  id: string;
  network: string;
  brand_name: string;
  commission_rate_low: number;
  commission_rate_high: number;
  cookie_duration: number;
  requires_application: boolean;
  confidence_score: number;
  last_verified: string;
  potential_gain_low: number;
  potential_gain_high: number;
  signup_url?: string;
}

interface Insight {
  type: 'tip' | 'opportunity' | 'warning' | 'action';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
}

interface AnalysisResult {
  productId: string;
  productName: string;
  brand: { brand: string; product?: string; category?: string };
  current_link: {
    url: string;
    platform: string;
    platform_name: string;
    commission_rate: number | null;
  };
  alternatives: Alternative[];
  insights?: Insight[];
}

interface AnalysisResultsProps {
  results: AnalysisResult[];
  onClear: () => void;
}

export default function AnalysisResults({ results, onClear }: AnalysisResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    results.length === 1 ? results[0].productId : null
  );

  const totalPotentialGain = results.reduce((sum, r) => {
    const best = r.alternatives[0];
    return sum + (best?.potential_gain_high || 0);
  }, 0);

  const productsWithAlternatives = results.filter(r => r.alternatives.length > 0);
  const totalInsights = results.reduce((sum, r) => sum + (r.insights?.length || 0), 0);

  const renderConfidence = (score: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= score ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
    );
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'tip': return <Lightbulb className="w-4 h-4 text-amber-400" />;
      case 'action': return <Zap className="w-4 h-4 text-blue-400" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Lightbulb className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getInsightBg = (type: string, priority: string) => {
    if (priority === 'high') {
      switch (type) {
        case 'opportunity': return 'bg-emerald-500/10 border-emerald-500/30';
        case 'action': return 'bg-blue-500/10 border-blue-500/30';
        case 'warning': return 'bg-red-500/10 border-red-500/30';
        default: return 'bg-amber-500/10 border-amber-500/30';
      }
    }
    return 'bg-muted/50 border-border';
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Analysis Complete</h3>
          <p className="text-sm text-muted-foreground">
            {results.length} product{results.length !== 1 ? 's' : ''} analyzed • {totalInsights} insights
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear results
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Potential Gain */}
        <div className={`p-4 rounded-xl border ${totalPotentialGain > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/50 border-border'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalPotentialGain > 0 ? 'bg-emerald-500/20' : 'bg-muted'}`}>
              <TrendingUp className={`w-5 h-5 ${totalPotentialGain > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${totalPotentialGain > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {totalPotentialGain > 0 ? `+€${totalPotentialGain.toFixed(0)}/mo` : 'No uplift'}
              </p>
              <p className="text-xs text-muted-foreground">
                {productsWithAlternatives.length > 0
                  ? `${productsWithAlternatives.length} product${productsWithAlternatives.length !== 1 ? 's' : ''} can earn more`
                  : 'Current rates are competitive'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Insights Count */}
        <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-400">{totalInsights}</p>
              <p className="text-xs text-muted-foreground">
                Actionable insights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result) => {
          const isExpanded = expandedId === result.productId;
          const bestAlt = result.alternatives[0];
          const hasAlternatives = result.alternatives.length > 0;
          const highPriorityInsights = result.insights?.filter(i => i.priority === 'high') || [];

          return (
            <div
              key={result.productId}
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              {/* Product Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : result.productId)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${hasAlternatives ? 'bg-emerald-500/10' : highPriorityInsights.length > 0 ? 'bg-amber-500/10' : 'bg-muted'}
                  `}>
                    {hasAlternatives ? (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    ) : highPriorityInsights.length > 0 ? (
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Check className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      {result.productName || result.brand.brand}
                    </h4>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-muted-foreground">
                        {result.current_link.platform_name}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {result.current_link.commission_rate}% {result.brand.category && `(${result.brand.category})`}
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
                <div className="flex items-center gap-3">
                  {hasAlternatives ? (
                    <span className="text-sm font-medium text-emerald-400">
                      +€{bestAlt.potential_gain_high.toFixed(0)}/mo
                    </span>
                  ) : (
                    <span className="text-sm text-amber-400">
                      {result.insights?.length || 0} tips
                    </span>
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
                  {/* Alternatives Section */}
                  {hasAlternatives && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">
                        Better-paying alternatives ({result.alternatives.length})
                      </p>

                      {result.alternatives.map((alt, index) => (
                        <div
                          key={alt.id}
                          className={`p-4 rounded-lg border ${
                            index === 0
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              {index === 0 && (
                                <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mb-2">
                                  Best Option
                                </span>
                              )}
                              <h5 className="font-medium text-foreground">
                                {alt.brand_name} via {alt.network}
                              </h5>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">
                                {alt.commission_rate_low}-{alt.commission_rate_high}%
                              </p>
                              <p className="text-xs text-muted-foreground">commission</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Confidence</p>
                              {renderConfidence(alt.confidence_score)}
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Cookie</p>
                              <p className="text-foreground">{alt.cookie_duration} days</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Verified</p>
                              <p className="text-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alt.last_verified).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
                            <p className="text-sm text-emerald-400">
                              <span className="font-semibold">
                                +€{alt.potential_gain_low.toFixed(0)} - €{alt.potential_gain_high.toFixed(0)}
                              </span>
                              /month potential extra earnings
                            </p>
                          </div>

                          {alt.requires_application && (
                            <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
                              <AlertTriangle className="w-3 h-3" />
                              Requires application approval
                            </div>
                          )}

                          <a
                            href={alt.signup_url || `https://${alt.network.toLowerCase()}.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Apply on {alt.network}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Insights Section - ALWAYS SHOW */}
                  {result.insights && result.insights.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        Insights & Recommendations
                      </p>

                      <div className="space-y-2">
                        {result.insights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${getInsightBg(insight.type, insight.priority)}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getInsightIcon(insight.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h6 className="font-medium text-foreground text-sm">
                                  {insight.title}
                                </h6>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {insight.description}
                                </p>
                                {insight.actionUrl && (
                                  <a
                                    href={insight.actionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                  >
                                    Learn more <ArrowRight className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              {insight.priority === 'high' && (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
                                  High Priority
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* If no alternatives AND no insights, show a helpful message */}
                  {!hasAlternatives && (!result.insights || result.insights.length === 0) && (
                    <div className="text-center py-4">
                      <Check className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                      <p className="font-medium text-foreground">You're using an optimal program</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        No better-paying alternatives found for this product
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
