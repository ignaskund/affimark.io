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
  convertToAlternativeProduct,
  DatafeedrProduct,
  resolveSourceNames,
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
import {
  computeKpi,
  computeAllProductKpis,
  computeAllBrandKpis,
  computeWeightedPriorityScore,
  type EnrichedProductSignals,
} from './priority-kpi-specs';
import { enrichStatic, computePricePercentiles, enrichDynamic } from './enrichment';
import { checkEligibility } from './storefront-eligibility';
import { selectDiverseProducts } from './diversity-selector';
import { generateReasonCodes } from './reason-code-engine';
import { semanticRerank } from './semantic-ranker';

/**
 * Category alias groups for fuzzy category matching.
 * Products whose category falls in a DIFFERENT group than the intent category
 * are considered category mismatches and should be filtered out.
 *
 * NOTE: Some products are genuinely cross-domain (e.g. smart light bulbs live in
 * both "Electronics" and "Home > Lighting" depending on the affiliate network).
 * Keep alias groups broad enough to accommodate this.
 */
const CATEGORY_ALIAS_GROUPS: Record<string, string[]> = {
  beauty: ['beauty', 'cosmetics', 'skincare', 'makeup', 'personal care', 'health & beauty', 'fragrance', 'haircare', 'bath & body', 'nail', 'lip', 'face', 'body care'],
  // Electronics + smart home lighting live in both 'electronics' AND 'home > lighting'
  electronics: [
    'electronics', 'technology', 'computers', 'audio', 'gadgets', 'phones', 'cameras',
    'headphones', 'tv', 'gaming', 'wearables', 'speakers',
    // Smart home / lighting crossover — Datafeedr lists smart bulbs, strips, plugs under home
    'lighting', 'light', 'smart home', 'smart lighting', 'bulb', 'led',
    'ceiling fan', 'ceiling light', 'ceiling lamp',
  ],
  fashion: ['fashion', 'clothing', 'apparel', 'accessories', 'shoes', 'jewelry', 'watches', 'bags', 'sunglasses', 'handbags'],
  home: [
    'home', 'home & garden', 'furniture', 'kitchen', 'decor', 'garden',
    'bedding', 'home improvement', 'appliances',
    // Note: 'lighting' intentionally removed here — it belongs to electronics too
    // so smart bulbs from Home > Lighting pass the electronics category gate.
  ],
  sports: ['sports', 'sports & outdoors', 'fitness', 'outdoor', 'camping', 'cycling', 'yoga', 'exercise'],
  food: ['food', 'food & beverage', 'grocery', 'drinks', 'supplements', 'nutrition', 'vitamins'],
  toys: ['toys', 'toys & games', 'games', 'puzzles', 'kids', 'baby'],
  books: ['books', 'books & media', 'media', 'music', 'movies'],
  automotive: ['automotive', 'auto', 'car', 'vehicle', 'motorcycle'],
  pets: ['pets', 'pet supplies', 'dog', 'cat', 'animal'],
  office: ['office', 'office & school', 'stationery', 'school supplies'],
  arts: ['arts', 'arts & crafts', 'crafts', 'diy', 'hobby'],
};

/**
 * Check if two category strings belong to the same alias group.
 * Returns true if they match (same group or exact match), false otherwise.
 */
function categoriesMatch(categoryA: string, categoryB: string): boolean {
  const a = categoryA.toLowerCase().trim();
  const b = categoryB.toLowerCase().trim();

  // Exact match
  if (a === b) return true;

  // Check if both belong to the same alias group
  for (const groupAliases of Object.values(CATEGORY_ALIAS_GROUPS)) {
    const aInGroup = groupAliases.some(alias => a.includes(alias) || alias.includes(a));
    const bInGroup = groupAliases.some(alias => b.includes(alias) || alias.includes(b));
    if (aInGroup && bInGroup) return true;
  }

  return false;
}

