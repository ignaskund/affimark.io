/**
 * Verifier Orchestrator
 *
 * Coordinates the full Product Verifier pipeline:
 * URL → scrape → score → verdict → coverage → intent → rank → bucket → playbook → watchlist
 *
 * New flow (v2):
 * 1. Scrape product page
 * 2. Compute 3-pillar scores
 * 3. Compute verdict (GREEN/YELLOW/RED/TEST_FIRST)
 * 4. Calculate coverage (data quality)
 * 5. Route intent (auto-determine rank mode + strategy)
 * 6. Rank alternatives with mode-specific weights
 * 7. Bucketize into Safe/Upside/Budget/Trending groups
 * 8. Return snapshot + recommendations (winner + buckets)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../index';
import { normalizeUrl, validateUrl, type NormalizedUrl } from './url-normalizer';
import { scrapeProductPage, type ScrapedProductData } from './page-scraper';
import {
  computeScores, computeConfidence, computeEarningBand, getBenchmarks,
  type ScoreResult, type ConfidenceResult, type ReputationData, type CommissionData,
} from './scoring-engine';
import { computeVerdict, type VerdictResult } from './verdict-engine';
import { calculateCoverage, type CoverageInput, type CoverageResult } from './coverage-engine';
import { routeIntent, getWeightsForMode, type RankMode, type IntentRouterInput, type IntentRouterOutput } from './intent-router';
import { rankAlternatives, rerankWithMode, type RankerCandidate, type RankedAlternative, type RankerOutput } from './alternatives-ranker';
import { bucketize, type BucketizerOutput, type Bucket, type BucketKey } from './bucketizer';
import { generatePlaybook, type PlaybookResult, type PlaybookInput } from './playbook-generator';
import { getBrandReputationWithCache, type BrandReputationResult } from '../reputation-scraper';

// --- Types ---

export interface AnalyzeRequest {
  product_url: string;
  user_context?: {
    region?: string;
    traffic_type?: string;
    risk_tolerance?: string;
    platform_preference?: string;
    min_commission_pct?: number;
    min_cookie_days?: number;
    price_band?: { min: number; max: number };
  };
}

export interface AnalyzeResponse {
  session_id: string;
  status: string;
  snapshot: {
    product: {
      title: string | null;
      brand: string | null;
      category: string | null;
      merchant: string;
      price: { amount: number | null; currency: string };
      region_availability: string[];
    };
    scores: {
      product_viability: number;
      offer_merchant: number;
      economics: number;
    };
    score_breakdowns: Record<string, Record<string, number>>;
    confidence: {
      level: 'LOW' | 'MED' | 'HIGH';
      evidence: any;
    };
    verdict: {
      status: 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST';
      primary_action: string;
      hard_stop_flags: string[];
    };
    insights: {
      top_pros: string[];
      top_risks: string[];
      key_assumptions: string[];
    };
    economics: {
      commission: any;
      cookie_days: number;
      earning_band: any;
      assumptions: any;
    };
    coverage: CoverageResult;
  };
  recommendations: {
    mode: RankMode;
    routing: IntentRouterOutput;
    winner: RankedAlternative | null;
    buckets: Bucket[];
    total_candidates: number;
    can_rerank: boolean;
  };
}

// Legacy response for backward compatibility
export interface LegacyAnalyzeResponse {
  session_id: string;
  status: string;
  product: {
    title: string | null;
    brand: string | null;
    category: string | null;
    merchant: string;
    price: { amount: number | null; currency: string };
    region_availability: string[];
  };
  scores: {
    product_viability: number;
    offer_merchant: number;
    economics_feasibility: number;
  };
  score_breakdowns: any;
  confidence: {
    level: string;
    evidence: any;
  };
  verdict: {
    status: string;
    primary_action: string;
    hard_stop_flags: string[];
  };
  insights: {
    top_pros: string[];
    top_risks: string[];
    key_assumptions: string[];
  };
  economics: {
    commission: any;
    cookie_days: number;
    earning_band: any;
    assumptions: any;
  };
}

// Rerank request/response
export interface RerankRequest {
  session_id: string;
  mode: RankMode;
}

export interface RerankResponse {
  mode: RankMode;
  winner: RankedAlternative | null;
  buckets: Bucket[];
  total_candidates: number;
}

// --- Main Functions ---

/**
 * Run the full analysis pipeline: URL → snapshot + recommendations
 *
 * Flow:
 * 1. Validate & normalize URL
 * 2. Scrape product page
 * 3. Compute 3-pillar scores
 * 4. Compute confidence & verdict
 * 5. Calculate coverage (data quality)
 * 6. Route intent (auto-determine rank mode)
 * 7. Load & rank alternative candidates
 * 8. Bucketize into decision-ready groups
 * 9. Return snapshot + recommendations
 */
