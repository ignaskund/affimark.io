/**
 * Brand Research Agent (Step 2)
 * 
 * Researches brand reputation from multiple sources and finds alternative brands.
 * This is the second step in the 3-step Commission Agent flow.
 */

import { Env } from '../../index';

// ============================================================
// Types
// ============================================================

export interface BrandResearchInput {
    brandSlug: string;
    brandName: string;
    category: string;
    productUrl: string;
    userId?: string;
    includeAlternatives?: boolean;  // Default true
    matchType?: 'exact' | 'similar';  // User preference from settings
}

export interface ReputationSource {
    source: 'trustpilot' | 'google' | 'reviewsio' | 'bbb' | 'capterra';
    displayName: string;
    rating: number | null;      // 0-5 stars
    reviewCount: number | null;
    sentimentLabel: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
    sentimentScore: number | null;  // -1 to 1
    sourceUrl: string | null;
    lastUpdated: string | null;
}

export interface PartnershipQuality {
    overallScore: number;  // 0-100
    payoutReliability: { score: number; label: string };
    supportQuality: { score: number; label: string };
    creativeAssets: { score: number; label: string };
    trackingReliability: { score: number; label: string };
    flags: {
        hasDedicatedManager: boolean;
        offersExclusiveDeals: boolean;
        hasTieredCommissions: boolean;
    };
}

export interface AlternativeBrand {
    brandSlug: string;
    brandName: string;
    matchType: 'exact_product' | 'similar_product' | 'same_category';
    similarityScore: number;  // 0-1
    avgRating: number | null;
    totalReviews: number;
    commissionRateLow: number;
    commissionRateHigh: number;
    network: string;
    networkDisplay: string;
}

export interface BrandResearchResult {
    success: boolean;

    brand: {
        slug: string;
        name: string;
        category: string;
    };

    // Reputation from 5 sources
    reputation: ReputationSource[];
    avgRating: number | null;
    totalReviews: number;

    // Aggregated partnership quality
    partnershipQuality: PartnershipQuality;

    // Alternative brands (sorted by reputation + commission)
    alternatives: AlternativeBrand[];

    // Recommendation
    recommendation: 'proceed' | 'consider_alternatives' | 'avoid';
    recommendationReasons: string[];

    error?: string;
}

// ============================================================
// Reputation Source Configuration
// ============================================================

const REPUTATION_SOURCES: Array<{
    key: ReputationSource['source'];
    displayName: string;
    urlTemplate: (brand: string) => string;
}> = [
        { key: 'trustpilot', displayName: 'Trustpilot', urlTemplate: (b) => `https://www.trustpilot.com/review/${b}.com` },
        { key: 'google', displayName: 'Google Reviews', urlTemplate: (b) => `https://www.google.com/search?q=${b}+reviews` },
        { key: 'reviewsio', displayName: 'Reviews.io', urlTemplate: (b) => `https://www.reviews.io/company-reviews/store/${b}` },
        { key: 'bbb', displayName: 'BBB', urlTemplate: (b) => `https://www.bbb.org/search?find_text=${b}` },
        { key: 'capterra', displayName: 'Capterra', urlTemplate: (b) => `https://www.capterra.com/search/?search=${b}` },
    ];

// ============================================================
// Fetch Brand Reputation (with caching)
// ============================================================

