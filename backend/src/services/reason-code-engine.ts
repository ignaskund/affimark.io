/**
 * Reason Code Engine
 *
 * For every recommendation, stores structured reason codes with
 * supporting features. The agent generates explanations from codes,
 * and they can be tested/evaluated automatically.
 */

export type ReasonCode =
  | 'MATCH_CATEGORY'
  | 'MATCH_SUBCATEGORY'
  | 'HIGH_COMMISSION'
  | 'FAST_SHIPPING'
  | 'STRONG_REVIEWS'
  | 'BRAND_RECOGNITION'
  | 'PRICE_FIT'
  | 'AUDIENCE_PRICE_MATCH'
  | 'AUDIENCE_CATEGORY_MATCH'
  | 'STOREFRONT_ELIGIBLE'
  | 'PREMIUM_NETWORK'
  | 'LONG_COOKIE'
  | 'EASY_APPROVAL'
  | 'ECO_FRIENDLY'
  | 'DESIGN_QUALITY'
  | 'LOW_REFUND_RISK'
  | 'HIGH_DEMAND'
  | 'BRAND_FAMILIAR'
  | 'OUTCOME_VERIFIED'
  | 'REQUIRES_VERIFICATION';

interface SupportingFeature {
  field: string;
  value: string | number | boolean;
}

export interface ReasonEntry {
  code: ReasonCode;
  weight: number;
  supportingFeatures: SupportingFeature[];
}

export interface RecommendationReasons {
  productId: string;
  codes: ReasonEntry[];
  summary: string;
}

interface ProductForReasons {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  commissionRate?: number;
  cookieDurationDays?: number;
  affiliateNetwork?: string;
  merchant?: string;
  matchScore: number;
  outcomeFeasibility?: number;
  inStock?: boolean;
  requiresVerification?: boolean;
  productPriorityKpis?: Array<{ id: string; score: number }>;
}

interface ReasonContext {
  intentCategory?: string;
  intentSubcategory?: string;
  userTopBrands?: string[];
  userAvgPricePoint?: number;
  userDominantCategories?: string[];
}

const REASON_TEMPLATES: Record<ReasonCode, string> = {
  MATCH_CATEGORY: 'Matches your {category} content focus',
  MATCH_SUBCATEGORY: 'Precise match for {subcategory}',
  HIGH_COMMISSION: '{rate}% commission rate',
  FAST_SHIPPING: 'Fast shipping via {network}',
  STRONG_REVIEWS: '{count} reviews, {rating}★ average',
  BRAND_RECOGNITION: '{brand} is a recognized brand',
  PRICE_FIT: 'Price aligns with your typical range',
  AUDIENCE_PRICE_MATCH: 'Fits your audience\'s price expectations',
  AUDIENCE_CATEGORY_MATCH: 'Aligns with your audience\'s interests',
  STOREFRONT_ELIGIBLE: 'Available via your {storefront} account',
  PREMIUM_NETWORK: 'On {network} (trusted network)',
  LONG_COOKIE: '{days}-day cookie window',
  EASY_APPROVAL: 'Easy approval on {network}',
  ECO_FRIENDLY: 'Sustainability signals detected',
  DESIGN_QUALITY: '{brand} known for design quality',
  LOW_REFUND_RISK: 'Low return risk for this category',
  HIGH_DEMAND: 'Strong demand evidence ({count} reviews)',
  BRAND_FAMILIAR: 'You\'ve promoted {brand} before',
  OUTCOME_VERIFIED: 'High confidence recommendation',
  REQUIRES_VERIFICATION: 'Verify program terms before promoting',
};

/**
 * Generate structured reason codes for a product recommendation
 */
