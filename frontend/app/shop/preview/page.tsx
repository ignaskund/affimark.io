'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MerchantBadge } from '@/components/product-search';
import type { ShopConfig, ShopItem } from '@/components/shop';

export default function PublicShopPreviewPage() {
  const [shop, setShop] = useState<(ShopConfig & { items?: ShopItem[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        // Fetch shop data (using /me for preview, would use /:handle for public)
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/me`,
          {
            headers: {
              'X-User-ID': 'current-user-id',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch shop');
        }

        const data = await response.json();

        // Fetch shop items
        const itemsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/shops/me/items`,
          {
            headers: {
              'X-User-ID': 'current-user-id',
            },
          }
        );

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setShop({ ...data.shop, items: itemsData.items?.filter((item: ShopItem) => item.is_visible) || [] });
        } else {
          setShop(data.shop);
        }
      } catch (err) {
        console.error('Fetch shop error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShop();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
    );
  }

  if (!shop) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-white">Shop not found</p>
          <p className="mt-2 text-sm text-gray-400">Configure your shop first</p>
        </div>
      </div>
    );
  }

  // Group items by section
  const itemsBySection = (shop.items || []).reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);

  const sections = Object.keys(itemsBySection);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Banner */}
      {shop.banner_image_url && (
        <div className="relative h-48 w-full overflow-hidden bg-gray-900">
          <Image
            src={shop.banner_image_url}
            alt={shop.shop_name}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Shop Info */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-white">{shop.shop_name}</h1>
          {shop.shop_tagline && (
            <p className="text-xl text-gray-400">{shop.shop_tagline}</p>
          )}
          {shop.shop_description && (
            <p className="mt-4 text-gray-300">{shop.shop_description}</p>
          )}
        </div>

        {/* Products by Section */}
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-12">
            <p className="text-lg text-white">No products yet</p>
            <p className="mt-2 text-sm text-gray-400">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section) => (
              <div key={section}>
                <h2 className="mb-6 text-2xl font-bold text-white">{section}</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {itemsBySection[section].map((item) => {
                    const product = item.inventory_item?.product;
                    const affiliateLink = item.inventory_item?.affiliate_link;

                    return (
                      <a
                        key={item.id}
                        href={affiliateLink?.affiliate_url || product?.product_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
                      >
                        {/* Product Image */}
                        <div className="relative aspect-square w-full overflow-hidden bg-gray-800">
                          {product?.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.product_name || ''}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
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

                          {/* Merchant Badge */}
                          {product?.merchant && (
                            <div className="absolute bottom-2 left-2">
                              <MerchantBadge
                                merchantKey={product.merchant.merchant_slug}
                                showName
                                size="sm"
                              />
                            </div>
                          )}

                          {/* Discount Badge */}
                          {affiliateLink?.discount_code && (
                            <div className="absolute right-2 top-2">
                              <span className="rounded-full bg-green-500/90 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                {affiliateLink.discount_code}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex flex-1 flex-col p-4">
                          {product?.brand && (
                            <p className="mb-1 text-xs font-medium text-gray-400">
                              {product.brand}
                            </p>
                          )}

                          <h3 className="mb-2 text-sm font-semibold text-white line-clamp-2">
                            {item.inventory_item?.custom_title || product?.product_name}
                          </h3>

                          {item.inventory_item?.custom_description && (
                            <p className="mb-3 text-xs text-gray-400 line-clamp-2">
                              {item.inventory_item.custom_description}
                            </p>
                          )}

                          {product?.current_price && (
                            <div className="mt-auto">
                              <p className="text-lg font-bold text-white">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: product.currency || 'USD',
                                }).format(product.current_price)}
                              </p>
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        Powered by AffiMark
      </div>
    </div>
  );
}
