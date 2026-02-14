/**
 * Alternatives Ranker for Product Verifier
 *
 * Ranks candidates using weighted scoring based on rank_mode.
 * Generates compact tags for each alternative.
 * Filters out items with hard-stop flags from winner eligibility.
 */

import { RankMode, getWeightsForMode, type RankWeights } from './intent-router';

// --- Types ---

export interface RankerCandidate {
  id: string;
  title: string;
  brand: string;
  category: string;
  merchant: string;
  network: string;

  // Scores (0-100)
  product_viability: number;
  offer_merchant: number;
  economics: number;

  // Economics details
  commission_rate_low: number;
  commission_rate_high: number;
  cookie_days: number;
  avg_conversion_rate: number | null;
  avg_order_value: number | null;
  refund_rate: number | null;

  // Coverage & confidence
  coverage: number; // 0-1
  confidence: 'LOW' | 'MED' | 'HIGH';

  // Risk
  hard_stop_flags: string[];
  risk_score: number; // 0-1, higher = more risk

  // Trend (optional)
  trend_score: number | null; // 0-1
  trend_eligible: boolean;

  // Price info
  price_low: number | null;
  price_high: number | null;
  currency: string;
}

export interface RankedAlternative extends RankerCandidate {
  rank_score: number;
  tags: string[];
  winner_eligible: boolean;
  bucket_hint: 'safe' | 'upside' | 'budget' | 'trending' | null;
}

export interface RankerOutput {
  ranked: RankedAlternative[];
  winner: RankedAlternative | null;
  mode: RankMode;
}

// --- Tag Thresholds ---

const TAG_THRESHOLDS = {
  trusted_merchant: { offer_merchant: 75 },
  strong_demand: { product_viability: 75 },
  high_margin: { economics: 80 },
  high_aov: { avg_order_value: 100 },
  low_aov: { avg_order_value: 30 },
  long_cookie: { cookie_days: 60 },
  short_cookie: { cookie_days: 14 },
  verified_program: { confidence: 'HIGH' },
  low_proof: { coverage: 0.4 },
  refund_risk: { refund_rate: 0.10 },
  trending: { trend_eligible: true, trend_score: 0.6 },
  budget_friendly: { price_percentile: 0.25 }, // Bottom 25% of category
  premium: { price_percentile: 0.75 }, // Top 25% of category
};

// --- Main Ranker ---

export function rankAlternatives(
  candidates: RankerCandidate[],
  mode: RankMode,
  categoryStats?: CategoryStats
): RankerOutput {
  const weights = getWeightsForMode(mode);

  // Score and tag each candidate
  const scored = candidates.map(candidate => {
    const rank_score = calculateRankScore(candidate, weights);
    const tags = generateTags(candidate, categoryStats);
    const winner_eligible = isWinnerEligible(candidate);
    const bucket_hint = determineBucketHint(candidate, categoryStats);

    return {
      ...candidate,
      rank_score,
      tags,
      winner_eligible,
      bucket_hint,
    };
  });

  // Sort by rank score (descending)
  scored.sort((a, b) => b.rank_score - a.rank_score);

  // Find winner (highest rank score that is winner_eligible)
  const winner = scored.find(s => s.winner_eligible) || null;

  return {
    ranked: scored,
    winner,
    mode,
  };
}

// --- Rank Score Calculation ---

function calculateRankScore(candidate: RankerCandidate, weights: RankWeights): number {
  // Normalize scores to 0-1
  const pv = candidate.product_viability / 100;
  const om = candidate.offer_merchant / 100;
  const ec = candidate.economics / 100;
  const trend = candidate.trend_score || 0;
  const coverage = candidate.coverage;
  const risk = candidate.risk_score;

  // Weighted sum
  const score =
    weights.product_viability * pv +
    weights.offer_merchant * om +
    weights.economics * ec +
    weights.trend * trend +
    weights.coverage * coverage -
    weights.risk_penalty * risk;

  // Normalize to 0-100
  return Math.round(Math.max(0, Math.min(100, score * 100)));
}

// --- Winner Eligibility ---

function isWinnerEligible(candidate: RankerCandidate): boolean {
  // Cannot be winner if has hard-stop flags
  if (candidate.hard_stop_flags.length > 0) return false;

  // Cannot be winner if coverage too low
  if (candidate.coverage < 0.3) return false;

  // Cannot be winner if any pillar is critically low
  if (candidate.product_viability < 30) return false;
  if (candidate.offer_merchant < 30) return false;
  if (candidate.economics < 25) return false;

  return true;
}

// --- Tag Generation ---

