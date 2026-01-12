'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { MerchantBadge } from '@/components/product-search';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/components/inventory';

export interface ShopItem {
  id: string;
  shop_id: string;
  inventory_item_id: string;
  section: string;
  sort_order: number;
  is_visible: boolean;
  is_featured: boolean;
  added_at: string;
  inventory_item?: InventoryItem;
}

interface ShopItemsManagerProps {
  shopItems: ShopItem[];
  inventoryItems: InventoryItem[];
  onAddItems: (inventoryItemIds: string[], section: string) => Promise<void>;
  onRemoveItem: (shopItemId: string) => Promise<void>;
  onUpdateItem: (shopItemId: string, updates: Partial<ShopItem>) => Promise<void>;
  onReorder: (items: Array<{ id: string; section: string; sort_order: number }>) => Promise<void>;
}

export function ShopItemsManager({
  shopItems,
  inventoryItems,
  onAddItems,
  onRemoveItem,
  onUpdateItem,
  onReorder,
}: ShopItemsManagerProps) {
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [newSection, setNewSection] = useState('Uncategorized');
  const [isAdding, setIsAdding] = useState(false);

  // Get sections from shop items
  const sections = Array.from(new Set(shopItems.map((item) => item.section)));

  // Get inventory items not in shop
  const shopItemInventoryIds = new Set(shopItems.map((item) => item.inventory_item_id));
  const availableInventoryItems = inventoryItems.filter(
    (item) => !shopItemInventoryIds.has(item.id) && item.status === 'active'
  );

  const handleAddItems = async () => {
    if (selectedInventoryIds.size === 0) return;

    setIsAdding(true);
    try {
      await onAddItems(Array.from(selectedInventoryIds), newSection);
      setSelectedInventoryIds(new Set());
    } catch (error) {
      console.error('Add items error:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleInventorySelection = (itemId: string) => {
    const newSet = new Set(selectedInventoryIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedInventoryIds(newSet);
  };

  // Group shop items by section
  const itemsBySection = shopItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);

  return (
    <div className="space-y-6">
      {/* Add Items Section */}
      {availableInventoryItems.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Add Items to Shop
          </h3>

          {/* Section Input */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Section
            </label>
            <input
              type="text"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="e.g. Camera Gear, Software, Favorites"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Available Items Grid */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableInventoryItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => toggleInventorySelection(item.id)}
                className={cn(
                  'cursor-pointer rounded-lg border p-4 transition-all',
                  selectedInventoryIds.has(item.id)
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-800">
                    {item.product?.image_url && (
                      <Image
                        src={item.product.image_url}
                        alt={item.product.product_name || ''}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {item.custom_title || item.product?.product_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.category || 'Uncategorized'}
                    </p>
                  </div>
                  {selectedInventoryIds.has(item.id) && (
                    <svg
                      className="h-5 w-5 text-purple-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {selectedInventoryIds.size} item{selectedInventoryIds.size !== 1 && 's'} selected
            </p>
            <Button
              onClick={handleAddItems}
              disabled={selectedInventoryIds.size === 0 || isAdding}
            >
              {isAdding ? 'Adding...' : `Add ${selectedInventoryIds.size > 0 ? selectedInventoryIds.size : ''} to Shop`}
            </Button>
          </div>
        </div>
      )}

      {/* Shop Items by Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Shop Items</h3>

        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-12">
            <svg
              className="mb-4 h-16 w-16 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <p className="text-lg font-medium text-white">No items in shop</p>
            <p className="mt-2 text-sm text-gray-400">
              Add active inventory items to your shop
            </p>
          </div>
        ) : (
          sections.map((section) => (
            <div
              key={section}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-6"
            >
              <h4 className="mb-4 text-base font-semibold text-white">{section}</h4>

              <div className="space-y-3">
                {itemsBySection[section]?.map((shopItem) => (
                  <div
                    key={shopItem.id}
                    className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-800/30 p-4"
                  >
                    {/* Product Info */}
                    <div className="flex flex-1 items-center gap-3">
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-800">
                        {shopItem.inventory_item?.product?.image_url && (
                          <Image
                            src={shopItem.inventory_item.product.image_url}
                            alt={shopItem.inventory_item.product.product_name || ''}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">
                          {shopItem.inventory_item?.custom_title ||
                            shopItem.inventory_item?.product?.product_name}
                        </p>
                        {shopItem.inventory_item?.product?.merchant && (
                          <MerchantBadge
                            merchantKey={
                              shopItem.inventory_item.product.merchant.merchant_slug
                            }
                            size="sm"
                          />
                        )}
                      </div>
                    </div>

                    {/* Visibility Toggle */}
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={shopItem.is_visible}
                        onChange={(e) =>
                          onUpdateItem(shopItem.id, { is_visible: e.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:border-gray-600 dark:bg-gray-700"></div>
                    </label>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(shopItem.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
