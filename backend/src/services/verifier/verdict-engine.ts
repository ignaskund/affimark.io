/**
 * Verdict Engine for Product Verifier
 *
 * Takes scores + confidence + hard-stop flags and produces:
 * - Verdict: GREEN / YELLOW / RED / TEST_FIRST
 * - Primary action recommendation
 * - Top 3 pros and top 3 risks (deterministic selection)
 */

import type { ScoreResult, ScoreBreakdowns, ConfidenceResult } from './scoring-engine';
import type { ScrapedProductData } from './page-scraper';
import type { CommissionData, ReputationData } from './scoring-engine';

// --- Types ---

export interface VerdictResult {
  status: 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST';
  primary_action: 'APPROVE' | 'ALT_BRAND' | 'ALT_PRODUCT' | 'TEST_FIRST';
  hard_stop_flags: string[];
  top_pros: string[];
  top_risks: string[];
  key_assumptions: string[];
}

export interface VerdictInput {
  scores: ScoreResult;
  confidence: ConfidenceResult;
  product: ScrapedProductData;
  reputation: ReputationData | null;
  commission: CommissionData | null;
}

// --- Hard Stop Detection ---

interface HardStopCheck {
  flag: string;
  check: (input: VerdictInput) => boolean;
}

const HARD_STOP_CHECKS: HardStopCheck[] = [
  {
    flag: 'MERCHANT_RISK_EXTREME',
    check: (input) => {
      if (!input.reputation) return false;
      // Merchant rating below 2.0 = extreme risk
      return input.reputation.overall_rating !== null && input.reputation.overall_rating < 2.0;
    },
  },
  {
    flag: 'COMPLIANCE_RISK_HIGH',
    check: (input) => {
      const text = [
        ...(input.product.claims || []),
        input.product.description || '',
      ].join(' ').toLowerCase();

      const dangerousPatterns = [
        'miracle cure', 'guaranteed weight loss', 'fda approved',
        'cures cancer', 'instant results guaranteed', '100% cure',
      ];
      return dangerousPatterns.some(p => text.includes(p));
    },
  },
  {
    flag: 'EVIDENCE_TOO_THIN',
    check: (input) => {
      // If confidence is LOW and we have very little data
      return input.confidence.level === 'LOW' &&
        input.confidence.evidence.total_data_points <= 2;
    },
  },
  {
    flag: 'PRODUCT_PAGE_NOT_FOUND',
    check: (input) => {
      // No title and no price = likely not a product page
      return !input.product.title && !input.product.price.amount;
    },
  },
  {
    flag: 'OUT_OF_STOCK',
    check: (input) => {
      return input.product.availability === 'out_of_stock';
    },
  },
];

/**
 * Compute the verdict for a product analysis
 */
export function computeVerdict(input: VerdictInput): VerdictResult {
  const { scores, confidence } = input;

  // Check hard stops
  const hardStopFlags: string[] = [];
  for (const check of HARD_STOP_CHECKS) {
    if (check.check(input)) {
      hardStopFlags.push(check.flag);
    }
  }

  // Determine verdict status
  const status = determineStatus(scores, confidence, hardStopFlags);

  // Determine primary action
  const primaryAction = determinePrimaryAction(status, scores, hardStopFlags);

  // Generate pros and risks
  const topPros = generateTopPros(input);
  const topRisks = generateTopRisks(input, hardStopFlags);
  const keyAssumptions = generateKeyAssumptions(input);

  return {
    status,
    primary_action: primaryAction,
    hard_stop_flags: hardStopFlags,
    top_pros: topPros.slice(0, 3),
    top_risks: topRisks.slice(0, 3),
    key_assumptions: keyAssumptions.slice(0, 3),
  };
}

/**
 * Determine verdict status from scores and flags
 */