function normalizeBrand(brand?: string): string {
  if (!brand) return '';
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameBrand(candidateBrand?: string, originalBrand?: string): boolean {
  const candidate = normalizeBrand(candidateBrand);
  const original = normalizeBrand(originalBrand);

  if (!candidate || !original) return false;
  if (candidate === original) return true;

  // Handle variants like "milk makeup inc" vs "milk makeup"
  if (candidate.includes(original) || original.includes(candidate)) return true;

  const candidateTokens = candidate.split(' ');
  const originalTokens = original.split(' ');
  if (candidateTokens.length > 0 && originalTokens.length > 0) {
    return candidateTokens[0] === originalTokens[0] && candidateTokens[0].length >= 4;
  }

  return false;
}

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

  // Outcome quality indicators
  requiresVerification?: boolean;
  outcomeWarnings?: string[];
  recommendationConfidence?: number;
  reasonCodes?: string[];
  reasonSummary?: string;
  productPriorityKpis?: Array<{
    id: string;
    label: string;
    rank: number;
    score: number;
    reason: string;
  }>;
  brandPriorityKpis?: Array<{
    id: string;
    label: string;
    rank: number;
    score: number;
    reason: string;
  }>;
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
  console.log('[Multi-Network] User priorities:', userProfile.productPriorities.slice(0, 3).map(p => p.id));
  console.log('[Multi-Network] User confidence:', userProfile.confidenceScore);

  const limit = options.limit || 50;
  const datafeedrAccessId = env.DATAFEEDR_ACCESS_ID;
  const datafeedrSecretKey = env.DATAFEEDR_SECRET_KEY;

  if (!datafeedrAccessId || !datafeedrSecretKey) {
    console.warn('[Multi-Network] No Datafeedr credentials configured');
    return [];
  }

  // Inject priority-driven network preferences into the profile for this search.
  // If the user's top priority is commission rate, prefer networks with higher rates
  // (Awin, Impact, CJ) over Amazon which pays 1-4%. This means the profile's
  // preferredNetworks gets augmented — not replaced — with priority-derived ones.
  const adjustedProfile = injectPriorityNetworkPreferences(userProfile);

  // Phase 1: Broad search via Datafeedr
  const rawResults = await searchViaDatafeedr(
    intent,
    adjustedProfile,
    datafeedrAccessId,
    datafeedrSecretKey,
    limit * 2,
    options.excludeOriginalBrand === true
  ); // Get more for deduplication

  // Phase 1.5: Canonicalize to remove duplicates (Fix #7)
  const canonicalProducts = canonicalizeProducts(rawResults);
  const dedupStats = getDeduplicationStats(rawResults.length, canonicalProducts);
  console.log(`[Multi-Network] Deduplication: ${dedupStats.duplicatesRemoved} duplicates removed (${dedupStats.deduplicationRate.toFixed(1)}%)`);

  // Use best variants for scoring
  const results = canonicalProducts.map(c => c.bestVariant);

  // Phase 2: STATIC ENRICHMENT (instant — network programs, merchant profiles, brand intelligence)
  const enrichedSignals = results.map(product => enrichStatic({
    name: product.name || '',
    brand: product.brand || '',
    category: product.category || '',
    price: product.price || 0,
    currency: product.currency || 'EUR',
    affiliateNetwork: product.affiliateNetwork,
    merchant: product.merchant,
    inStock: product.inStock,
    imageUrl: product.imageUrl,
    description: product.description,
    directUrl: product.directUrl,
    affiliateUrl: product.url,
  }));

  // Price percentile computation across all candidates
  computePricePercentiles(enrichedSignals);
  console.log(`[Multi-Network] Static enrichment complete for ${enrichedSignals.length} products`);

  // Phase 2.5: SEMANTIC RERANKING via embeddings
  // Batch-embeds the query intent + all candidates in 2 API calls (~$0.0001/search).
  // This is the key fix for irrelevant results: "lavender oil" semantically
  // matches "aromatherapy essential blend" even without shared keywords.
  const apiKey = env?.OPENAI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);

  let semanticScores = new Map<string, number>();
  if (apiKey && results.length > 0) {
    try {
      semanticScores = await semanticRerank(
        intent,
        results.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        })),
        apiKey,
        Math.min(results.length, 150)
      );
      console.log(`[Multi-Network] Semantic scores computed for ${semanticScores.size} products`);
    } catch (err) {
      console.warn('[Multi-Network] Semantic reranking failed, falling back to keyword scoring:', err);
    }
  }

  // Phase 3: TRIPLE SCORING with enriched signals + semantic similarity
  const scoredPromises = results.map(async (product, idx) => {
    const signals = enrichedSignals[idx];
    const semanticScore = semanticScores.get(product.id) ?? 50; // default 50 if embedding unavailable

    // A) Profile match score (personalization) — uses enriched signals for full KPI accuracy
    const matchScore = calculateProfileMatchScore(product, userProfile, intent, signals);
    const priorityAlignment = calculatePriorityAlignment(product, userProfile, signals);
    const productPriorityKpis = computeAllProductKpis(signals, userProfile.productPriorities);
    const brandPriorityKpis = computeAllBrandKpis(signals, userProfile.brandPriorities);
    const matchReasons = generateMatchReasons(product, userProfile, intent, matchScore);

    // B) Outcome feasibility score (business viability)
    const outcomeFeasibilityScore = await scoreOutcomeFeasibility(
      {
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        affiliateNetwork: product.affiliateNetwork,
        merchantName: product.merchant,
        rating: signals.rating,
        reviewCount: signals.reviewCount,
        availability: product.inStock ? 'in_stock' : 'unknown',
        commissionRate: signals.commissionRate,
        cookieDuration: signals.cookieDurationDays,
      },
      env
    );

    // C) Combined score: 35% semantic + 35% match + 30% outcome feasibility
    // Semantic similarity is the primary signal — it catches products that are
    // genuinely similar even when keyword overlap is low.
    const combinedScore = Math.round(
      semanticScore * 0.35 +
      matchScore * 0.35 +
      outcomeFeasibilityScore.overall * 0.30
    );

    // D) Generate structured reason codes
    const reasons = generateReasonCodes(
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        rating: signals.rating,
        reviewCount: signals.reviewCount,
        commissionRate: signals.commissionRate,
        cookieDurationDays: signals.cookieDurationDays,
        affiliateNetwork: product.affiliateNetwork,
        merchant: product.merchant,
        matchScore,
        outcomeFeasibility: outcomeFeasibilityScore.overall,
        inStock: product.inStock,
        requiresVerification: outcomeFeasibilityScore.requiresVerification,
        productPriorityKpis,
      },
      {
        intentCategory: intent.category,
        intentSubcategory: intent.subcategory,
        userTopBrands: userProfile.storefrontContext.topBrands,
        userAvgPricePoint: userProfile.storefrontContext.avgPricePoint,
        userDominantCategories: userProfile.storefrontContext.dominantCategories.map(d => d.category),
      },
    );

    return {
      ...product,
      matchScore,
      outcomeFeasibility: outcomeFeasibilityScore.overall,
      combinedScore,
      priorityAlignment,
      productPriorityKpis,
      brandPriorityKpis,
      matchReasons,
      requiresVerification: outcomeFeasibilityScore.requiresVerification,
      outcomeWarnings: outcomeFeasibilityScore.warnings,
      recommendationConfidence: outcomeFeasibilityScore.confidence,
      reasonCodes: reasons.codes.map(c => c.code),
      reasonSummary: reasons.summary,
      _outcomeFeasibilityDetails: outcomeFeasibilityScore,
      _enrichedSignals: signals,
      _semanticScore: semanticScore,
    };
  });

  const scored = await Promise.all(scoredPromises);

  // Phase 3: Filter by category, match score, AND outcome feasibility
  // Threshold uses COMBINED score (match + outcome feasibility).
  // Lowered for new users and when intent confidence is low (poor product info).
  const combinedThreshold = userProfile.confidenceScore >= 60
    ? 35
    : intent.confidence <= 30 ? 15 : 20;
  console.log(`[Multi-Network] Combined threshold: ${combinedThreshold} (profile confidence: ${userProfile.confidenceScore}%, intent confidence: ${intent.confidence})`);

  const filtered = scored
    .filter(p => {
      // HARD CATEGORY GATE: Reject products in completely wrong categories
      if (intent.category && intent.category !== 'General' && p.category && p.category !== 'General') {
        if (!categoriesMatch(p.category, intent.category)) {
          console.log(`[Multi-Network] Category mismatch rejected: "${p.name}" (${p.category}) vs intent (${intent.category})`);
          return false;
        }
      }

      // HARD STOREFRONT ELIGIBILITY GATE
      const eligibility = checkEligibility(p, userProfile);
      if (!eligibility.eligible) {
        console.log(`[Multi-Network] Ineligible storefront: "${p.name}" → ${eligibility.reason}`);
        return false;
      }

      // Must pass minimum combined threshold (match + feasibility)
      if (p.combinedScore < combinedThreshold) return false;

      // Must pass outcome feasibility gate (CRITICAL!)
      const recommendation = canRecommendProduct(p._outcomeFeasibilityDetails);
      if (!recommendation.canRecommend) {
        console.log(`[Multi-Network] Rejected ${p.name}: ${recommendation.reason}`);
        return false;
      }

      // Brand exclusion filter
      if (options.excludeOriginalBrand && isSameBrand(p.brand, intent.brand)) {
        return false;
      }

      return true;
    });

  // Phase 4: Sort by COMBINED SCORE (not just match)
  filtered.sort((a, b) => b.combinedScore - a.combinedScore);

  // Debug: Log score distribution for first few products
  if (scored.length > 0) {
    const sample = scored.slice(0, 3);
    for (const p of sample) {
      console.log(`[Multi-Network] Score sample: "${p.name}" → match=${p.matchScore}, outcome=${p.outcomeFeasibility}, combined=${p.combinedScore}`);
    }
  }
  console.log(`[Multi-Network] Scored ${results.length} → Filtered to ${filtered.length} (combined threshold: ${combinedThreshold})`);

  // Phase 5: Diversity-constrained final selection
  const topPriorityIds = userProfile.productPriorities
    .slice(0, 3)
    .map(p => p.id);

  const diverse = selectDiverseProducts(filtered, {
    targetSize: limit,
    maxPerMerchant: 2,
    minUniqueBrands: Math.min(3, filtered.length),
    topPriorityIds,
  });

  console.log(`[Multi-Network] Diversity selection: ${filtered.length} → ${diverse.length} (brands: ${new Set(diverse.map(d => d.brand?.toLowerCase())).size})`);

  // Phase 6: DYNAMIC ENRICHMENT (product page fetch for top results only)
  try {
    const enrichedSignalsForTop = diverse.map(d => d._enrichedSignals as EnrichedProductSignals).filter(Boolean);
    const urls = diverse.map(d => ({ directUrl: d.directUrl, affiliateUrl: d.url }));

    if (enrichedSignalsForTop.length > 0) {
      await enrichDynamic(enrichedSignalsForTop, urls);
      console.log(`[Multi-Network] Dynamic enrichment complete for ${enrichedSignalsForTop.length} products`);

      // Re-compute KPIs with full enriched data (now includes rating/reviews)
      for (let i = 0; i < diverse.length; i++) {
        const signals = enrichedSignalsForTop[i];
        if (!signals) continue;
        diverse[i].productPriorityKpis = computeAllProductKpis(signals, userProfile.productPriorities);
        diverse[i].brandPriorityKpis = computeAllBrandKpis(signals, userProfile.brandPriorities);
      }
    }
  } catch (err) {
    console.warn('[Multi-Network] Dynamic enrichment failed (non-fatal):', err);
  }

  // Phase 7: PERSONALIZATION STATEMENT + diagnostics
  for (const product of diverse) {
    (product as any).personalizationStatement = buildPersonalizationStatement(
      product, userProfile, intent
    );
  }

  // Diagnostic summary — visible in backend logs for debugging
  console.log(`[Multi-Network] ── Final ${diverse.length} results ──`);
  for (const p of diverse) {
    console.log(
      `  ✓ "${p.name.slice(0, 60)}" | semantic=${(p as any)._semanticScore ?? '–'} match=${p.matchScore} outcome=${p.outcomeFeasibility} combined=${p.combinedScore} | ${(p as any).personalizationStatement}`
    );
  }

  return diverse;
}

