'use client';

import { motion } from 'framer-motion';
import type { PriorityAlignment } from '@/types/finder';

interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  alignment?: PriorityAlignment;
  expanded?: boolean;
}

export default function MatchScore({
  score,
  size = 'md',
  showLabel = true,
  alignment,
  expanded = false,
}: MatchScoreProps) {
  // Determine color based on score
  const getColor = (s: number) => {
    if (s >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (s >= 60) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' };
  };

  const colors = getColor(score);

  const sizeClasses = {
    sm: { container: 'text-sm', number: 'text-lg', dots: 'w-1.5 h-1.5 gap-0.5' },
    md: { container: 'text-base', number: 'text-2xl', dots: 'w-2 h-2 gap-1' },
    lg: { container: 'text-lg', number: 'text-4xl', dots: 'w-2.5 h-2.5 gap-1' },
  };

  const sizes = sizeClasses[size];

  // Calculate filled dots (out of 5)
  const filledDots = Math.round(score / 20);

  return (
    <div className={`${sizes.container}`}>
      <div className="flex items-center gap-3">
        {/* Score number */}
        <div className={`${sizes.number} font-bold ${colors.text}`}>
          {score}
        </div>

        {/* Dots indicator */}
        <div className={`flex items-center ${sizes.dots}`}>
          {[1, 2, 3, 4, 5].map((dot) => (
            <motion.div
              key={dot}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: dot * 0.05 }}
              className={`rounded-full ${sizes.dots.split(' ')[0]} ${sizes.dots.split(' ')[1]} ${
                dot <= filledDots ? colors.bg : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Label */}
        {showLabel && (
          <span className="text-gray-400 text-sm">
            {score >= 80 ? 'Great match' : score >= 60 ? 'Good match' : 'Fair match'}
          </span>
        )}
      </div>

      {/* Expanded alignment breakdown */}
      {expanded && alignment && Object.keys(alignment).length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-gray-800 space-y-2"
        >
          {Object.entries(alignment)
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 5)
            .map(([priorityId, data]) => {
              const pColor = getColor(data.score);
              return (
                <div key={priorityId} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-500 capitalize truncate">
                    {priorityId.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${data.score}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className={`h-full ${pColor.bg}`}
                    />
                  </div>
                  <div className={`w-8 text-xs font-medium ${pColor.text}`}>
                    {data.score}
                  </div>
                </div>
              );
            })}
        </motion.div>
      )}
    </div>
  );
}
