'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Bookmark,
  TestTube,
  Calendar,
  Trash2,
  ExternalLink,
  MoreVertical,
  Filter,
  Search,
  SortAsc,
} from 'lucide-react';
import type { SavedProduct } from '@/types/finder';
import MatchScore from './MatchScore';

interface SavedProductsListProps {
  products: SavedProduct[];
  onRemove: (id: string) => void;
  onMoveToList: (id: string, listType: 'saved' | 'try_first' | 'content_calendar') => void;
  onOpenProduct: (product: SavedProduct) => void;
}

const listTypeConfig = {
  saved: { label: 'Saved', icon: Bookmark, color: 'emerald' },
  try_first: { label: 'Try First', icon: TestTube, color: 'blue' },
  content_calendar: { label: 'Content Calendar', icon: Calendar, color: 'purple' },
};

export default function SavedProductsList({
  products,
  onRemove,
  onMoveToList,
  onOpenProduct,
}: SavedProductsListProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'saved' | 'try_first' | 'content_calendar'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter and sort products
  const filteredProducts = products
    .filter((p) => {
      if (activeFilter !== 'all' && p.listType !== activeFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.productName?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Count by list type
  const counts = {
    all: products.length,
    saved: products.filter((p) => p.listType === 'saved').length,
    try_first: products.filter((p) => p.listType === 'try_first').length,
    content_calendar: products.filter((p) => p.listType === 'content_calendar').length,
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No saved products yet</h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          When you find products you like, swipe right to save them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* List type tabs */}
        <div className="flex gap-1 p-1 bg-gray-900/50 rounded-lg">
          {(['all', 'saved', 'try_first', 'content_calendar'] as const).map((type) => {
            const config = type === 'all' ? null : listTypeConfig[type];
            const Icon = config?.icon || Filter;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeFilter === type
                    ? type === 'all'
                      ? 'bg-gray-800 text-white'
                      : `bg-${config?.color}-500/20 text-${config?.color}-400`
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{type === 'all' ? 'All' : config?.label}</span>
                <span className="text-xs opacity-60">({counts[type]})</span>
              </button>
            );
          })}
        </div>

        {/* Search and sort */}
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved products..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'score' : 'date')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-gray-400 text-sm hover:text-white transition-colors"
          >
            <SortAsc className="w-4 h-4" />
            {sortBy === 'date' ? 'Date' : 'Score'}
          </button>
        </div>
      </div>

      {/* Products list */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredProducts.map((product) => {
            const config = listTypeConfig[product.listType];
            const Icon = config.icon;
            const isExpanded = expandedId === product.id;

            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Image */}
                  <div
                    className="w-16 h-16 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0 cursor-pointer"
                    onClick={() => onOpenProduct(product)}
                  >
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.productName || ''}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4
                          className="text-sm font-medium text-white truncate cursor-pointer hover:text-orange-400 transition-colors"
                          onClick={() => onOpenProduct(product)}
                        >
                          {product.productName}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {product.brand} • {product.category}
                        </p>
                      </div>

                      {/* List type badge */}
                      <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-${config.color}-500/20 text-${config.color}-400`}>
                        <Icon className="w-3 h-3" />
                        <span className="text-xs">{config.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      {/* Match score */}
                      {product.matchScore && (
                        <MatchScore score={product.matchScore} size="sm" showLabel={false} />
                      )}

                      {/* Price */}
                      {product.price && (
                        <span className="text-sm font-medium text-white">
                          {product.currency === 'EUR' ? '€' : product.currency === 'GBP' ? '£' : '$'}
                          {product.price.toFixed(2)}
                        </span>
                      )}

                      {/* Commission */}
                      {product.commissionRate && (
                        <span className="text-xs text-emerald-400">
                          {product.commissionRate}% commission
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : product.id)}
                      className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded actions */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-800"
                    >
                      <div className="p-3 flex flex-wrap gap-2">
                        {/* Move to different list */}
                        {Object.entries(listTypeConfig)
                          .filter(([key]) => key !== product.listType)
                          .map(([key, cfg]) => {
                            const MoveIcon = cfg.icon;
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  onMoveToList(product.id, key as any);
                                  setExpandedId(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${cfg.color}-500/10 border border-${cfg.color}-500/30 text-${cfg.color}-400 text-xs hover:bg-${cfg.color}-500/20 transition-colors`}
                              >
                                <MoveIcon className="w-3.5 h-3.5" />
                                Move to {cfg.label}
                              </button>
                            );
                          })}

                        {/* External link */}
                        {product.productUrl && (
                          <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View product
                          </a>
                        )}

                        {/* Affiliate link */}
                        {product.affiliateLink && (
                          <a
                            href={product.affiliateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Affiliate link
                          </a>
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => {
                            onRemove(product.id);
                            setExpandedId(null);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>

                      {/* Match reasons */}
                      {product.matchReasons && product.matchReasons.length > 0 && (
                        <div className="px-3 pb-3">
                          <p className="text-xs text-gray-500 mb-1">Why it matched:</p>
                          <ul className="space-y-0.5">
                            {product.matchReasons.slice(0, 3).map((reason, i) => (
                              <li key={i} className="text-xs text-gray-400">
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty filtered state */}
      {filteredProducts.length === 0 && products.length > 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            No products match your current filters.
          </p>
        </div>
      )}
    </div>
  );
}