export async function analyzeUrl(
  request: AnalyzeRequest,
  userId: string,
  env: Env
): Promise<AnalyzeResponse> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // 1. Validate URL
  const validation = validateUrl(request.product_url);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid URL');
  }

  // 2. Normalize URL
  const normalized = normalizeUrl(request.product_url);

  // 3. Create session
  const sessionId = await createSession(supabase, userId, normalized, request.user_context);

  try {
    // 4. Scrape product page
    const productData = await scrapeProductPage(
      normalized.normalized,
      normalized.platform,
      env
    );

    // 5. Detect brand slug for reputation/commission lookup
    const brandSlug = deriveBrandSlug(productData.brand, normalized.merchant);

    // 6. Get reputation data (best-effort)
    let reputationData: ReputationData | null = null;
    if (brandSlug) {
      reputationData = await getReputationForScoring(brandSlug, env);
    }

    // 7. Get commission data from DB
    const commissionData = await getCommissionData(
      brandSlug,
      productData.category || normalized.platform,
      supabase
    );

    // 8. Get category benchmarks
    const category = productData.category || deriveCategory(normalized.platform);
    const benchmarks = getBenchmarks(category);

    // 9. Compute scores
    const scores = computeScores({
      product: productData,
      reputation: reputationData,
      commission: commissionData,
      categoryBenchmarks: benchmarks,
    });

    // 10. Compute confidence
    const confidence = computeConfidence(productData, reputationData, commissionData);

    // 11. Compute verdict
    const verdict = computeVerdict({
      scores,
      confidence,
      product: productData,
      reputation: reputationData,
      commission: commissionData,
    });

    // 12. Compute earning band
    const earningBand = computeEarningBand(productData, commissionData, benchmarks);

    // 13. Build economics details
    const economics = {
      commission: commissionData ? {
        rate_pct_low: commissionData.rate_low,
        rate_pct_high: commissionData.rate_high,
        model: 'CPS',
        network: commissionData.network,
      } : {
        rate_pct_low: benchmarks.avg_commission * 0.8,
        rate_pct_high: benchmarks.avg_commission * 1.2,
        model: 'CPS',
        network: 'category_average',
      },
      cookie_days: commissionData?.cookie_days ?? benchmarks.avg_cookie_days,
      earning_band: earningBand,
      assumptions: earningBand.assumptions,
    };

    // 14. Calculate coverage (data quality assessment)
    const coverageInput: CoverageInput = {
      has_price: productData.price.amount !== null,
      has_reviews: (productData.reviews?.count ?? 0) > 0,
      has_rating: (productData.reviews?.rating ?? 0) > 0,
      has_brand: !!productData.brand,
      has_category: !!productData.category,
      has_trustpilot: reputationData?.trustpilot_rating !== null,
      has_google_reviews: reputationData?.google_rating !== null,
      has_commission_data: commissionData !== null,
      has_cookie_data: commissionData?.cookie_days !== undefined,
      has_conversion_data: commissionData?.avg_conversion_rate !== null,
      has_aov_data: commissionData?.avg_order_value !== null,
      has_refund_data: commissionData?.refund_rate !== null,
      has_trend_data: false, // Will be enhanced when trend data is available
    };
    const coverage = calculateCoverage(coverageInput);

    // 15. Route intent (determine rank mode + strategy)
    const intentInput: IntentRouterInput = {
      verdict: verdict.status as 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST',
      hard_stop_flags: verdict.hard_stop_flags,
      scores: {
        product_viability: scores.product_viability,
        offer_merchant: scores.offer_merchant,
        economics: scores.economics_feasibility,
      },
      confidence: confidence.level as 'LOW' | 'MED' | 'HIGH',
      coverage: coverage.overall_score,
      user_override: null, // Can be set from user_context if needed
    };
    const routing = routeIntent(intentInput);

    // 16. Load alternative candidates from database
    const candidates = await loadAlternativeCandidates(
      brandSlug,
      category,
      normalized.region || 'EU',
      supabase
    );

    // 17. Rank alternatives with mode-specific weights
    const categoryStats = await getCategoryStats(category, supabase);
    const rankerOutput = rankAlternatives(candidates, routing.rank_mode, categoryStats);

    // 18. Bucketize into decision-ready groups
    const bucketizerOutput = bucketize(rankerOutput.ranked, rankerOutput.winner, {
      items_per_bucket: 3,
      show_trending: routing.show_trending,
      bucket_strategy: routing.bucket_strategy,
    });

    // 19. Update session with full results
    await updateSession(supabase, sessionId, {
      status: 'recommendations_ready',
      product_data: productData,
      product_viability_score: scores.product_viability,
      offer_merchant_score: scores.offer_merchant,
      economics_score: scores.economics_feasibility,
      confidence: confidence.level,
      verdict: verdict.status,
      primary_action: verdict.primary_action,
      hard_stop_flags: verdict.hard_stop_flags,
      top_pros: verdict.top_pros,
      top_risks: verdict.top_risks,
      key_assumptions: verdict.key_assumptions,
      evidence_summary: confidence.evidence,
      score_breakdowns: scores.breakdowns,
      economics_details: economics,
      normalized_url: normalized.normalized,
      merchant: normalized.merchant,
      platform: normalized.platform,
      region: normalized.region,
      // New fields
      coverage: coverage,
      routing: routing,
      rank_mode: routing.rank_mode,
      winner: bucketizerOutput.winner,
      buckets: bucketizerOutput.buckets,
      ranked_alternatives: rankerOutput.ranked,
    });

    // 20. Build response with snapshot + recommendations
    return {
      session_id: sessionId,
      status: 'recommendations_ready',
      snapshot: {
        product: {
          title: productData.title,
          brand: productData.brand,
          category: category,
          merchant: normalized.merchant,
          price: productData.price,
          region_availability: productData.region_availability.length > 0
            ? productData.region_availability
            : normalized.region ? [normalized.region] : [],
        },
        scores: {
          product_viability: scores.product_viability,
          offer_merchant: scores.offer_merchant,
          economics: scores.economics_feasibility,
        },
        score_breakdowns: scores.breakdowns,
        confidence: {
          level: confidence.level as 'LOW' | 'MED' | 'HIGH',
          evidence: confidence.evidence,
        },
        verdict: {
          status: verdict.status as 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST',
          primary_action: verdict.primary_action,
          hard_stop_flags: verdict.hard_stop_flags,
        },
        insights: {
          top_pros: verdict.top_pros,
          top_risks: verdict.top_risks,
          key_assumptions: verdict.key_assumptions,
        },
        economics,
        coverage,
      },
      recommendations: {
        mode: routing.rank_mode,
        routing,
        winner: bucketizerOutput.winner,
        buckets: bucketizerOutput.buckets,
        total_candidates: bucketizerOutput.total_candidates,
        can_rerank: rankerOutput.ranked.length > 1,
      },
    };
  } catch (error) {
    // Update session as failed
    await updateSession(supabase, sessionId, {
      status: 'failed',
    });
    throw error;
  }
}

