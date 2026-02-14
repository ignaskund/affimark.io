'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bookmark,
  Settings,
  MessageSquare,
  AlertCircle,
  X,
} from 'lucide-react';
import { useFinder } from '@/hooks/useFinder';
import ContextBar from './ContextBar';
import FinderInput from './FinderInput';
import CardStack from './CardStack';
import ChatSidebar from './ChatSidebar';
import SavedProductsList from './SavedProductsList';
import type { AlternativeProduct, SavedProduct } from '@/types/finder';

interface ProductFinderProps {
  userId: string;
}

type ViewMode = 'search' | 'saved';

export default function ProductFinder({ userId }: ProductFinderProps) {
  const router = useRouter();
  const finder = useFinder({ userId });
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Handle search
  const handleSearch = (input: string, inputType: 'url' | 'category') => {
    finder.search(input, inputType);
  };

  // Handle save
  const handleSave = (product: AlternativeProduct, listType: 'saved' | 'try_first' | 'content_calendar') => {
    finder.saveProduct(product, listType);
  };

  // Handle skip
  const handleSkip = (product: AlternativeProduct) => {
    finder.skipProduct(product);
  };

  // Handle ask about product
  const handleAskAbout = (product: AlternativeProduct, question: string) => {
    setIsChatOpen(true);
    finder.sendChatMessage(question);
  };

  // Handle open saved product
  const handleOpenProduct = (product: SavedProduct) => {
    // Could open a modal or navigate to product detail
    window.open(product.productUrl, '_blank');
  };

  // Go to settings to edit priorities
  const handleEditPriorities = () => {
    router.push('/settings');
  };

  const hasResults = finder.alternatives.length > 0;
  const hasPriorities = finder.productPriorities.length > 0;

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View mode tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex gap-1 p-1 bg-gray-900/50 rounded-lg">
            <button
              onClick={() => setViewMode('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'search'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Find Products
            </button>
            <button
              onClick={() => setViewMode('saved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'saved'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Saved
              {finder.savedProducts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-xs">
                  {finder.savedProducts.length}
                </span>
              )}
            </button>
          </div>

          {/* Chat toggle (mobile) */}
          {hasResults && viewMode === 'search' && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Ask
            </button>
          )}
        </div>

        {/* Search view */}
        {viewMode === 'search' && (
          <div className="flex-1 overflow-y-auto">
            {/* No priorities warning */}
            {!hasPriorities && (
              <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">
                      Set your priorities for better results
                    </p>
                    <p className="text-xs text-amber-400/70 mt-1">
                      Without priorities, we can't personalize product recommendations.
                    </p>
                    <button
                      onClick={handleEditPriorities}
                      className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
                    >
                      Set priorities in Settings →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Context bar */}
            <div className="px-6 pt-4">
              <ContextBar
                availableSocials={finder.availableSocials}
                availableStorefronts={finder.availableStorefronts}
                activeContext={finder.activeContext}
                onContextChange={finder.updateActiveContext}
                onEditPriorities={handleEditPriorities}
              />
            </div>

            {/* Search input */}
            <div className="px-6 py-6">
              <FinderInput
                onSearch={handleSearch}
                isLoading={finder.isSearching}
                disabled={false}
              />
            </div>

            {/* Error display */}
            {finder.error && (
              <div className="mx-6 mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{finder.error}</p>
                  </div>
                  <button
                    onClick={finder.clearError}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Card stack */}
            <div className="px-6 pb-6">
              <CardStack
                products={finder.alternatives}
                currentIndex={finder.currentIndex}
                onSave={handleSave}
                onSkip={handleSkip}
                onAskAbout={handleAskAbout}
                onIndexChange={finder.goToIndex}
                isLoading={finder.isSearching}
              />
            </div>
          </div>
        )}

        {/* Saved view */}
        {viewMode === 'saved' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <SavedProductsList
              products={finder.savedProducts}
              onRemove={finder.removeSavedProduct}
              onMoveToList={finder.moveSavedProduct}
              onOpenProduct={handleOpenProduct}
            />
          </div>
        )}
      </div>

      {/* Chat sidebar (desktop) */}
      <AnimatePresence>
        {viewMode === 'search' && (
          <div className="hidden md:block border-l border-gray-800">
            <ChatSidebar
              messages={finder.chatMessages}
              currentProduct={finder.currentProduct}
              onSendMessage={finder.sendChatMessage}
              isLoading={finder.isChatLoading}
              isOpen={isChatOpen}
              onToggle={() => setIsChatOpen(!isChatOpen)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Mobile chat overlay */}
      <AnimatePresence>
        {isChatOpen && viewMode === 'search' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => setIsChatOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute bottom-0 left-0 right-0 h-[80vh] bg-gray-900 rounded-t-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatSidebar
                messages={finder.chatMessages}
                currentProduct={finder.currentProduct}
                onSendMessage={finder.sendChatMessage}
                isLoading={finder.isChatLoading}
                isOpen={true}
                onToggle={() => setIsChatOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
