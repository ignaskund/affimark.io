'use client';

import { Shield, TrendingUp, Wallet, Flame } from 'lucide-react';
import type { RankedAlternative, RecommendationBucket } from '@/types/verifier';

// --- Types ---

interface BucketsProps {
  buckets: RecommendationBucket[];
  onSelectItem: (id: string) => void;
}

// --- Bucket Icons ---

const BUCKET_ICONS: Record<string, typeof Shield> = {
  safe: Shield,
  upside: TrendingUp,
  budget: Wallet,
  trending: Flame,
};

const BUCKET_COLORS: Record<string, string> = {
  safe: 'text-blue-400',
  upside: 'text-amber-400',
  budget: 'text-green-400',
  trending: 'text-orange-400',
};

// --- Main Component ---

export default function RecommendationsBuckets({ buckets, onSelectItem }: BucketsProps) {
  if (buckets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No alternatives found for this category.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => (
        <BucketSection
          key={bucket.key}
          bucket={bucket}
          onSelectItem={onSelectItem}
        />
      ))}
    </div>
  );
}

// --- Bucket Section ---

function BucketSection({
  bucket,
  onSelectItem,
}: {
  bucket: RecommendationBucket;
  onSelectItem: (id: string) => void;
}) {
  const Icon = BUCKET_ICONS[bucket.key] || Shield;
  const iconColor = BUCKET_COLORS[bucket.key] || 'text-gray-400';

  return (
    <div>
      {/* Bucket Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className="text-sm font-medium text-white">{bucket.title}</h4>
        <span className="text-xs text-gray-500">({bucket.items.length})</span>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {bucket.items.map((item) => (
          <BucketItemCard
            key={item.id}
            item={item}
            onSelect={() => onSelectItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Bucket Item Card ---

function BucketItemCard({
  item,
  onSelect,
}: {
  item: RankedAlternative;
  onSelect: () => void;
}) {
  const commissionStr = item.commission_rate_low === item.commission_rate_high
    ? `${item.commission_rate_low}%`
    : `${item.commission_rate_low}-${item.commission_rate_high}%`;

  return (
    <button
      onClick={onSelect}
      className="text-left p-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/50 transition-all group"
    >
      {/* Brand & Score */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
          {item.brand}
        </span>
        <span className="text-xs text-gray-500">{item.rank_score}</span>
      </div>

      {/* Title (truncated) */}
      <p className="text-xs text-gray-400 line-clamp-1 mb-2">
        {item.title}
      </p>

      {/* Mini Bars (using flat scores from RankedAlternative) */}
      <div className="flex gap-1 mb-2">
        <MiniBar score={item.product_viability} />
        <MiniBar score={item.offer_merchant} />
        <MiniBar score={item.economics} />
      </div>

      {/* Commission & Cookie */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{commissionStr}</span>
        <span>•</span>
        <span>{item.cookie_days}d</span>
        <span className="ml-auto text-gray-600">{item.network}</span>
      </div>

      {/* Tags (max 2) */}
      {item.tags.length > 0 && (
        <div className="flex gap-1 mt-2">
          {item.tags.slice(0, 2).map((tag, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 text-[10px] rounded bg-gray-800 text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// --- Mini Score Bar ---

function MiniBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 60) return 'bg-green-500';
    if (score >= 45) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${getColor()}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}