/**
 * Rerank alternatives with a new mode (triggered by pillar hover action)
 *
 * This allows users to instantly rerank without filtering:
 * - "Find higher-demand alternatives" → demand_first
 * - "Find more trusted brands" → trust_first
 * - "Find higher-margin programs" → economics_first
 */
export async function rerankAlternatives(
  sessionId: string,
  userId: string,
  newMode: RankMode,
  env: Env
): Promise<RerankResponse> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Load session
  const session = await getSession(supabase, sessionId, userId);
  if (!session) throw new Error('Session not found');

  // Get previously ranked alternatives
  const previousRanked = (session.ranked_alternatives || []) as RankedAlternative[];
  if (previousRanked.length === 0) {
    throw new Error('No alternatives to rerank');
  }

  // Get category stats for proper ranking
  const productData = session.product_data as ScrapedProductData;
  const category = productData?.category || 'general';
  const categoryStats = await getCategoryStats(category, supabase);

  // Rerank with new mode
  const rankerOutput = rerankWithMode(previousRanked, newMode, categoryStats);

  // Re-bucketize with new ranking
  const bucketizerOutput = bucketize(rankerOutput.ranked, rankerOutput.winner, {
    items_per_bucket: 3,
    show_trending: true,
    bucket_strategy: 'standard',
  });

  // Update session with new ranking
  await updateSession(supabase, sessionId, {
    rank_mode: newMode,
    winner: bucketizerOutput.winner,
    buckets: bucketizerOutput.buckets,
    ranked_alternatives: rankerOutput.ranked,
  });

  return {
    mode: newMode,
    winner: bucketizerOutput.winner,
    buckets: bucketizerOutput.buckets,
    total_candidates: bucketizerOutput.total_candidates,
  };
}

