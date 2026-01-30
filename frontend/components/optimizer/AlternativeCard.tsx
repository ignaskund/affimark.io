'use client';

import { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Check,
  Bookmark,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ConfidenceScore from './ConfidenceScore';
import ActionSteps from './ActionSteps';

interface ActionStep {
  step: number;
  instruction: string;
  url?: string;
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

interface AlternativeCardProps {
  alternative: Alternative;
  rank: number;
  onAction?: (action: 'saved' | 'applied' | 'dismissed', programId: string) => void;
  actionLoading?: boolean;
}

export default function AlternativeCard({ alternative: alt, rank, onAction, actionLoading }: AlternativeCardProps) {
  const [showSteps, setShowSteps] = useState(rank === 0);
  const isBest = rank === 0;

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isBest
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-border bg-card'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {isBest && (
            <span className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded mb-2">
              Best Alternative
            </span>
          )}
          <h5 className="font-medium text-foreground">
            {alt.brand_name} via {alt.network_display}
          </h5>
          <div className="flex items-center gap-2 mt-1">
            <ConfidenceScore score={alt.confidence_score} showLabel />
            {alt.match_type === 'exact_brand' && (
              <span className="text-xs text-emerald-400">Exact match</span>
            )}
            {alt.match_type === 'category' && (
              <span className="text-xs text-amber-400">Category match</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary">
            {alt.commission_rate_low}-{alt.commission_rate_high}%
          </p>
          <p className="text-xs text-muted-foreground">commission</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Cookie</p>
          <p className="text-foreground font-medium">{alt.cookie_duration} days</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Verified</p>
          <p className="text-foreground flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatVerifiedDate(alt.last_verified)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Regions</p>
          <p className="text-foreground text-xs">
            {alt.regions?.slice(0, 3).join(', ')}{alt.regions?.length > 3 ? ` +${alt.regions.length - 3}` : ''}
          </p>
        </div>
      </div>

      {/* Gain Highlight */}
      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
        <p className="text-sm text-emerald-400">
          <span className="font-semibold">
            +€{alt.potential_gain.monthly_low.toFixed(0)}-€{alt.potential_gain.monthly_high.toFixed(0)}
          </span>
          /month potential extra
          <span className="text-emerald-400/70 ml-1">
            (€{alt.potential_gain.yearly_low.toFixed(0)}-€{alt.potential_gain.yearly_high.toFixed(0)}/year)
          </span>
        </p>
      </div>

      {/* Application requirement */}
      {alt.requires_application && (
        <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
          <AlertTriangle className="w-3 h-3" />
          Requires application ({alt.approval_difficulty === 'easy' ? '1-2 days' : alt.approval_difficulty === 'hard' ? '1-2 weeks' : '3-7 days'})
        </div>
      )}

      {/* Action Steps Toggle */}
      <button
        onClick={() => setShowSteps(!showSteps)}
        className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <span className="font-medium">How to switch</span>
        {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showSteps && (
        <div className="mb-3">
          <ActionSteps steps={alt.action_steps} />
        </div>
      )}

      {/* Action Buttons */}
      {onAction && (
        <div className="flex gap-2">
          <button
            onClick={() => onAction('applied', alt.program_id)}
            disabled={actionLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            I've Applied
          </button>
          <button
            onClick={() => onAction('saved', alt.program_id)}
            disabled={actionLoading}
            className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAction('dismissed', alt.program_id)}
            disabled={actionLoading}
            className="px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function formatVerifiedDate(date: string): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}
