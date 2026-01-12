'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SearchBar,
  SearchResults,
  ProductCardData,
  SearchFilters,
} from '@/components/product-search';
import { AppShell } from '@/components/layout/AppShell';

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [inventoryProductIds, setInventoryProductIds] = useState<Set<string>>(
    new Set()
  );

  const limit = 20;

  // Load initial query from URL
  const initialQuery = searchParams.get('q') || '';

  // Fetch user's inventory to check which products are already added
  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        const ids = new Set(
          data.items?.map(
            (item: any) => `${item.merchant_key}-${item.external_product_id}`
          ) || []
        );
        setInventoryProductIds(ids);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Perform product search
  const handleSearch = async (
    query: string,
    filters: SearchFilters,
    merchants: string[]
  ) => {
    setIsLoading(true);
    setError(null);
    setPage(1);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/products/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            merchants,
            page: 1,
            limit,
            filters,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.success) {
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);

        // Update URL with search query
        router.push(`/products?q=${encodeURIComponent(query)}`);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to search products'
      );
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load more products (pagination)
  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/products/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: initialQuery,
            page: nextPage,
            limit,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load more products');
      }

      const data = await response.json();

      if (data.success) {
        setProducts((prev) => [...prev, ...(data.products || [])]);
        setPage(nextPage);
        setHasMore(data.has_more || false);
      }
    } catch (err) {
      console.error('Load more error:', err);
      setError('Failed to load more products');
    } finally {
      setIsLoading(false);
    }
  };

  // Add product to inventory
  const handleAddToInventory = async (product: ProductCardData) => {
    try {
      const response = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_id: product.merchant_id,
          external_product_id: product.external_id,
          product_name: product.product_name,
          product_url: product.product_url,
          image_url: product.image_url,
          current_price: product.price,
          currency: product.currency,
          category: product.category,
          brand: product.brand,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add to inventory');
      }

      // Update local inventory state
      const productId = `${product.merchantKey}-${product.external_id}`;
      setInventoryProductIds((prev) => new Set(prev).add(productId));
    } catch (err) {
      console.error('Add to inventory error:', err);
      throw err;
    }
  };

  // View product details
  const handleViewDetails = (product: ProductCardData) => {
    // Open product URL in new tab
    window.open(product.product_url, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">Product Search</h1>
        <p className="text-gray-400">
          Search for products across Amazon, Shopify stores, and Gumroad
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <SearchBar
          onSearch={handleSearch}
          isLoading={isLoading}
          initialQuery={initialQuery}
          showFilters={true}
        />
      </div>

      {/* Search Results */}
      <SearchResults
        products={products}
        isLoading={isLoading}
        error={error}
        total={total}
        page={page}
        limit={limit}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onAddToInventory={handleAddToInventory}
        onViewDetails={handleViewDetails}
        inventoryProductIds={inventoryProductIds}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <span className="text-gray-400">Loading products…</span>
          </div>
        }
      >
        <ProductsPageInner />
      </Suspense>
    </AppShell>
  );
}
