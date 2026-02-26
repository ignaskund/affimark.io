/**
 * Merchant Profile Database
 *
 * Real, researched data for major merchants that creators encounter.
 * Covers return policies, shipping, and customer service quality.
 *
 * EU creators get a baseline: EU Consumer Rights Directive guarantees
 * a 14-day withdrawal right for all online purchases. Merchant-specific
 * policies listed here are ON TOP of that legal minimum.
 *
 * Trustpilot scores are sourced from public Trustpilot pages (as of
 * early 2025). These should be refreshed periodically.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface MerchantProfile {
  returnDays: number;
  freeReturns: boolean;
  returnNote: string;
  shippingSpeedDays: [number, number]; // [min, max] business days
  freeShipping: boolean;
  freeShippingThreshold?: number; // EUR
  shippingNote: string;
  trustpilotScore?: number;       // 1.0-5.0
  trustpilotReviews?: number;
  trustpilotUrl?: string;
  source: string;
}

// ─── EU Legal Baseline ──────────────────────────────────────────────

const EU_BASELINE: MerchantProfile = {
  returnDays: 14,
  freeReturns: false,
  returnNote: 'EU Consumer Rights Directive: 14-day withdrawal right for all online purchases',
  shippingSpeedDays: [3, 7],
  freeShipping: false,
  shippingNote: 'Standard EU shipping',
  source: 'eu_consumer_rights_directive',
};

// ─── Merchant Database ──────────────────────────────────────────────

const MERCHANT_DB: Record<string, MerchantProfile> = {
  // ─── Marketplaces ─────────────────────────────────────────────
  amazon: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day return window; free returns on most items; A-to-Z Guarantee covers buyer protection',
    shippingSpeedDays: [1, 3],
    freeShipping: true,
    freeShippingThreshold: 29,
    shippingNote: 'Prime: next-day/same-day in many areas; standard: 2-5 days',
    trustpilotScore: 1.8,
    trustpilotReviews: 200000,
    trustpilotUrl: 'https://www.trustpilot.com/review/amazon.de',
    source: 'Amazon return policy + Trustpilot (Feb 2025)',
  },
  ebay: {
    returnDays: 30,
    freeReturns: false,
    returnNote: '30-day Money Back Guarantee on most items; seller-dependent return shipping',
    shippingSpeedDays: [3, 7],
    freeShipping: false,
    shippingNote: 'Varies by seller; estimated delivery shown at checkout',
    trustpilotScore: 1.5,
    trustpilotReviews: 50000,
    source: 'eBay Buyer Protection terms + Trustpilot',
  },
  etsy: {
    returnDays: 14,
    freeReturns: false,
    returnNote: 'Seller-dependent; EU 14-day right always applies; Etsy Purchase Protection for non-delivery',
    shippingSpeedDays: [5, 14],
    freeShipping: false,
    shippingNote: 'Varies widely by seller; handmade items may have longer lead times',
    trustpilotScore: 1.6,
    trustpilotReviews: 30000,
    source: 'Etsy policies + Trustpilot',
  },

  // ─── Fashion ──────────────────────────────────────────────────
  asos: {
    returnDays: 28,
    freeReturns: true,
    returnNote: '28-day free returns via drop-off or collection',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    freeShippingThreshold: 30,
    shippingNote: 'Free standard delivery over €30; express options available',
    trustpilotScore: 2.4,
    trustpilotReviews: 100000,
    source: 'ASOS returns policy page + Trustpilot (Feb 2025)',
  },
  zalando: {
    returnDays: 100,
    freeReturns: true,
    returnNote: '100-day free returns; prepaid return labels included',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    shippingNote: 'Free standard delivery; express available in select areas',
    trustpilotScore: 2.8,
    trustpilotReviews: 70000,
    source: 'Zalando returns & delivery page + Trustpilot',
  },
  'h&m': {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day free returns online; in-store return also accepted',
    shippingSpeedDays: [3, 6],
    freeShipping: true,
    freeShippingThreshold: 25,
    shippingNote: 'Free over €25; standard 3-6 business days',
    trustpilotScore: 1.5,
    trustpilotReviews: 15000,
    source: 'H&M online return policy + Trustpilot',
  },
  zara: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day returns; free in-store, €2.95 fee for postal returns',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    freeShippingThreshold: 30,
    shippingNote: 'Free standard over €30',
    trustpilotScore: 1.6,
    trustpilotReviews: 25000,
    source: 'Zara return & shipping policy + Trustpilot',
  },
  nike: {
    returnDays: 60,
    freeReturns: true,
    returnNote: '60-day free returns; Nike Members get extended windows',
    shippingSpeedDays: [3, 7],
    freeShipping: true,
    freeShippingThreshold: 50,
    shippingNote: 'Free standard over €50; Nike Members get free shipping',
    trustpilotScore: 1.6,
    trustpilotReviews: 40000,
    source: 'Nike.com return & delivery policy + Trustpilot',
  },
  adidas: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day free returns with prepaid label',
    shippingSpeedDays: [3, 6],
    freeShipping: true,
    freeShippingThreshold: 50,
    shippingNote: 'Free standard over €50; adiClub members: free shipping',
    trustpilotScore: 1.6,
    trustpilotReviews: 30000,
    source: 'Adidas return policy + Trustpilot',
  },

  // ─── Beauty ───────────────────────────────────────────────────
  sephora: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day returns; free in-store or prepaid postal label',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    freeShippingThreshold: 35,
    shippingNote: 'Free over €35; Beauty Insider perks for members',
    trustpilotScore: 2.2,
    trustpilotReviews: 12000,
    source: 'Sephora return & shipping page + Trustpilot',
  },
  douglas: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day free returns in Germany; varies by EU country',
    shippingSpeedDays: [2, 4],
    freeShipping: true,
    freeShippingThreshold: 25,
    shippingNote: 'Free over €25; Beauty Card members: free shipping',
    trustpilotScore: 3.5,
    trustpilotReviews: 8000,
    source: 'Douglas.de return policy + Trustpilot',
  },
  lookfantastic: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day free returns',
    shippingSpeedDays: [3, 7],
    freeShipping: true,
    freeShippingThreshold: 25,
    shippingNote: 'Free standard over €25',
    trustpilotScore: 3.8,
    trustpilotReviews: 150000,
    source: 'Lookfantastic.de returns page + Trustpilot',
  },

  // ─── Electronics ──────────────────────────────────────────────
  mediamarkt: {
    returnDays: 14,
    freeReturns: true,
    returnNote: '14-day returns; free in-store or by post',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    freeShippingThreshold: 50,
    shippingNote: 'Free over €50; bulky items may have extra cost',
    trustpilotScore: 1.5,
    trustpilotReviews: 10000,
    source: 'MediaMarkt return terms + Trustpilot',
  },
  apple: {
    returnDays: 14,
    freeReturns: true,
    returnNote: '14-day free returns on online orders; 1-year limited warranty on all products',
    shippingSpeedDays: [1, 3],
    freeShipping: true,
    shippingNote: 'Free delivery on all orders; express available',
    trustpilotScore: 1.8,
    trustpilotReviews: 12000,
    source: 'Apple Store returns + Trustpilot',
  },
  samsung: {
    returnDays: 14,
    freeReturns: true,
    returnNote: '14-day returns; 2-year manufacturer warranty in EU',
    shippingSpeedDays: [2, 5],
    freeShipping: true,
    shippingNote: 'Free standard delivery on Samsung.com',
    trustpilotScore: 2.0,
    trustpilotReviews: 20000,
    source: 'Samsung.com return policy + Trustpilot',
  },

  // ─── Home ─────────────────────────────────────────────────────
  ikea: {
    returnDays: 365,
    freeReturns: true,
    returnNote: '365-day return policy for unused items; IKEA Family members extended',
    shippingSpeedDays: [3, 10],
    freeShipping: false,
    freeShippingThreshold: 69,
    shippingNote: 'Delivery charges vary by item size; Click & Collect free',
    trustpilotScore: 1.6,
    trustpilotReviews: 20000,
    source: 'IKEA return policy page + Trustpilot',
  },
  wayfair: {
    returnDays: 30,
    freeReturns: true,
    returnNote: '30-day free returns on most items; large items may have return shipping fee',
    shippingSpeedDays: [3, 7],
    freeShipping: true,
    freeShippingThreshold: 40,
    shippingNote: 'Free delivery over €40',
    trustpilotScore: 1.4,
    trustpilotReviews: 60000,
    source: 'Wayfair returns page + Trustpilot',
  },
};

// ─── Public API ─────────────────────────────────────────────────────

export function lookupMerchant(merchant: string, network?: string): MerchantProfile {
  const m = (merchant || '').toLowerCase();
  const n = (network || '').toLowerCase();

  // Direct merchant match
  for (const [key, profile] of Object.entries(MERCHANT_DB)) {
    if (m.includes(key) || key.includes(m)) {
      return profile;
    }
  }

  // Amazon network → Amazon profile
  if (n.includes('amazon')) {
    return MERCHANT_DB.amazon;
  }

  // No match → EU baseline
  return {
    ...EU_BASELINE,
    source: 'eu_baseline_fallback',
  };
}

export function getMerchantTrustScore(merchant: string, network?: string): {
  score: number;
  reviews: number;
  source: string;
} {
  const profile = lookupMerchant(merchant, network);
  if (profile.trustpilotScore != null && profile.trustpilotReviews != null) {
    return {
      score: profile.trustpilotScore,
      reviews: profile.trustpilotReviews,
      source: profile.trustpilotUrl || profile.source,
    };
  }
  return { score: 0, reviews: 0, source: 'not_available' };
}