function determineStatus(
  scores: ScoreResult,
  confidence: ConfidenceResult,
  hardStopFlags: string[]
): VerdictResult['status'] {
  // Hard stops that force RED
  const redFlags = ['MERCHANT_RISK_EXTREME', 'COMPLIANCE_RISK_HIGH', 'PRODUCT_PAGE_NOT_FOUND'];
  if (hardStopFlags.some(f => redFlags.includes(f))) {
    return 'RED';
  }

  // Low confidence = TEST_FIRST (unless other flags force RED)
  if (confidence.level === 'LOW') {
    return 'TEST_FIRST';
  }

  const pv = scores.product_viability;
  const om = scores.offer_merchant;
  const ef = scores.economics_feasibility;
  const minScore = Math.min(pv, om, ef);
  const avgScore = (pv + om + ef) / 3;

  // RED: any score below 40
  if (minScore < 40) return 'RED';

  // Out of stock is a yellow flag
  if (hardStopFlags.includes('OUT_OF_STOCK')) return 'YELLOW';

  // GREEN: all scores above 65
  if (pv >= 65 && om >= 65 && ef >= 65) return 'GREEN';

  // YELLOW: anything in between
  if (avgScore >= 50) return 'YELLOW';

  return 'RED';
}

/**
 * Determine the recommended primary action
 */
function determinePrimaryAction(
  status: VerdictResult['status'],
  scores: ScoreResult,
  hardStopFlags: string[]
): VerdictResult['primary_action'] {
  if (status === 'TEST_FIRST') return 'TEST_FIRST';
  if (status === 'GREEN') return 'APPROVE';

  // For YELLOW/RED, suggest alternatives based on which score is lowest
  const { product_viability, offer_merchant, economics_feasibility } = scores;
  const minScore = Math.min(product_viability, offer_merchant, economics_feasibility);

  if (minScore === offer_merchant || hardStopFlags.includes('MERCHANT_RISK_EXTREME')) {
    // Merchant is the problem -> try different brand
    return 'ALT_BRAND';
  }

  if (minScore === economics_feasibility) {
    // Economics is the problem -> try different brand with better commission
    return 'ALT_BRAND';
  }

  if (minScore === product_viability) {
    // Product itself is the problem -> try different product from same brand
    return 'ALT_PRODUCT';
  }

  return 'ALT_BRAND';
}

/**
 * Generate top pros from score breakdowns
 */
function generateTopPros(input: VerdictInput): string[] {
  const pros: Array<{ text: string; score: number }> = [];
  const { scores, product, commission, reputation } = input;
  const bd = scores.breakdowns;

  // Product viability pros
  if (bd.product_viability.demand_signals >= 18) {
    const count = product.review_count || 0;
    pros.push({ text: `High demand: ${count.toLocaleString()} reviews indicate strong market interest`, score: bd.product_viability.demand_signals });
  }
  if (bd.product_viability.review_sentiment >= 20) {
    pros.push({ text: `Excellent reviews: ${product.rating}/5 star rating shows high customer satisfaction`, score: bd.product_viability.review_sentiment });
  }
  if (bd.product_viability.pricing_competitiveness >= 18) {
    pros.push({ text: `Competitively priced within category, easier sell for your audience`, score: bd.product_viability.pricing_competitiveness });
  }

  // Offer & merchant pros
  if (bd.offer_merchant.merchant_trust >= 24) {
    const rating = reputation?.overall_rating;
    pros.push({ text: `Trusted merchant${rating ? ` (${rating}/5 reputation)` : ''}: low risk of customer complaints`, score: bd.offer_merchant.merchant_trust });
  }
  if (bd.offer_merchant.brand_risk >= 18) {
    pros.push({ text: `${product.brand || 'This brand'} is well-known, increasing conversion confidence`, score: bd.offer_merchant.brand_risk });
  }

  // Economics pros
  if (bd.economics.commission_component >= 28) {
    const rate = commission ? `${commission.rate_low}-${commission.rate_high}%` : 'above average';
    pros.push({ text: `Strong commission rate (${rate}), better than category average`, score: bd.economics.commission_component });
  }
  if (bd.economics.aov_component >= 14) {
    pros.push({ text: `High average order value increases your earnings per conversion`, score: bd.economics.aov_component });
  }
  if (commission && commission.cookie_days >= 30) {
    pros.push({ text: `${commission.cookie_days}-day cookie window gives more time for conversions`, score: 15 });
  }

  // Sort by score descending, take top 3
  return pros.sort((a, b) => b.score - a.score).map(p => p.text);
}

