'use client';

import { useState } from 'react';
import { ProductCard, ProductCardData } from './ProductCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchResultsProps {
  products: ProductCardData[];
  isLoading?: boolean;
  error?: string | null;
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAddToInventory?: (product: ProductCardData) => Promise<void>;
  onViewDetails?: (product: ProductCardData) => void;
  inventoryProductIds?: Set<string>;
}

export function SearchResults({
  products,
  isLoading = false,
  error = null,
  total = 0,
  page = 1,
  limit = 20,
  hasMore = false,
  onLoadMore,
  onAddToInventory,
  onViewDetails,
  inventoryProductIds = new Set(),
}: SearchResultsProps) {
  const [addingProducts, setAddingProducts] = useState<Set<string>>(new Set());

  const handleAddToInventory = async (product: ProductCardData) => {
    if (!onAddToInventory) return;

    const productId = `${product.merchantKey}-${product.external_id}`;
    setAddingProducts((prev) => new Set(prev).add(productId));

    try {
      await onAddToInventory(product);
    } catch (error) {
      console.error('Failed to add to inventory:', error);
    } finally {
      setAddingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const isProductInInventory = (product: ProductCardData) => {
    const productId = `${product.merchantKey}-${product.external_id}`;
    return inventoryProductIds.has(productId);
  };

  const isProductAdding = (product: ProductCardData) => {
    const productId = `${product.merchantKey}-${product.external_id}`;
    return addingProducts.has(productId);
  };

  // Loading State
  if (isLoading && products.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <svg
              className="h-12 w-12 animate-spin text-purple-500"
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
          </div>
          <p className="text-lg font-medium text-white">Searching products...</p>
          <p className="mt-2 text-sm text-gray-400">
            This may take a few moments
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-white">Search Failed</p>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Empty State
  if (products.length === 0 && !isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <svg
              className="h-8 w-8 text-gray-500"
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
          <p className="text-lg font-medium text-white">No products found</p>
          <p className="mt-2 text-sm text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      </div>
    );
  }

  // Results Header
  const startResult = (page - 1) * limit + 1;
  const endResult = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {total > 0 ? (
            <>
              Showing <span className="font-medium text-white">{startResult}</span> -{' '}
              <span className="font-medium text-white">{endResult}</span> of{' '}
              <span className="font-medium text-white">{total}</span> results
            </>
          ) : (
            'Search for products to get started'
          )}
        </p>
      </div>

      {/* Products Grid */}
      <div className={cn(
        'grid gap-6',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      )}>
        {products.map((product, index) => (
          <ProductCard
            key={`${product.merchantKey}-${product.external_id}-${index}`}
            product={product}
            onAddToInventory={handleAddToInventory}
            onViewDetails={onViewDetails}
            isAdding={isProductAdding(product)}
            isInInventory={isProductInInventory(product)}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={isLoading}
          >
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
                Loading...
              </span>
            ) : (
              'Load More Products'
            )}
          </Button>
        </div>
      )}

      {/* Loading Overlay (for pagination) */}
      {isLoading && products.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 inline-block">
              <svg
                className="h-12 w-12 animate-spin text-purple-500"
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
            </div>
            <p className="text-lg font-medium text-white">Loading more products...</p>
          </div>
        </div>
      )}
    </div>
  );
}
