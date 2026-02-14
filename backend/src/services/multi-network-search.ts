/**
 * Multi-Network Product Search
 * Combines Datafeedr + direct APIs with profile-based scoring
 *
 * CRITICAL: Uses DUAL SCORING:
 * - Match Score: How well product aligns with user priorities (personalization)
 * - Outcome Feasibility: Business viability (prevents "high match, bad outcome")
 */

import { ProductIntent } from './product-intent-analyzer';
import { UserProfile } from './profile-builder';
import {
  searchDatafeedr,
  findAlternatives as datafeedrFindAlternatives,
  convertToAlternativeProduct,
  DatafeedrProduct,
} from './datafeedr-client';
import {
  scoreOutcomeFeasibility,
  canRecommendProduct,
  type OutcomeFeasibilityScore,
} from './outcome-feasibility-scorer';
import {
  canonicalizeProducts,
  getDeduplicationStats,
} from './product-canonicalization';

export interface AlternativeProduct {
  id: string;
  url: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;

  // DUAL SCORING SYSTEM
  matchScore: number; // 0-100 based on user profile (personalization)
  outcomeFeasibility: number; // 0-100 business outcome potential (NEW)
  combinedScore: number; // Weighted combination (NEW)

  matchReasons: string[];
  priorityAlignment: Record<string, { score: number; reason: string }>;
  affiliateNetwork: string;
  merchant: string;
  commissionRate?: number;
  cookieDurationDays?: number;
  pros?: string[];
  cons?: string[];
  inStock: boolean;

  // NEW: Outcome quality indicators
  requiresVerification?: boolean; // User should manually check before promoting
  outcomeWarnings?: string[]; // Red flags (merchant risk, low demand, etc.)
  recommendationConfidence?: number; // 0-100 confidence in this recommendation
}

/**
 * Search across multiple networks and score based on user profile
 */
export async function searchAllNetworks(
  intent: ProductIntent,
  userProfile: UserProfile,
  env: any,
  options: {
    limit?: number;
    excludeOriginalBrand?: boolean;
  } = {}
): Promise<AlternativeProduct[]> {
  console.log('[Multi-Network] Searching with intent:', intent);
  console.log('[Multi-Network] User confidence:', userProfile.confidenceScore);

  const limit = options.limit || 50;
  const datafeedrAccessId = env.DATAFEEDR_ACCESS_ID;
  const datafeedrSecretKey = env.DATAFEEDR_SECRET_KEY;

  if (!datafeedrAccessId || !datafeedrSecretKey) {
    console.warn('[Multi-Network] No Datafeedr credentials configured');
    return [];
  }

  // Phase 1: Broad search via Datafeedr
  const rawResults = await searchViaDatafeedr(intent, userProfile, datafeedrAccessId, datafeedrSecretKey, limit * 2); // Get more for deduplication

  // Phase 1.5: Canonicalize to remove duplicates (Fix #7)
  const canonicalProducts = canonicalizeProducts(rawResults);
  const dedupStats = getDeduplicationStats(rawResults.length, canonicalProducts);
  console.log(`[Multi-Network] Deduplication: ${dedupStats.duplicatesRemoved} duplicates removed (${dedupStats.deduplicationRate.toFixed(1)}%)`);

  // Use best variants for scoring
  const results = canonicalProducts.map(c => c.bestVariant);

  // Phase 2: DUAL SCORING - Match + Outcome Feasibility
  const scoredPromises = results.map(async product => {
    // A) Profile match score (personalization)
    const matchScore = calculateProfileMatchScore(product, userProfile, intent);
    const priorityAlignment = calculatePriorityAlignment(product, userProfile);
    const matchReasons = generateMatchReasons(product, userProfile, intent, matchScore);

    // B) Outcome feasibility score (business viability) - NEW!
    const outcomeFeasibilityScore = await scoreOutcomeFeasibility(
      {
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        affiliateNetwork: product.affiliateNetwork,
        merchantName: product.merchant,
        rating: product.rating,
        reviewCount: product.reviewCount,
        availability: product.inStock ? 'in_stock' : 'unknown',
        commissionRate: product.commissionRate,
        cookieDuration: product.cookieDurationDays,
      },
      env
    );

    // C) Combined score (60% match, 40% outcome feasibility)
    const combinedScore = Math.round(
      matchScore * 0.60 + outcomeFeasibilityScore.overall * 0.40
    );

    return {
      ...product,
      matchScore,
      outcomeFeasibility: outcomeFeasibilityScore.overall,
      combinedScore,
      priorityAlignment,
      matchReasons,
      requiresVerification: outcomeFeasibilityScore.requiresVerification,
      outcomeWarnings: outcomeFeasibilityScore.warnings,
      recommendationConfidence: outcomeFeasibilityScore.confidence,
      // Attach full feasibility breakdown for debugging (optional)
      _outcomeFeasibilityDetails: outcomeFeasibilityScore,
    };
  });

  const scored = await Promise.all(scoredPromises);

  // Phase 3: Filter by BOTH match AND outcome feasibility
  const filtered = scored
    .filter(p => {
      // Must pass minimum match threshold
      if (p.matchScore < 60) return false;

      // Must pass outcome feasibility gate (CRITICAL!)
      const recommendation = canRecommendProduct(p._outcomeFeasibilityDetails);
      if (!recommendation.canRecommend) {
        console.log(`[Multi-Network] Rejected ${p.name}: ${recommendation.reason}`);
        return false;
      }

      // Brand exclusion filter
      if (options.excludeOriginalBrand && p.brand.toLowerCase() === intent.brand?.toLowerCase()) {
        return false;
      }

      return true;
    });

  // Phase 4: Sort by COMBINED SCORE (not just match)
  filtered.sort((a, b) => b.combinedScore - a.combinedScore);

  console.log(`[Multi-Network] Scored ${results.length} → Filtered to ${filtered.length} after outcome feasibility checks`);
  return filtered.slice(0, limit);
}

