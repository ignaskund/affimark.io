/**
 * Scoring Engine for Product Verifier
 *
 * All deterministic formulas, no AI.
 * Computes 3 separate scores (0-100) + confidence level.
 */

import type { ScrapedProductData } from './page-scraper';

// --- Types ---

export interface ScoringInput {
  product: ScrapedProductData;
  reputation: ReputationData | null;
  commission: CommissionData | null;
  categoryBenchmarks: CategoryBenchmarks;
  userCategories?: string[]; // user's top performing categories
}

export interface ReputationData {
  trustpilot_rating: number | null;   // 0-5
  trustpilot_reviews: number | null;
  google_rating: number | null;
  google_reviews: number | null;
  overall_rating: number | null;      // aggregated
  overall_reviews: number | null;
  sentiment_score: number | null;     // 0-1
  has_shipping_complaints: boolean;
  has_quality_complaints: boolean;
  has_support_complaints: boolean;
}

export interface CommissionData {
  rate_low: number;    // percentage
  rate_high: number;
  cookie_days: number;
  network: string;
  avg_conversion_rate: number | null;
  avg_order_value: number | null;
  refund_rate: number | null;
  requires_application: boolean;
}

export interface CategoryBenchmarks {
  avg_commission: number;
  avg_cookie_days: number;
  avg_conversion_rate: number;
  avg_order_value: number;
  avg_refund_rate: number;
  avg_review_count: number;
  avg_price: number;
}

export interface ScoreResult {
  product_viability: number;
  offer_merchant: number;
  economics_feasibility: number;
  breakdowns: ScoreBreakdowns;
}

export interface ScoreBreakdowns {
  product_viability: {
    demand_signals: number;
    review_sentiment: number;
    pricing_competitiveness: number;
    category_fit: number;
    uniqueness: number;
    details: Record<string, string>;
  };
  offer_merchant: {
    merchant_trust: number;
    shipping_returns: number;
    policy_clarity: number;
    brand_risk: number;
    compliance: number;
    details: Record<string, string>;
  };
  economics: {
    commission_component: number;
    conversion_component: number;
    aov_component: number;
    refund_adjustment: number;
    details: Record<string, string>;
  };
}

// --- Default Benchmarks by Category ---

const DEFAULT_BENCHMARKS: Record<string, CategoryBenchmarks> = {
  electronics: {
    avg_commission: 4, avg_cookie_days: 24, avg_conversion_rate: 2.5,
    avg_order_value: 120, avg_refund_rate: 5, avg_review_count: 500, avg_price: 100,
  },
  fashion: {
    avg_commission: 7, avg_cookie_days: 30, avg_conversion_rate: 3.0,
    avg_order_value: 65, avg_refund_rate: 15, avg_review_count: 200, avg_price: 50,
  },
  beauty: {
    avg_commission: 8, avg_cookie_days: 30, avg_conversion_rate: 3.5,
    avg_order_value: 45, avg_refund_rate: 8, avg_review_count: 300, avg_price: 30,
  },
  home: {
    avg_commission: 6, avg_cookie_days: 25, avg_conversion_rate: 2.0,
    avg_order_value: 90, avg_refund_rate: 10, avg_review_count: 150, avg_price: 80,
  },
  software: {
    avg_commission: 25, avg_cookie_days: 60, avg_conversion_rate: 5.0,
    avg_order_value: 200, avg_refund_rate: 8, avg_review_count: 100, avg_price: 150,
  },
  travel: {
    avg_commission: 5, avg_cookie_days: 20, avg_conversion_rate: 1.5,
    avg_order_value: 250, avg_refund_rate: 12, avg_review_count: 1000, avg_price: 200,
  },
  food: {
    avg_commission: 10, avg_cookie_days: 20, avg_conversion_rate: 4.0,
    avg_order_value: 40, avg_refund_rate: 5, avg_review_count: 200, avg_price: 35,
  },
  luxury: {
    avg_commission: 7, avg_cookie_days: 20, avg_conversion_rate: 1.0,
    avg_order_value: 400, avg_refund_rate: 12, avg_review_count: 50, avg_price: 300,
  },
};

const FALLBACK_BENCHMARKS: CategoryBenchmarks = {
  avg_commission: 5, avg_cookie_days: 30, avg_conversion_rate: 2.5,
  avg_order_value: 75, avg_refund_rate: 8, avg_review_count: 200, avg_price: 60,
};

