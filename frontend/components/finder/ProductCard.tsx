'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  Truck,
  RotateCcw,
  Shield,
  Percent,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Calendar,
  TestTube,
} from 'lucide-react';
import MatchScore from './MatchScore';
import type { AlternativeProduct } from '@/types/finder';

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

        {/* Match reasons (collapsed view) */}
        {!isExpanded && product.matchReasons.length > 0 && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {product.matchReasons[0]}
          </p>
        )}

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
              {/* Why it matches */}
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

              {/* Priority alignment */}
              {product.priorityAlignment && Object.keys(product.priorityAlignment).length > 0 && (
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Priority Match
                  </h4>
                  <MatchScore
                    score={product.matchScore}
                    alignment={product.priorityAlignment}
                    expanded={true}
                    showLabel={false}
                    size="sm"
                  />
                </div>
              )}

              {/* Product details */}
              <div className="grid grid-cols-2 gap-3">
                {product.affiliateNetwork && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <ExternalLink className="w-4 h-4" />
                    {product.affiliateNetwork}
                  </div>
                )}
                {product.commissionRate && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <Percent className="w-4 h-4" />
                    {product.commissionRate}% commission
                  </div>
                )}
                {product.cookieDurationDays && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {product.cookieDurationDays} day cookie
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
