'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import SavedProductsList from '@/components/finder/SavedProductsList';
import type { SavedProduct } from '@/types/finder';

interface SavedProductsClientProps {
  userId: string;
}

export default function SavedProductsClient({ userId }: SavedProductsClientProps) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/finder/saved', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        throw new Error('Failed to load products');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/finder/saved/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove product:', err);
    }
  };

  const handleMoveToList = async (id: string, listType: 'saved' | 'try_first' | 'content_calendar') => {
    try {
      const res = await fetch(`/api/finder/saved/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listType }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, listType } : p))
        );
      }
    } catch (err) {
      console.error('Failed to move product:', err);
    }
  };

  const handleOpenProduct = (product: SavedProduct) => {
    if (product.productUrl) {
      window.open(product.productUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchProducts}
          className="mt-4 text-sm text-gray-400 hover:text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <SavedProductsList
      products={products}
      onRemove={handleRemove}
      onMoveToList={handleMoveToList}
      onOpenProduct={handleOpenProduct}
    />
  );
}