/**
 * Get benchmarks for a category
 */
export function getBenchmarks(category: string | null): CategoryBenchmarks {
  if (!category) return FALLBACK_BENCHMARKS;
  const key = category.toLowerCase();
  return DEFAULT_BENCHMARKS[key] || FALLBACK_BENCHMARKS;
}

/**
 * Compute all three scores for a product
 */
export function computeScores(input: ScoringInput): ScoreResult {
  const pv = computeProductViability(input);
  const om = computeOfferMerchant(input);
  const ef = computeEconomicsFeasibility(input);

  return {
    product_viability: clamp(pv.total, 0, 100),
    offer_merchant: clamp(om.total, 0, 100),
    economics_feasibility: clamp(ef.total, 0, 100),
    breakdowns: {
      product_viability: pv.breakdown,
      offer_merchant: om.breakdown,
      economics: ef.breakdown,
    },
  };
}

// --- Product Viability Score (0-100) ---

function computeProductViability(input: ScoringInput) {
  const { product, categoryBenchmarks, userCategories } = input;

  // Demand signals (0-25): review count as proxy
  let demandSignals = 3; // minimum
  const reviewCount = product.review_count || 0;
  if (reviewCount >= 1000) demandSignals = 25;
  else if (reviewCount >= 500) demandSignals = 22;
  else if (reviewCount >= 100) demandSignals = 18;
  else if (reviewCount >= 50) demandSignals = 15;
  else if (reviewCount >= 10) demandSignals = 10;
  else if (reviewCount >= 1) demandSignals = 5;

  // Check for demand claims
  const hasBoughtBadge = product.claims.some(c => /bought|sold|popular/i.test(c));
  if (hasBoughtBadge) demandSignals = Math.min(25, demandSignals + 3);

  const demandDetails = `${reviewCount} reviews${hasBoughtBadge ? ', popular badge detected' : ''}`;

  // Review sentiment (0-25): star rating
  let reviewSentiment = 12; // neutral default
  const rating = product.rating;
  if (rating !== null) {
    if (rating >= 4.5) reviewSentiment = 25;
    else if (rating >= 4.2) reviewSentiment = 22;
    else if (rating >= 4.0) reviewSentiment = 20;
    else if (rating >= 3.5) reviewSentiment = 15;
    else if (rating >= 3.0) reviewSentiment = 10;
    else if (rating >= 2.0) reviewSentiment = 5;
    else reviewSentiment = 2;
  }
  const sentimentDetails = rating !== null ? `${rating}/5 stars` : 'No rating data';

  // Pricing competitiveness (0-25)
  let pricingCompetitiveness = 15; // neutral
  const price = product.price.amount;
  if (price !== null && categoryBenchmarks.avg_price > 0) {
    const ratio = price / categoryBenchmarks.avg_price;
    if (ratio <= 0.5) pricingCompetitiveness = 25; // significantly cheaper
    else if (ratio <= 0.8) pricingCompetitiveness = 22;
    else if (ratio <= 1.2) pricingCompetitiveness = 18; // competitive
    else if (ratio <= 1.5) pricingCompetitiveness = 12;
    else if (ratio <= 2.0) pricingCompetitiveness = 8;
    else pricingCompetitiveness = 4; // expensive
  }

  // On sale bonus
  if (product.price.original_amount && price && product.price.original_amount > price) {
    pricingCompetitiveness = Math.min(25, pricingCompetitiveness + 3);
  }
  const pricingDetails = price !== null
    ? `${product.price.currency} ${price} vs category avg ${categoryBenchmarks.avg_price}`
    : 'Price unknown';

  // Category fit (0-15): does product category match user's top categories?
  let categoryFit = 10; // neutral
  if (product.category && userCategories && userCategories.length > 0) {
    const match = userCategories.some(c => c.toLowerCase() === product.category?.toLowerCase());
    categoryFit = match ? 15 : 7;
  }
  const fitDetails = product.category || 'Category not detected';

  // Uniqueness (0-10): fewer alternatives = more unique
  // This is a simplified proxy; real uniqueness would need competitor analysis
  let uniqueness = 6; // neutral
  if (product.brand) {
    // Known major brands are less unique (many sellers), niche brands are more unique
    const majorBrands = ['amazon', 'nike', 'adidas', 'apple', 'samsung', 'sony', 'zara', 'hm'];
    const isMajor = majorBrands.some(b => product.brand!.toLowerCase().includes(b));
    uniqueness = isMajor ? 4 : 8;
  }
  const uniquenessDetails = product.brand ? `Brand: ${product.brand}` : 'Brand unknown';

  const total = demandSignals + reviewSentiment + pricingCompetitiveness + categoryFit + uniqueness;

  return {
    total,
    breakdown: {
      demand_signals: demandSignals,
      review_sentiment: reviewSentiment,
      pricing_competitiveness: pricingCompetitiveness,
      category_fit: categoryFit,
      uniqueness,
      details: {
        demand: demandDetails,
        sentiment: sentimentDetails,
        pricing: pricingDetails,
        fit: fitDetails,
        uniqueness: uniquenessDetails,
      },
    },
  };
}

