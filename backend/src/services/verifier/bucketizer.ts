/**
 * Bucketizer for Product Verifier
 *
 * Groups ranked alternatives into meaningful buckets:
 * - Safe pick: High trust, low risk
 * - Higher upside: Better economics, acceptable risk
 * - Budget-friendly: Lower price, good conversion potential
 * - Trending now: High trend signals (optional, only when eligible)
 *
 * Ensures each bucket has 2-3 items for a decision-ready shortlist.
 */

import type { RankedAlternative } from './alternatives-ranker';

// --- Types ---

export type BucketKey = 'safe' | 'upside' | 'budget' | 'trending';

export interface Bucket {
  key: BucketKey;
  title: string;
  description: string;
  items: RankedAlternative[];
  eligible: boolean;
}

export interface BucketizerOutput {
  winner: RankedAlternative | null;
  buckets: Bucket[];
  total_candidates: number;
  overflow: RankedAlternative[]; // Items that didn't fit in buckets
}

export interface BucketizerConfig {
  items_per_bucket: number;
  show_trending: boolean;
  bucket_strategy: 'standard' | 'conservative' | 'aggressive';
}

// --- Bucket Definitions ---

const BUCKET_DEFS: Record<BucketKey, { title: string; description: string }> = {
  safe: {
    title: 'Safe pick',
    description: 'Trusted brands with proven track records',
  },
  upside: {
    title: 'Higher upside',
    description: 'Better margins or AOV, moderate risk',
  },
  budget: {
    title: 'Budget-friendly',
    description: 'Lower price point, high conversion potential',
  },
  trending: {
    title: 'Trending now',
    description: 'Rising popularity in this category',
  },
};

// --- Default Config ---

const DEFAULT_CONFIG: BucketizerConfig = {
  items_per_bucket: 3,
  show_trending: true,
  bucket_strategy: 'standard',
};

// --- Main Bucketizer ---

export function bucketize(
  ranked: RankedAlternative[],
  winner: RankedAlternative | null,
  config: Partial<BucketizerConfig> = {}
): BucketizerOutput {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Exclude winner from bucket candidates
  const candidates = winner
    ? ranked.filter(r => r.id !== winner.id)
    : ranked;

  // Initialize buckets
  const buckets: Record<BucketKey, RankedAlternative[]> = {
    safe: [],
    upside: [],
    budget: [],
    trending: [],
  };

  // Track which items are already assigned
  const assigned = new Set<string>();

  // First pass: assign items based on bucket_hint from ranker
  for (const item of candidates) {
    if (assigned.has(item.id)) continue;
    if (item.bucket_hint && buckets[item.bucket_hint].length < cfg.items_per_bucket) {
      buckets[item.bucket_hint].push(item);
      assigned.add(item.id);
    }
  }

  // Second pass: fill buckets that are underfilled using scoring thresholds
  fillBucketByScore(buckets.safe, candidates, assigned, cfg.items_per_bucket, isSafeCandidate);
  fillBucketByScore(buckets.upside, candidates, assigned, cfg.items_per_bucket, isUpsideCandidate);
  fillBucketByScore(buckets.budget, candidates, assigned, cfg.items_per_bucket, isBudgetCandidate);

  if (cfg.show_trending) {
    fillBucketByScore(buckets.trending, candidates, assigned, cfg.items_per_bucket, isTrendingCandidate);
  }

  // Apply strategy adjustments
  if (cfg.bucket_strategy === 'conservative') {
    // Only show safe bucket prominently
    buckets.upside = buckets.upside.slice(0, 2);
    buckets.budget = buckets.budget.slice(0, 2);
  } else if (cfg.bucket_strategy === 'aggressive') {
    // Favor upside bucket
    // No changes needed, already filled
  }

  // Build output buckets
  const outputBuckets: Bucket[] = [
    {
      ...BUCKET_DEFS.safe,
      key: 'safe',
      items: buckets.safe,
      eligible: buckets.safe.length > 0,
    },
    {
      ...BUCKET_DEFS.upside,
      key: 'upside',
      items: buckets.upside,
      eligible: buckets.upside.length > 0,
    },
    {
      ...BUCKET_DEFS.budget,
      key: 'budget',
      items: buckets.budget,
      eligible: buckets.budget.length > 0,
    },
  ];

  // Only add trending if eligible and has items
  if (cfg.show_trending && buckets.trending.length > 0) {
    outputBuckets.push({
      ...BUCKET_DEFS.trending,
      key: 'trending',
      items: buckets.trending,
      eligible: true,
    });
  }

  // Collect overflow (items not in any bucket)
  const overflow = candidates.filter(c => !assigned.has(c.id));

  return {
    winner,
    buckets: outputBuckets.filter(b => b.eligible),
    total_candidates: ranked.length,
    overflow,
  };
}

// --- Bucket Candidate Checks ---

function isSafeCandidate(item: RankedAlternative): boolean {
  return (
    item.offer_merchant >= 65 &&
    item.risk_score < 0.35 &&
    item.product_viability >= 55 &&
    item.hard_stop_flags.length === 0
  );
}

function isUpsideCandidate(item: RankedAlternative): boolean {
  return (
    item.economics >= 70 ||
    (item.avg_order_value !== null && item.avg_order_value >= 80)
  ) && item.risk_score < 0.5;
}

function isBudgetCandidate(item: RankedAlternative): boolean {
  // Lower price (indicated by tags or bucket_hint)
  const hasBudgetTag = item.tags.includes('Budget-friendly');
  const hasGoodDemand = item.product_viability >= 50;
  const lowRefundRisk = item.refund_rate === null || item.refund_rate < 0.10;

  return hasBudgetTag || (hasGoodDemand && lowRefundRisk && item.economics >= 50);
}

function isTrendingCandidate(item: RankedAlternative): boolean {
  return (
    item.trend_eligible &&
    item.trend_score !== null &&
    item.trend_score >= 0.5 &&
    item.coverage >= 0.5
  );
}

// --- Helper: Fill Bucket by Score ---

function fillBucketByScore(
  bucket: RankedAlternative[],
  candidates: RankedAlternative[],
  assigned: Set<string>,
  maxItems: number,
  checkFn: (item: RankedAlternative) => boolean
): void {
  if (bucket.length >= maxItems) return;

  // Get eligible candidates sorted by rank_score
  const eligible = candidates
    .filter(c => !assigned.has(c.id) && checkFn(c))
    .sort((a, b) => b.rank_score - a.rank_score);

  for (const item of eligible) {
    if (bucket.length >= maxItems) break;
    bucket.push(item);
    assigned.add(item.id);
  }
}

// --- Utility: Get Summary for UI ---

export function getBucketsSummary(output: BucketizerOutput): {
  has_winner: boolean;
  bucket_count: number;
  total_shortlist: number;
  bucket_keys: BucketKey[];
} {
  const totalShortlist = output.buckets.reduce((sum, b) => sum + b.items.length, 0);

  return {
    has_winner: output.winner !== null,
    bucket_count: output.buckets.length,
    total_shortlist: totalShortlist,
    bucket_keys: output.buckets.map(b => b.key),
  };
}

// --- Create Empty Bucketizer Output (for error cases) ---

export function createEmptyBucketizerOutput(): BucketizerOutput {
  return {
    winner: null,
    buckets: [],
    total_candidates: 0,
    overflow: [],
  };
}