/**
 * Adjust the user profile's preferred networks based on their top priorities.
 * This means the Datafeedr query will filter to networks that are more likely
 * to satisfy what the user cares most about — e.g. high commission = Awin/Impact.
 */
function injectPriorityNetworkPreferences(profile: UserProfile): UserProfile {
  // Read from brandPriorities — these contain the network-relevant KPIs.
  // (commission, cookie_duration, payment_speed, etc. are BRAND priorities, not product priorities.)
  const topPriorityIds = profile.brandPriorities.slice(0, 3).map(p => p.id);

  // Brand priority ID → affiliate networks that tend to excel for that KPI.
  // These IDs must match the constants in BRAND_PRIORITIES (frontend/types/finder.ts).
  const PRIORITY_NETWORK_MAP: Record<string, string[]> = {
    commission:           ['awin', 'impact', 'shareasale', 'cj'],  // 5-20% vs Amazon 1-4%
    cookie_duration:      ['awin', 'shareasale', 'impact'],         // 30-90 day cookies
    payment_speed:        ['shareasale', 'awin'],                   // Faster payout schedules
    reputation:           ['awin', 'impact', 'cj'],                 // Major vetted brands
    brand_sustainability: ['awin'],                                  // Most eco-brands on Awin
    easy_approval:        ['amazon', 'awin'],                       // Open-enrollment networks
    return_policy:        ['awin', 'amazon'],                       // Strong return policies
    customer_service:     ['awin', 'impact'],                       // Networks with merchant vetting
    // product KPIs (quality/reviews/design) don't map to specific networks — keep open
  };

  const priorityNetworks = new Set<string>(profile.storefrontContext.preferredNetworks);
  for (const pid of topPriorityIds) {
    const nets = PRIORITY_NETWORK_MAP[pid];
    if (nets) nets.forEach(n => priorityNetworks.add(n));
  }

  if (priorityNetworks.size === 0) return profile; // no change

  const networks = [...priorityNetworks];
  console.log(`[Multi-Network] Priority-driven networks: [${networks.join(', ')}] (from priorities: ${topPriorityIds.join(', ')})`);

  return {
    ...profile,
    storefrontContext: {
      ...profile.storefrontContext,
      preferredNetworks: networks,
    },
  };
}