/**
 * Generate top risks from score breakdowns and flags
 */
function generateTopRisks(input: VerdictInput, hardStopFlags: string[]): string[] {
  const risks: Array<{ text: string; severity: number }> = [];
  const { scores, product, commission, reputation } = input;
  const bd = scores.breakdowns;

  // Hard stop flags are highest severity
  if (hardStopFlags.includes('MERCHANT_RISK_EXTREME')) {
    risks.push({ text: 'Merchant has extremely low trust rating — high risk of customer issues and refunds', severity: 100 });
  }
  if (hardStopFlags.includes('COMPLIANCE_RISK_HIGH')) {
    risks.push({ text: 'Product page contains potentially problematic claims — compliance risk', severity: 95 });
  }
  if (hardStopFlags.includes('OUT_OF_STOCK')) {
    risks.push({ text: 'Product is currently out of stock — traffic will not convert', severity: 90 });
  }
  if (hardStopFlags.includes('EVIDENCE_TOO_THIN')) {
    risks.push({ text: 'Very limited data available — analysis may not be reliable', severity: 85 });
  }

  // Low score components
  if (bd.product_viability.demand_signals <= 8) {
    risks.push({ text: 'Low demand signals: few reviews suggest limited market interest', severity: 70 });
  }
  if (bd.product_viability.review_sentiment <= 10) {
    risks.push({ text: `Below-average reviews${product.rating ? ` (${product.rating}/5)` : ''} may hurt conversion rates`, severity: 65 });
  }
  if (bd.offer_merchant.merchant_trust <= 12) {
    const rating = reputation?.overall_rating;
    risks.push({ text: `Merchant trust concerns${rating ? ` (${rating}/5 reputation)` : ''}: may increase refund rate`, severity: 60 });
  }
  if (bd.offer_merchant.shipping_returns <= 8) {
    risks.push({ text: 'Shipping or return policy concerns detected — may affect customer satisfaction', severity: 55 });
  }
  if (bd.economics.commission_component <= 12) {
    const rate = commission ? `${commission.rate_low}-${commission.rate_high}%` : 'below average';
    risks.push({ text: `Low commission rate (${rate}) — consider alternative programs`, severity: 50 });
  }
  if (commission && commission.cookie_days <= 7) {
    risks.push({ text: `Short cookie window (${commission.cookie_days} days) — conversions may be lost`, severity: 45 });
  }
  if (bd.economics.refund_adjustment <= 5) {
    risks.push({ text: 'High estimated refund rate in this category may reduce actual earnings', severity: 40 });
  }
  if (!product.brand) {
    risks.push({ text: 'Brand not identified — unknown brands carry higher conversion risk', severity: 35 });
  }
  if (commission?.requires_application) {
    risks.push({ text: `Program requires application (${commission.network}) — approval not guaranteed`, severity: 20 });
  }

  return risks.sort((a, b) => b.severity - a.severity).map(r => r.text);
}

/**
 * Generate key assumptions for transparency
 */
function generateKeyAssumptions(input: VerdictInput): string[] {
  const assumptions: string[] = [];
  const { commission, product, confidence } = input;

  if (!commission) {
    assumptions.push('Commission rates based on category averages — actual rates may vary');
  }
  if (!product.review_count || product.review_count === 0) {
    assumptions.push('No on-page review data found — demand assessment may be less reliable');
  }
  if (confidence.level !== 'HIGH') {
    assumptions.push('Limited data sources available — scores may change with more data');
  }
  if (!product.price.amount) {
    assumptions.push('Price not detected — economics estimate uses category average');
  }

  assumptions.push('Earning estimates assume 500-2,000 monthly clicks — adjust based on your actual traffic');

  return assumptions;
}
