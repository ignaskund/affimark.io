'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ShopConfig {
  id?: string;
  user_id?: string;
  shop_name: string;
  shop_tagline?: string;
  shop_description?: string;
  banner_image_url?: string;
  theme_color?: string;
  is_public: boolean;
  show_out_of_stock: boolean;
  embed_mode_enabled: boolean;
  meta_title?: string;
  meta_description?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

interface ShopConfigFormProps {
  shop: ShopConfig | null;
  onSave: (config: ShopConfig) => Promise<void>;
  isSaving?: boolean;
}

export function ShopConfigForm({ shop, onSave, isSaving = false }: ShopConfigFormProps) {
  const [config, setConfig] = useState<ShopConfig>({
    shop_name: '',
    shop_tagline: '',
    shop_description: '',
    banner_image_url: '',
    theme_color: '#9333ea',
    is_public: false,
    show_out_of_stock: true,
    embed_mode_enabled: true,
    meta_title: '',
    meta_description: '',
  });

  useEffect(() => {
    if (shop) {
      setConfig(shop);
    }
  }, [shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Basic Information</h3>

        <div className="space-y-4">
          {/* Shop Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Shop Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.shop_name}
              onChange={(e) => setConfig({ ...config, shop_name: e.target.value })}
              placeholder="My Creator Shop"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Tagline
            </label>
            <input
              type="text"
              value={config.shop_tagline || ''}
              onChange={(e) => setConfig({ ...config, shop_tagline: e.target.value })}
              placeholder="Tools & gear I actually use"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Description
            </label>
            <textarea
              value={config.shop_description || ''}
              onChange={(e) => setConfig({ ...config, shop_description: e.target.value })}
              placeholder="Tell your audience about your favorite products..."
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Branding</h3>

        <div className="space-y-4">
          {/* Banner Image */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Banner Image URL
            </label>
            <input
              type="url"
              value={config.banner_image_url || ''}
              onChange={(e) => setConfig({ ...config, banner_image_url: e.target.value })}
              placeholder="https://example.com/banner.jpg"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Theme Color */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Theme Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.theme_color || '#9333ea'}
                onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                className="h-10 w-20 cursor-pointer rounded border border-gray-700 bg-gray-900/50"
              />
              <input
                type="text"
                value={config.theme_color || '#9333ea'}
                onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                placeholder="#9333ea"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Settings</h3>

        <div className="space-y-4">
          {/* Public/Private */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Make shop public</p>
              <p className="text-sm text-gray-400">
                Allow anyone to view your shop
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.is_public}
                onChange={(e) => setConfig({ ...config, is_public: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-purple-800"></div>
            </label>
          </div>

          {/* Show Out of Stock */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Show out of stock items</p>
              <p className="text-sm text-gray-400">
                Display products that are currently unavailable
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.show_out_of_stock}
                onChange={(e) => setConfig({ ...config, show_out_of_stock: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-purple-800"></div>
            </label>
          </div>

          {/* Embed Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Enable embed mode</p>
              <p className="text-sm text-gray-400">
                Allow embedding shop in other websites
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.embed_mode_enabled}
                onChange={(e) => setConfig({ ...config, embed_mode_enabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-purple-800"></div>
            </label>
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">SEO</h3>

        <div className="space-y-4">
          {/* Meta Title */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Meta Title
            </label>
            <input
              type="text"
              value={config.meta_title || ''}
              onChange={(e) => setConfig({ ...config, meta_title: e.target.value })}
              placeholder="My Shop - Creator Recommendations"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Meta Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Meta Description
            </label>
            <textarea
              value={config.meta_description || ''}
              onChange={(e) => setConfig({ ...config, meta_description: e.target.value })}
              placeholder="Discover the tools and products I recommend..."
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving || !config.shop_name} size="lg">
          {isSaving ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
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
              Saving...
            </span>
          ) : (
            'Save Shop Configuration'
          )}
        </Button>
      </div>
    </form>
  );
}