/**
 * Generate a human-readable personalization statement for a product.
 * This is what the user sees in the card: "Why this for you."
 */
export function buildPersonalizationStatement(
  product: any,
  userProfile: UserProfile,
  intent: ProductIntent
): string {
  const topProductPriorities = userProfile.productPriorities.slice(0, 2).map(p => p.id);
  const topBrandPriorities = userProfile.brandPriorities.slice(0, 2).map(p => p.id);
  const allTop = [...topProductPriorities, ...topBrandPriorities];

  const kpis: Array<{ id: string; label: string; score: number; reason: string }> = [
    ...(product.productPriorityKpis || []),
    ...(product.brandPriorityKpis || []),
  ].filter((k: any) => allTop.includes(k.id) && k.score >= 60);

  const parts: string[] = [];

  // Commission highlight
  const commissionKpi = kpis.find(k => k.id === 'commission_rate');
  if (commissionKpi && product._enrichedSignals?.commissionRate) {
    const rate = product._enrichedSignals.commissionRate;
    parts.push(`${rate}% commission`);
  }

  // Brand recognition
  const brandKpi = kpis.find(k => k.id === 'brand_recognition');
  if (brandKpi && product.brand) {
    parts.push(`${product.brand} (recognised brand)`);
  }

  // Niche match from social context
  if (userProfile.socialContext.contentCategories.length > 0) {
    const categories = userProfile.socialContext.contentCategories;
    const matchesNiche = categories.some(c =>
      product.category?.toLowerCase().includes(c.toLowerCase()) ||
      product.name?.toLowerCase().includes(c.toLowerCase())
    );
    if (matchesNiche) {
      parts.push(`fits your ${categories[0]} audience`);
    }
  }

  // Price point alignment
  if (userProfile.storefrontContext.avgPricePoint > 0) {
    const diff = Math.abs(product.price - userProfile.storefrontContext.avgPricePoint);
    if (diff / userProfile.storefrontContext.avgPricePoint < 0.25) {
      parts.push(`priced near your usual range`);
    }
  }

  // Semantic similarity hint
  if (product._semanticScore && product._semanticScore >= 60) {
    parts.push(`closely matches the product type`);
  }

  if (parts.length === 0) {
    return `Similar ${intent.subcategory || intent.category} product from ${product.brand || product.merchant}`;
  }

  return parts.join(' · ');
}

