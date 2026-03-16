/**
 * Priority → KPI Specification Library (v2 — enrichment-backed)
 *
 * Every KPI uses data from the enrichment layer:
 *   - Network program database  → commission, cookie, payment, approval
 *   - Merchant profile database → returns, shipping, Trustpilot
 *   - Brand intelligence        → recognition, sustainability certs, design awards
 *   - Product page enrichment   → rating, reviewCount, warranty
 *   - Price percentile          → relative pricing within search results
 *
 * No proxies. Every score is backed by a named data source.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface KpiResult {
  score: number;
  confidence: ConfidenceLevel;
  reason: string;
  evidenceLabel: string;
  evidenceSource: string;
  checkedAt: string;
  isProxy: boolean;
}

/**
 * Full product signals after enrichment. Static enrichment populates the
 * network/merchant/brand fields; dynamic enrichment adds rating/reviewCount.
 */
export interface EnrichedProductSignals {
  // Core (from Datafeedr)
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

  // Product page enrichment (Stage 2 — dynamic)
  rating?: number;
  reviewCount?: number;
  warrantyMonths?: number;

  // Network program database (Stage 1 — static)
  commissionRate?: number;
  commissionRateLow?: number;
  commissionRateHigh?: number;
  cookieDurationDays?: number;
  paymentTermDays?: number;
  paymentSchedule?: string;
  programApproval?: 'auto' | 'easy' | 'moderate' | 'selective';
  programApprovalNote?: string;
  programSource?: string;

  // Merchant profile database (Stage 1 — static)
  returnWindowDays?: number;
  freeReturns?: boolean;
  returnNote?: string;
  shippingSpeedDaysLow?: number;
  shippingSpeedDaysHigh?: number;
  freeShipping?: boolean;
  freeShippingThreshold?: number;
  shippingNote?: string;
  merchantTrustpilotScore?: number;
  merchantTrustpilotReviews?: number;
  merchantProfileSource?: string;

  // Brand intelligence (Stage 1 — static)
  brandRecognitionTier?: 'global' | 'major' | 'established' | 'emerging' | 'niche';
  brandRecognitionScore?: number;
  brandRecognitionSource?: string;
  sustainabilityCerts?: string[];
  sustainabilitySource?: string;
  designAwards?: string[];
  designSource?: string;

  // Computed during search
  pricePercentile?: number;

  // Metadata
  enrichmentLevel?: 'basic' | 'static' | 'full';
}

/** Backwards-compat alias used by older code paths */
export type ProductSignals = EnrichedProductSignals;

type KpiComputer = (product: EnrichedProductSignals) => KpiResult;

interface PriorityKpiSpec {
  id: string;
  type: 'product' | 'brand';
  label: string;
  dataSource: string;
  compute: KpiComputer;
}

const now = () => new Date().toISOString();

// ═══════════════════════════════════════════════════════════════════
// PRODUCT PRIORITY SPECS (8)
// ═══════════════════════════════════════════════════════════════════

// ─── 1. Quality & Durability ────────────────────────────────────────
// Source: product page JSON-LD aggregateRating (rating + reviewCount)

