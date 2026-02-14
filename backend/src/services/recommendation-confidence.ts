/**
 * Recommendation Confidence Calculator
 *
 * CRITICAL: Splits "confidence" into TWO independent measures:
 * 1. Profile Completeness - How complete is the user's static profile
 * 2. Recommendation Evidence - How confident are we in THIS specific recommendation
 *
 * Prevents false certainty: A user can have 100% profile completeness but low
 * recommendation evidence (or vice versa).
 */

export interface ProfileCompleteness {
  overall: number; // 0-100
  hasPriorities: boolean; // +40
  hasSocialContext: boolean; // +30
  hasStorefrontContext: boolean; // +30
  breakdown: {
    priorities: number;
    social: number;
    storefront: number;
  };
}

export interface RecommendationEvidence {
  overall: number; // 0-100
  sourcesUsed: string[]; // Independent data sources
  dataFreshness: number; // 0-100 (how recent is the data)
  crossSourceAgreement: number; // 0-100 (do sources agree)
  fallbackDataUsed: number; // 0-100 (how much is real vs defaults)

  // Warnings
  thinEvidence: boolean; // True if evidence < 50
  staleData: boolean; // True if data is old
  warnings: string[];
}

/**
 * Calculate profile completeness (static measure)
 */
export function calculateProfileCompleteness(profile: {
  productPriorities: any[];
  brandPriorities: any[];
  socialContext: { platforms: any[] };
  storefrontContext: { dominantCategories: any[] };
}): ProfileCompleteness {
  let overall = 0;
  const breakdown = { priorities: 0, social: 0, storefront: 0 };

  // Component 1: Priorities (40 points)
  const hasPriorities =
    profile.productPriorities.length > 0 ||
    profile.brandPriorities.length > 0;

  if (hasPriorities) {
    const priorityScore =
      (profile.productPriorities.length >= 3 ? 20 : profile.productPriorities.length * 6) +
      (profile.brandPriorities.length >= 3 ? 20 : profile.brandPriorities.length * 6);
    breakdown.priorities = Math.min(40, priorityScore);
    overall += breakdown.priorities;
  }

  // Component 2: Social Context (30 points)
  const hasSocialContext = profile.socialContext.platforms.length > 0;

  if (hasSocialContext) {
    const socialScore = Math.min(30, profile.socialContext.platforms.length * 10);
    breakdown.social = socialScore;
    overall += breakdown.social;
  }

  // Component 3: Storefront Context (30 points)
  const hasStorefrontContext =
    profile.storefrontContext.dominantCategories &&
    profile.storefrontContext.dominantCategories.length > 0;

  if (hasStorefrontContext) {
    const storefrontScore = Math.min(30, profile.storefrontContext.dominantCategories.length * 10);
    breakdown.storefront = storefrontScore;
    overall += breakdown.storefront;
  }

  return {
    overall,
    hasPriorities,
    hasSocialContext,
    hasStorefrontContext,
    breakdown,
  };
}

/**
 * Calculate recommendation evidence confidence (query-specific)
 */
export function calculateRecommendationEvidence(inputs: {
  productData?: {
    hasRating: boolean;
    hasReviewCount: boolean;
    hasPrice: boolean;
    hasCategory: boolean;
    hasBrand: boolean;
  };
  profileData?: {
    lastSocialAnalysis?: string | null;
    lastStorefrontAnalysis?: string | null;
  };
  searchData?: {
    datafeedrUsed: boolean;
    aiAnalysisUsed: boolean;
    directApiUsed: boolean;
    fallbacksUsed: string[];
  };
  outcomeFeasibility?: {
    dataSources: string[];
    confidence: number;
  };
}): RecommendationEvidence {
  const warnings: string[] = [];
  const sourcesUsed: string[] = [];

  // Component 1: Independent sources (40 points)
  let sourcesScore = 0;

  if (inputs.searchData?.datafeedrUsed) {
    sourcesUsed.push('datafeedr');
    sourcesScore += 15;
  }
  if (inputs.searchData?.aiAnalysisUsed) {
    sourcesUsed.push('ai_analysis');
    sourcesScore += 10;
  }
  if (inputs.searchData?.directApiUsed) {
    sourcesUsed.push('direct_api');
    sourcesScore += 15;
  }
  if (inputs.outcomeFeasibility) {
    sourcesUsed.push(...inputs.outcomeFeasibility.dataSources);
    sourcesScore += Math.min(20, inputs.outcomeFeasibility.dataSources.length * 5);
  }

  sourcesScore = Math.min(40, sourcesScore);

  // Component 2: Data freshness (20 points)
  let freshnessScore = 20; // Start at 100%
  const now = Date.now();

  if (inputs.profileData?.lastSocialAnalysis) {
    const socialAge = (now - new Date(inputs.profileData.lastSocialAnalysis).getTime()) / (1000 * 60 * 60 * 24);
    if (socialAge > 35) {
      freshnessScore -= 5;
      warnings.push('Social context data is stale (>35 days)');
    }
  } else {
    freshnessScore -= 10;
    warnings.push('No social context analysis available');
  }

  if (inputs.profileData?.lastStorefrontAnalysis) {
    const storefrontAge = (now - new Date(inputs.profileData.lastStorefrontAnalysis).getTime()) / (1000 * 60 * 60 * 24);
    if (storefrontAge > 10) {
      freshnessScore -= 5;
      warnings.push('Storefront context data is stale (>10 days)');
    }
  } else {
    freshnessScore -= 10;
    warnings.push('No storefront context analysis available');
  }

  freshnessScore = Math.max(0, freshnessScore);

  // Component 3: Product data completeness (20 points)
  let productDataScore = 0;

  if (inputs.productData?.hasRating) productDataScore += 5;
  if (inputs.productData?.hasReviewCount) productDataScore += 5;
  if (inputs.productData?.hasPrice) productDataScore += 3;
  if (inputs.productData?.hasCategory) productDataScore += 4;
  if (inputs.productData?.hasBrand) productDataScore += 3;

  if (productDataScore < 10) {
    warnings.push('Limited product data available');
  }

  // Component 4: Fallback usage penalty (20 points)
  let fallbackPenalty = 0;

  if (inputs.searchData?.fallbacksUsed && inputs.searchData.fallbacksUsed.length > 0) {
    fallbackPenalty = Math.min(20, inputs.searchData.fallbacksUsed.length * 5);
    warnings.push(`Using ${inputs.searchData.fallbacksUsed.length} fallback data sources`);
  }

  const fallbackScore = Math.max(0, 20 - fallbackPenalty);

  // Overall recommendation evidence
  const overall = Math.round(sourcesScore + freshnessScore + productDataScore + fallbackScore);

  return {
    overall,
    sourcesUsed,
    dataFreshness: freshnessScore * 5, // Scale to 0-100
    crossSourceAgreement: 100, // TODO: Implement cross-source comparison
    fallbackDataUsed: fallbackPenalty * 5, // Scale to 0-100
    thinEvidence: overall < 50,
    staleData: freshnessScore < 10,
    warnings,
  };
}

/**
 * Combine both confidence measures into a single recommendation confidence
 *
 * This is what we show to users as "confidence" but internally we track both.
 */
export function calculateOverallConfidence(
  profileCompleteness: number,
  recommendationEvidence: number
): number {
  // Weighted: 40% profile completeness, 60% recommendation evidence
  // (Recommendation evidence matters MORE for confidence in a specific pick)
  return Math.round(profileCompleteness * 0.40 + recommendationEvidence * 0.60);
}