/**
 * Search via Datafeedr API
 */
async function searchViaDatafeedr(
  intent: ProductIntent,
  profile: UserProfile,
  accessId: string,
  secretKey: string,
  limit: number
): Promise<AlternativeProduct[]> {
  // Determine price range based on intent and profile
  let priceMin: number | undefined;
  let priceMax: number | undefined;

  if (intent.priceRange === 'budget') {
    priceMax = profile.storefrontContext.avgPricePoint * 0.7;
  } else if (intent.priceRange === 'premium') {
    priceMin = profile.storefrontContext.avgPricePoint * 1.3;
  } else {
    // Mid-range: ±30% of user's average
    priceMin = profile.storefrontContext.avgPricePoint * 0.7;
    priceMax = profile.storefrontContext.avgPricePoint * 1.3;
  }

  try {
    const response = await searchDatafeedr(
      {
        query: intent.searchQuery,
        price_min: priceMin,
        price_max: priceMax,
        limit: limit * 2, // Get more for filtering
        in_stock: true,
      },
      accessId,
      secretKey
    );

    return response.products.map(convertToAlternativeProduct);
  } catch (error) {
    console.error('[Multi-Network] Datafeedr search failed:', error);
    return [];
  }
}

/**
 * Calculate match score based on user profile (0-100)
 */
function calculateProfileMatchScore(
  product: any,
  profile: UserProfile,
  intent: ProductIntent
): number {
  let score = 0;
  let totalWeight = 0;

  // 1. Priority-based scoring (50% weight)
  if (profile.productPriorities.length > 0) {
    profile.productPriorities.forEach(p => {
      // Base weight from rank (stable identity)
      const baseWeight = 6 - p.rank; // Rank 1 = 5x, Rank 2 = 4x, etc.

      // Apply dynamic intent multiplier if present (smooth adjustment)
      const multiplier = p.weightMultiplier || 1.0;
      const effectiveWeight = baseWeight * multiplier;

      const priorityScore = calculatePriorityScore(product, p.id);
      score += priorityScore * effectiveWeight;
      totalWeight += effectiveWeight;
    });
  }

  // 2. Category alignment (20% weight)
  const categoryWeight = 5;
  if (profile.storefrontContext.dominantCategories.length > 0) {
    const matchingCategory = profile.storefrontContext.dominantCategories.find(
      c => c.category.toLowerCase() === intent.category.toLowerCase()
    );
    if (matchingCategory) {
      // Strong match if this is in their top categories
      score += 90 * categoryWeight;
    } else {
      // Moderate match for new categories
      score += 60 * categoryWeight;
    }
    totalWeight += categoryWeight;
  }

  // 3. Brand familiarity (15% weight)
  const brandWeight = 3;
  if (product.brand && profile.storefrontContext.topBrands.includes(product.brand)) {
    score += 90 * brandWeight;
  } else {
    score += 50 * brandWeight; // Neutral for unknown brands
  }
  totalWeight += brandWeight;

  // 4. Price point fit (15% weight)
  const priceWeight = 3;
  if (profile.storefrontContext.avgPricePoint > 0) {
    const priceDiff = Math.abs(product.price - profile.storefrontContext.avgPricePoint);
    const priceRatio = priceDiff / profile.storefrontContext.avgPricePoint;
    const priceScore = Math.max(0, 100 - priceRatio * 100);
    score += priceScore * priceWeight;
  } else {
    score += 50 * priceWeight; // Neutral if no price history
  }
  totalWeight += priceWeight;

  return totalWeight > 0 ? Math.min(100, Math.round(score / totalWeight)) : 50;
}

/**
 * Calculate score for individual priority
 */