async function fetchReputationFromCache(
    brandSlug: string,
    supabaseUrl: string,
    supabaseKey: string
): Promise<ReputationSource[]> {
    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/brand_reputation?brand_slug=eq.${brandSlug}&select=*`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        if (!response.ok) return [];

        const data = await response.json() as Array<{
            source: string;
            rating: number | null;
            review_count: number | null;
            sentiment_label: string | null;
            sentiment_score: number | null;
            source_url: string | null;
            scraped_at: string | null;
            expires_at: string;
        }>;

        // Filter out expired entries
        const now = new Date();
        const validEntries = data.filter(d => new Date(d.expires_at) > now);

        return validEntries.map(d => ({
            source: d.source as ReputationSource['source'],
            displayName: REPUTATION_SOURCES.find(s => s.key === d.source)?.displayName || d.source,
            rating: d.rating,
            reviewCount: d.review_count,
            sentimentLabel: (d.sentiment_label || 'unknown') as ReputationSource['sentimentLabel'],
            sentimentScore: d.sentiment_score,
            sourceUrl: d.source_url,
            lastUpdated: d.scraped_at,
        }));
    } catch {
        return [];
    }
}

async function fetchFreshReputation(
    brandSlug: string,
    brandName: string,
    env: Env
): Promise<ReputationSource[]> {
    // For now, return placeholder data
    // In production, this would call the reputation-scraper service
    return REPUTATION_SOURCES.map(source => ({
        source: source.key,
        displayName: source.displayName,
        rating: null,
        reviewCount: null,
        sentimentLabel: 'unknown' as const,
        sentimentScore: null,
        sourceUrl: source.urlTemplate(brandSlug),
        lastUpdated: null,
    }));
}

// ============================================================
// Calculate Partnership Quality
// ============================================================

function calculatePartnershipQuality(reputation: ReputationSource[]): PartnershipQuality {
    // Calculate average rating from available sources
    const ratings = reputation.filter(r => r.rating !== null).map(r => r.rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 3;

    // Convert 5-star rating to 0-100 score
    const baseScore = Math.round((avgRating / 5) * 100);

    // Estimate sub-scores based on overall rating and sentiment
    const sentimentBonus = reputation.some(r => r.sentimentLabel === 'positive') ? 10 : 0;
    const sentimentPenalty = reputation.some(r => r.sentimentLabel === 'negative') ? -15 : 0;

    const overallScore = Math.max(0, Math.min(100, baseScore + sentimentBonus + sentimentPenalty));

    return {
        overallScore,
        payoutReliability: {
            score: Math.min(100, overallScore + 5),
            label: overallScore >= 70 ? 'Reliable' : overallScore >= 50 ? 'Generally reliable' : 'Mixed reports'
        },
        supportQuality: {
            score: Math.max(0, overallScore - 5),
            label: overallScore >= 70 ? 'Responsive' : overallScore >= 50 ? 'Average' : 'Slow response'
        },
        creativeAssets: {
            score: 60, // Default - would need specific data
            label: 'Standard resources available'
        },
        trackingReliability: {
            score: 75, // Default - would need network-specific data
            label: 'Accurate tracking'
        },
        flags: {
            hasDedicatedManager: overallScore >= 80,
            offersExclusiveDeals: overallScore >= 70,
            hasTieredCommissions: true, // Common for most programs
        },
    };
}

// ============================================================
// Find Alternative Brands
// ============================================================

async function findAlternativeBrands(
    brandSlug: string,
    category: string,
    matchType: 'exact' | 'similar',
    supabaseUrl: string,
    supabaseKey: string
): Promise<AlternativeBrand[]> {
    try {
        // Query affiliate_programs for same category, different brand
        const response = await fetch(
            `${supabaseUrl}/rest/v1/affiliate_programs?category=eq.${category}&brand_slug=neq.${brandSlug}&is_active=eq.true&order=commission_rate_high.desc&limit=5`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        if (!response.ok) return [];

        const data = await response.json() as Array<{
            brand_slug: string;
            brand_name: string;
            commission_rate_low: number;
            commission_rate_high: number;
            network: string;
        }>;

        return data.map(p => ({
            brandSlug: p.brand_slug,
            brandName: p.brand_name,
            matchType: 'same_category' as const,
            similarityScore: 0.7,
            avgRating: null, // Would need to fetch from brand_reputation
            totalReviews: 0,
            commissionRateLow: p.commission_rate_low,
            commissionRateHigh: p.commission_rate_high,
            network: p.network,
            networkDisplay: p.network.charAt(0).toUpperCase() + p.network.slice(1),
        }));
    } catch {
        return [];
    }
}

// ============================================================
// Generate Recommendation
// ============================================================

function generateRecommendation(
    partnershipQuality: PartnershipQuality,
    alternatives: AlternativeBrand[]
): { recommendation: BrandResearchResult['recommendation']; reasons: string[] } {
    const reasons: string[] = [];

    if (partnershipQuality.overallScore >= 70) {
        reasons.push('Brand has good overall reputation');
        if (partnershipQuality.flags.hasDedicatedManager) {
            reasons.push('Offers dedicated affiliate manager');
        }
        return { recommendation: 'proceed', reasons };
    }

    if (partnershipQuality.overallScore >= 50) {
        reasons.push('Brand reputation is average');
        if (alternatives.length > 0 && alternatives[0].commissionRateHigh > 10) {
            reasons.push('Better-paying alternatives available');
            return { recommendation: 'consider_alternatives', reasons };
        }
        return { recommendation: 'proceed', reasons };
    }

    reasons.push('Brand has poor reputation scores');
    if (partnershipQuality.payoutReliability.score < 50) {
        reasons.push('Concerns about payout reliability');
    }
    if (alternatives.length > 0) {
        reasons.push('Consider alternative brands with better reputation');
    }
    return { recommendation: 'avoid', reasons };
}

// ============================================================
// Main Agent Function
// ============================================================

export async function runBrandResearchAgent(
    input: BrandResearchInput,
    env: Env
): Promise<BrandResearchResult> {
    try {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_SERVICE_KEY;

        // Fetch reputation from cache first
        let reputation = await fetchReputationFromCache(input.brandSlug, supabaseUrl, supabaseKey);

        // If cache miss or incomplete, fetch fresh data
        if (reputation.length < 3) {
            reputation = await fetchFreshReputation(input.brandSlug, input.brandName, env);
        }

        // Calculate aggregated metrics
        const ratings = reputation.filter(r => r.rating !== null).map(r => r.rating!);
        const avgRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
        const totalReviews = reputation.reduce((sum, r) => sum + (r.reviewCount || 0), 0);

        // Calculate partnership quality
        const partnershipQuality = calculatePartnershipQuality(reputation);

        // Find alternatives if requested
        const alternatives = input.includeAlternatives !== false
            ? await findAlternativeBrands(
                input.brandSlug,
                input.category,
                input.matchType || 'similar',
                supabaseUrl,
                supabaseKey
            )
            : [];

        // Generate recommendation
        const { recommendation, reasons } = generateRecommendation(partnershipQuality, alternatives);

        return {
            success: true,
            brand: {
                slug: input.brandSlug,
                name: input.brandName,
                category: input.category,
            },
            reputation,
            avgRating,
            totalReviews,
            partnershipQuality,
            alternatives,
            recommendation,
            recommendationReasons: reasons,
        };
    } catch (error) {
        return {
            success: false,
            brand: { slug: input.brandSlug, name: input.brandName, category: input.category },
            reputation: [],
            avgRating: null,
            totalReviews: 0,
            partnershipQuality: {
                overallScore: 0,
                payoutReliability: { score: 0, label: 'Unknown' },
                supportQuality: { score: 0, label: 'Unknown' },
                creativeAssets: { score: 0, label: 'Unknown' },
                trackingReliability: { score: 0, label: 'Unknown' },
                flags: { hasDedicatedManager: false, offersExclusiveDeals: false, hasTieredCommissions: false },
            },
            alternatives: [],
            recommendation: 'consider_alternatives',
            recommendationReasons: ['Error researching brand'],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
