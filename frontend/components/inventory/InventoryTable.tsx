'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { MerchantBadge } from '@/components/product-search';
import { cn } from '@/lib/utils';

export interface InventoryItem {
  id: string;
  user_id: string;
  product_id: string;
  affiliate_link_id?: string;
  custom_title?: string;
  custom_description?: string;
  custom_image_url?: string;
  category?: string;
  tags?: string[];
  status: 'draft' | 'active' | 'archived';
  sort_order: number;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    product_name: string;
    product_url: string;
    current_price?: number;
    currency?: string;
    is_available?: boolean;
    image_url?: string;
    brand?: string;
    category?: string;
    merchant?: {
      merchant_name: string;
      merchant_slug: string;
      logo_url?: string;
    };
  };
  affiliate_link?: {
    id: string;
    affiliate_url: string;
    discount_code?: string;
    commission_rate?: number;
  };
}

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading?: boolean;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: 'draft' | 'active' | 'archived') => void;
  onBulkSelect?: (itemIds: string[]) => void;
  selectedIds?: Set<string>;
}

export function InventoryTable({
  items,
  isLoading = false,
  onEdit,
  onDelete,
  onStatusChange,
  onBulkSelect,
  selectedIds = new Set(),
}: InventoryTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'N/A';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    });
    return formatter.format(price);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onBulkSelect?.(items.map((item) => item.id));
    } else {
      onBulkSelect?.([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    onBulkSelect?.(Array.from(newSelected));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'archived':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
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
          <p className="mt-4 text-gray-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <p className="text-lg font-medium text-white">No inventory items</p>
        <p className="mt-2 text-sm text-gray-400">
          Search for products to add to your inventory
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-800 bg-gray-900/50">
            <tr>
              <th className="p-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
                />
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Product
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Merchant
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Price
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Category
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Status
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-400">
                Affiliate Link
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  'transition-colors',
                  hoveredRow === item.id ? 'bg-gray-800/30' : 'bg-transparent'
                )}
                onMouseEnter={() => setHoveredRow(item.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
                  />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-800">
                      {item.product?.image_url || item.custom_image_url ? (
                        <Image
                          src={
                            item.custom_image_url ||
                            item.product?.image_url ||
                            ''
                          }
                          alt={
                            item.custom_title || item.product?.product_name || ''
                          }
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-600">
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {item.custom_title || item.product?.product_name}
                      </p>
                      {item.product?.brand && (
                        <p className="truncate text-xs text-gray-500">
                          {item.product.brand}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {item.product?.merchant && (
                    <MerchantBadge
                      merchantKey={item.product.merchant.merchant_slug}
                      showName
                      size="sm"
                    />
                  )}
                </td>
                <td className="p-4">
                  <span className="text-sm font-medium text-white">
                    {formatPrice(
                      item.product?.current_price,
                      item.product?.currency
                    )}
                  </span>
                </td>
                <td className="p-4">
                  {item.category && (
                    <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300">
                      {item.category}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => {
                      const statuses: ('draft' | 'active' | 'archived')[] = [
                        'draft',
                        'active',
                        'archived',
                      ];
                      const currentIndex = statuses.indexOf(item.status);
                      const nextStatus =
                        statuses[(currentIndex + 1) % statuses.length];
                      onStatusChange?.(item.id, nextStatus);
                    }}
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium capitalize transition-colors',
                      getStatusColor(item.status)
                    )}
                  >
                    {item.status}
                  </button>
                </td>
                <td className="p-4">
                  {item.affiliate_link ? (
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item.affiliate_link.discount_code && (
                        <span className="text-xs text-gray-400">
                          {item.affiliate_link.discount_code}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">No link</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit?.(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete?.(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
