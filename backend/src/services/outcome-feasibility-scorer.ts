/**
 * Outcome Feasibility Scorer
 *
 * Scores products based on BUSINESS OUTCOME potential, not just profile match.
 * Prevents "high match, bad recommendation" failures.
 *
 * Components:
 * - Merchant Risk Proxy (returns, support, shipping reliability)
 * - Program Friction Proxy (approval difficulty, payout reliability)
 * - Demand Evidence Proxy (real demand signals, not just ratings)
 * - Refund Risk Proxy (category + review sentiment)
 */

export interface OutcomeFeasibilityScore {
  overall: number; // 0-100
  merchantRisk: number; // 0-100 (higher = lower risk)
  programFriction: number; // 0-100 (higher = easier program)
  demandEvidence: number; // 0-100 (higher = stronger demand)
  refundRisk: number; // 0-100 (higher = lower refund risk)

  // Evidence quality
  confidence: number; // 0-100 (how confident are we in this score)
  dataSources: string[]; // Which sources were used

  // Flags
  warnings: string[]; // Red flags that should prevent selection
  requiresVerification: boolean; // User should manually verify before promoting
}

export interface ProductForScoring {
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  affiliateNetwork: string;
  merchantName?: string;

  // Product signals
  rating?: number;
  reviewCount?: number;
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

  // Merchant signals
  merchantId?: string;
  merchantRating?: number;

  // Program signals
  commissionRate?: number;
  cookieDuration?: number;
  programTermsUrl?: string;
}

/**
 * Calculate outcome feasibility score for a product
 */
export async function scoreOutcomeFeasibility(
  product: ProductForScoring,
  env: any
): Promise<OutcomeFeasibilityScore> {

  const warnings: string[] = [];
  const dataSources: string[] = [];

  // Component 1: Merchant Risk Score
  const merchantRisk = scoreMerchantRisk(product, dataSources, warnings);

  // Component 2: Program Friction Score
  const programFriction = scoreProgramFriction(product, dataSources, warnings);

  // Component 3: Demand Evidence Score
  const demandEvidence = scoreDemandEvidence(product, dataSources, warnings);

  // Component 4: Refund Risk Score
  const refundRisk = scoreRefundRisk(product, dataSources, warnings);

  // Overall score (weighted average)
  const overall = Math.round(
    (merchantRisk * 0.30) +
    (programFriction * 0.25) +
    (demandEvidence * 0.25) +
    (refundRisk * 0.20)
  );

  // Confidence based on data availability
  const confidence = calculateConfidence(product, dataSources);

  // Requires verification if overall < 60 OR confidence < 50
  const requiresVerification = overall < 60 || confidence < 50;

  return {
    overall,
    merchantRisk,
    programFriction,
    demandEvidence,
    refundRisk,
    confidence,
    dataSources,
    warnings,
    requiresVerification,
  };
}

/**
 * Component 1: Merchant Risk (shipping, returns, support)
 */
