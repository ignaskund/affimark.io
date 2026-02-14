'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save, Package, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import PriorityRanker from '@/components/onboarding/PriorityRanker';
import { PRODUCT_PRIORITIES, BRAND_PRIORITIES, Priority } from '@/types/finder';

interface PrioritiesEditorProps {
  onSaved?: () => void;
}

export default function PrioritiesEditor({ onSaved }: PrioritiesEditorProps) {
  const [productPriorities, setProductPriorities] = useState<Priority[]>([]);
  const [brandPriorities, setBrandPriorities] = useState<Priority[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'product' | 'brand'>('product');

  // Fetch current priorities on mount
  useEffect(() => {
    async function fetchPriorities() {
      try {
        const res = await fetch('/api/preferences/priorities', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setProductPriorities(data.productPriorities || []);
          setBrandPriorities(data.brandPriorities || []);
        }
      } catch (err) {
        console.error('Failed to fetch priorities:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPriorities();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/preferences/priorities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productPriorities,
          brandPriorities,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSaved?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save priorities');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-2 p-1 bg-gray-900/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('product')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'product'
              ? 'bg-orange-500/20 text-orange-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          Product Priorities
        </button>
        <button
          onClick={() => setActiveTab('brand')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'brand'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Brand Priorities
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'product' ? (
          <PriorityRanker
            type="product"
            options={PRODUCT_PRIORITIES}
            selected={productPriorities}
            onSelectionChange={setProductPriorities}
            maxSelections={5}
          />
        ) : (
          <PriorityRanker
            type="brand"
            options={BRAND_PRIORITIES}
            selected={brandPriorities}
            onSelectionChange={setBrandPriorities}
            maxSelections={5}
          />
        )}
      </motion.div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Priorities saved successfully!
        </motion.div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium text-sm transition-colors"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Priorities
            </>
          )}
        </button>
      </div>
    </div>
  );
}
