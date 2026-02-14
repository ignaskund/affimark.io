'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube,
  Instagram,
  Twitter,
  Globe,
  Store,
  Settings2,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import type { ActiveContext } from '@/types/finder';

// Platform icons mapping
const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  instagram: Instagram,
  twitter: Twitter,
  tiktok: Globe, // Using Globe as placeholder
  amazon: Store,
  ltk: Store,
  shopmy: Store,
  awin: Store,
};

const platformLabels: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  tiktok: 'TikTok',
  amazon: 'Amazon',
  amazon_de: 'Amazon DE',
  amazon_uk: 'Amazon UK',
  amazon_us: 'Amazon US',
  ltk: 'LTK',
  shopmy: 'ShopMy',
  awin: 'Awin',
};

interface ContextBarProps {
  availableSocials: string[];
  availableStorefronts: string[];
  activeContext: ActiveContext;
  onContextChange: (context: ActiveContext) => void;
  onEditPriorities?: () => void;
}

export default function ContextBar({
  availableSocials,
  availableStorefronts,
  activeContext,
  onContextChange,
  onEditPriorities,
}: ContextBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleSocial = (social: string) => {
    const newSocials = activeContext.socials.includes(social)
      ? activeContext.socials.filter((s) => s !== social)
      : [...activeContext.socials, social];
    onContextChange({ ...activeContext, socials: newSocials });
  };

  const toggleStorefront = (storefront: string) => {
    const newStorefronts = activeContext.storefronts.includes(storefront)
      ? activeContext.storefronts.filter((s) => s !== storefront)
      : [...activeContext.storefronts, storefront];
    onContextChange({ ...activeContext, storefronts: newStorefronts });
  };

  const selectAll = () => {
    onContextChange({
      socials: [...availableSocials],
      storefronts: [...availableStorefronts],
    });
  };

  const clearAll = () => {
    onContextChange({ socials: [], storefronts: [] });
  };

  const totalActive = activeContext.socials.length + activeContext.storefronts.length;
  const totalAvailable = availableSocials.length + availableStorefronts.length;

  return (
    <div className="relative">
      {/* Main bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
        {/* Quick toggles for active items */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {activeContext.socials.map((social) => {
            const Icon = platformIcons[social] || Globe;
            return (
              <motion.button
                key={social}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => toggleSocial(social)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {platformLabels[social] || social}
                <X className="w-3 h-3 opacity-60" />
              </motion.button>
            );
          })}

          {activeContext.storefronts.map((storefront) => {
            const Icon = platformIcons[storefront.split('_')[0]] || Store;
            return (
              <motion.button
                key={storefront}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => toggleStorefront(storefront)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {platformLabels[storefront] || storefront}
                <X className="w-3 h-3 opacity-60" />
              </motion.button>
            );
          })}

          {totalActive === 0 && (
            <span className="text-sm text-gray-500 italic">
              No context selected - click to add
            </span>
          )}
        </div>

        {/* Dropdown trigger */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">
            {totalActive}/{totalAvailable}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Edit priorities button */}
        {onEditPriorities && (
          <button
            onClick={onEditPriorities}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
          >
            Edit Priorities
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 rounded-xl bg-gray-900 border border-gray-800 shadow-xl z-50"
          >
            {/* Quick actions */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-400">Select context for search</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Select all
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Socials section */}
            {availableSocials.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Social Platforms
                </h4>
                <div className="flex flex-wrap gap-2">
                  {availableSocials.map((social) => {
                    const Icon = platformIcons[social] || Globe;
                    const isActive = activeContext.socials.includes(social);
                    return (
                      <button
                        key={social}
                        onClick={() => toggleSocial(social)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {platformLabels[social] || social}
                        {isActive && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Storefronts section */}
            {availableStorefronts.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Storefronts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {availableStorefronts.map((storefront) => {
                    const Icon = platformIcons[storefront.split('_')[0]] || Store;
                    const isActive = activeContext.storefronts.includes(storefront);
                    return (
                      <button
                        key={storefront}
                        onClick={() => toggleStorefront(storefront)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isActive
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {platformLabels[storefront] || storefront}
                        {isActive && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {availableSocials.length === 0 && availableStorefronts.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No connected accounts found. Connect your socials and storefronts in settings.
              </p>
            )}

            {/* Close button */}
            <button
              onClick={() => setShowDropdown(false)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
