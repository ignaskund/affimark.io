'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bookmark,
  MessageSquare,
  AlertCircle,
  X,
  Link2,
  Sparkles,
  Tag,
  Loader2,
  ArrowRight,
  HelpCircle,
  Users,
  ShoppingBag,
} from 'lucide-react';
import { useFinder } from '@/hooks/useFinder';
import CardStack from './CardStack';
import ChatPanel from './ChatPanel';
import ProductScanAnimation from './ProductScanAnimation';
import ProductRiskCard from './ProductRiskCard';
import type { AlternativeProduct, SavedProduct } from '@/types/finder';

interface ProductFinderProps {
  userId: string;
  prefillUrl?: string;
}

type FinderViewState = 'initial' | 'searching' | 'results';

const exampleSearches = [
  'organic skincare sets',
  'wireless headphones under €200',
  'sustainable yoga mats',
  'minimalist watches',
];

function detectInputType(value: string): 'url' | 'category' {
  try {
    new URL(value);
    return 'url';
  } catch {
    return value.startsWith('http') ? 'url' : 'category';
  }
}

export default function ProductFinder({ userId, prefillUrl }: ProductFinderProps) {
  const router = useRouter();
  const finder = useFinder({ userId });
  const [input, setInput] = useState(prefillUrl || '');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [productNameInput, setProductNameInput] = useState('');

  // Auto-trigger search when prefillUrl is provided (e.g. from portfolio audit "Find Alternative")
  useEffect(() => {
    if (!prefillUrl) return;
    // Small delay to let useFinder load user context first
    const timer = setTimeout(() => {
      finder.search(prefillUrl, 'url');
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewState: FinderViewState = useMemo(() => {
    if (finder.isSearching) return 'searching';
    if (finder.alternatives.length > 0) return 'results';
    return 'initial';
  }, [finder.isSearching, finder.alternatives.length]);

  const inputType = detectInputType(input);

  const handleSearch = (searchInput: string, type: 'url' | 'category') => {
    finder.search(searchInput, type);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || finder.isSearching) return;
    handleSearch(input.trim(), inputType);
    setInput('');
  };

  const handleSave = (product: AlternativeProduct, listType: 'saved' | 'try_first' | 'content_calendar') => {
    finder.saveProduct(product, listType);
  };

  const handleSkip = (product: AlternativeProduct) => {
    finder.skipProduct(product);
  };

  const handleAskAbout = (_product: AlternativeProduct, question: string) => {
    setIsChatOpen(true);
    finder.sendChatMessage(question);
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Saved products button */}
      {viewState !== 'initial' && (
        <button
          onClick={() => router.push('/dashboard/product-finder/saved')}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/80 backdrop-blur text-gray-300 text-sm hover:bg-gray-700 transition-colors"
        >
          <Bookmark className="w-4 h-4" />
          Saved{finder.savedProducts.length > 0 && ` (${finder.savedProducts.length})`}
        </button>
      )}

      {/* Error display */}
      <AnimatePresence>
        {finder.error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-20 z-20 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{finder.error}</p>
              </div>
              <button onClick={finder.clearError} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== INITIAL STATE: Centered chat-style input ===== */}
      {viewState === 'initial' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl space-y-8">
            {/* Heading */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-700 to-orange-600 shadow-lg shadow-orange-500/20">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                What product are you looking for?
              </h1>
              <p className="text-gray-400 text-lg">
                Paste a product URL or describe what you need
              </p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit}>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/40 via-amber-500/40 to-orange-500/40 rounded-2xl blur opacity-30 group-hover:opacity-50 group-focus-within:opacity-75 transition duration-500" />
                <div className="relative flex items-center bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                  <div className="flex-shrink-0 pl-4">
                    {inputType === 'url' ? (
                      <Link2 className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Search className="w-5 h-5 text-orange-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter product URL or describe what you're looking for..."
                    className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-base px-4 h-14 focus:outline-none"
                    autoFocus
                  />
                  {input && (
                    <span className={`flex-shrink-0 mr-2 px-2 py-1 rounded text-xs font-medium ${
                      inputType === 'url'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {inputType === 'url' ? 'URL' : 'Search'}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex-shrink-0 h-14 px-6 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Find</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Example searches */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Tag className="w-3 h-3" />
                Try searching for:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {exampleSearches.map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setInput(example);
                    }}
                    className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 hover:text-gray-300 hover:border-gray-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Product identification failed — ask for product name */}
            {finder.needsProductName && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-blue-500/10 border border-blue-500/30"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-300 font-medium">
                      We found your URL, but couldn't identify the product
                    </p>
                    <p className="text-xs text-blue-400/70 mt-1 mb-3">
                      Amazon blocks automated lookups. Just tell us what the product is and we'll find the best alternatives for you.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={productNameInput}
                        onChange={(e) => setProductNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && productNameInput.trim()) {
                            finder.search(productNameInput.trim(), 'category');
                            setProductNameInput('');
                          }
                        }}
                        placeholder="e.g. Sony WH-1000XM5 headphones, lavender essential oil..."
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (productNameInput.trim()) {
                            finder.search(productNameInput.trim(), 'category');
                            setProductNameInput('');
                          }
                        }}
                        disabled={!productNameInput.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Search
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* No priorities warning */}
            {finder.productPriorities.length === 0 && !finder.needsProductName && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">
                      Set your priorities for better results
                    </p>
                    <p className="text-xs text-amber-400/70 mt-1">
                      Without priorities, we can't personalize recommendations.
                    </p>
                    <button
                      onClick={() => router.push('/onboarding/priorities')}
                      className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
                    >
                      Set priorities →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Profile incomplete nudge — show when priorities set but no social/storefront data */}
            {finder.productPriorities.length > 0 &&
              finder.availableSocials.length === 0 &&
              finder.availableStorefronts.length === 0 &&
              !finder.needsProductName && (
              <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300 font-medium">
                      Connect your accounts for deeper personalization
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your priorities are set. Adding social accounts and storefronts unlocks audience-matched recommendations.
                    </p>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => router.push('/social-accounts')}
                        className="text-xs text-gray-400 hover:text-gray-300 underline"
                      >
                        Connect socials
                      </button>
                      <button
                        onClick={() => router.push('/storefronts')}
                        className="text-xs text-gray-400 hover:text-gray-300 underline"
                      >
                        Add storefronts
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SEARCHING / RESULTS STATE: Split view ===== */}
      {(viewState === 'searching' || viewState === 'results') && (
        <>
          {/* Desktop: Side-by-side */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Left: Chat panel */}
            <div className="w-[400px] flex-shrink-0 border-r border-gray-800">
              <ChatPanel
                messages={finder.chatMessages}
                currentProduct={finder.currentProduct}
                onSendMessage={finder.sendChatMessage}
                onNewSearch={handleSearch}
                isLoading={finder.isChatLoading}
                isSearching={finder.isSearching}
                searchQuery={finder.lastSearchInput}
                availableSocials={finder.availableSocials}
                availableStorefronts={finder.availableStorefronts}
                activeContext={finder.activeContext}
                onContextChange={finder.updateActiveContext}
                onEditPriorities={() => router.push('/settings')}
              />
            </div>

            {/* Right: Products or scanning */}
            <div className="flex-1 overflow-hidden">
              {viewState === 'searching' ? (
                <ProductScanAnimation isActive={true} />
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Original product risk card */}
                    {finder.originalProductRisk && finder.originalSearchProduct && (
                      <ProductRiskCard
                        productTitle={finder.originalSearchProduct.title}
                        productPrice={finder.originalSearchProduct.price}
                        productCurrency={finder.originalSearchProduct.currency}
                        risk={finder.originalProductRisk}
                      />
                    )}
                    <CardStack
                      products={finder.alternatives}
                      currentIndex={finder.currentIndex}
                      onSave={handleSave}
                      onSkip={handleSkip}
                      onAskAbout={handleAskAbout}
                      onIndexChange={finder.goToIndex}
                      isLoading={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Stacked layout */}
          <div className="md:hidden flex-1 flex flex-col overflow-hidden">
            {/* Mobile: Products / scanning */}
            <div className="flex-1 overflow-y-auto">
              {viewState === 'searching' ? (
                <ProductScanAnimation isActive={true} />
              ) : (
                <div className="p-4">
                  <CardStack
                    products={finder.alternatives}
                    currentIndex={finder.currentIndex}
                    onSave={handleSave}
                    onSkip={handleSkip}
                    onAskAbout={handleAskAbout}
                    onIndexChange={finder.goToIndex}
                    isLoading={false}
                  />
                </div>
              )}
            </div>

            {/* Mobile: Chat toggle */}
            {viewState === 'results' && (
              <button
                onClick={() => setIsChatOpen(true)}
                className="m-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm"
              >
                <MessageSquare className="w-4 h-4 text-orange-400" />
                Ask about this product
                {finder.chatMessages.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs">
                    {finder.chatMessages.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Mobile chat overlay */}
          <AnimatePresence>
            {isChatOpen && (
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
                  className="absolute bottom-0 left-0 right-0 h-[85vh] bg-gray-900 rounded-t-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-700" />
                  </div>
                  <ChatPanel
                    messages={finder.chatMessages}
                    currentProduct={finder.currentProduct}
                    onSendMessage={finder.sendChatMessage}
                    onNewSearch={handleSearch}
                    isLoading={finder.isChatLoading}
                    isSearching={finder.isSearching}
                    searchQuery={finder.lastSearchInput}
                    availableSocials={finder.availableSocials}
                    availableStorefronts={finder.availableStorefronts}
                    activeContext={finder.activeContext}
                    onContextChange={finder.updateActiveContext}
                    onEditPriorities={() => router.push('/settings')}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