/**
 * Generate playbook for a session
 */
export async function getPlaybook(
  sessionId: string,
  userId: string,
  selectedAlternativeId: string | null,
  env: Env
): Promise<PlaybookResult> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const session = await getSession(supabase, sessionId, userId);
  if (!session) throw new Error('Session not found');

  const productData = session.product_data as ScrapedProductData;
  const economics = session.economics_details as any;
  const alternatives = (session.alternatives || []) as AlternativeResult[];

  // Determine which item was approved
  let approvedItem: { id: string; title: string; brand: string };
  let playbookInput: PlaybookInput;

  if (selectedAlternativeId) {
    const alt = alternatives.find(a => a.id === selectedAlternativeId);
    if (!alt) throw new Error('Selected alternative not found');

    approvedItem = { id: alt.id, title: alt.title, brand: alt.brand };
    playbookInput = {
      product_title: alt.title,
      brand: alt.brand,
      category: alt.category,
      merchant: alt.merchant,
      price: alt.price_band.min || null,
      currency: productData?.price?.currency || 'EUR',
      commission_rate: `${alt.commission.rate_pct_low}-${alt.commission.rate_pct_high}%`,
      network: alt.network,
      cookie_days: alt.cookie_days,
      top_pros: (session.top_pros as string[]) || [],
      top_risks: (session.top_risks as string[]) || [],
      user_region: session.region || 'EU',
      traffic_type: (session.user_context as any)?.traffic_type || 'ORGANIC',
    };
  } else {
    // Original product approved
    approvedItem = {
      id: sessionId,
      title: productData?.title || 'Product',
      brand: productData?.brand || session.merchant || 'Unknown',
    };
    playbookInput = {
      product_title: productData?.title || 'Product',
      brand: productData?.brand || session.merchant || 'Unknown',
      category: productData?.category || 'general',
      merchant: session.merchant || 'Unknown',
      price: productData?.price?.amount || null,
      currency: productData?.price?.currency || 'EUR',
      commission_rate: economics?.commission
        ? `${economics.commission.rate_pct_low}-${economics.commission.rate_pct_high}%`
        : 'varies',
      network: economics?.commission?.network || 'Unknown',
      cookie_days: economics?.cookie_days || 30,
      top_pros: (session.top_pros as string[]) || [],
      top_risks: (session.top_risks as string[]) || [],
      user_region: session.region || 'EU',
      traffic_type: (session.user_context as any)?.traffic_type || 'ORGANIC',
    };
  }

  const playbook = await generatePlaybook(playbookInput, approvedItem.id, env);

  // Update session
  await updateSession(supabase, sessionId, {
    status: 'playbook_ready',
    selected_alternative_id: selectedAlternativeId,
    approved_item: approvedItem,
    playbook,
  });

  return playbook;
}

/**
 * Add session to watchlist
 */
