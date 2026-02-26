'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';

interface ProductScanAnimationProps {
  isActive: boolean;
}

const PLACEHOLDER_PRODUCTS = [
  { w: '70%', pw: '30%' },
  { w: '85%', pw: '25%' },
  { w: '60%', pw: '35%' },
  { w: '75%', pw: '28%' },
  { w: '90%', pw: '32%' },
  { w: '65%', pw: '26%' },
  { w: '80%', pw: '30%' },
  { w: '55%', pw: '24%' },
];

function SkeletonCard({ index, isScanning }: { index: number; isScanning: boolean }) {
  const product = PLACEHOLDER_PRODUCTS[index % PLACEHOLDER_PRODUCTS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative p-4 rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden"
    >
      {/* Scanning highlight sweep */}
      {isScanning && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: index * 0.15 }}
        />
      )}

      <div className="flex gap-3">
        {/* Image placeholder */}
        <div className="w-14 h-14 rounded-lg bg-gray-800 flex-shrink-0 animate-pulse" />

        <div className="flex-1 space-y-2 min-w-0">
          {/* Title */}
          <div
            className="h-3.5 rounded bg-gray-800 animate-pulse"
            style={{ width: product.w }}
          />
          <div className="h-3 rounded bg-gray-800/60 animate-pulse" style={{ width: '45%' }} />

          {/* Price */}
          <div
            className="h-3 rounded bg-gray-800 animate-pulse"
            style={{ width: product.pw }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function ProductScanAnimation({ isActive }: ProductScanAnimationProps) {
  const [scanCount, setScanCount] = useState(0);
  const [visibleCards, setVisibleCards] = useState([0, 1, 2, 3, 4]);

  // Increment scan count
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setScanCount(prev => prev + Math.floor(Math.random() * 8) + 3);
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  // Cycle cards
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setVisibleCards(prev => {
        const next = [...prev];
        next.shift();
        next.push((next[next.length - 1] + 1) % 100);
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/20 mb-4"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Search className="w-6 h-6 text-orange-400" />
        </motion.div>
        <p className="text-sm text-gray-400">
          Scanning{' '}
          <motion.span
            key={scanCount}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-orange-400 font-medium"
          >
            {scanCount}
          </motion.span>{' '}
          products...
        </p>
      </div>

      {/* Card feed */}
      <div className="w-full max-w-sm space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleCards.map((cardIndex, i) => (
            <SkeletonCard
              key={cardIndex}
              index={cardIndex}
              isScanning={i === 1 || i === 2}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
