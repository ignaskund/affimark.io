'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import ProductCard from './ProductCard';
import type { AlternativeProduct } from '@/types/finder';

interface CardStackProps {
  products: AlternativeProduct[];
  currentIndex: number;
  onSave: (product: AlternativeProduct, listType: 'saved' | 'try_first' | 'content_calendar') => void;
  onSkip: (product: AlternativeProduct) => void;
  onAskAbout: (product: AlternativeProduct, question: string) => void;
  onIndexChange: (index: number) => void;
  isLoading?: boolean;
}

export default function CardStack({
  products,
  currentIndex,
  onSave,
  onSkip,
  onAskAbout,
  onIndexChange,
  isLoading = false,
}: CardStackProps) {
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Visual indicators for swipe direction
  const leftIndicatorOpacity = useTransform(x, [-200, -50, 0], [1, 0.5, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 50, 200], [0, 0.5, 1]);

  const currentProduct = products[currentIndex];

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const threshold = 100;

      if (info.offset.x > threshold) {
        // Swiped right = Save (Tinder-style)
        setExitDirection('right');
        onSave(currentProduct, 'saved');
      } else if (info.offset.x < -threshold) {
        // Swiped left = Skip
        setExitDirection('left');
        onSkip(currentProduct);
      }
    },
    [currentProduct, onSave, onSkip]
  );

  const handleSave = useCallback(
    (listType: 'saved' | 'try_first' | 'content_calendar') => {
      setExitDirection('right');
      onSave(currentProduct, listType);
    },
    [currentProduct, onSave]
  );

  const handleSkip = useCallback(() => {
    setExitDirection('left');
    onSkip(currentProduct);
  }, [currentProduct, onSkip]);

  const handleAskAbout = useCallback(
    (question: string) => {
      onAskAbout(currentProduct, question);
    },
    [currentProduct, onAskAbout]
  );

  // Navigate to specific card (for review mode)
  const goToCard = (index: number) => {
    if (index >= 0 && index < products.length) {
      onIndexChange(index);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-4" />
        <p className="text-gray-400">Finding the best products for you...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl mb-4">🔍</span>
        <h3 className="text-xl font-semibold text-white mb-2">No products yet</h3>
        <p className="text-gray-400 max-w-sm">
          Enter a product URL or search for a category to find the best products for you.
        </p>
      </div>
    );
  }

  if (currentIndex >= products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl mb-4">✨</span>
        <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
        <p className="text-gray-400 max-w-sm mb-4">
          You've reviewed all {products.length} products. Check your saved list or search for more.
        </p>
        <button
          onClick={() => onIndexChange(0)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
        >
          Review again
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Swipe direction indicators */}
      <motion.div
        style={{ opacity: leftIndicatorOpacity }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 px-4 py-2 rounded-full bg-red-500/80 text-white font-bold"
      >
        SKIP
      </motion.div>
      <motion.div
        style={{ opacity: rightIndicatorOpacity }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 px-4 py-2 rounded-full bg-emerald-500/80 text-white font-bold"
      >
        SAVE
      </motion.div>

      {/* Card stack */}
      <div className="relative h-[600px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentProduct.id}
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              x: exitDirection === 'left' ? -300 : exitDirection === 'right' ? 300 : 0,
              opacity: 0,
              transition: { duration: 0.2 },
            }}
            className="absolute cursor-grab active:cursor-grabbing"
          >
            <ProductCard
              product={currentProduct}
              onSave={handleSave}
              onSkip={handleSkip}
              onAskAbout={handleAskAbout}
              isActive={true}
            />
          </motion.div>
        </AnimatePresence>

        {/* Background cards preview */}
        {products[currentIndex + 1] && (
          <div className="absolute transform scale-95 opacity-50 -z-10">
            <div className="w-full max-w-md h-[500px] rounded-2xl bg-gray-800 border border-gray-700" />
          </div>
        )}
        {products[currentIndex + 2] && (
          <div className="absolute transform scale-90 opacity-25 -z-20">
            <div className="w-full max-w-md h-[500px] rounded-2xl bg-gray-800 border border-gray-700" />
          </div>
        )}
      </div>

      {/* Progress and navigation */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <button
          onClick={() => goToCard(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {currentIndex + 1} of {products.length}
          </span>
          {/* Progress dots */}
          <div className="flex gap-1">
            {products.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => goToCard(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex
                    ? 'bg-orange-500'
                    : i < currentIndex
                      ? 'bg-emerald-500/50'
                      : 'bg-gray-700'
                }`}
              />
            ))}
            {products.length > 10 && (
              <span className="text-xs text-gray-500">+{products.length - 10}</span>
            )}
          </div>
        </div>

        <button
          onClick={() => goToCard(currentIndex + 1)}
          disabled={currentIndex >= products.length - 1}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Swipe instructions */}
      <p className="text-center text-xs text-gray-500 mt-3">
        Swipe right to save • Swipe left to skip • Right-click for more options
      </p>
    </div>
  );
}
