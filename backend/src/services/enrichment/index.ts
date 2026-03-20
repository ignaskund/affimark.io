/**
 * Enrichment Orchestrator
 *
 * Two-stage enrichment:
 *   Stage 1 – STATIC (instant, no HTTP):
 *     Network program data, merchant profiles, brand intelligence.
 *     Applied to ALL candidates before scoring.
 *
 *   Stage 2 – DYNAMIC (fetches product pages):
 *     Real rating, reviewCount, warranty from JSON-LD.
 *     Applied to TOP-N candidates only (after initial scoring & selection).
 */

import { lookupProgram } from './network-programs';
import { lookupMerchant } from './merchant-profiles';
import { lookupBrand, computeRecognitionScore, type RecognitionTier } from './brand-intelligence';
import { enrichFromProductPage, enrichBatch, type PageEnrichmentResult } from './product-page-enricher';
import type { EnrichedProductSignals } from '../priority-kpi-specs';

// ─── Stage 1: Static Enrichment ─────────────────────────────────────

export function enrichStatic(product: {
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  affiliateNetwork?: string;
  merchant?: string;
  inStock?: boolean;
  imageUrl?: string;
  description?: string;
  directUrl?: string;
  affiliateUrl?: string;
}): EnrichedProductSignals {
  const program = lookupProgram(
    product.affiliateNetwork || '',
    product.merchant || '',
    product.category,
  );

  const merchantProfile = lookupMerchant(
    product.merchant || '',
    product.affiliateNetwork,
  );

  const brandProfile = lookupBrand(product.brand || '');

  return {
    // Core product data (pass-through)
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    currency: product.currency,
    affiliateNetwork: product.affiliateNetwork,
    merchant: product.merchant,
    inStock: product.inStock,
    imageUrl: product.imageUrl,
    description: product.description,

    // Network program data (REAL published data)
    commissionRateLow: program.commissionLow,
    commissionRateHigh: program.commissionHigh,
    commissionRate: (program.commissionLow + program.commissionHigh) / 2,
    cookieDurationDays: program.cookieDays,
    paymentTermDays: program.paymentTermDays,
    paymentSchedule: program.paymentSchedule,
    programApproval: program.approval,
    programApprovalNote: program.approvalNote,
    programSource: program.source,

    // Merchant profile data (REAL published policies + Trustpilot)
    returnWindowDays: merchantProfile.returnDays,
    freeReturns: merchantProfile.freeReturns,
    returnNote: merchantProfile.returnNote,
    shippingSpeedDaysLow: merchantProfile.shippingSpeedDays[0],
    shippingSpeedDaysHigh: merchantProfile.shippingSpeedDays[1],
    freeShipping: merchantProfile.freeShipping,
    freeShippingThreshold: merchantProfile.freeShippingThreshold,
    shippingNote: merchantProfile.shippingNote,
    merchantTrustpilotScore: merchantProfile.trustpilotScore,
    merchantTrustpilotReviews: merchantProfile.trustpilotReviews,
    merchantProfileSource: merchantProfile.source,

    // Brand intelligence data (REAL directories + award archives)
    brandRecognitionTier: brandProfile.recognition,
    brandRecognitionScore: computeRecognitionScore(brandProfile.recognition),
    brandRecognitionSource: brandProfile.recognitionSource,
    sustainabilityCerts: brandProfile.sustainabilityCerts,
    sustainabilitySource: brandProfile.sustainabilitySource,
    designAwards: brandProfile.designAwards,
    designSource: brandProfile.designSource,

    // Not yet enriched
    rating: undefined,
    reviewCount: undefined,
    warrantyMonths: undefined,
    pricePercentile: undefined,

    enrichmentLevel: 'static',
  };
}

// ─── Price Percentile ───────────────────────────────────────────────

export function computePricePercentiles(
  products: EnrichedProductSignals[],
): void {
  if (products.length === 0) return;

  const prices = products
    .map(p => p.price)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return;

  for (const product of products) {
    if (product.price <= 0) {
      product.pricePercentile = 50;
      continue;
    }
    const below = prices.filter(p => p < product.price).length;
    product.pricePercentile = Math.round((below / prices.length) * 100);
  }
}

// ─── Stage 2: Dynamic Enrichment (product pages) ────────────────────

export async function enrichDynamic(
  products: EnrichedProductSignals[],
  productUrls: Array<{ directUrl?: string; affiliateUrl?: string }>,
): Promise<void> {
  const results = await enrichBatch(productUrls, 5);

  for (let i = 0; i < products.length; i++) {
    const pageData = results[i];

    if (pageData && !pageData.error) {
      if (pageData.rating != null) products[i].rating = pageData.rating;
      if (pageData.reviewCount != null) products[i].reviewCount = pageData.reviewCount;
      if (pageData.warrantyMonths != null) products[i].warrantyMonths = pageData.warrantyMonths;
    }

    products[i].enrichmentLevel = 'full';
  }
}

export { enrichFromProductPage, enrichBatch, type PageEnrichmentResult };