/**
 * Convert internal product to basic signals (for non-enriched code paths).
 * Enriched signals are created by enrichStatic() in the main pipeline.
 */
function toBasicSignals(product: any): EnrichedProductSignals {
  return {
    name: product.name || '',
    brand: product.brand || '',
    category: product.category || '',
    price: product.price || 0,
    currency: product.currency || 'EUR',
    rating: product.rating,
    reviewCount: product.reviewCount,
    affiliateNetwork: product.affiliateNetwork || '',
    merchant: product.merchant || '',
    commissionRate: product.commissionRate,
    cookieDurationDays: product.cookieDurationDays,
    inStock: product.inStock,
    imageUrl: product.imageUrl,
    description: product.description,
    enrichmentLevel: 'basic',
  };
}

/**
 * Search via Datafeedr API
 */
async function searchViaDatafeedr(
  intent: ProductIntent,
  profile: UserProfile,
  accessId: string,
  secretKey: string,
  limit: number,
  excludeOriginalBrand: boolean
): Promise<AlternativeProduct[]> {
  // Determine price range based on intent and profile
  // Skip price filtering if user has no storefront data (avgPricePoint = 0)
  let priceMin: number | undefined;
  let priceMax: number | undefined;

  const avgPrice = profile.storefrontContext.avgPricePoint;
  if (avgPrice > 0) {
    if (intent.priceRange === 'budget') {
      priceMax = avgPrice * 0.7;
    } else if (intent.priceRange === 'premium') {
      priceMin = avgPrice * 1.3;
    } else {
      // Mid-range: ±30% of user's average
      priceMin = avgPrice * 0.7;
      priceMax = avgPrice * 1.3;
    }
  }
  // When avgPrice is 0 (new user, no storefront data), don't filter by price at all

  // ── ASIN / product-ID detection ──────────────────────────────────
  // If the search query is a raw ASIN or product ID, use Datafeedr's
  // `sku` and `any` fields instead of `name LIKE`.
  const isAsin = /^[A-Z0-9]{10}$/i.test(intent.searchQuery.trim());
  if (isAsin) {
    const asin = intent.searchQuery.trim();
    console.log(`[Datafeedr] Detected ASIN/product ID: ${asin} — using SKU + any-field search`);
    try {
      // Try 1: search by SKU (some Datafeedr merchants store ASINs as SKU)
      const skuResponse = await searchDatafeedr(
        { query: '', rawFilters: [`sku = ${asin}`], limit: limit, in_stock: true },
        accessId,
        secretKey,
      );
      if ((skuResponse.products?.length || 0) > 0) {
        console.log(`[Datafeedr] SKU search found ${skuResponse.products.length} products`);
        return skuResponse.products.map(convertToAlternativeProduct);
      }

      // Try 2: search by `any LIKE` (full-text across all fields including SKU, EAN, etc.)
      const anyResponse = await searchDatafeedr(
        { query: '', rawFilters: [`any LIKE ${asin}`], limit: limit, in_stock: true },
        accessId,
        secretKey,
      );
      if ((anyResponse.products?.length || 0) > 0) {
        console.log(`[Datafeedr] Any-field search found ${anyResponse.products.length} products`);
        return anyResponse.products.map(convertToAlternativeProduct);
      }

      console.log(`[Datafeedr] ASIN search returned 0 — cannot resolve product from ID alone`);
      return [];
    } catch (error) {
      console.error('[Datafeedr] ASIN search failed:', error);
      return [];
    }
  }

  try {
    const brandTokens = normalizeBrand(intent.brand).split(' ').filter(Boolean);
    const searchNoise = new Set([
      'gift', 'set', 'pack', 'bundle', 'exclusive', 'full', 'size', 'oz', 'ml',
      'clear', 'warm', 'beige', 'red', 'pink', 'shade', 'color',
    ]);

    // ALWAYS start from the AI-distilled search query — it's the best
    // human-readable description of the product (e.g. "smart LED light bulbs",
    // "wireless noise-cancelling headphones", "selfie stick bluetooth").
    // Strip the original brand tokens so we find alternatives, not variants.
    const queryWithoutBrand = intent.searchQuery
      .split(/\s+/)
      .filter((token) => !brandTokens.includes(normalizeBrand(token)))
      .join(' ')
      .trim();

    // Primary search: use the full searchQuery (minus original brand)
    // NEVER prepend the category name — Datafeedr `name LIKE` matches
    // words inside product TITLES, not category strings.
    const primaryQuery = queryWithoutBrand || intent.searchQuery;

    // Fallback 1: subcategory (more specific than category, less specific than full query)
    // Fallback 2: first 2-3 meaningful keywords
    const coreKeywords = (intent.keywords || [])
      .filter((keyword) => {
        const normalized = normalizeBrand(keyword);
        return normalized &&
          !brandTokens.includes(normalized) &&
          !searchNoise.has(normalized) &&
          !/^\d/.test(normalized);
      });

    const fallbackQuery =
      intent.subcategory ||
      (coreKeywords.length >= 2 ? coreKeywords.slice(0, 3).join(' ') : null) ||
      intent.searchQuery;

    // Resolve user's preferred networks to Datafeedr source names for query-level filtering
    const sourceNames = resolveSourceNames(profile.storefrontContext.preferredNetworks);

    console.log(`[Datafeedr] Primary query: "${primaryQuery}" (category: ${intent.category}, sources: ${sourceNames.length > 0 ? sourceNames.join(', ') : 'all'})`);

    const response = await searchDatafeedr(
      {
        query: primaryQuery,
        source_names: sourceNames.length > 0 ? sourceNames : undefined,
        price_min: priceMin,
        price_max: priceMax,
        limit: limit * 2,
        in_stock: true,
      },
      accessId,
      secretKey
    );

    let combinedProducts = response.products || [];

    // If primary query yields few candidates, run a fallback search and merge results.
    if (combinedProducts.length < 15 && fallbackQuery && fallbackQuery !== primaryQuery) {
      console.log(`[Datafeedr] Broadening with fallback query: "${fallbackQuery}"`);
      const fallbackResponse = await searchDatafeedr(
        {
          query: fallbackQuery,
          source_names: sourceNames.length > 0 ? sourceNames : undefined,
          price_min: priceMin,
          price_max: priceMax,
          limit: limit * 2,
          in_stock: true,
        },
        accessId,
        secretKey
      );

      const byId = new Map<string, DatafeedrProduct>();
      for (const p of combinedProducts) byId.set(p._id, p);
      for (const p of fallbackResponse.products || []) byId.set(p._id, p);
      combinedProducts = Array.from(byId.values());
      console.log(`[Datafeedr] After merge: ${combinedProducts.length} candidates`);
    }

    return combinedProducts.map(convertToAlternativeProduct);
  } catch (error) {
    console.error('[Multi-Network] Datafeedr search failed:', error);
    return [];
  }
}

