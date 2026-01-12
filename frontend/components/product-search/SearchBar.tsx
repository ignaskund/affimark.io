'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  brand?: string;
  inStockOnly?: boolean;
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters, merchants: string[]) => void;
  isLoading?: boolean;
  initialQuery?: string;
  placeholder?: string;
  showFilters?: boolean;
}

const MERCHANT_OPTIONS = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'shopify', label: 'Shopify' },
  { key: 'gumroad', label: 'Gumroad' },
];

export function SearchBar({
  onSearch,
  isLoading = false,
  initialQuery = '',
  placeholder = 'Search products...',
  showFilters = true,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>(['amazon']);
  const [filters, setFilters] = useState<SearchFilters>({
    inStockOnly: false,
  });

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), filters, selectedMerchants);
    }
  };

  const toggleMerchant = (merchantKey: string) => {
    setSelectedMerchants((prev) =>
      prev.includes(merchantKey)
        ? prev.filter((m) => m !== merchantKey)
        : [...prev, merchantKey]
    );
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      inStockOnly: false,
    });
    setSelectedMerchants(['amazon']);
  };

  const hasActiveFilters = () => {
    return (
      filters.minPrice ||
      filters.maxPrice ||
      filters.category ||
      filters.brand ||
      filters.inStockOnly ||
      selectedMerchants.length !== 1 ||
      !selectedMerchants.includes('amazon')
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Main Search Bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={cn(
              'w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 pl-12 text-white placeholder:text-gray-500',
              'focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50',
              'transition-colors'
            )}
          />
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <Button type="submit" disabled={isLoading || !query.trim()} size="lg">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </Button>

        {showFilters && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </Button>
        )}
      </form>

      {/* Advanced Filters */}
      {showFilters && showAdvanced && (
        <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          {/* Merchant Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Merchants
            </label>
            <div className="flex flex-wrap gap-2">
              {MERCHANT_OPTIONS.map((merchant) => (
                <button
                  key={merchant.key}
                  type="button"
                  onClick={() => toggleMerchant(merchant.key)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    selectedMerchants.includes(merchant.key)
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  {merchant.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Min Price ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.minPrice || ''}
                onChange={(e) =>
                  handleFilterChange(
                    'minPrice',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Max Price ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.maxPrice || ''}
                onChange={(e) =>
                  handleFilterChange(
                    'maxPrice',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                placeholder="999.99"
              />
            </div>
          </div>

          {/* Category and Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Category
              </label>
              <input
                type="text"
                value={filters.category || ''}
                onChange={(e) =>
                  handleFilterChange(
                    'category',
                    e.target.value || undefined
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                placeholder="e.g. Electronics"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Brand
              </label>
              <input
                type="text"
                value={filters.brand || ''}
                onChange={(e) =>
                  handleFilterChange('brand', e.target.value || undefined)
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                placeholder="e.g. Apple"
              />
            </div>
          </div>

          {/* In Stock Only */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="inStockOnly"
              checked={filters.inStockOnly || false}
              onChange={(e) =>
                handleFilterChange('inStockOnly', e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
            />
            <label
              htmlFor="inStockOnly"
              className="text-sm font-medium text-gray-300"
            >
              In stock only
            </label>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters() && (
            <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
              <Button type="button" size="sm" onClick={handleSubmit}>
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
