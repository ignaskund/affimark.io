'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  Percent,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Calendar,
  TestTube,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package,
  Building2,
} from 'lucide-react';
import MatchScore from './MatchScore';
import type { AlternativeProduct } from '@/types/finder';

import type { PriorityKpi } from '@/types/finder';

const CONFIDENCE_BADGE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  high: { label: 'High', className: 'text-emerald-400', Icon: CheckCircle2 },
  medium: { label: 'Med', className: 'text-amber-400', Icon: AlertCircle },
  low: { label: 'Low', className: 'text-red-400', Icon: HelpCircle },
};

function KpiRow({ kpi, accentColor }: { kpi: PriorityKpi; accentColor: 'emerald' | 'orange' }) {
  const scoreColor =
    kpi.score >= 75
      ? 'text-emerald-400'
      : kpi.score >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  const conf = kpi.confidence ? CONFIDENCE_BADGE[kpi.confidence] : null;

  return (
    <div className="rounded-md border border-gray-700/60 bg-gray-900/30 p-2">
      {/* Header: rank + label + score */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] text-gray-300 font-medium truncate">
          <span className="text-gray-500 mr-1">{kpi.rank}.</span>
          {kpi.label}
        </span>
        <span className={`text-[11px] font-bold tabular-nums ${scoreColor}`}>
          {kpi.score}
        </span>
      </div>

      {/* Score bar */}
      <div className="mt-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            kpi.score >= 75
              ? 'bg-emerald-500'
              : kpi.score >= 50
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, kpi.score)}%` }}
        />
      </div>

      {/* Evidence row: reason + confidence */}
      <div className="mt-1.5 flex items-start justify-between gap-1">
        <p className="text-[10px] text-gray-500 leading-tight flex-1">
          {kpi.isProxy && <span className="text-amber-500/70 mr-0.5">~</span>}
          {kpi.reason}
        </p>
        {conf && (
          <span className={`flex items-center gap-0.5 text-[9px] font-medium ${conf.className} flex-shrink-0`}>
            <conf.Icon className="w-2.5 h-2.5" />
            {conf.label}
          </span>
        )}
      </div>

      {/* Evidence source + timestamp */}
      {(kpi.evidenceLabel || kpi.checkedAt) && (
        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-gray-600">
          {kpi.evidenceLabel && (
            <span className="truncate">{kpi.evidenceLabel}</span>
          )}
          {kpi.checkedAt && (
            <span className="flex-shrink-0">&middot; {kpi.checkedAt}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  product: AlternativeProduct;
  onSave: (listType: 'saved' | 'try_first' | 'content_calendar') => void;
  onSkip: () => void;
  onAskAbout: (question: string) => void;
  isActive?: boolean;
}

export default function ProductCard({
  product,
  onSave,
  onSkip,
  onAskAbout,
  isActive = true,
}: ProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const handleLongPress = () => {
    setShowQuickActions(true);
  };

  return (
    <motion.div
      layout
      className={`relative w-full max-w-md mx-auto bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl ${
        isActive ? '' : 'opacity-50 pointer-events-none'
      }`}
    >
      {/* Product Image */}
      <div className="relative h-48 bg-gray-800 overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {/* Match score overlay */}
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm">
          <MatchScore score={product.matchScore} size="sm" showLabel={false} />
        </div>

        {/* Brand badge */}
        {product.brand && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-xs text-gray-300">
            {product.brand}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Product name */}
        <h3 className="text-lg font-semibold text-white line-clamp-2">
          {product.name}
        </h3>

        {/* Collapsed: show top 2 priority matches as chips */}
        {!isExpanded && (() => {
          const allKpis = [
            ...(product.productPriorityKpis || []),
            ...(product.brandPriorityKpis || []),
          ];
          const topChips = allKpis
            .filter(k => k.score >= 65)
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 2);

          if (topChips.length > 0) {
            return (
              <div className="flex flex-wrap gap-1.5">
                {topChips.map(kpi => (
                  <span key={kpi.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
                    <span className="font-bold">#{kpi.rank}</span>
                    {kpi.label}
                    <span className="font-bold">{kpi.score}</span>
                  </span>
                ))}
              </div>
            );
          }

          return product.matchReasons.length > 0 ? (
            <p className="text-sm text-gray-400 line-clamp-2">{product.matchReasons[0]}</p>
          ) : null;
        })()}

        {/* Price and rating row */}
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold text-white">
            {product.currency === 'EUR' ? '€' : product.currency === 'GBP' ? '£' : '$'}
            {product.price?.toFixed(2)}
          </div>
          {product.rating && (
            <div className="flex items-center gap-1 text-sm text-amber-400">
              <Star className="w-4 h-4 fill-current" />
              {product.rating.toFixed(1)}
              {product.reviewCount && (
                <span className="text-gray-500">({product.reviewCount.toLocaleString()})</span>
              )}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" /> Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" /> Show details
            </>
          )}
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-2"
            >
              {/* === PERSONALIZATION NARRATIVE === */}
              {/* Show top priorities this product satisfies — explicit "why for you" */}
              {(() => {
                const allKpis = [
                  ...(product.productPriorityKpis || []),
                  ...(product.brandPriorityKpis || []),
                ];
                const topMatches = allKpis
                  .filter(k => k.score >= 65)
                  .sort((a, b) => a.rank - b.rank)
                  .slice(0, 4);

                if (topMatches.length === 0) return null;

                return (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-900/20 to-gray-900/40 border border-emerald-700/30">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2.5">
                      Why this is right for you
                    </h4>
                    <div className="space-y-1.5">
                      {topMatches.map((kpi) => (
                        <div key={kpi.id} className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-emerald-400">{kpi.rank}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white font-medium">{kpi.label}</span>
                            <span className="text-xs text-gray-400"> — </span>
                            <span className="text-xs text-gray-400">{kpi.reason}</span>
                          </div>
                          <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums ${
                            kpi.score >= 75 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>{kpi.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Why it matches (fallback if no KPIs) */}
              {(!product.productPriorityKpis?.length && !product.brandPriorityKpis?.length) &&
                product.matchReasons.length > 0 && (
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Why This Matches You
                  </h4>
                  <ul className="space-y-1.5">
                    {product.matchReasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Two-column KPI split: Product (left) / Brand (right) */}
              {(product.productPriorityKpis?.length || product.brandPriorityKpis?.length) && (
                <div className="grid grid-cols-2 gap-3">
                  {/* LEFT: Product KPIs */}
                  <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Package className="w-3.5 h-3.5 text-emerald-400" />
                      <h4 className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Product
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(product.productPriorityKpis || []).map((kpi) => (
                        <KpiRow key={`product-${kpi.id}`} kpi={kpi} accentColor="emerald" />
                      ))}
                      {(!product.productPriorityKpis || product.productPriorityKpis.length === 0) && (
                        <p className="text-[11px] text-gray-600 italic">No product priorities set</p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Brand KPIs */}
                  <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Building2 className="w-3.5 h-3.5 text-orange-400" />
                      <h4 className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">
                        Brand
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(product.brandPriorityKpis || []).map((kpi) => (
                        <KpiRow key={`brand-${kpi.id}`} kpi={kpi} accentColor="orange" />
                      ))}
                      {(!product.brandPriorityKpis || product.brandPriorityKpis.length === 0) && (
                        <p className="text-[11px] text-gray-600 italic">No brand priorities set</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison to original (V2 agent insight) */}
              {product.comparisonToOriginal && (
                <div className="flex flex-wrap gap-1.5">
                  {product.comparisonToOriginal.priceDiff !== 'unknown' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      product.comparisonToOriginal.priceDiff.startsWith('-')
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      vs original: {product.comparisonToOriginal.priceDiff}
                    </span>
                  )}
                  {product.comparisonToOriginal.betterCommission && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      better commission
                    </span>
                  )}
                  {product.comparisonToOriginal.categoryMatch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      category match
                    </span>
                  )}
                  {product.inStock === false && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      may be OOS
                    </span>
                  )}
                </div>
              )}

              {/* Product details row */}
              <div className="flex flex-wrap gap-3">
                {product.affiliateNetwork && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800/50 rounded-md px-2 py-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {product.affiliateNetwork}
                  </div>
                )}
                {product.commissionRate && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 rounded-md px-2 py-1">
                    <Percent className="w-3.5 h-3.5" />
                    {product.commissionRate}%
                  </div>
                )}
                {product.cookieDurationDays && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800/50 rounded-md px-2 py-1">
                    <Clock className="w-3.5 h-3.5" />
                    {product.cookieDurationDays}d cookie
                  </div>
                )}
              </div>

              {/* Pros and cons */}
              {(product.pros?.length > 0 || product.cons?.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {product.pros?.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-emerald-400">Pros</h4>
                      {product.pros.slice(0, 3).map((pro, i) => (
                        <p key={i} className="text-xs text-gray-400">+ {pro}</p>
                      ))}
                    </div>
                  )}
                  {product.cons?.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-red-400">Cons</h4>
                      {product.cons.slice(0, 3).map((con, i) => (
                        <p key={i} className="text-xs text-gray-400">- {con}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ask about this product */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onAskAbout('Why is this my best match?')}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  Why best match?
                </button>
                <button
                  onClick={() => onAskAbout('What are the risks?')}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  Risks?
                </button>
                <button
                  onClick={() => onAskAbout('Compare to original')}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  Compare
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-gray-800">
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <ThumbsDown className="w-5 h-5" />
          <span className="text-sm font-medium">Skip</span>
        </button>

        {/* Divider */}
        <div className="w-px bg-gray-800" />

        {/* Save button (with long press for options) */}
        <button
          onClick={() => onSave('saved')}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowQuickActions(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          <ThumbsUp className="w-5 h-5" />
          <span className="text-sm font-medium">Save</span>
        </button>
      </div>

      {/* Quick actions overlay */}
      <AnimatePresence>
        {showQuickActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowQuickActions(false)}
          >
            <div className="space-y-3 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-gray-400 text-center mb-4">Save to:</p>

              <button
                onClick={() => { onSave('saved'); setShowQuickActions(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              >
                <Bookmark className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <div className="font-medium">Saved Products</div>
                  <div className="text-xs text-gray-400">Default watchlist</div>
                </div>
              </button>

              <button
                onClick={() => { onSave('try_first'); setShowQuickActions(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              >
                <TestTube className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="font-medium">Try First</div>
                  <div className="text-xs text-gray-400">Products to test before promoting</div>
                </div>
              </button>

              <button
                onClick={() => { onSave('content_calendar'); setShowQuickActions(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              >
                <Calendar className="w-5 h-5 text-purple-400" />
                <div className="text-left">
                  <div className="font-medium">Content Calendar</div>
                  <div className="text-xs text-gray-400">Planned for upcoming content</div>
                </div>
              </button>

              <button
                onClick={() => setShowQuickActions(false)}
                className="w-full p-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