export function generateReasonCodes(
  product: ProductForReasons,
  context: ReasonContext,
): RecommendationReasons {
  const codes: ReasonEntry[] = [];

  // Category match
  if (context.intentCategory && product.category) {
    const cat = product.category.toLowerCase();
    const intent = context.intentCategory.toLowerCase();
    if (cat.includes(intent) || intent.includes(cat)) {
      codes.push({
        code: 'MATCH_CATEGORY',
        weight: 3,
        supportingFeatures: [
          { field: 'product_category', value: product.category },
          { field: 'intent_category', value: context.intentCategory },
        ],
      });
    }
  }

  // Commission rate
  if (product.commissionRate && product.commissionRate >= 5) {
    codes.push({
      code: 'HIGH_COMMISSION',
      weight: product.commissionRate >= 10 ? 4 : 2,
      supportingFeatures: [
        { field: 'commission_rate', value: product.commissionRate },
        { field: 'network', value: product.affiliateNetwork || 'unknown' },
      ],
    });
  }

  // Reviews + demand
  if (product.reviewCount && product.reviewCount >= 100) {
    codes.push({
      code: 'STRONG_REVIEWS',
      weight: product.reviewCount >= 1000 ? 3 : 2,
      supportingFeatures: [
        { field: 'review_count', value: product.reviewCount },
        { field: 'rating', value: product.rating || 0 },
      ],
    });
  }

  if (product.reviewCount && product.reviewCount >= 500) {
    codes.push({
      code: 'HIGH_DEMAND',
      weight: 2,
      supportingFeatures: [
        { field: 'review_count', value: product.reviewCount },
      ],
    });
  }

  // Brand recognition
  const majorBrands = [
    'apple', 'samsung', 'sony', 'nike', 'adidas', 'bose', 'dyson',
    'philips', 'loreal', 'clinique', 'dell', 'lenovo', 'microsoft',
  ];
  if (majorBrands.some(b => (product.brand || '').toLowerCase().includes(b))) {
    codes.push({
      code: 'BRAND_RECOGNITION',
      weight: 2,
      supportingFeatures: [{ field: 'brand', value: product.brand }],
    });
  }

  // Brand familiarity
  if (context.userTopBrands?.some(b =>
    b.toLowerCase() === (product.brand || '').toLowerCase()
  )) {
    codes.push({
      code: 'BRAND_FAMILIAR',
      weight: 3,
      supportingFeatures: [{ field: 'brand', value: product.brand }],
    });
  }

  // Price fit
  if (context.userAvgPricePoint && context.userAvgPricePoint > 0) {
    const ratio = Math.abs(product.price - context.userAvgPricePoint) / context.userAvgPricePoint;
    if (ratio < 0.3) {
      codes.push({
        code: 'PRICE_FIT',
        weight: 2,
        supportingFeatures: [
          { field: 'product_price', value: product.price },
          { field: 'user_avg_price', value: context.userAvgPricePoint },
        ],
      });
      codes.push({
        code: 'AUDIENCE_PRICE_MATCH',
        weight: 2,
        supportingFeatures: [
          { field: 'price_ratio', value: Number((1 - ratio).toFixed(2)) },
        ],
      });
    }
  }

  // Category alignment with audience
  if (context.userDominantCategories?.some(dc =>
    (product.category || '').toLowerCase().includes(dc.toLowerCase())
  )) {
    codes.push({
      code: 'AUDIENCE_CATEGORY_MATCH',
      weight: 3,
      supportingFeatures: [
        { field: 'product_category', value: product.category },
      ],
    });
  }

  // Network quality
  const premiumNetworks = ['amazon', 'awin', 'cj', 'impact'];
  const network = (product.affiliateNetwork || '').toLowerCase();
  if (premiumNetworks.some(n => network.includes(n))) {
    codes.push({
      code: 'PREMIUM_NETWORK',
      weight: 1,
      supportingFeatures: [{ field: 'network', value: product.affiliateNetwork || '' }],
    });
  }

  // Cookie duration
  if (product.cookieDurationDays && product.cookieDurationDays >= 14) {
    codes.push({
      code: 'LONG_COOKIE',
      weight: 1,
      supportingFeatures: [{ field: 'cookie_days', value: product.cookieDurationDays }],
    });
  }

  // Easy approval
  if (network.includes('amazon')) {
    codes.push({
      code: 'EASY_APPROVAL',
      weight: 1,
      supportingFeatures: [{ field: 'network', value: product.affiliateNetwork || '' }],
    });
  }

  // Outcome verification status
  if (product.requiresVerification) {
    codes.push({
      code: 'REQUIRES_VERIFICATION',
      weight: -1,
      supportingFeatures: [
        { field: 'feasibility_score', value: product.outcomeFeasibility || 0 },
      ],
    });
  } else if (product.outcomeFeasibility && product.outcomeFeasibility >= 70) {
    codes.push({
      code: 'OUTCOME_VERIFIED',
      weight: 2,
      supportingFeatures: [
        { field: 'feasibility_score', value: product.outcomeFeasibility },
      ],
    });
  }

  // Sort by weight descending
  codes.sort((a, b) => b.weight - a.weight);

  // Generate summary from top codes
  const summary = codes
    .filter(c => c.weight > 0)
    .slice(0, 3)
    .map(c => renderReasonTemplate(c))
    .join('. ');

  return {
    productId: product.id,
    codes,
    summary: summary || 'Alternative product in your category',
  };
}

function renderReasonTemplate(entry: ReasonEntry): string {
  let template = REASON_TEMPLATES[entry.code] || entry.code;
  for (const feat of entry.supportingFeatures) {
    template = template.replace(`{${feat.field}}`, String(feat.value));
  }
  // Also handle named placeholders
  const featureMap = Object.fromEntries(
    entry.supportingFeatures.map(f => [f.field, f.value])
  );
  template = template
    .replace('{category}', String(featureMap['product_category'] || featureMap['intent_category'] || ''))
    .replace('{subcategory}', String(featureMap['intent_subcategory'] || ''))
    .replace('{rate}', String(featureMap['commission_rate'] || ''))
    .replace('{network}', String(featureMap['network'] || ''))
    .replace('{count}', String(featureMap['review_count'] || ''))
    .replace('{rating}', String(featureMap['rating'] || ''))
    .replace('{brand}', String(featureMap['brand'] || ''))
    .replace('{days}', String(featureMap['cookie_days'] || ''))
    .replace('{storefront}', String(featureMap['network'] || ''));
  return template;
}

/**
 * Extract just the reason code strings (for storage/testing)
 */
export function extractCodeStrings(reasons: RecommendationReasons): ReasonCode[] {
  return reasons.codes.map(c => c.code);
}