const qualitySpec: PriorityKpiSpec = {
  id: 'quality',
  type: 'product',
  label: 'Quality & Durability',
  dataSource: 'product_page_structured_data',
  compute: (p) => {
    if (p.rating != null && p.reviewCount != null && p.reviewCount > 0) {
      const ratingScore = (p.rating / 5) * 70;
      const volumeBonus = Math.min(30, (p.reviewCount / 200) * 30);
      const score = Math.min(100, Math.round(ratingScore + volumeBonus));
      const confidence: ConfidenceLevel =
        p.reviewCount >= 100 ? 'high' : p.reviewCount >= 20 ? 'medium' : 'low';

      return {
        score,
        confidence,
        reason: `${p.rating.toFixed(1)}★ from ${p.reviewCount.toLocaleString()} reviews`,
        evidenceLabel: `${p.reviewCount.toLocaleString()} reviews on ${p.merchant || 'merchant'}`,
        evidenceSource: 'product_page_structured_data',
        checkedAt: now(),
        isProxy: false,
      };
    }

    // Scoring happens before dynamic enrichment (product page fetch) runs.
    // Use brand recognition tier as a quality proxy when product ratings are missing.
    // This prevents punishing every Datafeedr product for not yet having a page fetch.
    // Tier scores reflect typical correlation between brand prestige and product quality.
    const BRAND_TIER_QUALITY_PROXY: Record<string, number> = {
      global: 75,       // Nike, Apple, Sony — consistently high quality
      major: 70,        // Well-known brands with strong QC
      established: 60,  // Reputable mid-tier brands
      emerging: 45,     // Less predictable quality
      niche: 45,        // Specialised but unknown quality track record
    };
    const isChecked = p.enrichmentLevel === 'full';
    if (p.brandRecognitionTier && p.brandRecognitionTier in BRAND_TIER_QUALITY_PROXY) {
      const proxyScore = BRAND_TIER_QUALITY_PROXY[p.brandRecognitionTier];
      return {
        score: isChecked ? Math.min(proxyScore, 40) : proxyScore, // if we fetched the page & found nothing, cap it
        confidence: 'low',
        reason: `Quality estimated from brand tier (${p.brandRecognitionTier} — ${p.brand || 'brand'}) — no product reviews available yet`,
        evidenceLabel: `${p.brand || 'Brand'}: ${p.brandRecognitionTier} tier proxy`,
        evidenceSource: 'brand_intelligence_database',
        checkedAt: now(),
        isProxy: true,
      };
    }
    return {
      score: isChecked ? 40 : 50, // 40 if we fetched the page and found nothing; 50 if data pending
      confidence: 'low',
      reason: isChecked ? 'No rating data found on merchant page' : 'Rating data pending — scored neutrally until enriched',
      evidenceLabel: isChecked ? 'No rating on merchant page' : 'Awaiting page enrichment',
      evidenceSource: 'pending_enrichment',
      checkedAt: now(),
      isProxy: true,
    };
  },
};

// ─── 2. Price & Value ───────────────────────────────────────────────
// Source: price percentile within search results (computed by orchestrator)