/**
 * Calculate match score based on user profile (0-100).
 *
 * Formula:
 *   55% — Product priority KPIs (quality, price, reviews, sustainability, design,
 *          shipping, warranty, brand_recognition) — rank 1 = 5× weight, rank 5 = 1×
 *   25% — Brand priority KPIs  (commission, cookie_duration, return_policy, reputation,
 *          payment_speed, easy_approval, customer_service, brand_sustainability)
 *   20% — Storefront context   (category dominance weighted by percentage, brand
 *          familiarity, price fit, network affinity)
 *
 * Uses enriched signals when provided — they carry commission rate, cookie duration,
 * return policy, Trustpilot score, brand tier, rating, etc. from the enrichment layer.
 * Falls back to basic signals (inStock, price, brand name only) when not yet enriched.
 */
function calculateProfileMatchScore(
  product: any,
  profile: UserProfile,
  intent: ProductIntent,
  enrichedSignals?: EnrichedProductSignals
): number {
  // Prefer enriched signals — they carry commission, cookie, rating, return policy, etc.
  const signals: EnrichedProductSignals = enrichedSignals ?? toBasicSignals(product);

  // ── A. Product Priority Score (55%) ─────────────────────────────────────
  // Covers quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition.
  const productPriorityScore: number = profile.productPriorities.length > 0
    ? computeWeightedPriorityScore(signals, profile.productPriorities)
    : 50;

  // ── B. Brand Priority Score (25%) ────────────────────────────────────────
  // Covers commission, cookie_duration, return_policy, reputation, payment_speed,
  // easy_approval, customer_service, brand_sustainability.
  // If user ranked "commission" #1, products from high-commission programs rank higher.
  const brandPriorityScore: number = profile.brandPriorities.length > 0
    ? computeWeightedPriorityScore(signals, profile.brandPriorities)
    : 50;

  // ── C. Storefront Context Score (20%) ────────────────────────────────────
  let contextScore = 0;
  let contextWeight = 0;

  // C1. Category alignment (weight 5)
  // Uses fuzzy alias matching (not exact strings) and scales the bonus by how
  // dominant this category is in the user's storefront (0% → no bonus, 100% → +30).
  const categoryWeight = 5;
  if (profile.storefrontContext.dominantCategories.length > 0) {
    const matchingCategory = profile.storefrontContext.dominantCategories.find(
      c => categoriesMatch(c.category, intent.category)
    );
    if (matchingCategory) {
      // Score 60–90: higher when this is the user's primary category
      const dominanceBonus = Math.round(matchingCategory.percentage * 30);
      contextScore += (60 + dominanceBonus) * categoryWeight;
    } else {
      contextScore += 50 * categoryWeight; // Neutral for categories outside user's usual mix
    }
    contextWeight += categoryWeight;
  }

  // C1b. Hard penalty when the product's own category doesn't match the search intent.
  if (intent.category && intent.category !== 'General' && product.category && product.category !== 'General') {
    if (!categoriesMatch(product.category, intent.category)) {
      contextScore -= 40 * categoryWeight;
    }
  }

  // C2. Brand familiarity (weight 3) — user has successfully promoted this brand before.
  const brandWeight = 3;
  const productBrandNorm = normalizeBrand(product.brand);
  const isFamiliarBrand = productBrandNorm.length > 0 &&
    profile.storefrontContext.topBrands.some(b => normalizeBrand(b) === productBrandNorm);
  contextScore += (isFamiliarBrand ? 90 : 50) * brandWeight;
  contextWeight += brandWeight;

  // C3. Price point fit (weight 2) — within ±100% of user's storefront avg = good fit.
  const priceWeight = 2;
  if (profile.storefrontContext.avgPricePoint > 0) {
    const priceDiff = Math.abs(product.price - profile.storefrontContext.avgPricePoint);
    const priceRatio = priceDiff / profile.storefrontContext.avgPricePoint;
    contextScore += Math.max(0, 100 - priceRatio * 100) * priceWeight;
  } else {
    contextScore += 50 * priceWeight;
  }
  contextWeight += priceWeight;

  // C4. Network affinity (weight 2) — prefer products from user's connected networks.
  const networkWeight = 2;
  const productNetwork = (product.affiliateNetwork || product.merchant || '').toLowerCase();
  if (productNetwork && profile.storefrontContext.preferredNetworks.length > 0) {
    const isPreferred = profile.storefrontContext.preferredNetworks.some(
      (n: string) => productNetwork.includes(n.toLowerCase()) || n.toLowerCase().includes(productNetwork)
    );
    contextScore += (isPreferred ? 95 : 40) * networkWeight;
  } else {
    contextScore += 50 * networkWeight;
  }
  contextWeight += networkWeight;

  const normalizedContextScore = contextWeight > 0
    ? Math.min(100, Math.max(0, Math.round(contextScore / contextWeight)))
    : 50;

  // ── Final weighted combination ─────────────────────────────────────────
  return Math.min(100, Math.max(0, Math.round(
    productPriorityScore * 0.55 +
    brandPriorityScore   * 0.25 +
    normalizedContextScore * 0.20
  )));
}