function scoreMerchantRisk(
  product: ProductForScoring,
  dataSources: string[],
  warnings: string[]
): number {
  let score = 50; // Neutral default

  // Known reliable networks get a boost
  const reliableNetworks = ['amazon', 'awin', 'cj', 'impact'];
  const network = product.affiliateNetwork?.toLowerCase() || '';

  if (reliableNetworks.some(n => network.includes(n))) {
    score += 20;
    dataSources.push('network_reliability_db');
  }

  // Merchant rating (if available)
  if (product.merchantRating !== undefined) {
    if (product.merchantRating >= 4.5) {
      score += 20;
    } else if (product.merchantRating >= 4.0) {
      score += 10;
    } else if (product.merchantRating < 3.5) {
      score -= 20;
      warnings.push('Low merchant rating');
    }
    dataSources.push('merchant_rating');
  }

  // Availability signals
  if (product.availability === 'out_of_stock') {
    score -= 30;
    warnings.push('Product currently out of stock');
  } else if (product.availability === 'low_stock') {
    score -= 10;
    warnings.push('Low stock - may go OOS soon');
  } else if (product.availability === 'in_stock') {
    score += 10;
    dataSources.push('availability_check');
  }

  // Brand reputation proxy
  const premiumBrands = ['apple', 'sony', 'samsung', 'bose', 'nike', 'adidas'];
  const brand = product.brand?.toLowerCase() || '';

  if (premiumBrands.some(b => brand.includes(b))) {
    score += 15;
    dataSources.push('brand_reputation_db');
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Component 2: Program Friction (approval, payout, terms)
 */
function scoreProgramFriction(
  product: ProductForScoring,
  dataSources: string[],
  warnings: string[]
): number {
  let score = 50; // Neutral default

  // Networks with known easy approval
  const easyApprovalNetworks = ['amazon', 'awin'];
  const network = product.affiliateNetwork?.toLowerCase() || '';

  if (easyApprovalNetworks.some(n => network.includes(n))) {
    score += 25;
    dataSources.push('network_approval_db');
  }

  // Cookie duration (longer = better)
  if (product.cookieDuration !== undefined) {
    if (product.cookieDuration >= 30) {
      score += 20;
    } else if (product.cookieDuration >= 7) {
      score += 10;
    } else if (product.cookieDuration < 1) {
      score -= 20;
      warnings.push('Very short cookie duration (<24hrs)');
    }
    dataSources.push('program_terms');
  }

  // Commission rate signals
  if (product.commissionRate !== undefined) {
    if (product.commissionRate >= 10) {
      score += 15; // High commission (but check if too-good-to-be-true)

      if (product.commissionRate > 30) {
        warnings.push('Unusually high commission - verify program legitimacy');
      }
    } else if (product.commissionRate >= 5) {
      score += 10;
    } else if (product.commissionRate < 2) {
      score -= 10; // Very low commission might indicate poor program
    }
    dataSources.push('commission_data');
  }

  // Missing program terms is a red flag
  if (!product.programTermsUrl && !product.commissionRate) {
    score -= 20;
    warnings.push('Program terms unavailable - requires manual verification');
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Component 3: Demand Evidence (real demand, not just ratings)
 */
function scoreDemandEvidence(
  product: ProductForScoring,
  dataSources: string[],
  warnings: string[]
): number {
  let score = 40; // Conservative default

  // Review count is the strongest demand signal
  if (product.reviewCount !== undefined) {
    if (product.reviewCount >= 5000) {
      score += 40;
    } else if (product.reviewCount >= 1000) {
      score += 30;
    } else if (product.reviewCount >= 500) {
      score += 20;
    } else if (product.reviewCount >= 100) {
      score += 10;
    } else if (product.reviewCount < 10) {
      score -= 10;
      warnings.push('Very few reviews - limited demand evidence');
    }
    dataSources.push('review_count');
  } else {
    // No review count = weak evidence
    score -= 20;
  }

  // Rating quality (with review count context)
  if (product.rating !== undefined && product.reviewCount !== undefined) {
    if (product.rating >= 4.5 && product.reviewCount >= 100) {
      score += 20; // Strong positive signal
    } else if (product.rating >= 4.0 && product.reviewCount >= 50) {
      score += 10;
    } else if (product.rating < 3.5) {
      score -= 20;
      warnings.push('Low rating - may indicate quality issues');
    }
    dataSources.push('rating_with_volume');
  }

  // Price point proxy for demand
  // Very high prices (>€1000) have smaller markets
  if (product.price > 1000) {
    score -= 10; // Harder to convert
  } else if (product.price >= 100 && product.price <= 500) {
    score += 10; // Sweet spot for affiliate sales
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Component 4: Refund Risk (category + review sentiment)
 */
function scoreRefundRisk(
  product: ProductForScoring,
  dataSources: string[],
  warnings: string[]
): number {
  let score = 60; // Neutral-positive default

  // High-risk categories (known for returns)
  const highRiskCategories = [
    'clothing', 'fashion', 'apparel', 'shoes', 'footwear',
    'jewelry', 'accessories', 'beauty', 'cosmetics'
  ];

  const lowRiskCategories = [
    'electronics', 'software', 'books', 'digital', 'subscription'
  ];

  const category = product.category?.toLowerCase() || '';

  if (highRiskCategories.some(c => category.includes(c))) {
    score -= 20;
    warnings.push('High-return category (fashion/beauty) - expect higher refund rate');
    dataSources.push('category_risk_db');
  } else if (lowRiskCategories.some(c => category.includes(c))) {
    score += 20;
    dataSources.push('category_risk_db');
  }

  // Rating as refund proxy
  if (product.rating !== undefined) {
    if (product.rating >= 4.5) {
      score += 15; // High satisfaction = lower returns
    } else if (product.rating < 3.5) {
      score -= 20; // Low satisfaction = higher returns
    }
  }

  // Price point proxy
  // Very cheap items (<€20) often have quality issues
  if (product.price < 20) {
    score -= 15;
    warnings.push('Low price point may indicate quality/refund risk');
  } else if (product.price >= 100) {
    score += 10; // Premium pricing usually means better QC
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate confidence in the outcome feasibility score
 */
function calculateConfidence(
  product: ProductForScoring,
  dataSources: string[]
): number {
  let confidence = 0;

  // Each independent data source adds confidence
  const uniqueSources = new Set(dataSources);
  confidence += uniqueSources.size * 15; // Up to 90 for 6+ sources

  // Key signals present
  if (product.rating !== undefined) confidence += 10;
  if (product.reviewCount !== undefined) confidence += 15;
  if (product.commissionRate !== undefined) confidence += 10;
  if (product.merchantRating !== undefined) confidence += 10;
  if (product.availability !== 'unknown') confidence += 5;

  return Math.min(100, confidence);
}

/**
 * Validate if a product can be recommended based on outcome feasibility
 *
 * This is the critical gate that prevents "high match, bad outcome" failures
 */
export function canRecommendProduct(score: OutcomeFeasibilityScore): {
  canRecommend: boolean;
  reason?: string;
  requiresWarning?: boolean;
} {
  // Hard rejection thresholds
  if (score.overall < 40) {
    return {
      canRecommend: false,
      reason: 'Overall outcome feasibility too low (business risk)',
    };
  }

  if (score.merchantRisk < 30) {
    return {
      canRecommend: false,
      reason: 'Merchant reliability concerns',
    };
  }

  if (score.demandEvidence < 25) {
    return {
      canRecommend: false,
      reason: 'Insufficient demand evidence',
    };
  }

  // Conditional acceptance with warning
  if (score.overall >= 40 && score.overall < 60) {
    return {
      canRecommend: true,
      requiresWarning: true,
      reason: 'Moderate outcome feasibility - verify before promoting',
    };
  }

  if (score.confidence < 50) {
    return {
      canRecommend: true,
      requiresWarning: true,
      reason: 'Limited data - verify program terms and merchant reliability',
    };
  }

  // Clear acceptance
  return { canRecommend: true };
}
