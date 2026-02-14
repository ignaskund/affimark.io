'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Sparkles, Link2, Tag } from 'lucide-react';

interface FinderInputProps {
  onSearch: (input: string, type: 'url' | 'category') => void;
  isLoading: boolean;
  disabled?: boolean;
}

const exampleSearches = [
  'wireless headphones under €200',
  'sustainable yoga mats',
  'minimalist watches for men',
  'organic skincare sets',
  'ergonomic office chairs',
  'vegan protein powder',
];

export default function FinderInput({
  onSearch,
  isLoading,
  disabled = false,
}: FinderInputProps) {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'url' | 'category'>('category');

  // Detect if input is a URL
  const detectInputType = (value: string): 'url' | 'category' => {
    try {
      new URL(value);
      return 'url';
    } catch {
      return value.startsWith('http') ? 'url' : 'category';
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setInputType(detectInputType(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSearch(input.trim(), inputType);
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    setInputType('category');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        {/* Input container */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/50 via-amber-500/50 to-orange-500/50 rounded-2xl blur opacity-30 group-hover:opacity-50 group-focus-within:opacity-75 transition duration-500" />

          <div className="relative flex items-center bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Icon */}
            <div className="flex-shrink-0 pl-4">
              {inputType === 'url' ? (
                <Link2 className="w-5 h-5 text-blue-400" />
              ) : (
                <Search className="w-5 h-5 text-orange-400" />
              )}
            </div>

            {/* Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Enter product URL or describe what you're looking for..."
              className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-base px-4 h-14 focus:outline-none"
              disabled={isLoading || disabled}
            />

            {/* Type indicator */}
            <div className="flex-shrink-0 pr-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                inputType === 'url'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-orange-500/20 text-orange-400'
              }`}>
                {inputType === 'url' ? 'URL' : 'Search'}
              </span>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading || disabled}
              className="flex-shrink-0 h-14 px-6 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Find Best</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Example searches */}
      {!input && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Try searching for:
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleSearches.slice(0, 4).map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 hover:text-gray-300 hover:border-gray-600 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Input type help text */}
      {input && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-gray-500"
        >
          {inputType === 'url' ? (
            <>We'll analyze this product and find better alternatives based on your priorities.</>
          ) : (
            <>We'll search for the best products in this category that match your priorities.</>
          )}
        </motion.p>
      )}
    </div>
  );
}
