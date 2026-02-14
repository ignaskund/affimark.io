/**
 * Coverage Engine for Product Verifier
 *
 * Calculates what percentage of scoring signals used real data
 * vs fallback/default values. This informs:
 * - Whether to suppress winner selection
 * - Whether to show "Trending" bucket
 * - Overall confidence weighting
 */

// --- Types ---

export interface CoverageInput {
  // Product data signals
  has_rating: boolean;
  has_reviews: boolean;
  review_count: number;
  has_price: boolean;
  has_brand: boolean;
  has_description: boolean;

  // Merchant/reputation signals
  has_trustpilot: boolean;
  trustpilot_reviews: number;
  has_reviews_io: boolean;

  // Economics signals
  has_affiliate_program: boolean;
  program_confidence: number | null; // 1-5
  has_commission_data: boolean;
  has_cookie_data: boolean;

  // Policy signals
  has_return_policy: boolean;
  has_shipping_info: boolean;
}

export interface CoverageResult {
  overall_score: number; // 0-1
  by_pillar: {
    product_viability: number;
    offer_merchant: number;
    economics: number;
  };
  missing_signals: string[];
  data_quality: 'high' | 'medium' | 'low';
  recommendation: string;
}

// --- Signal Weights ---

const PRODUCT_SIGNALS = {
  has_rating: 0.25,
  has_reviews: 0.25,
  review_volume: 0.20, // Based on review count
  has_price: 0.15,
  has_brand: 0.10,
  has_description: 0.05,
};

const MERCHANT_SIGNALS = {
  has_trustpilot: 0.40,
  trustpilot_volume: 0.20,
  has_reviews_io: 0.20,
  has_return_policy: 0.10,
  has_shipping_info: 0.10,
};

const ECONOMICS_SIGNALS = {
  has_affiliate_program: 0.50,
  program_confidence: 0.20,
  has_commission_data: 0.20,
  has_cookie_data: 0.10,
};

// --- Main Calculation ---

export function calculateCoverage(input: CoverageInput): CoverageResult {
  const productCoverage = calculateProductCoverage(input);
  const merchantCoverage = calculateMerchantCoverage(input);
  const economicsCoverage = calculateEconomicsCoverage(input);

  // Overall is weighted average (economics slightly less weight since it can be estimated)
  const overall_score =
    productCoverage.score * 0.35 +
    merchantCoverage.score * 0.35 +
    economicsCoverage.score * 0.30;

  // Collect missing signals
  const missing_signals = [
    ...productCoverage.missing,
    ...merchantCoverage.missing,
    ...economicsCoverage.missing,
  ];

  // Determine data quality
  let data_quality: 'high' | 'medium' | 'low';
  if (overall_score >= 0.7) {
    data_quality = 'high';
  } else if (overall_score >= 0.4) {
    data_quality = 'medium';
  } else {
    data_quality = 'low';
  }

  // Generate recommendation
  const recommendation = generateRecommendation(
    overall_score,
    missing_signals,
    data_quality
  );

  return {
    overall_score: Math.round(overall_score * 100) / 100,
    by_pillar: {
      product_viability: productCoverage.score,
      offer_merchant: merchantCoverage.score,
      economics: economicsCoverage.score,
    },
    missing_signals,
    data_quality,
    recommendation,
  };
}

// --- Pillar-Specific Coverage ---

