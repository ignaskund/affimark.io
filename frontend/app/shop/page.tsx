'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShopConfigForm, ShopItemsManager, ShopConfig, ShopItem } from '@/components/shop';
import type { InventoryItem } from '@/components/inventory';
import { AppShell } from '@/components/layout/AppShell';

export default function ShopManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'config' | 'items'>('config');
  const [shop, setShop] = useState<ShopConfig | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch shop data
  const fetchShop = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/me`,
        {
          headers: {
            'X-User-ID': 'current-user-id', // TODO: Get from auth context
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch shop');
      }

      const data = await response.json();
      setShop(data.shop);
    } catch (err) {
      console.error('Fetch shop error:', err);
      setError('Failed to load shop');
    }
  };

  // Fetch shop items
  const fetchShopItems = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/me/items`,
        {
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch shop items');
      }

      const data = await response.json();
      setShopItems(data.items || []);
    } catch (err) {
      console.error('Fetch shop items error:', err);
    }
  };

  // Fetch active inventory items
  const fetchInventoryItems = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/inventory?status=active`,
        {
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();
      setInventoryItems(data.items || []);
    } catch (err) {
      console.error('Fetch inventory error:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchShop(), fetchShopItems(), fetchInventoryItems()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Save shop configuration
  const handleSaveConfig = async (config: ShopConfig) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify(config),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save shop configuration');
      }

      const data = await response.json();
      setShop(data.shop);
      alert('Shop configuration saved successfully!');
    } catch (err) {
      console.error('Save config error:', err);
      setError('Failed to save shop configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Add items to shop
  const handleAddItems = async (inventoryItemIds: string[], section: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/items/bulk-add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({
            inventory_item_ids: inventoryItemIds,
            section,
            is_visible: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add items to shop');
      }

      await fetchShopItems();
    } catch (err) {
      console.error('Add items error:', err);
      throw err;
    }
  };

  // Remove item from shop
  const handleRemoveItem = async (shopItemId: string) => {
    if (!confirm('Remove this item from your shop?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/items/${shopItemId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      await fetchShopItems();
    } catch (err) {
      console.error('Remove item error:', err);
      alert('Failed to remove item');
    }
  };

  // Update shop item
  const handleUpdateItem = async (shopItemId: string, updates: Partial<ShopItem>) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/items/${shopItemId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      await fetchShopItems();
    } catch (err) {
      console.error('Update item error:', err);
      throw err;
    }
  };

  // Reorder shop items
  const handleReorder = async (items: Array<{ id: string; section: string; sort_order: number }>) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/items/reorder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reorder items');
      }

      await fetchShopItems();
    } catch (err) {
      console.error('Reorder error:', err);
      throw err;
    }
  };

  // Get public shop URL
  const getPublicShopUrl = () => {
    // TODO: Get user handle from auth context
    return `${window.location.origin}/shop/preview`;
  };

  if (isLoading) {
    return (
      <AppShell>
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 animate-spin text-purple-500"
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
          <p className="mt-4 text-gray-400">Loading shop...</p>
        </div>
      </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">My Shop</h1>
          <p className="text-gray-400">Configure your public shop and manage items</p>
        </div>
        {shop?.is_public && (
          <Button
            variant="outline"
            onClick={() => window.open(getPublicShopUrl(), '_blank')}
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View Public Shop
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'config'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'items'
              ? 'border-b-2 border-purple-500 text-purple-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Shop Items ({shopItems.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && (
        <ShopConfigForm shop={shop} onSave={handleSaveConfig} isSaving={isSaving} />
      )}

      {activeTab === 'items' && (
        <ShopItemsManager
          shopItems={shopItems}
          inventoryItems={inventoryItems}
          onAddItems={handleAddItems}
          onRemoveItem={handleRemoveItem}
          onUpdateItem={handleUpdateItem}
          onReorder={handleReorder}
        />
      )}
    </div>
    </AppShell>
  );
}