export async function addToWatchlist(
  sessionId: string,
  userId: string,
  env: Env
): Promise<{ watchlist_id: string }> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const session = await getSession(supabase, sessionId, userId);
  if (!session) throw new Error('Session not found');

  const productData = session.product_data as ScrapedProductData | null;

  const { data, error } = await supabase
    .from('verifier_watchlist')
    .insert({
      user_id: userId,
      session_id: sessionId,
      url: session.url,
      normalized_url: session.normalized_url,
      product_name: productData?.title || 'Unknown Product',
      brand: productData?.brand || session.merchant,
      merchant: session.merchant,
      category: productData?.category,
      last_snapshot: {
        scores: {
          product_viability: session.product_viability_score,
          offer_merchant: session.offer_merchant_score,
          economics_feasibility: session.economics_score,
        },
        verdict: session.verdict,
        confidence: session.confidence,
      },
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to add to watchlist: ${error.message}`);

  // Mark session as completed
  await updateSession(supabase, sessionId, { status: 'completed' });

  return { watchlist_id: data.id };
}

// --- Helper Functions ---

async function createSession(
  supabase: SupabaseClient,
  userId: string,
  normalized: NormalizedUrl,
  userContext: any
): Promise<string> {
  const { data, error } = await supabase
    .from('verifier_sessions')
    .insert({
      user_id: userId,
      url: normalized.original,
      normalized_url: normalized.normalized,
      merchant: normalized.merchant,
      platform: normalized.platform,
      region: normalized.region,
      user_context: userContext || {},
      status: 'analyzing',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data.id;
}

async function getSession(supabase: SupabaseClient, sessionId: string, userId: string) {
  const { data, error } = await supabase
    .from('verifier_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}

async function updateSession(supabase: SupabaseClient, sessionId: string, updates: Record<string, any>) {
  await supabase
    .from('verifier_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

function deriveBrandSlug(brand: string | null, merchant: string): string {
  const name = (brand || merchant || 'unknown').toLowerCase();
  return name
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

function deriveCategory(platform: string): string {
  // Map platforms to likely categories
  const platformCategories: Record<string, string> = {
    amazon: 'electronics',
    zalando: 'fashion',
    aboutyou: 'fashion',
    asos: 'fashion',
    sephora: 'beauty',
    douglas: 'beauty',
    mediamarkt: 'electronics',
    saturn: 'electronics',
  };
  return platformCategories[platform] || 'general';
}

async function getReputationForScoring(
  brandSlug: string,
  env: Env
): Promise<ReputationData | null> {
  try {
    const result = await getBrandReputationWithCache(
      brandSlug,
      env,
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY
    );

    if (!result || !result.sources || result.sources.length === 0) return null;

    // Convert to scoring engine format
    const trustpilot = result.sources.find(s => s.source === 'trustpilot');
    const google = result.sources.find(s => s.source === 'google');

    return {
      trustpilot_rating: trustpilot?.rating ?? null,
      trustpilot_reviews: trustpilot?.reviewCount ?? null,
      google_rating: google?.rating ?? null,
      google_reviews: google?.reviewCount ?? null,
      overall_rating: result.avgRating,
      overall_reviews: result.totalReviews,
      sentiment_score: null,
      has_shipping_complaints: result.overallSentiment === 'negative',
      has_quality_complaints: false,
      has_support_complaints: false,
    };
  } catch {
    return null;
  }
}

async function getCommissionData(
  brandSlug: string,
  category: string,
  supabase: SupabaseClient
): Promise<CommissionData | null> {
  try {
    // Try exact brand match first
    let { data } = await supabase
      .from('affiliate_programs')
      .select('*')
      .eq('brand_slug', brandSlug)
      .eq('is_active', true)
      .order('commission_rate_high', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      // Try by category
      const result = await supabase
        .from('affiliate_programs')
        .select('*')
        .eq('primary_category', category.toLowerCase())
        .eq('is_active', true)
        .order('commission_rate_high', { ascending: false })
        .limit(1)
        .single();
      data = result.data;
    }

    if (!data) return null;

    return {
      rate_low: data.commission_rate_low,
      rate_high: data.commission_rate_high,
      cookie_days: data.cookie_duration_days,
      network: data.network,
      avg_conversion_rate: data.avg_conversion_rate,
      avg_order_value: data.avg_order_value,
      refund_rate: data.refund_rate,
      requires_application: data.requires_application ?? true,
    };
  } catch {
    return null;
  }
}

/**
 * Load alternative candidates from the database
 * Excludes the original brand, matches by category
 */
async function loadAlternativeCandidates(
  excludeBrandSlug: string,
  category: string,
  region: string,
  supabase: SupabaseClient
): Promise<RankerCandidate[]> {
  try {
    // Query affiliate programs in the same category, excluding original brand
    const { data, error } = await supabase
      .from('affiliate_programs')
      .select('*')
      .eq('primary_category', category.toLowerCase())
      .neq('brand_slug', excludeBrandSlug)
      .eq('is_active', true)
      .order('commission_rate_high', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // Convert to RankerCandidate format
    return data.map((program: any): RankerCandidate => {
      // Calculate pillar scores from program data
      const productViability = calculateProductViabilityFromProgram(program);
      const offerMerchant = calculateOfferMerchantFromProgram(program);
      const economics = calculateEconomicsFromProgram(program);

      return {
        id: program.id,
        title: program.program_name || `${program.brand_name} Affiliate Program`,
        brand: program.brand_name,
        category: program.primary_category,
        merchant: program.merchant_name || program.brand_name,
        network: program.network,
        product_viability: productViability,
        offer_merchant: offerMerchant,
        economics: economics,
        commission_rate_low: program.commission_rate_low || 0,
        commission_rate_high: program.commission_rate_high || 0,
        cookie_days: program.cookie_duration_days || 30,
        avg_conversion_rate: program.avg_conversion_rate,
        avg_order_value: program.avg_order_value,
        refund_rate: program.refund_rate,
        coverage: calculateProgramCoverage(program),
        confidence: determineProgramConfidence(program),
        hard_stop_flags: detectHardStopFlags(program),
        risk_score: calculateProgramRisk(program),
        trend_score: program.trend_score || null,
        trend_eligible: program.trend_eligible || false,
        price_low: program.typical_price_low,
        price_high: program.typical_price_high,
        currency: 'EUR',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get category statistics for relative comparisons
 */
async function getCategoryStats(
  category: string,
  supabase: SupabaseClient
): Promise<{ median_price: number; price_p25: number; price_p75: number; median_aov: number; avg_commission: number } | undefined> {
  try {
    const { data } = await supabase
      .from('affiliate_programs')
      .select('commission_rate_high, avg_order_value, typical_price_low')
      .eq('primary_category', category.toLowerCase())
      .eq('is_active', true);

    if (!data || data.length < 3) return undefined;

    // Calculate statistics
    const commissions = data.map(d => d.commission_rate_high || 0).filter(c => c > 0);
    const aovs = data.map(d => d.avg_order_value || 0).filter(a => a > 0);
    const prices = data.map(d => d.typical_price_low || 0).filter(p => p > 0);

    const sortedPrices = [...prices].sort((a, b) => a - b);

    return {
      median_price: sortedPrices[Math.floor(sortedPrices.length / 2)] || 50,
      price_p25: sortedPrices[Math.floor(sortedPrices.length * 0.25)] || 25,
      price_p75: sortedPrices[Math.floor(sortedPrices.length * 0.75)] || 100,
      median_aov: aovs.length > 0 ? aovs.reduce((a, b) => a + b, 0) / aovs.length : 50,
      avg_commission: commissions.length > 0 ? commissions.reduce((a, b) => a + b, 0) / commissions.length : 5,
    };
  } catch {
    return undefined;
  }
}

// --- Score Calculation Helpers for Program Data ---

function calculateProductViabilityFromProgram(program: any): number {
  let score = 50; // Base score

  // Brand recognition bonus
  if (program.brand_tier === 'premium') score += 20;
  else if (program.brand_tier === 'mainstream') score += 10;

  // Review/rating proxy (if available)
  if (program.merchant_rating && program.merchant_rating >= 4.5) score += 15;
  else if (program.merchant_rating && program.merchant_rating >= 4.0) score += 10;

  // Category demand (default categories get baseline)
  if (program.high_demand_category) score += 10;

  return Math.min(100, Math.max(0, score));
}

function calculateOfferMerchantFromProgram(program: any): number {
  let score = 50; // Base score

  // Trust indicators
  if (program.merchant_rating && program.merchant_rating >= 4.5) score += 25;
  else if (program.merchant_rating && program.merchant_rating >= 4.0) score += 15;
  else if (program.merchant_rating && program.merchant_rating >= 3.5) score += 5;

  // Verification status
  if (program.verified_program) score += 15;

  // Returns/shipping quality
  if (program.has_free_shipping) score += 5;
  if (program.has_easy_returns) score += 5;

  return Math.min(100, Math.max(0, score));
}

function calculateEconomicsFromProgram(program: any): number {
  let score = 0;

  // Commission component (40 points max)
  const commissionRate = program.commission_rate_high || 0;
  if (commissionRate >= 15) score += 40;
  else if (commissionRate >= 10) score += 30;
  else if (commissionRate >= 7) score += 25;
  else if (commissionRate >= 5) score += 20;
  else if (commissionRate >= 3) score += 15;
  else score += 10;

  // Cookie duration component (20 points max)
  const cookieDays = program.cookie_duration_days || 30;
  if (cookieDays >= 90) score += 20;
  else if (cookieDays >= 60) score += 15;
  else if (cookieDays >= 30) score += 10;
  else score += 5;

  // Conversion rate component (20 points max)
  const convRate = program.avg_conversion_rate || 0;
  if (convRate >= 0.05) score += 20;
  else if (convRate >= 0.03) score += 15;
  else if (convRate >= 0.02) score += 10;
  else score += 5;

  // AOV component (20 points max)
  const aov = program.avg_order_value || 0;
  if (aov >= 100) score += 20;
  else if (aov >= 75) score += 15;
  else if (aov >= 50) score += 10;
  else score += 5;

  return Math.min(100, Math.max(0, score));
}

function calculateProgramCoverage(program: any): number {
  let signals = 0;
  let total = 8;

  if (program.commission_rate_high) signals++;
  if (program.cookie_duration_days) signals++;
  if (program.avg_conversion_rate) signals++;
  if (program.avg_order_value) signals++;
  if (program.merchant_rating) signals++;
  if (program.refund_rate !== null) signals++;
  if (program.verified_program) signals++;
  if (program.last_verified_at) signals++;

  return signals / total;
}

function determineProgramConfidence(program: any): 'LOW' | 'MED' | 'HIGH' {
  const coverage = calculateProgramCoverage(program);

  if (coverage >= 0.75 && program.verified_program) return 'HIGH';
  if (coverage >= 0.5) return 'MED';
  return 'LOW';
}

function detectHardStopFlags(program: any): string[] {
  const flags: string[] = [];

  if (program.merchant_rating && program.merchant_rating < 2.5) {
    flags.push('MERCHANT_RISK');
  }

  if (program.refund_rate && program.refund_rate > 0.25) {
    flags.push('HIGH_REFUND_RATE');
  }

  if (program.program_paused) {
    flags.push('PROGRAM_PAUSED');
  }

  if (program.compliance_risk) {
    flags.push('COMPLIANCE_RISK');
  }

  return flags;
}

function calculateProgramRisk(program: any): number {
  let risk = 0;

  // Low merchant rating increases risk
  if (program.merchant_rating) {
    if (program.merchant_rating < 3.0) risk += 0.3;
    else if (program.merchant_rating < 3.5) risk += 0.2;
    else if (program.merchant_rating < 4.0) risk += 0.1;
  } else {
    risk += 0.15; // Unknown rating is slight risk
  }

  // High refund rate increases risk
  if (program.refund_rate) {
    if (program.refund_rate > 0.20) risk += 0.25;
    else if (program.refund_rate > 0.10) risk += 0.15;
    else if (program.refund_rate > 0.05) risk += 0.05;
  }

  // Unverified program increases risk
  if (!program.verified_program) risk += 0.1;

  // Application required adds slight risk (uncertainty)
  if (program.requires_application) risk += 0.05;

  return Math.min(1, Math.max(0, risk));
}
