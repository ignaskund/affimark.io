'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InventoryItem } from './InventoryTable';

interface InventoryEditModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
}

export function InventoryEditModal({
  item,
  isOpen,
  onClose,
  onSave,
}: InventoryEditModalProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setCustomTitle(item.custom_title || '');
      setCustomDescription(item.custom_description || '');
      setCategory(item.category || '');
      setTags(item.tags?.join(', ') || '');
      setStatus(item.status);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;

    setIsSaving(true);
    try {
      await onSave(item.id, {
        custom_title: customTitle || undefined,
        custom_description: customDescription || undefined,
        category: category || undefined,
        tags: tags
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        status,
      });
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Edit Inventory Item</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Original Product Info */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-800/50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-400">
            Original Product
          </p>
          <p className="text-white">{item.product?.product_name}</p>
          {item.product?.brand && (
            <p className="mt-1 text-sm text-gray-500">{item.product.brand}</p>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Custom Title */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Custom Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Leave blank to use original"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Custom Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Custom Description
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Add your own notes or description"
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Audio, Cameras, Software"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. gear, studio, favorites (comma separated)"
              className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Separate tags with commas
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Status
            </label>
            <div className="flex gap-2">
              {(['draft', 'active', 'archived'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors',
                    status === s
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
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
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
