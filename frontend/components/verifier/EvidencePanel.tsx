'use client';

import { useState } from 'react';
import {
  Database,
  FileSearch,
  Star,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type { EnhancedEvidenceSummary, EnhancedEvidenceSource } from '@/types/verifier';

interface EvidencePanelProps {
  evidence: EnhancedEvidenceSummary;
}

const SOURCE_ICONS: Record<string, typeof Database> = {
  product_page: FileSearch,
  trustpilot: Star,
  reviews_io: Star,
  google_reviews: Star,
  affiliate_db: Database,
  policy_page: ShoppingBag,
  brand_site: ShoppingBag,
};

const SOURCE_LABELS: Record<string, string> = {
  product_page: 'Product Page',
  trustpilot: 'Trustpilot',
  reviews_io: 'Reviews.io',
  google_reviews: 'Google Reviews',
  affiliate_db: 'Affiliate Database',
  policy_page: 'Policy Page',
  brand_site: 'Brand Site',
};

function getQualityColor(quality: string): string {
  switch (quality) {
    case 'high':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    default:
      return 'text-red-400';
  }
}

function getAgreementColor(agreement: string): string {
  switch (agreement) {
    case 'HIGH':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'MED':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-blue-400" />
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Evidence Summary</h3>
            <p className="text-xs text-gray-500">
              {evidence.source_count} sources, {evidence.total_data_points} data points
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cross-Source Agreement Badge */}
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getAgreementColor(
              evidence.cross_source_agreement
            )}`}
          >
            {evidence.cross_source_agreement} Agreement
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
          {/* Sources List */}
          <div className="pt-4">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Data Sources
            </h4>
            <div className="space-y-2">
              {evidence.sources.map((source, idx) => (
                <SourceRow key={idx} source={source} />
              ))}
            </div>
          </div>

          {/* Confidence Explanation */}
          {evidence.confidence_explanation.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Why {evidence.confidence} Confidence?
              </h4>
              <div className="space-y-1.5">
                {evidence.confidence_explanation.map((exp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-300">{exp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-2 gap-4">
            {/* Strengths */}
            {evidence.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">
                  Strengths
                </h4>
                <div className="space-y-1.5">
                  {evidence.strengths.map((strength, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-gray-300">{strength}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gaps */}
            {evidence.gaps.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">
                  Data Gaps
                </h4>
                <div className="space-y-1.5">
                  {evidence.gaps.map((gap, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-gray-300">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceRow({ source }: { source: EnhancedEvidenceSource }) {
  const Icon = SOURCE_ICONS[source.source] || Database;
  const label = SOURCE_LABELS[source.source] || source.source;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">
          {source.data_points} {source.data_points === 1 ? 'point' : 'points'}
        </span>
        {source.recency_days !== null && (
          <span className="text-xs text-gray-600">
            {source.recency_days === 0 ? 'Live' : `${source.recency_days}d ago`}
          </span>
        )}
        <span
          className={`text-xs font-medium capitalize ${getQualityColor(source.quality)}`}
        >
          {source.quality}
        </span>
      </div>
    </div>
  );
}