// --- Offer & Merchant Score (0-100) ---

function computeOfferMerchant(input: ScoringInput) {
  const { product, reputation } = input;

  // Merchant trust (0-30): from Trustpilot/Google ratings
  let merchantTrust = 15; // neutral default
  if (reputation?.overall_rating !== null && reputation?.overall_rating !== undefined) {
    const r = reputation.overall_rating;
    if (r >= 4.5) merchantTrust = 30;
    else if (r >= 4.0) merchantTrust = 26;
    else if (r >= 3.5) merchantTrust = 20;
    else if (r >= 3.0) merchantTrust = 15;
    else if (r >= 2.0) merchantTrust = 8;
    else merchantTrust = 3;
  }
  const trustDetails = reputation?.overall_rating != null
    ? `${reputation.overall_rating}/5 (${reputation.overall_reviews || 0} reviews)`
    : 'No reputation data available';

  // Shipping & returns (0-20)
  let shippingReturns = 10; // neutral
  if (reputation) {
    if (reputation.has_shipping_complaints) shippingReturns -= 5;
    if (!reputation.has_shipping_complaints && reputation.overall_reviews && reputation.overall_reviews > 100) {
      shippingReturns += 5; // many reviews, no shipping complaints = good sign
    }
  }
  // Check product availability
  if (product.availability === 'in_stock') shippingReturns = Math.min(20, shippingReturns + 3);
  if (product.availability === 'out_of_stock') shippingReturns = Math.max(0, shippingReturns - 5);

  const shippingDetails = product.availability
    ? `Availability: ${product.availability}`
    : 'Availability unknown';

  // Policy clarity (0-15): based on merchant reputation signals
  let policyClarity = 10; // neutral
  if (reputation) {
    if (reputation.has_support_complaints) policyClarity -= 4;
    if (reputation.overall_rating && reputation.overall_rating >= 4.0) policyClarity += 3;
  }
  policyClarity = clamp(policyClarity, 0, 15);
  const policyDetails = reputation?.has_support_complaints
    ? 'Support complaints detected'
    : 'No support issues detected';

  // Brand risk (0-20): known brand = lower risk
  let brandRisk = 12; // neutral
  if (product.brand) {
    // Known brands get higher scores
    const knownBrands = [
      'sony', 'samsung', 'apple', 'nike', 'adidas', 'puma', 'bose', 'dyson',
      'philips', 'canon', 'logitech', 'sephora', 'zalando', 'asos', 'hm',
      'zara', 'douglas', 'ikea', 'lego', 'bosch', 'dell', 'hp', 'lenovo',
    ];
    const isKnown = knownBrands.some(b => product.brand!.toLowerCase().includes(b));
    brandRisk = isKnown ? 20 : 12;

    // If unknown brand and low review count, higher risk
    if (!isKnown && (!product.review_count || product.review_count < 10)) {
      brandRisk = 5;
    }
  } else {
    brandRisk = 5; // unknown brand = risky
  }
  const brandDetails = product.brand || 'Brand not identified';

  // Compliance (0-15): check for suspicious claims
  let compliance = 13; // assume ok
  if (product.claims.length > 0 || product.description) {
    const text = [...product.claims, product.description || ''].join(' ').toLowerCase();
    const flaggedTerms = [
      'miracle', 'cure', 'guaranteed results', 'lose weight fast',
      'fda approved', 'clinically proven', 'doctor recommended',
    ];
    const hasFlags = flaggedTerms.some(term => text.includes(term));
    if (hasFlags) compliance = 5;
  }
  const complianceDetails = compliance < 10 ? 'Suspicious claims detected' : 'No compliance concerns';

  const total = merchantTrust + shippingReturns + policyClarity + brandRisk + compliance;

  return {
    total,
    breakdown: {
      merchant_trust: merchantTrust,
      shipping_returns: shippingReturns,
      policy_clarity: policyClarity,
      brand_risk: brandRisk,
      compliance,
      details: {
        trust: trustDetails,
        shipping: shippingDetails,
        policy: policyDetails,
        brand: brandDetails,
        compliance: complianceDetails,
      },
    },
  };
}