function calculatePriorityScore(product: any, priorityId: string): number {
  switch (priorityId) {
    case 'quality':
      // Based on rating and review count
      if (product.rating && product.reviewCount) {
        const ratingScore = (product.rating / 5) * 80;
        const reviewBonus = Math.min((product.reviewCount / 100) * 20, 20);
        return Math.min(100, ratingScore + reviewBonus);
      }
      return 60; // Neutral if no rating data

    case 'price':
      // Lower price = higher score (for price-conscious creators)
      // Assume average price is $100 for normalization
      const avgPrice = 100;
      const priceScore = Math.max(0, 100 - (product.price / avgPrice) * 50);
      return Math.min(100, priceScore);

    case 'reviews':
      // Based on review count
      if (product.reviewCount) {
        return Math.min(100, (product.reviewCount / 100) * 100);
      }
      return 50;

    case 'commission':
      // Based on commission rate (if available)
      if (product.commissionRate) {
        return Math.min(100, (product.commissionRate / 10) * 100);
      }
      return 60; // Neutral assumption

    case 'brand_recognition':
      // Higher for known brands
      const knownBrands = ['Apple', 'Sony', 'Samsung', 'Nike', 'Adidas'];
      return knownBrands.includes(product.brand) ? 90 : 50;

    default:
      return 60; // Neutral score for unknown priorities
  }
}

/**
 * Calculate priority alignment breakdown
 */
function calculatePriorityAlignment(
  product: any,
  profile: UserProfile
): Record<string, { score: number; reason: string }> {
  const alignment: Record<string, { score: number; reason: string }> = {};

  // Top 3 priorities only
  const topPriorities = profile.productPriorities.slice(0, 3);

  for (const priority of topPriorities) {
    const score = calculatePriorityScore(product, priority.id);
    const reason = getPriorityReason(priority.id, product, score);

    alignment[priority.id] = { score, reason };
  }

  return alignment;
}

/**
 * Generate human-readable reason for priority score
 */
function getPriorityReason(priorityId: string, product: any, score: number): string {
  const templates: Record<string, (p: any, s: number) => string> = {
    quality: (p, s) =>
      p.rating
        ? `${p.rating}★ rating from ${p.reviewCount || 0} reviews`
        : 'Quality not yet rated',
    price: (p, s) => `Competitively priced at ${p.currency}${p.price.toFixed(2)}`,
    reviews: (p, s) =>
      p.reviewCount ? `${p.reviewCount} customer reviews` : 'Limited review data',
    commission: (p, s) =>
      p.commissionRate ? `${p.commissionRate}% commission rate` : 'Standard commission rates',
    brand_recognition: (p, s) => `${p.brand} is ${s > 70 ? 'a well-known' : 'an emerging'} brand`,
  };

  const template = templates[priorityId];
  return template ? template(product, score) : `Score: ${score}/100`;
}

/**
 * Generate match reasons for product card
 */
function generateMatchReasons(
  product: any,
  profile: UserProfile,
  intent: ProductIntent,
  matchScore: number
): string[] {
  const reasons: string[] = [];

  // Check if matches category
  const matchingCategory = profile.storefrontContext.dominantCategories.find(
    c => c.category.toLowerCase() === intent.category.toLowerCase()
  );
  if (matchingCategory) {
    reasons.push(
      `Matches your ${intent.category} focus (${(matchingCategory.percentage * 100).toFixed(0)}% of your content)`
    );
  }

  // Check top priorities
  const topPriority = profile.productPriorities[0];
  if (topPriority) {
    const score = calculatePriorityScore(product, topPriority.id);
    if (score >= 80) {
      const reason = getPriorityReason(topPriority.id, product, score);
      reasons.push(`Strong ${topPriority.id}: ${reason}`);
    }
  }

  // Check brand familiarity
  if (product.brand && profile.storefrontContext.topBrands.includes(product.brand)) {
    reasons.push(`You've successfully promoted ${product.brand} before`);
  }

  // Price comparison
  if (profile.storefrontContext.avgPricePoint > 0) {
    const priceDiff = product.price - profile.storefrontContext.avgPricePoint;
    if (Math.abs(priceDiff) < profile.storefrontContext.avgPricePoint * 0.2) {
      reasons.push('Similar price to your typical product range');
    }
  }

  // Overall score
  if (matchScore >= 90) {
    reasons.push('Excellent overall match for your profile');
  } else if (matchScore >= 80) {
    reasons.push('Strong match based on your priorities');
  }

  return reasons.slice(0, 3); // Max 3 reasons
}

/**
 * Find alternatives for a specific product
 */
export async function findProductAlternatives(
  originalProduct: {
    url: string;
    name?: string;
    brand?: string;
    price?: number;
  },
  userProfile: UserProfile,
  env: any,
  options: {
    limit?: number;
    excludeOriginalBrand?: boolean;
  } = {}
): Promise<AlternativeProduct[]> {
  // First, analyze the original product URL to get intent
  const { analyzeProductIntent } = await import('./product-intent-analyzer');
  const intent = await analyzeProductIntent(originalProduct.url);

  // Override with known data
  if (originalProduct.brand) intent.brand = originalProduct.brand;
  if (originalProduct.price) {
    if (originalProduct.price < 50) intent.priceRange = 'budget';
    else if (originalProduct.price > 200) intent.priceRange = 'premium';
    else intent.priceRange = 'mid-range';
  }

  // Search for alternatives
  return searchAllNetworks(intent, userProfile, env, options);
}
