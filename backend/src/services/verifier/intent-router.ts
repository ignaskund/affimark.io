/**
 * Intent Router for Product Verifier
 *
 * Automatically determines what alternatives to show based on:
 * - Verdict and hard-stop flags
 * - Weakest pillar score
 * - Confidence/coverage level
 *
 * Replaces manual user selection of "same category vs same brand"
 * with intelligent automatic routing.
 */

// --- Types ---

export type RankMode = 'balanced' | 'demand_first' | 'trust_first' | 'economics_first';

export type PrimaryRoute = 'category_alternatives' | 'brand_alternatives' | 'test_first';

export type BucketStrategy = 'standard' | 'conservative' | 'aggressive';

export interface IntentRouterInput {
  verdict: 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST';
  hard_stop_flags: string[];
  scores: {
    product_viability: number;
    offer_merchant: number;
    economics: number;
  };
  confidence: 'LOW' | 'MED' | 'HIGH';
  coverage: number; // 0-1, percentage of non-fallback signals
  category: string | null;
}

export interface IntentRouterOutput {
  primary_route: PrimaryRoute;
  rank_mode: RankMode;
  bucket_strategy: BucketStrategy;
  show_trending: boolean;
  suppress_winner: boolean;
  banner: string | null;
  reason: string;
}

// --- Thresholds ---

const COVERAGE_THRESHOLD_FOR_WINNER = 0.4;
const COVERAGE_THRESHOLD_FOR_TRENDING = 0.6;
const CONFIDENCE_THRESHOLD_FOR_TRENDING = 'MED';
const WEAK_PILLAR_THRESHOLD = 50;
const VERY_WEAK_PILLAR_THRESHOLD = 35;

// --- Main Router ---

export function routeIntent(input: IntentRouterInput): IntentRouterOutput {
  const { verdict, hard_stop_flags, scores, confidence, coverage } = input;

  // Find weakest pillar
  const weakestPillar = findWeakestPillar(scores);

  // Determine primary route based on verdict
  let primary_route: PrimaryRoute = 'category_alternatives';
  let rank_mode: RankMode = 'balanced';
  let bucket_strategy: BucketStrategy = 'standard';
  let show_trending = false;
  let suppress_winner = false;
  let banner: string | null = null;
  let reason = '';

  // Route based on verdict
  if (verdict === 'TEST_FIRST' || confidence === 'LOW') {
    primary_route = 'test_first';
    suppress_winner = coverage < COVERAGE_THRESHOLD_FOR_WINNER;
    banner = 'Limited data available. Test before committing.';
    reason = 'Low confidence triggers test-first mode';

    // Still determine rank mode based on weakest pillar
    rank_mode = getRankModeFromWeakestPillar(weakestPillar);
    bucket_strategy = 'conservative';
  } else if (verdict === 'RED') {
    // Avoid verdict - route based on cause
    const cause = determineAvoidCause(hard_stop_flags, weakestPillar, scores);

    if (cause === 'demand') {
      rank_mode = 'demand_first';
      reason = 'Weak demand signals - prioritizing higher-demand alternatives';
    } else if (cause === 'merchant') {
      rank_mode = 'trust_first';
      reason = 'Merchant risk detected - prioritizing trusted brands';
    } else if (cause === 'economics') {
      rank_mode = 'economics_first';
      reason = 'Poor economics - prioritizing higher-margin programs';
    } else {
      rank_mode = 'balanced';
      reason = 'Multiple concerns - balanced alternative search';
    }

    primary_route = 'category_alternatives';
    bucket_strategy = 'standard';
  } else if (verdict === 'YELLOW') {
    // Caution - use balanced approach but highlight the weak area
    rank_mode = getRankModeFromWeakestPillar(weakestPillar);
    primary_route = 'category_alternatives';
    bucket_strategy = 'standard';
    reason = `Caution on ${weakestPillar.name} - showing balanced alternatives`;
  } else {
    // GREEN - balanced, product is good but still show alternatives
    rank_mode = 'balanced';
    primary_route = 'category_alternatives';
    bucket_strategy = 'standard';
    reason = 'Product looks good - showing alternatives for comparison';
  }

  // Determine if trending bucket should be shown
  show_trending =
    coverage >= COVERAGE_THRESHOLD_FOR_TRENDING &&
    (confidence === 'MED' || confidence === 'HIGH') &&
    verdict !== 'RED';

  return {
    primary_route,
    rank_mode,
    bucket_strategy,
    show_trending,
    suppress_winner,
    banner,
    reason,
  };
}