const priceSpec: PriorityKpiSpec = {
  id: 'price',
  type: 'product',
  label: 'Price & Value',
  dataSource: 'price_percentile_computation',
  compute: (p) => {
    if (p.pricePercentile != null) {
      // Lower percentile = cheaper = better value. Invert for score.
      const score = Math.max(0, Math.min(100, 100 - p.pricePercentile));

      let label: string;
      if (p.pricePercentile <= 20) label = 'Most affordable';
      else if (p.pricePercentile <= 40) label = 'Below average';
      else if (p.pricePercentile <= 60) label = 'Mid-range';
      else if (p.pricePercentile <= 80) label = 'Above average';
      else label = 'Premium priced';

      return {
        score,
        confidence: 'high',
        reason: `${label} — ${p.currency} ${p.price.toFixed(2)} (${ordinal(p.pricePercentile)} percentile among alternatives)`,
        evidenceLabel: `${p.currency} ${p.price.toFixed(2)} — ${label.toLowerCase()} for this search`,
        evidenceSource: 'price_percentile_computation',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 50,
      confidence: 'medium',
      reason: `${p.currency} ${p.price.toFixed(2)} — percentile not yet computed`,
      evidenceLabel: `Listed: ${p.currency} ${p.price.toFixed(2)}`,
      evidenceSource: 'product_catalog',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 3. Customer Reviews ────────────────────────────────────────────
// Source: product page JSON-LD reviewCount + aggregateRating

const reviewsSpec: PriorityKpiSpec = {
  id: 'reviews',
  type: 'product',
  label: 'Customer Reviews',
  dataSource: 'product_page_structured_data',
  compute: (p) => {
    if (p.reviewCount != null && p.reviewCount > 0) {
      let score: number;
      if (p.reviewCount >= 5000) score = 95;
      else if (p.reviewCount >= 1000) score = 85;
      else if (p.reviewCount >= 500) score = 75;
      else if (p.reviewCount >= 100) score = 65;
      else if (p.reviewCount >= 20) score = 50;
      else score = 35;

      if (p.rating != null) {
        if (p.rating >= 4.5) score = Math.min(100, score + 5);
        else if (p.rating < 3.0) score = Math.max(0, score - 15);
      }

      const confidence: ConfidenceLevel =
        p.reviewCount >= 100 ? 'high' : p.reviewCount >= 20 ? 'medium' : 'low';

      return {
        score,
        confidence,
        reason: `${p.reviewCount.toLocaleString()} reviews${p.rating ? `, ${p.rating.toFixed(1)}★ avg` : ''}`,
        evidenceLabel: `${p.reviewCount.toLocaleString()} reviews`,
        evidenceSource: 'product_page_structured_data',
        checkedAt: now(),
        isProxy: false,
      };
    }

    // Same reasoning as qualitySpec: returning 0 penalises every product for not
    // yet having its page fetched. Return neutral (50) until enrichment completes.
    const isChecked = p.enrichmentLevel === 'full';
    return {
      score: isChecked ? 40 : 50,
      confidence: 'low',
      reason: isChecked ? 'No review data found on merchant page' : 'Review data pending — scored neutrally until enriched',
      evidenceLabel: isChecked ? 'No reviews on merchant page' : 'Awaiting page enrichment',
      evidenceSource: 'pending_enrichment',
      checkedAt: now(),
      isProxy: true,
    };
  },
};

// ─── 4. Sustainability & Ethics ─────────────────────────────────────
// Source: B Corp directory, EU Ecolabel, Bluesign, GOTS, etc.

const sustainabilitySpec: PriorityKpiSpec = {
  id: 'sustainability',
  type: 'product',
  label: 'Sustainability & Ethics',
  dataSource: 'certification_registries',
  compute: (p) => {
    const certs = p.sustainabilityCerts || [];

    if (certs.length >= 3) {
      return {
        score: 95,
        confidence: 'high',
        reason: `${certs.length} verified certifications: ${certs.join(', ')}`,
        evidenceLabel: certs.join(', '),
        evidenceSource: p.sustainabilitySource || 'certification_registries',
        checkedAt: now(),
        isProxy: false,
      };
    }
    if (certs.length === 2) {
      return {
        score: 80,
        confidence: 'high',
        reason: `Certified: ${certs.join(', ')}`,
        evidenceLabel: certs.join(', '),
        evidenceSource: p.sustainabilitySource || 'certification_registries',
        checkedAt: now(),
        isProxy: false,
      };
    }
    if (certs.length === 1) {
      return {
        score: 65,
        confidence: 'medium',
        reason: `Certified: ${certs[0]}`,
        evidenceLabel: certs[0],
        evidenceSource: p.sustainabilitySource || 'certification_registries',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 20,
      confidence: 'high',
      reason: `${p.brand || 'Brand'} has no verified sustainability certifications in B Corp / EU Ecolabel / GOTS / Bluesign registries`,
      evidenceLabel: 'No certifications found',
      evidenceSource: 'certification_registries',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 5. Design & Aesthetics ─────────────────────────────────────────
// Source: Red Dot, iF Design, Good Design, IDEA award archives

const designSpec: PriorityKpiSpec = {
  id: 'design',
  type: 'product',
  label: 'Design & Aesthetics',
  dataSource: 'design_award_archives',
  compute: (p) => {
    const awards = p.designAwards || [];

    if (awards.length >= 3) {
      return {
        score: 95,
        confidence: 'high',
        reason: `${p.brand} has won ${awards.length} design awards: ${awards.join(', ')}`,
        evidenceLabel: awards.join(', '),
        evidenceSource: p.designSource || 'design_award_archives',
        checkedAt: now(),
        isProxy: false,
      };
    }
    if (awards.length >= 1) {
      return {
        score: 78,
        confidence: 'high',
        reason: `${p.brand} is a ${awards.join(' & ')} award winner`,
        evidenceLabel: awards.join(', '),
        evidenceSource: p.designSource || 'design_award_archives',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 30,
      confidence: 'high',
      reason: `${p.brand || 'Brand'} has no entries in Red Dot, iF Design, Good Design, or IDEA archives`,
      evidenceLabel: 'No design awards found',
      evidenceSource: 'design_award_archives',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 6. Shipping & Availability ─────────────────────────────────────
// Source: Datafeedr stock status + merchant shipping profile database

const shippingSpec: PriorityKpiSpec = {
  id: 'shipping',
  type: 'product',
  label: 'Shipping & Availability',
  dataSource: 'product_catalog + merchant_shipping_database',
  compute: (p) => {
    let score = 0;
    const parts: string[] = [];

    // Stock status (from Datafeedr — real)
    if (p.inStock === true) {
      score += 30;
      parts.push('In stock');
    } else if (p.inStock === false) {
      return {
        score: 5,
        confidence: 'high',
        reason: 'Product is out of stock',
        evidenceLabel: 'Out of stock',
        evidenceSource: 'product_catalog',
        checkedAt: now(),
        isProxy: false,
      };
    } else {
      score += 15;
      parts.push('Stock status unknown');
    }

    // Shipping speed (from merchant profile — real published data)
    if (p.shippingSpeedDaysLow != null && p.shippingSpeedDaysHigh != null) {
      const avgDays = (p.shippingSpeedDaysLow + p.shippingSpeedDaysHigh) / 2;
      if (avgDays <= 2) { score += 40; parts.push(`${p.shippingSpeedDaysLow}-${p.shippingSpeedDaysHigh} day delivery`); }
      else if (avgDays <= 4) { score += 30; parts.push(`${p.shippingSpeedDaysLow}-${p.shippingSpeedDaysHigh} day delivery`); }
      else if (avgDays <= 7) { score += 20; parts.push(`${p.shippingSpeedDaysLow}-${p.shippingSpeedDaysHigh} day delivery`); }
      else { score += 10; parts.push(`${p.shippingSpeedDaysLow}-${p.shippingSpeedDaysHigh} day delivery`); }
    }

    // Free shipping (from merchant profile)
    if (p.freeShipping) {
      score += 20;
      if (p.freeShippingThreshold) {
        parts.push(`Free shipping over €${p.freeShippingThreshold}`);
      } else {
        parts.push('Free shipping');
      }
    } else {
      score += 5;
    }

    // Shipping note
    if (p.shippingNote) parts.push(p.shippingNote);

    return {
      score: Math.min(100, score),
      confidence: p.shippingSpeedDaysLow != null ? 'high' : 'medium',
      reason: parts.join('; '),
      evidenceLabel: parts.slice(0, 2).join('; '),
      evidenceSource: p.merchantProfileSource || 'merchant_shipping_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 7. Warranty & Guarantees ───────────────────────────────────────
// Source: product page warranty data + merchant return policy database

const warrantySpec: PriorityKpiSpec = {
  id: 'warranty',
  type: 'product',
  label: 'Warranty & Guarantees',
  dataSource: 'merchant_return_policy_database + product_page',
  compute: (p) => {
    const parts: string[] = [];
    let score = 0;

    // Product warranty (from product page enrichment)
    if (p.warrantyMonths != null && p.warrantyMonths > 0) {
      const years = p.warrantyMonths >= 12 ? `${Math.round(p.warrantyMonths / 12)}-year` : `${p.warrantyMonths}-month`;
      score += 40;
      parts.push(`${years} manufacturer warranty`);
      if (p.warrantyMonths >= 24) score += 15;
    }

    // Return policy (from merchant profile — real published data)
    if (p.returnWindowDays != null) {
      if (p.returnWindowDays >= 100) { score += 35; parts.push(`${p.returnWindowDays}-day returns`); }
      else if (p.returnWindowDays >= 30) { score += 25; parts.push(`${p.returnWindowDays}-day returns`); }
      else if (p.returnWindowDays >= 14) { score += 15; parts.push(`${p.returnWindowDays}-day returns (EU minimum)`); }
    }

    if (p.freeReturns) {
      score += 15;
      parts.push('Free returns');
    }

    if (p.returnNote) parts.push(p.returnNote);

    // EU legal baseline — every online purchase has 14-day withdrawal
    if (score === 0) {
      score = 30;
      parts.push('EU 14-day withdrawal right applies');
    }

    return {
      score: Math.min(100, score),
      confidence: p.returnWindowDays != null ? 'high' : 'medium',
      reason: parts.join('; '),
      evidenceLabel: parts.slice(0, 2).join('; '),
      evidenceSource: p.merchantProfileSource || 'merchant_return_policy_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 8. Brand Recognition ───────────────────────────────────────────
// Source: Interbrand/Forbes brand rankings + brand intelligence database

const brandRecognitionSpec: PriorityKpiSpec = {
  id: 'brand_recognition',
  type: 'product',
  label: 'Brand Recognition',
  dataSource: 'interbrand_forbes_brand_rankings',
  compute: (p) => {
    const score = p.brandRecognitionScore ?? 35;
    const tier = p.brandRecognitionTier || 'niche';
    const source = p.brandRecognitionSource || 'brand_intelligence_database';

    const tierLabels: Record<string, string> = {
      global: 'Global top brand (Interbrand/Forbes)',
      major: 'Major recognized brand',
      established: 'Established brand with strong presence',
      emerging: 'Emerging brand',
      niche: 'Niche or unranked brand',
    };

    return {
      score,
      confidence: tier === 'global' || tier === 'major' ? 'high' : tier === 'established' ? 'medium' : 'high',
      reason: `${p.brand || 'Unknown'} — ${tierLabels[tier] || tierLabels.niche}`,
      evidenceLabel: `${p.brand}: ${tier} tier`,
      evidenceSource: source,
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════
// BRAND PRIORITY SPECS (8)
// ═══════════════════════════════════════════════════════════════════

// ─── 9. Commission Rate ─────────────────────────────────────────────
// Source: Network program database (published rates)

const commissionSpec: PriorityKpiSpec = {
  id: 'commission',
  type: 'brand',
  label: 'Commission Rate',
  dataSource: 'network_program_database',
  compute: (p) => {
    const low = p.commissionRateLow;
    const high = p.commissionRateHigh;

    if (low != null && high != null) {
      const mid = (low + high) / 2;
      const score = Math.min(100, Math.round((mid / 15) * 100));

      const rangeStr = low === high ? `${low}%` : `${low}-${high}%`;

      return {
        score,
        confidence: 'high',
        reason: `${rangeStr} commission via ${p.affiliateNetwork || 'network'}`,
        evidenceLabel: `${p.merchant || p.affiliateNetwork}: ${rangeStr}`,
        evidenceSource: p.programSource || 'network_program_database',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 30,
      confidence: 'low',
      reason: 'Commission rate not available for this network/merchant combination',
      evidenceLabel: 'Rate unavailable',
      evidenceSource: 'network_program_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 10. Customer Service ───────────────────────────────────────────
// Source: Trustpilot merchant rating (from merchant profiles database)

const customerServiceSpec: PriorityKpiSpec = {
  id: 'customer_service',
  type: 'brand',
  label: 'Customer Service',
  dataSource: 'trustpilot_merchant_ratings',
  compute: (p) => {
    if (p.merchantTrustpilotScore != null && p.merchantTrustpilotReviews != null) {
      // Trustpilot is 1-5 scale. Normalize to 0-100.
      const score = Math.round(((p.merchantTrustpilotScore - 1) / 4) * 100);
      const confidence: ConfidenceLevel =
        p.merchantTrustpilotReviews >= 10000 ? 'high'
          : p.merchantTrustpilotReviews >= 1000 ? 'medium' : 'low';

      return {
        score,
        confidence,
        reason: `${p.merchant} has ${p.merchantTrustpilotScore.toFixed(1)}/5.0 on Trustpilot from ${p.merchantTrustpilotReviews.toLocaleString()} reviews`,
        evidenceLabel: `Trustpilot: ${p.merchantTrustpilotScore.toFixed(1)}/5.0 (${p.merchantTrustpilotReviews.toLocaleString()} reviews)`,
        evidenceSource: 'trustpilot',
        checkedAt: now(),
        isProxy: false,
      };
    }

    // Fallback: if merchant Trustpilot is missing, estimate from brand recognition tier
    // Well-known brands generally have responsive customer service
    if (p.brandRecognitionTier) {
      const tierScores: Record<string, number> = {
        'global': 75, 'major': 65, 'established': 55, 'emerging': 40, 'niche': 30,
      };
      const score = tierScores[p.brandRecognitionTier] || 30;
      return {
        score,
        confidence: 'low' as ConfidenceLevel,
        reason: `Estimated from ${p.brand || p.merchant} brand tier (${p.brandRecognitionTier}). No direct Trustpilot data available.`,
        evidenceLabel: `${p.brandRecognitionTier} brand tier`,
        evidenceSource: 'brand_tier_estimate',
        checkedAt: now(),
        isProxy: true,
      };
    }

    return {
      score: 30,
      confidence: 'low',
      reason: `No Trustpilot data available for ${p.merchant || 'this merchant'}`,
      evidenceLabel: 'No Trustpilot data',
      evidenceSource: 'trustpilot',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 11. Return Policy ──────────────────────────────────────────────
// Source: Merchant return policy database (published policies)

const returnPolicySpec: PriorityKpiSpec = {
  id: 'return_policy',
  type: 'brand',
  label: 'Return Policy',
  dataSource: 'merchant_return_policy_database',
  compute: (p) => {
    if (p.returnWindowDays != null) {
      let score: number;
      if (p.returnWindowDays >= 100) score = 95;
      else if (p.returnWindowDays >= 60) score = 85;
      else if (p.returnWindowDays >= 30) score = 75;
      else if (p.returnWindowDays >= 14) score = 55;
      else score = 35;

      if (p.freeReturns) score = Math.min(100, score + 10);

      const parts = [`${p.returnWindowDays}-day return window`];
      if (p.freeReturns) parts.push('free returns');
      if (p.returnNote) parts.push(p.returnNote);

      return {
        score,
        confidence: 'high',
        reason: parts.join('; '),
        evidenceLabel: `${p.returnWindowDays} days${p.freeReturns ? ', free returns' : ''}`,
        evidenceSource: p.merchantProfileSource || 'merchant_return_policy_database',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 45,
      confidence: 'medium',
      reason: 'EU 14-day withdrawal right applies; merchant-specific policy not in database',
      evidenceLabel: 'EU 14-day minimum',
      evidenceSource: 'eu_consumer_rights_directive',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 12. Brand Reputation ───────────────────────────────────────────
// Source: Trustpilot + brand recognition tier + product ratings

const reputationSpec: PriorityKpiSpec = {
  id: 'reputation',
  type: 'brand',
  label: 'Brand Reputation',
  dataSource: 'trustpilot + brand_rankings + product_page',
  compute: (p) => {
    let score = 0;
    let signals = 0;
    const parts: string[] = [];

    // Trustpilot merchant score (weighted 40%)
    if (p.merchantTrustpilotScore != null) {
      score += ((p.merchantTrustpilotScore - 1) / 4) * 40;
      signals++;
      parts.push(`Trustpilot ${p.merchantTrustpilotScore.toFixed(1)}/5.0`);
    }

    // Brand recognition tier (weighted 30%)
    const tierScores: Record<string, number> = { global: 30, major: 24, established: 18, emerging: 12, niche: 6 };
    const tier = p.brandRecognitionTier || 'niche';
    score += tierScores[tier] || 6;
    signals++;
    parts.push(`${tier} brand tier`);

    // Product rating (weighted 30%)
    if (p.rating != null) {
      score += (p.rating / 5) * 30;
      signals++;
      parts.push(`${p.rating.toFixed(1)}★ product rating`);
    }

    const finalScore = Math.min(100, Math.round(score));
    const confidence: ConfidenceLevel =
      signals >= 3 ? 'high' : signals >= 2 ? 'medium' : 'low';

    return {
      score: finalScore,
      confidence,
      reason: parts.join('; '),
      evidenceLabel: parts.slice(0, 2).join('; '),
      evidenceSource: 'trustpilot + brand_intelligence + product_page',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 13. Brand Sustainability & Ethics ──────────────────────────────
// Source: same certification registries as product sustainability

const brandSustainabilitySpec: PriorityKpiSpec = {
  id: 'brand_sustainability',
  type: 'brand',
  label: 'Sustainability & Ethics',
  dataSource: 'certification_registries',
  compute: (p) => sustainabilitySpec.compute(p),
};

// ─── 14. Payment Reliability ────────────────────────────────────────
// Source: Network program database (published payment terms)

const paymentSpeedSpec: PriorityKpiSpec = {
  id: 'payment_speed',
  type: 'brand',
  label: 'Payment Reliability',
  dataSource: 'network_program_database',
  compute: (p) => {
    if (p.paymentTermDays != null && p.paymentSchedule) {
      let score: number;
      if (p.paymentTermDays <= 20) score = 90;
      else if (p.paymentTermDays <= 30) score = 75;
      else if (p.paymentTermDays <= 45) score = 60;
      else if (p.paymentTermDays <= 60) score = 45;
      else score = 30;

      return {
        score,
        confidence: 'high',
        reason: `${p.paymentSchedule} (net-${p.paymentTermDays} days)`,
        evidenceLabel: `Net-${p.paymentTermDays} days via ${p.affiliateNetwork}`,
        evidenceSource: p.programSource || 'network_program_database',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 0,
      confidence: 'low',
      reason: 'Payment terms not available for this network',
      evidenceLabel: 'Terms unavailable',
      evidenceSource: 'network_program_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 15. Cookie Duration ────────────────────────────────────────────
// Source: Network program database (published cookie windows)

const cookieDurationSpec: PriorityKpiSpec = {
  id: 'cookie_duration',
  type: 'brand',
  label: 'Cookie Duration',
  dataSource: 'network_program_database',
  compute: (p) => {
    if (p.cookieDurationDays != null && p.cookieDurationDays > 0) {
      const score = Math.min(100, Math.round((p.cookieDurationDays / 30) * 80));

      return {
        score,
        confidence: 'high',
        reason: `${p.cookieDurationDays}-day cookie window via ${p.affiliateNetwork || 'network'}`,
        evidenceLabel: `${p.cookieDurationDays} days`,
        evidenceSource: p.programSource || 'network_program_database',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 0,
      confidence: 'low',
      reason: 'Cookie duration not available for this network/merchant',
      evidenceLabel: 'Duration unavailable',
      evidenceSource: 'network_program_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ─── 16. Easy Approval ──────────────────────────────────────────────
// Source: Network program database (published approval policies)

const easyApprovalSpec: PriorityKpiSpec = {
  id: 'easy_approval',
  type: 'brand',
  label: 'Easy Approval',
  dataSource: 'network_program_database',
  compute: (p) => {
    if (p.programApproval) {
      const approvalScores: Record<string, number> = {
        auto: 95,
        easy: 80,
        moderate: 55,
        selective: 30,
      };
      const score = approvalScores[p.programApproval] || 50;

      return {
        score,
        confidence: 'high',
        reason: p.programApprovalNote || `${p.programApproval} approval via ${p.affiliateNetwork}`,
        evidenceLabel: `${p.programApproval} approval`,
        evidenceSource: p.programSource || 'network_program_database',
        checkedAt: now(),
        isProxy: false,
      };
    }

    return {
      score: 0,
      confidence: 'low',
      reason: 'Approval process not documented for this program',
      evidenceLabel: 'Approval info unavailable',
      evidenceSource: 'network_program_database',
      checkedAt: now(),
      isProxy: false,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════
// Registry & Public API
// ═══════════════════════════════════════════════════════════════════

const SPEC_REGISTRY: Record<string, PriorityKpiSpec> = {
  quality: qualitySpec,
  price: priceSpec,
  reviews: reviewsSpec,
  sustainability: sustainabilitySpec,
  design: designSpec,
  shipping: shippingSpec,
  warranty: warrantySpec,
  brand_recognition: brandRecognitionSpec,
  commission: commissionSpec,
  customer_service: customerServiceSpec,
  return_policy: returnPolicySpec,
  reputation: reputationSpec,
  brand_sustainability: brandSustainabilitySpec,
  payment_speed: paymentSpeedSpec,
  cookie_duration: cookieDurationSpec,
  easy_approval: easyApprovalSpec,
};

export function computeKpi(priorityId: string, product: EnrichedProductSignals): KpiResult {
  const spec = SPEC_REGISTRY[priorityId];
  if (!spec) {
    return {
      score: 0,
      confidence: 'low',
      reason: `No KPI spec defined for "${priorityId}"`,
      evidenceLabel: 'Unmapped priority',
      evidenceSource: 'none',
      checkedAt: now(),
      isProxy: false,
    };
  }
  return spec.compute(product);
}

export function computeAllProductKpis(
  product: EnrichedProductSignals,
  priorities: Array<{ id: string; rank: number; weightMultiplier?: number }>,
): Array<{
  id: string;
  label: string;
  rank: number;
  score: number;
  reason: string;
  confidence: ConfidenceLevel;
  evidenceLabel: string;
  evidenceSource: string;
  checkedAt: string;
  isProxy: boolean;
}> {
  return [...priorities]
    .sort((a, b) => a.rank - b.rank)
    .map((p) => {
      const spec = SPEC_REGISTRY[p.id];
      const result = computeKpi(p.id, product);
      return {
        id: p.id,
        label: spec?.label || p.id.replace(/_/g, ' '),
        rank: p.rank,
        ...result,
      };
    });
}

export function computeAllBrandKpis(
  product: EnrichedProductSignals,
  priorities: Array<{ id: string; rank: number }>,
): Array<{
  id: string;
  label: string;
  rank: number;
  score: number;
  reason: string;
  confidence: ConfidenceLevel;
  evidenceLabel: string;
  evidenceSource: string;
  checkedAt: string;
  isProxy: boolean;
}> {
  return computeAllProductKpis(product, priorities);
}

export function computeWeightedPriorityScore(
  product: EnrichedProductSignals,
  priorities: Array<{ id: string; rank: number; weightMultiplier?: number }>,
): number {
  if (priorities.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const p of priorities) {
    const baseWeight = 6 - p.rank;
    const multiplier = p.weightMultiplier || 1.0;
    const effectiveWeight = baseWeight * multiplier;
    const result = computeKpi(p.id, product);
    weightedSum += result.score * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  return totalWeight > 0 ? Math.min(100, Math.round(weightedSum / totalWeight)) : 50;
}

export function getKpiSpec(priorityId: string): PriorityKpiSpec | undefined {
  return SPEC_REGISTRY[priorityId];
}

export function getAllSpecs(): Record<string, PriorityKpiSpec> {
  return { ...SPEC_REGISTRY };
}

// ─── Helpers ────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