// --- Economics Feasibility Score (0-100) ---

function computeEconomicsFeasibility(input: ScoringInput) {
  const { product, commission, categoryBenchmarks } = input;

  // Use commission data if available, otherwise use category averages
  const commRate = commission
    ? (commission.rate_low + commission.rate_high) / 2
    : categoryBenchmarks.avg_commission;
  const cookieDays = commission?.cookie_days ?? categoryBenchmarks.avg_cookie_days;
  const conversionRate = commission?.avg_conversion_rate ?? categoryBenchmarks.avg_conversion_rate;
  const aov = commission?.avg_order_value ?? product.price.amount ?? categoryBenchmarks.avg_order_value;
  const refundRate = commission?.refund_rate ?? categoryBenchmarks.avg_refund_rate;

  // Commission component (0-40): how good is the commission rate?
  let commissionComponent = 20; // neutral
  const commRatio = commRate / categoryBenchmarks.avg_commission;
  if (commRatio >= 2.0) commissionComponent = 40;
  else if (commRatio >= 1.5) commissionComponent = 35;
  else if (commRatio >= 1.2) commissionComponent = 30;
  else if (commRatio >= 0.9) commissionComponent = 25;
  else if (commRatio >= 0.6) commissionComponent = 18;
  else if (commRatio >= 0.3) commissionComponent = 10;
  else commissionComponent = 5;

  // Cookie bonus
  if (cookieDays >= 60) commissionComponent = Math.min(40, commissionComponent + 3);
  else if (cookieDays <= 7) commissionComponent = Math.max(0, commissionComponent - 3);

  const commDetails = commission
    ? `${commission.rate_low}-${commission.rate_high}% (${commission.network}), ${cookieDays}d cookie`
    : `Category avg: ${categoryBenchmarks.avg_commission}%`;

  // Conversion component (0-25): expected conversion rate
  let conversionComponent = 12; // neutral
  const convRatio = conversionRate / categoryBenchmarks.avg_conversion_rate;
  if (convRatio >= 1.5) conversionComponent = 25;
  else if (convRatio >= 1.2) conversionComponent = 22;
  else if (convRatio >= 0.9) conversionComponent = 18;
  else if (convRatio >= 0.6) conversionComponent = 12;
  else if (convRatio >= 0.3) conversionComponent = 7;
  else conversionComponent = 3;
  const convDetails = `Est. conversion: ${conversionRate}%`;

  // AOV component (0-20): average order value
  let aovComponent = 10; // neutral
  const aovRatio = aov / categoryBenchmarks.avg_order_value;
  if (aovRatio >= 2.0) aovComponent = 20;
  else if (aovRatio >= 1.5) aovComponent = 18;
  else if (aovRatio >= 1.0) aovComponent = 14;
  else if (aovRatio >= 0.7) aovComponent = 10;
  else if (aovRatio >= 0.4) aovComponent = 6;
  else aovComponent = 3;
  const aovDetails = `AOV: ${product.price.currency} ${aov.toFixed(0)}`;

  // Refund risk adjustment (0-15): lower refund = more points
  let refundAdjustment = 10; // neutral
  if (refundRate <= 3) refundAdjustment = 15;
  else if (refundRate <= 5) refundAdjustment = 13;
  else if (refundRate <= 10) refundAdjustment = 10;
  else if (refundRate <= 15) refundAdjustment = 7;
  else if (refundRate <= 25) refundAdjustment = 4;
  else refundAdjustment = 2;
  const refundDetails = `Refund rate: ~${refundRate}%`;

  const total = commissionComponent + conversionComponent + aovComponent + refundAdjustment;

  return {
    total,
    breakdown: {
      commission_component: commissionComponent,
      conversion_component: conversionComponent,
      aov_component: aovComponent,
      refund_adjustment: refundAdjustment,
      details: {
        commission: commDetails,
        conversion: convDetails,
        aov: aovDetails,
        refund: refundDetails,
      },
    },
  };
}

