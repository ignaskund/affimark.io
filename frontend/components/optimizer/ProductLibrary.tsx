'use client';

import { useState } from 'react';
import {
  Check,
  Package,
  TrendingUp,
  Clock,
  AlertCircle,
  Store,
  Plus
} from 'lucide-react';

export interface Product {
  id: string;
  title: string | null;
  brand: string | null;
  product_url: string;
  platform: string | null;
  image_url: string | null;
  current_price: number | null;
  currency: string;
  storefront_name?: string;
  last_analysis?: {
    detected_commission_rate: number | null;
    alternatives_found: number;
    potential_gain_high: number | null;
    created_at: string;
  } | null;
}

interface ProductLibraryProps {
  storefrontProducts: Product[];
  addedProducts: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function ProductLibrary({
  storefrontProducts,
  addedProducts,
  selectedIds,
  onSelectionChange
}: ProductLibraryProps) {
  const allProducts = [...storefrontProducts, ...addedProducts];
  const allSelected = allProducts.length > 0 && selectedIds.length === allProducts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < allProducts.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allProducts.map(p => p.id));
    }
  };

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getPlatformColor = (platform: string | null) => {
    switch (platform?.toLowerCase()) {
      case 'amazon':
      case 'amazon_de':
      case 'amazon_uk':
      case 'amazon_us':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'ltk':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'awin':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'shopmy':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const renderProductCard = (product: Product) => {
    const isSelected = selectedIds.includes(product.id);
    const hasAnalysis = product.last_analysis && product.last_analysis.alternatives_found > 0;

    return (
      <div
        key={product.id}
        onClick={() => toggleProduct(product.id)}
        className={`
          group relative p-4 rounded-xl border cursor-pointer transition-all
          ${isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
            : 'border-border hover:border-muted-foreground/30 bg-card'
          }
        `}
      >
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className={`
            w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
            ${isSelected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
            }
          `}>
            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>

          {/* Product Image */}
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title || 'Product'}
              className="w-12 h-12 object-cover rounded-lg bg-muted flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate text-sm">
              {product.title || 'Untitled Product'}
            </h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {product.brand && (
                <span className="text-xs text-muted-foreground">{product.brand}</span>
              )}
              {product.platform && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${getPlatformColor(product.platform)}`}>
                  {product.platform.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Analysis Status */}
            {product.last_analysis ? (
              <div className="flex items-center gap-2 mt-2">
                {hasAnalysis ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    {product.last_analysis.alternatives_found} better options
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3" />
                    Scanned
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                <AlertCircle className="w-3 h-3" />
                Not scanned
              </div>
            )}
          </div>

          {/* Price */}
          {product.current_price && (
            <div className="text-right flex-shrink-0">
              <span className="text-sm font-medium text-foreground">
                {product.currency === 'EUR' ? '€' : product.currency === 'GBP' ? '£' : '$'}
                {product.current_price.toFixed(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (allProducts.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No products yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Add a link below to analyze commission rates
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Select All Header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={toggleAll}
          className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${allSelected
              ? 'bg-primary border-primary'
              : someSelected
                ? 'border-primary bg-primary/20'
                : 'border-muted-foreground/30 hover:border-muted-foreground/50'
            }
          `}>
            {(allSelected || someSelected) && (
              <Check className={`w-3 h-3 ${allSelected ? 'text-primary-foreground' : 'text-primary'}`} />
            )}
          </div>
          <span>
            {allSelected ? 'Deselect all' : `Select all (${allProducts.length})`}
          </span>
        </button>
        {selectedIds.length > 0 && (
          <span className="text-sm text-primary font-medium">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Storefront Products Section */}
      {storefrontProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Store className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">
              From Your Storefronts
            </h3>
            <span className="text-xs text-muted-foreground/70">
              ({storefrontProducts.length})
            </span>
          </div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {storefrontProducts.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* Added Products Section */}
      {addedProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Added Products
            </h3>
            <span className="text-xs text-muted-foreground/70">
              ({addedProducts.length})
            </span>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {addedProducts.map(renderProductCard)}
          </div>
        </div>
      )}
    </div>
  );
}