function calculateProductCoverage(input: CoverageInput): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  if (input.has_rating) {
    score += PRODUCT_SIGNALS.has_rating;
  } else {
    missing.push('No product rating');
  }

  if (input.has_reviews) {
    score += PRODUCT_SIGNALS.has_reviews;

    // Review volume bonus
    if (input.review_count >= 100) {
      score += PRODUCT_SIGNALS.review_volume;
    } else if (input.review_count >= 20) {
      score += PRODUCT_SIGNALS.review_volume * 0.5;
    } else if (input.review_count > 0) {
      score += PRODUCT_SIGNALS.review_volume * 0.2;
    }
  } else {
    missing.push('No customer reviews');
  }

  if (input.has_price) {
    score += PRODUCT_SIGNALS.has_price;
  } else {
    missing.push('Price not detected');
  }

  if (input.has_brand) {
    score += PRODUCT_SIGNALS.has_brand;
  } else {
    missing.push('Brand not identified');
  }

  if (input.has_description) {
    score += PRODUCT_SIGNALS.has_description;
  }

  return { score: Math.min(1, score), missing };
}

function calculateMerchantCoverage(input: CoverageInput): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  if (input.has_trustpilot) {
    score += MERCHANT_SIGNALS.has_trustpilot;

    // Trustpilot volume bonus
    if (input.trustpilot_reviews >= 100) {
      score += MERCHANT_SIGNALS.trustpilot_volume;
    } else if (input.trustpilot_reviews >= 20) {
      score += MERCHANT_SIGNALS.trustpilot_volume * 0.5;
    }
  } else {
    missing.push('No Trustpilot data');
  }

  if (input.has_reviews_io) {
    score += MERCHANT_SIGNALS.has_reviews_io;
  }

  if (input.has_return_policy) {
    score += MERCHANT_SIGNALS.has_return_policy;
  } else {
    missing.push('Return policy unclear');
  }

  if (input.has_shipping_info) {
    score += MERCHANT_SIGNALS.has_shipping_info;
  } else {
    missing.push('Shipping info unclear');
  }

  return { score: Math.min(1, score), missing };
}

function calculateEconomicsCoverage(input: CoverageInput): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  if (input.has_affiliate_program) {
    score += ECONOMICS_SIGNALS.has_affiliate_program;

    // Program confidence bonus
    if (input.program_confidence !== null) {
      if (input.program_confidence >= 4) {
        score += ECONOMICS_SIGNALS.program_confidence;
      } else if (input.program_confidence >= 3) {
        score += ECONOMICS_SIGNALS.program_confidence * 0.5;
      }
    }
  } else {
    missing.push('No affiliate program found');
  }

  if (input.has_commission_data) {
    score += ECONOMICS_SIGNALS.has_commission_data;
  } else {
    missing.push('Commission rate estimated');
  }

  if (input.has_cookie_data) {
    score += ECONOMICS_SIGNALS.has_cookie_data;
  }

  return { score: Math.min(1, score), missing };
}

// --- Recommendation Generator ---

function generateRecommendation(
  score: number,
  missing: string[],
  quality: 'high' | 'medium' | 'low'
): string {
  if (quality === 'high') {
    return 'Strong data coverage. Recommendations are reliable.';
  }

  if (quality === 'medium') {
    if (missing.includes('No affiliate program found')) {
      return 'Using category benchmarks for economics. Verify commission rates before committing.';
    }
    if (missing.includes('No Trustpilot data')) {
      return 'Limited merchant trust data. Consider verifying merchant reputation.';
    }
    return 'Moderate data coverage. Key signals present.';
  }

  // Low quality
  if (missing.length >= 3) {
    return 'Limited data available. Test with small commitment first.';
  }
  return 'Some key signals missing. Verify before full commitment.';
}

// --- Quick Coverage Check (for filtering) ---

export function quickCoverageCheck(input: Partial<CoverageInput>): {
  eligible_for_winner: boolean;
  eligible_for_trending: boolean;
} {
  const minForWinner =
    (input.has_rating || input.has_reviews) &&
    (input.has_trustpilot || input.has_reviews_io || input.has_return_policy);

  const minForTrending =
    input.has_rating &&
    input.has_reviews &&
    (input.review_count || 0) >= 10 &&
    (input.has_trustpilot || input.has_reviews_io);

  return {
    eligible_for_winner: Boolean(minForWinner),
    eligible_for_trending: Boolean(minForTrending),
  };
}