// --- Confidence Calculation ---

export interface ConfidenceResult {
  level: 'LOW' | 'MED' | 'HIGH';
  evidence: {
    sources: Array<{
      name: string;
      type: string;
      count: number;
      recency_days: number;
    }>;
    cross_source_agreement: 'LOW' | 'MED' | 'HIGH';
    total_data_points: number;
  };
}

export function computeConfidence(
  product: ScrapedProductData,
  reputation: ReputationData | null,
  commission: CommissionData | null
): ConfidenceResult {
  const sources: ConfidenceResult['evidence']['sources'] = [];
  let totalPoints = 0;

  // On-page data
  let onPageCount = 0;
  if (product.title) onPageCount++;
  if (product.brand) onPageCount++;
  if (product.price.amount) onPageCount++;
  if (product.rating) onPageCount++;
  if (product.review_count) onPageCount++;
  if (product.description) onPageCount++;
  sources.push({ name: 'Product Page', type: 'on_page', count: onPageCount, recency_days: 0 });
  totalPoints += onPageCount;

  // Reputation data
  if (reputation) {
    let repCount = 0;
    if (reputation.trustpilot_rating) repCount++;
    if (reputation.google_rating) repCount++;
    if (reputation.overall_reviews) repCount++;
    sources.push({ name: 'Merchant Reputation', type: 'reputation', count: repCount, recency_days: 1 });
    totalPoints += repCount;
  }

  // Commission data
  if (commission) {
    sources.push({ name: 'Affiliate Programs DB', type: 'commission_db', count: 1, recency_days: 7 });
    totalPoints += 1;
  }

  // Review data
  if (product.review_count && product.review_count > 0) {
    sources.push({ name: 'Product Reviews', type: 'reviews', count: product.review_count, recency_days: 0 });
    totalPoints += 1;
  }

  // Cross-source agreement
  let agreement: 'LOW' | 'MED' | 'HIGH' = 'LOW';
  if (sources.length >= 3) agreement = 'HIGH';
  else if (sources.length >= 2) agreement = 'MED';

  // Overall confidence
  let level: 'LOW' | 'MED' | 'HIGH' = 'LOW';
  if (totalPoints >= 8 && sources.length >= 3) level = 'HIGH';
  else if (totalPoints >= 4 && sources.length >= 2) level = 'MED';

  return {
    level,
    evidence: {
      sources,
      cross_source_agreement: agreement,
      total_data_points: totalPoints,
    },
  };
}

// --- Earning Band Calculation ---

export interface EarningBand {
  low: number;
  high: number;
  currency: string;
  assumptions: {
    aov: number;
    conversion_rate: number;
    refund_rate: number;
    estimated_monthly_clicks: number;
  };
}

export function computeEarningBand(
  product: ScrapedProductData,
  commission: CommissionData | null,
  benchmarks: CategoryBenchmarks
): EarningBand {
  const commLow = commission?.rate_low ?? benchmarks.avg_commission * 0.8;
  const commHigh = commission?.rate_high ?? benchmarks.avg_commission * 1.2;
  const convRate = (commission?.avg_conversion_rate ?? benchmarks.avg_conversion_rate) / 100;
  const aov = commission?.avg_order_value ?? product.price.amount ?? benchmarks.avg_order_value;
  const refundRate = (commission?.refund_rate ?? benchmarks.avg_refund_rate) / 100;

  // Assume a range of monthly clicks (conservative to optimistic)
  const clicksLow = 500;
  const clicksHigh = 2000;

  // low = low clicks * low commission * conversion * AOV * (1 - refund)
  const earningLow = clicksLow * (commLow / 100) * convRate * aov * (1 - refundRate);
  const earningHigh = clicksHigh * (commHigh / 100) * convRate * aov * (1 - refundRate);

  return {
    low: Math.round(earningLow * 100) / 100,
    high: Math.round(earningHigh * 100) / 100,
    currency: product.price.currency || 'EUR',
    assumptions: {
      aov: Math.round(aov),
      conversion_rate: Math.round(convRate * 10000) / 100,
      refund_rate: Math.round(refundRate * 10000) / 100,
      estimated_monthly_clicks: Math.round((clicksLow + clicksHigh) / 2),
    },
  };
}

// --- Utility ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
