'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Tag,
  Star,
  Leaf,
  Palette,
  Truck,
  Shield,
  Award,
  Percent,
  Headphones,
  RefreshCw,
  BadgeCheck,
  Globe,
  CreditCard,
  Clock,
  CheckCircle,
  Info,
  GripVertical,
} from 'lucide-react';
import type { PriorityOption as PriorityOptionType } from '@/types/finder';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'shield-check': ShieldCheck,
  'tag': Tag,
  'star': Star,
  'leaf': Leaf,
  'palette': Palette,
  'truck': Truck,
  'shield': Shield,
  'award': Award,
  'percent': Percent,
  'headphones': Headphones,
  'refresh-cw': RefreshCw,
  'badge-check': BadgeCheck,
  'globe': Globe,
  'credit-card': CreditCard,
  'clock': Clock,
  'check-circle': CheckCircle,
};

interface PriorityOptionProps {
  option: PriorityOptionType;
  isSelected: boolean;
  rank?: number;
  onSelect: () => void;
  isDragging?: boolean;
  showDragHandle?: boolean;
}

export default function PriorityOption({
  option,
  isSelected,
  rank,
  onSelect,
  isDragging = false,
  showDragHandle = false,
}: PriorityOptionProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = iconMap[option.icon] || CheckCircle;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: isDragging ? 1.05 : 1,
        boxShadow: isDragging ? '0 10px 40px rgba(0,0,0,0.3)' : '0 0 0 rgba(0,0,0,0)',
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={`
        relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer
        transition-colors select-none
        ${isSelected
          ? 'bg-orange-500/20 border-orange-500/50 text-white'
          : 'bg-gray-900/50 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900/70'
        }
        ${isDragging ? 'z-50' : ''}
      `}
      onClick={onSelect}
    >
      {/* Drag handle (when in ranked list) */}
      {showDragHandle && (
        <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-500">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Rank badge */}
      {rank && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">
          {rank}
        </div>
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isSelected ? 'bg-orange-500/30' : 'bg-gray-800'
      }`}>
        <Icon className={`w-5 h-5 ${isSelected ? 'text-orange-400' : 'text-gray-400'}`} />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{option.label}</div>
      </div>

      {/* Info tooltip trigger */}
      <div
        className="flex-shrink-0 relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
      >
        <Info className="w-4 h-4 text-gray-500 hover:text-gray-400 transition-colors" />

        {/* Tooltip */}
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute right-0 top-full mt-2 z-50 w-64 p-3 rounded-lg bg-gray-800 border border-gray-700 shadow-xl"
          >
            <div className="text-sm text-gray-300">{option.description}</div>
            <div className="absolute -top-1.5 right-2 w-3 h-3 bg-gray-800 border-l border-t border-gray-700 rotate-45" />
          </motion.div>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && !rank && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex-shrink-0"
        >
          <CheckCircle className="w-5 h-5 text-orange-400" />
        </motion.div>
      )}
    </motion.div>
  );
}