/**
 * Calculate priority alignment breakdown — spec-driven, using enriched signals.
 * Returns top 3 product priorities + top 2 brand priorities so the UI can
 * show a complete picture of why (or why not) this product fits the creator.
 */
function calculatePriorityAlignment(
  product: any,
  profile: UserProfile,
  enrichedSignals?: EnrichedProductSignals
): Record<string, { score: number; reason: string }> {
  const alignment: Record<string, { score: number; reason: string }> = {};
  const signals: EnrichedProductSignals = enrichedSignals ?? toBasicSignals(product);

  // Top 3 product priorities (quality, reviews, price, etc.)
  for (const priority of profile.productPriorities.slice(0, 3)) {
    const result = computeKpi(priority.id, signals);
    alignment[priority.id] = { score: result.score, reason: result.reason };
  }

  // Top 2 brand priorities (commission, cookie_duration, etc.) — enriched data carries these
  for (const priority of profile.brandPriorities.slice(0, 2)) {
    const result = computeKpi(priority.id, signals);
    alignment[priority.id] = { score: result.score, reason: result.reason };
  }

  return alignment;
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

  // Check if matches category — fuzzy alias match (not exact string comparison)
  const matchingCategory = profile.storefrontContext.dominantCategories.find(
    c => categoriesMatch(c.category, intent.category)
  );
  if (matchingCategory) {
    reasons.push(
      `Matches your ${intent.category} focus (${(matchingCategory.percentage * 100).toFixed(0)}% of your content)`
    );
  }

  // Check top priorities via spec library
  const topPriority = profile.productPriorities[0];
  if (topPriority) {
    const signals = toBasicSignals(product);
    const kpiResult = computeKpi(topPriority.id, signals);
    if (kpiResult.score >= 80) {
      reasons.push(`Strong ${topPriority.id}: ${kpiResult.reason}`);
    }
  }

  // Check brand familiarity — normalise both sides for case-insensitive comparison
  const productBrandNorm = normalizeBrand(product.brand);
  if (productBrandNorm && profile.storefrontContext.topBrands.some(b => normalizeBrand(b) === productBrandNorm)) {
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
  const intent = await analyzeProductIntent(originalProduct.url, env);

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
