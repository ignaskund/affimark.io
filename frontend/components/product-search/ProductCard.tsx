'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { MerchantBadge } from './MerchantBadge';
import { cn } from '@/lib/utils';

export interface ProductCardData {
  merchant_id: string;
  external_id: string;
  product_name: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  product_url: string;
  category?: string;
  brand?: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  rating?: number;
  review_count?: number;
  merchantKey?: string;
}

interface ProductCardProps {
  product: ProductCardData;
  onAddToInventory?: (product: ProductCardData) => void;
  onViewDetails?: (product: ProductCardData) => void;
  isAdding?: boolean;
  isInInventory?: boolean;
}

export function ProductCard({
  product,
  onAddToInventory,
  onViewDetails,
  isAdding = false,
  isInInventory = false,
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatPrice = (price: number, currency: string) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    });
    return formatter.format(price);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
      {/* Product Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-800">
        {product.image_url && !imageError ? (
          <Image
            src={product.image_url}
            alt={product.product_name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-600">
            <svg
              className="h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Availability Badge */}
        <div className="absolute right-2 top-2">
          {product.availability === 'in_stock' && (
            <span className="rounded-full bg-green-500/90 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              In Stock
            </span>
          )}
          {product.availability === 'out_of_stock' && (
            <span className="rounded-full bg-red-500/90 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Out of Stock
            </span>
          )}
        </div>

        {/* Merchant Badge */}
        <div className="absolute bottom-2 left-2">
          <MerchantBadge merchantKey={product.merchantKey || 'unknown'} />
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand */}
        {product.brand && (
          <p className="mb-1 text-xs font-medium text-gray-400">
            {product.brand}
          </p>
        )}

        {/* Product Name */}
        <h3
          className="mb-2 text-sm font-semibold text-white line-clamp-2 cursor-pointer hover:text-purple-400"
          onClick={() => onViewDetails?.(product)}
          title={product.product_name}
        >
          {truncateText(product.product_name, 60)}
        </h3>

        {/* Rating */}
        {product.rating && (
          <div className="mb-2 flex items-center gap-1">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={cn(
                    'h-3 w-3',
                    i < Math.floor(product.rating || 0)
                      ? 'text-yellow-500'
                      : 'text-gray-600'
                  )}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {product.review_count && (
              <span className="text-xs text-gray-400">
                ({product.review_count.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mb-3 flex items-baseline gap-2">
          <p className="text-xl font-bold text-white">
            {formatPrice(product.price, product.currency)}
          </p>
          {product.category && (
            <span className="text-xs text-gray-500">{product.category}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(product.product_url, '_blank')}
          >
            View
          </Button>
          <Button
            variant={isInInventory ? 'ghost' : 'default'}
            size="sm"
            className="flex-1"
            onClick={() => onAddToInventory?.(product)}
            disabled={isAdding || isInInventory}
          >
            {isAdding ? (
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
                Adding...
              </span>
            ) : isInInventory ? (
              'In Inventory'
            ) : (
              'Add to Inventory'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