function generateTags(
  candidate: RankerCandidate,
  categoryStats?: CategoryStats
): string[] {
  const tags: string[] = [];

  // Trust tags
  if (candidate.offer_merchant >= TAG_THRESHOLDS.trusted_merchant.offer_merchant) {
    tags.push('Trusted merchant');
  }

  // Demand tags
  if (candidate.product_viability >= TAG_THRESHOLDS.strong_demand.product_viability) {
    tags.push('Strong demand');
  }

  // Economics tags
  if (candidate.economics >= TAG_THRESHOLDS.high_margin.economics) {
    tags.push('High margin');
  }

  if (candidate.avg_order_value && candidate.avg_order_value >= TAG_THRESHOLDS.high_aov.avg_order_value) {
    tags.push('High AOV');
  }

  if (candidate.cookie_days >= TAG_THRESHOLDS.long_cookie.cookie_days) {
    tags.push('Long cookie');
  } else if (candidate.cookie_days <= TAG_THRESHOLDS.short_cookie.cookie_days) {
    tags.push('Short cookie');
  }

  // Confidence tags
  if (candidate.confidence === 'HIGH') {
    tags.push('Program verified');
  }

  // Warning tags
  if (candidate.coverage < TAG_THRESHOLDS.low_proof.coverage) {
    tags.push('Low proof');
  }

  if (candidate.refund_rate && candidate.refund_rate >= TAG_THRESHOLDS.refund_risk.refund_rate) {
    tags.push('Refund risk');
  }

  // Trend tags
  if (candidate.trend_eligible && candidate.trend_score && candidate.trend_score >= TAG_THRESHOLDS.trending.trend_score) {
    tags.push('Trending');
  }

  // Price tags (relative to category)
  if (categoryStats && candidate.price_low !== null) {
    const pricePercentile = calculatePricePercentile(candidate.price_low, categoryStats);
    if (pricePercentile <= TAG_THRESHOLDS.budget_friendly.price_percentile) {
      tags.push('Budget-friendly');
    } else if (pricePercentile >= TAG_THRESHOLDS.premium.price_percentile) {
      tags.push('Premium');
    }
  }

  // Limit to most relevant tags
  return tags.slice(0, 4);
}

// --- Bucket Hint Determination ---

function determineBucketHint(
  candidate: RankerCandidate,
  categoryStats?: CategoryStats
): 'safe' | 'upside' | 'budget' | 'trending' | null {
  // Trending takes precedence if eligible and strong
  if (candidate.trend_eligible && candidate.trend_score && candidate.trend_score >= 0.6) {
    return 'trending';
  }

  // Safe: high trust + low risk
  if (
    candidate.offer_merchant >= 70 &&
    candidate.risk_score < 0.3 &&
    candidate.product_viability >= 60
  ) {
    return 'safe';
  }

  // Upside: high economics or high AOV
  if (
    candidate.economics >= 75 ||
    (candidate.avg_order_value && candidate.avg_order_value >= 100)
  ) {
    // But not if risk is too high
    if (candidate.risk_score < 0.5) {
      return 'upside';
    }
  }

  // Budget: lower price, adequate quality
  if (categoryStats && candidate.price_low !== null) {
    const pricePercentile = calculatePricePercentile(candidate.price_low, categoryStats);
    if (
      pricePercentile <= 0.35 &&
      candidate.product_viability >= 50 &&
      candidate.refund_rate !== null &&
      candidate.refund_rate < 0.10
    ) {
      return 'budget';
    }
  }

  return null;
}

// --- Helper Types & Functions ---

interface CategoryStats {
  median_price: number;
  price_p25: number;
  price_p75: number;
  median_aov: number;
  avg_commission: number;
}

function calculatePricePercentile(price: number, stats: CategoryStats): number {
  if (price <= stats.price_p25) return 0.25;
  if (price >= stats.price_p75) return 0.75;

  // Linear interpolation between p25 and p75
  const range = stats.price_p75 - stats.price_p25;
  const position = price - stats.price_p25;
  return 0.25 + (position / range) * 0.5;
}

// --- Re-rank with Different Mode ---

export function rerankWithMode(
  previousRanked: RankedAlternative[],
  newMode: RankMode,
  categoryStats?: CategoryStats
): RankerOutput {
  // Convert back to candidates and re-rank
  const candidates: RankerCandidate[] = previousRanked.map(r => ({
    id: r.id,
    title: r.title,
    brand: r.brand,
    category: r.category,
    merchant: r.merchant,
    network: r.network,
    product_viability: r.product_viability,
    offer_merchant: r.offer_merchant,
    economics: r.economics,
    commission_rate_low: r.commission_rate_low,
    commission_rate_high: r.commission_rate_high,
    cookie_days: r.cookie_days,
    avg_conversion_rate: r.avg_conversion_rate,
    avg_order_value: r.avg_order_value,
    refund_rate: r.refund_rate,
    coverage: r.coverage,
    confidence: r.confidence,
    hard_stop_flags: r.hard_stop_flags,
    risk_score: r.risk_score,
    trend_score: r.trend_score,
    trend_eligible: r.trend_eligible,
    price_low: r.price_low,
    price_high: r.price_high,
    currency: r.currency,
  }));

  return rankAlternatives(candidates, newMode, categoryStats);
}
