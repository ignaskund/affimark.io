'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import ProductLibrary, { Product } from './ProductLibrary';
import AddLinkForm from './AddLinkForm';
import AnalysisResults from './AnalysisResults';

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
  alternatives: Array<{
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
  }>;
  insights?: Array<{
    type: 'tip' | 'opportunity' | 'warning' | 'action';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionUrl?: string;
  }>;
}

export default function SmartOptimizer() {
  const [storefrontProducts, setStorefrontProducts] = useState<Product[]>([]);
  const [addedProducts, setAddedProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allProducts = [...storefrontProducts, ...addedProducts];

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/optimizer/products');
      const data = await response.json();
      if (response.ok) {
        setStorefrontProducts(data.storefrontProducts || []);
        setAddedProducts(data.addedProducts || []);
      } else {
        setError(data.error || 'Failed to load products');
      }
    } catch {
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLink = async (url: string, name?: string) => {
    setIsAdding(true);
    setError(null);
    try {
      const response = await fetch('/api/optimizer/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add link');
      }
      // Add to addedProducts list
      setAddedProducts(prev => [data.product, ...prev]);
      // Auto-select the new product
      setSelectedIds(prev => [data.product.id, ...prev]);
    } catch (err) {
      throw err;
    } finally {
      setIsAdding(false);
    }
  };

  const handleAnalyze = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one product to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const selectedProducts = allProducts.filter(p => selectedIds.includes(p.id));
      const response = await fetch('/api/optimizer/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProducts.map(p => ({
            id: p.id,
            product_url: p.product_url,
            title: p.title,
            brand: p.brand,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResults(data.results);

      // Refresh products to get updated analysis data
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Show results view
  if (results) {
    return <AnalysisResults results={results} onClear={clearResults} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Your Products</h3>
          <p className="text-sm text-muted-foreground">
            Select products to find better commission rates
          </p>
        </div>
        <button
          onClick={fetchProducts}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Product Library */}
      <ProductLibrary
        storefrontProducts={storefrontProducts}
        addedProducts={addedProducts}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Add Link Form */}
      <AddLinkForm onAdd={handleAddLink} isAdding={isAdding} />

      {/* Analyze Button */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || selectedIds.length === 0}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3
            ${selectedIds.length > 0
              ? 'bg-gradient-to-r from-primary to-purple-500 text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
            }
          `}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {selectedIds.length > 0 ? (
                <>Find Better Rates for {selectedIds.length} Product{selectedIds.length !== 1 ? 's' : ''}</>
              ) : (
                <>Select Products to Analyze</>
              )}
            </>
          )}
        </button>
        {selectedIds.length > 0 && !isAnalyzing && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Get insights on commission rates and optimization tips
          </p>
        )}
      </div>
    </div>
  );
}