// --- Helper Functions ---

interface PillarInfo {
  name: 'product_viability' | 'offer_merchant' | 'economics';
  score: number;
}

function findWeakestPillar(scores: IntentRouterInput['scores']): PillarInfo {
  const pillars: PillarInfo[] = [
    { name: 'product_viability', score: scores.product_viability },
    { name: 'offer_merchant', score: scores.offer_merchant },
    { name: 'economics', score: scores.economics },
  ];

  return pillars.reduce((weakest, current) =>
    current.score < weakest.score ? current : weakest
  );
}

function getRankModeFromWeakestPillar(weakest: PillarInfo): RankMode {
  if (weakest.score >= WEAK_PILLAR_THRESHOLD) {
    return 'balanced';
  }

  switch (weakest.name) {
    case 'product_viability':
      return 'demand_first';
    case 'offer_merchant':
      return 'trust_first';
    case 'economics':
      return 'economics_first';
    default:
      return 'balanced';
  }
}

function determineAvoidCause(
  hard_stop_flags: string[],
  weakest: PillarInfo,
  scores: IntentRouterInput['scores']
): 'demand' | 'merchant' | 'economics' | 'multiple' {
  // Check hard-stop flags first
  const merchantFlags = ['merchant_risk', 'trust_score_critical', 'compliance_risk'];
  const demandFlags = ['no_reviews', 'thin_evidence'];
  const economicsFlags = ['no_program', 'commission_too_low'];

  const hasMerchantHardStop = hard_stop_flags.some(f =>
    merchantFlags.some(mf => f.toLowerCase().includes(mf.toLowerCase()))
  );
  const hasDemandHardStop = hard_stop_flags.some(f =>
    demandFlags.some(df => f.toLowerCase().includes(df.toLowerCase()))
  );
  const hasEconomicsHardStop = hard_stop_flags.some(f =>
    economicsFlags.some(ef => f.toLowerCase().includes(ef.toLowerCase()))
  );

  if (hasMerchantHardStop) return 'merchant';
  if (hasDemandHardStop) return 'demand';
  if (hasEconomicsHardStop) return 'economics';

  // Fall back to weakest pillar
  if (weakest.score < VERY_WEAK_PILLAR_THRESHOLD) {
    switch (weakest.name) {
      case 'product_viability':
        return 'demand';
      case 'offer_merchant':
        return 'merchant';
      case 'economics':
        return 'economics';
    }
  }

  // Multiple issues
  const weakPillars = [
    scores.product_viability,
    scores.offer_merchant,
    scores.economics,
  ].filter(s => s < WEAK_PILLAR_THRESHOLD);

  return weakPillars.length >= 2 ? 'multiple' : 'demand';
}

// --- Rank Mode Weights ---

export interface RankWeights {
  product_viability: number;
  offer_merchant: number;
  economics: number;
  trend: number;
  coverage: number;
  risk_penalty: number;
}

export function getWeightsForMode(mode: RankMode): RankWeights {
  switch (mode) {
    case 'demand_first':
      return {
        product_viability: 0.55,
        offer_merchant: 0.25,
        economics: 0.20,
        trend: 0.10,
        coverage: 0.05,
        risk_penalty: 0.15,
      };
    case 'trust_first':
      return {
        product_viability: 0.25,
        offer_merchant: 0.55,
        economics: 0.20,
        trend: 0.05,
        coverage: 0.05,
        risk_penalty: 0.20,
      };
    case 'economics_first':
      return {
        product_viability: 0.30,
        offer_merchant: 0.20,
        economics: 0.50,
        trend: 0.05,
        coverage: 0.05,
        risk_penalty: 0.10,
      };
    case 'balanced':
    default:
      return {
        product_viability: 0.35,
        offer_merchant: 0.35,
        economics: 0.30,
        trend: 0.05,
        coverage: 0.05,
        risk_penalty: 0.15,
      };
  }
}
