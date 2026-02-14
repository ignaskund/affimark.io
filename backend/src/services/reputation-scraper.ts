/**
 * Brand Reputation Scraper Service
 * 
 * Fetches and caches brand reputation from multiple sources:
 * - Trustpilot (primary)
 * - Google Reviews (via Places API)
 * - Reviews.io (public API)
 * - BBB (scraping)
 * - Capterra (scraping, for B2B/SaaS)
 */

import { Env } from '../index';

// ============================================================
// Types
// ============================================================

export interface ReputationData {
    source: 'trustpilot' | 'google' | 'reviewsio' | 'bbb' | 'capterra';
    rating: number | null;
    reviewCount: number | null;
    sentimentLabel: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
    sentimentScore: number | null;
    responseRate: number | null;
    sourceUrl: string | null;
    rawData?: Record<string, unknown>;
}

export interface BrandReputationResult {
    brandSlug: string;
    sources: ReputationData[];
    avgRating: number | null;
    totalReviews: number;
    overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
    fetchedAt: string;
    cachedUntil: string;
}

// ============================================================
// Trustpilot Scraper
// ============================================================

async function fetchTrustpilotReputation(brandSlug: string): Promise<ReputationData> {
    const searchUrl = `https://www.trustpilot.com/review/${brandSlug}.com`;
    const altSearchUrl = `https://www.trustpilot.com/review/www.${brandSlug}.com`;

    try {
        // Try primary URL
        let response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        // If not found, try with www prefix
        if (!response.ok) {
            response = await fetch(altSearchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
        }

        if (!response.ok) {
            return {
                source: 'trustpilot',
                rating: null,
                reviewCount: null,
                sentimentLabel: 'unknown',
                sentimentScore: null,
                responseRate: null,
                sourceUrl: searchUrl,
            };
        }

        const html = await response.text();

        // Extract rating from JSON-LD or meta tags
        const ratingMatch = html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
        const reviewCountMatch = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/);

        // Alternative extraction from HTML
        const altRatingMatch = html.match(/data-rating="([\d.]+)"/);
        const altReviewMatch = html.match(/(\d[\d,]*)\s*reviews?/i);

        const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1]) :
            altRatingMatch?.[1] ? parseFloat(altRatingMatch[1]) : null;
        const reviewCount = reviewCountMatch?.[1] ? parseInt(reviewCountMatch[1]) :
            altReviewMatch?.[1] ? parseInt(altReviewMatch[1].replace(/,/g, '')) : null;

        // Determine sentiment from rating
        let sentimentLabel: ReputationData['sentimentLabel'] = 'unknown';
        let sentimentScore: number | null = null;
        if (rating !== null) {
            sentimentScore = (rating - 2.5) / 2.5; // Map 0-5 to -1 to 1
            if (rating >= 4) sentimentLabel = 'positive';
            else if (rating >= 3) sentimentLabel = 'neutral';
            else if (rating >= 2) sentimentLabel = 'mixed';
            else sentimentLabel = 'negative';
        }

        return {
            source: 'trustpilot',
            rating,
            reviewCount,
            sentimentLabel,
            sentimentScore,
            responseRate: null,
            sourceUrl: response.url || searchUrl,
        };
    } catch (error) {
        console.error('Trustpilot fetch error:', error);
        return {
            source: 'trustpilot',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    }
}

// ============================================================
// Google Reviews (via search scraping - no API key needed)
// ============================================================

async function fetchGoogleReputation(brandSlug: string): Promise<ReputationData> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(brandSlug)}+reviews`;

    try {
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });

        if (!response.ok) {
            return {
                source: 'google',
                rating: null,
                reviewCount: null,
                sentimentLabel: 'unknown',
                sentimentScore: null,
                responseRate: null,
                sourceUrl: searchUrl,
            };
        }

        const html = await response.text();

        // Try to extract rating from knowledge panel
        const ratingMatch = html.match(/(\d\.\d)\s*(?:out of 5|\/5|stars)/i);
        const reviewMatch = html.match(/([\d,]+)\s*(?:reviews?|ratings?)/i);

        const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1]) : null;
        const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;

        let sentimentLabel: ReputationData['sentimentLabel'] = 'unknown';
        let sentimentScore: number | null = null;
        if (rating !== null) {
            sentimentScore = (rating - 2.5) / 2.5;
            if (rating >= 4) sentimentLabel = 'positive';
            else if (rating >= 3) sentimentLabel = 'neutral';
            else sentimentLabel = 'negative';
        }

        return {
            source: 'google',
            rating,
            reviewCount,
            sentimentLabel,
            sentimentScore,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    } catch (error) {
        console.error('Google fetch error:', error);
        return {
            source: 'google',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    }
}

// ============================================================
// Reviews.io (public API)
// ============================================================

async function fetchReviewsIoReputation(brandSlug: string): Promise<ReputationData> {
    const apiUrl = `https://api.reviews.io/merchant/latest?store=${brandSlug}`;
    const fallbackUrl = `https://www.reviews.io/company-reviews/store/${brandSlug}`;

    try {
        const response = await fetch(apiUrl, {
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            const data = await response.json() as {
                stats?: { average_rating?: number; total_reviews?: number };
            };

            const rating = data.stats?.average_rating ?? null;
            const reviewCount = data.stats?.total_reviews ?? null;

            let sentimentLabel: ReputationData['sentimentLabel'] = 'unknown';
            let sentimentScore: number | null = null;
            if (rating !== null) {
                sentimentScore = (rating - 2.5) / 2.5;
                if (rating >= 4) sentimentLabel = 'positive';
                else if (rating >= 3) sentimentLabel = 'neutral';
                else sentimentLabel = 'negative';
            }

            return {
                source: 'reviewsio',
                rating,
                reviewCount,
                sentimentLabel,
                sentimentScore,
                responseRate: null,
                sourceUrl: fallbackUrl,
                rawData: data as Record<string, unknown>,
            };
        }

        return {
            source: 'reviewsio',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: fallbackUrl,
        };
    } catch (error) {
        console.error('Reviews.io fetch error:', error);
        return {
            source: 'reviewsio',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: fallbackUrl,
        };
    }
}

// ============================================================
// BBB (Better Business Bureau) - US/Canada focused
// ============================================================

async function fetchBBBReputation(brandSlug: string): Promise<ReputationData> {
    const searchUrl = `https://www.bbb.org/search?find_text=${encodeURIComponent(brandSlug)}`;

    // BBB uses grades (A+, A, B, etc.) rather than numeric ratings
    // We'll convert these to a 5-point scale
    const gradeToRating: Record<string, number> = {
        'A+': 5.0, 'A': 4.5, 'A-': 4.0,
        'B+': 3.5, 'B': 3.25, 'B-': 3.0,
        'C+': 2.5, 'C': 2.25, 'C-': 2.0,
        'D+': 1.5, 'D': 1.25, 'D-': 1.0,
        'F': 0.5, 'NR': null,
    };

    try {
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
        });

        if (!response.ok) {
            return {
                source: 'bbb',
                rating: null,
                reviewCount: null,
                sentimentLabel: 'unknown',
                sentimentScore: null,
                responseRate: null,
                sourceUrl: searchUrl,
            };
        }

        const html = await response.text();

        // Extract BBB rating grade
        const gradeMatch = html.match(/(?:BBB\s+)?Rating[:\s]+([A-F][+-]?|NR)/i);
        const reviewMatch = html.match(/([\d,]+)\s*(?:customer\s+)?reviews?/i);

        const grade = gradeMatch?.[1]?.toUpperCase();
        const rating = grade ? gradeToRating[grade] ?? null : null;
        const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;

        let sentimentLabel: ReputationData['sentimentLabel'] = 'unknown';
        let sentimentScore: number | null = null;
        if (rating !== null) {
            sentimentScore = (rating - 2.5) / 2.5;
            if (rating >= 4) sentimentLabel = 'positive';
            else if (rating >= 3) sentimentLabel = 'neutral';
            else sentimentLabel = 'negative';
        }

        return {
            source: 'bbb',
            rating,
            reviewCount,
            sentimentLabel,
            sentimentScore,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    } catch (error) {
        console.error('BBB fetch error:', error);
        return {
            source: 'bbb',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    }
}

// ============================================================
// Capterra (B2B/SaaS focused)
// ============================================================

async function fetchCapterraReputation(brandSlug: string): Promise<ReputationData> {
    const searchUrl = `https://www.capterra.com/search/?search=${encodeURIComponent(brandSlug)}`;

    try {
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
        });

        if (!response.ok) {
            return {
                source: 'capterra',
                rating: null,
                reviewCount: null,
                sentimentLabel: 'unknown',
                sentimentScore: null,
                responseRate: null,
                sourceUrl: searchUrl,
            };
        }

        const html = await response.text();

        // Extract rating
        const ratingMatch = html.match(/(\d\.\d)\s*(?:out of 5|\/5)/i);
        const reviewMatch = html.match(/([\d,]+)\s*reviews?/i);

        const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1]) : null;
        const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;

        let sentimentLabel: ReputationData['sentimentLabel'] = 'unknown';
        let sentimentScore: number | null = null;
        if (rating !== null) {
            sentimentScore = (rating - 2.5) / 2.5;
            if (rating >= 4) sentimentLabel = 'positive';
            else if (rating >= 3) sentimentLabel = 'neutral';
            else sentimentLabel = 'negative';
        }

        return {
            source: 'capterra',
            rating,
            reviewCount,
            sentimentLabel,
            sentimentScore,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    } catch (error) {
        console.error('Capterra fetch error:', error);
        return {
            source: 'capterra',
            rating: null,
            reviewCount: null,
            sentimentLabel: 'unknown',
            sentimentScore: null,
            responseRate: null,
            sourceUrl: searchUrl,
        };
    }
}

// ============================================================
// Main Aggregation Function
// ============================================================

export async function fetchBrandReputation(
    brandSlug: string,
    _env: Env,
    sources: Array<'trustpilot' | 'google' | 'reviewsio' | 'bbb' | 'capterra'> = ['trustpilot', 'google', 'reviewsio']
): Promise<BrandReputationResult> {
    const now = new Date();
    const cacheExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Fetch from requested sources in parallel
    const fetchPromises = sources.map(source => {
        switch (source) {
            case 'trustpilot': return fetchTrustpilotReputation(brandSlug);
            case 'google': return fetchGoogleReputation(brandSlug);
            case 'reviewsio': return fetchReviewsIoReputation(brandSlug);
            case 'bbb': return fetchBBBReputation(brandSlug);
            case 'capterra': return fetchCapterraReputation(brandSlug);
        }
    });

    const results = await Promise.all(fetchPromises);

    // Calculate aggregated metrics
    const validRatings = results.filter(r => r.rating !== null).map(r => r.rating!);
    const avgRating = validRatings.length > 0
        ? Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10) / 10
        : null;
    const totalReviews = results.reduce((sum, r) => sum + (r.reviewCount || 0), 0);

    // Determine overall sentiment
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, mixed: 0, unknown: 0 };
    results.forEach(r => sentimentCounts[r.sentimentLabel]++);

    let overallSentiment: BrandReputationResult['overallSentiment'] = 'unknown';
    if (sentimentCounts.positive >= 2) overallSentiment = 'positive';
    else if (sentimentCounts.negative >= 2) overallSentiment = 'negative';
    else if (sentimentCounts.positive > 0 && sentimentCounts.negative > 0) overallSentiment = 'mixed';
    else if (sentimentCounts.positive > 0 || sentimentCounts.neutral > 0) overallSentiment = 'neutral';

    return {
        brandSlug,
        sources: results,
        avgRating,
        totalReviews,
        overallSentiment,
        fetchedAt: now.toISOString(),
        cachedUntil: cacheExpiry.toISOString(),
    };
}

// ============================================================
// Cache Management
// ============================================================

export async function getBrandReputationWithCache(
    brandSlug: string,
    env: Env,
    supabaseUrl: string,
    supabaseKey: string
): Promise<BrandReputationResult> {
    // Check cache first
    try {
        const cacheResponse = await fetch(
            `${supabaseUrl}/rest/v1/brand_reputation?brand_slug=eq.${brandSlug}&expires_at=gt.${new Date().toISOString()}&select=*`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        if (cacheResponse.ok) {
            const cached = await cacheResponse.json() as Array<{
                source: string;
                rating: number | null;
                review_count: number | null;
                sentiment_label: string;
                sentiment_score: number | null;
                response_rate: number | null;
                source_url: string | null;
                scraped_at: string;
                expires_at: string;
            }>;

            if (cached.length >= 2) {
                // Return cached data
                const sources: ReputationData[] = cached.map(c => ({
                    source: c.source as ReputationData['source'],
                    rating: c.rating,
                    reviewCount: c.review_count,
                    sentimentLabel: c.sentiment_label as ReputationData['sentimentLabel'],
                    sentimentScore: c.sentiment_score,
                    responseRate: c.response_rate,
                    sourceUrl: c.source_url,
                }));

                const validRatings = sources.filter(r => r.rating !== null).map(r => r.rating!);
                const avgRating = validRatings.length > 0
                    ? Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10) / 10
                    : null;

                return {
                    brandSlug,
                    sources,
                    avgRating,
                    totalReviews: sources.reduce((sum, r) => sum + (r.reviewCount || 0), 0),
                    overallSentiment: 'positive', // Simplified
                    fetchedAt: cached[0].scraped_at,
                    cachedUntil: cached[0].expires_at,
                };
            }
        }
    } catch (error) {
        console.error('Cache lookup error:', error);
    }

    // Cache miss - fetch fresh data
    const freshData = await fetchBrandReputation(brandSlug, env);

    // Store in cache
    try {
        for (const source of freshData.sources) {
            await fetch(`${supabaseUrl}/rest/v1/brand_reputation`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify({
                    brand_slug: brandSlug,
                    source: source.source,
                    rating: source.rating,
                    review_count: source.reviewCount,
                    sentiment_label: source.sentimentLabel,
                    sentiment_score: source.sentimentScore,
                    response_rate: source.responseRate,
                    source_url: source.sourceUrl,
                    scraped_at: freshData.fetchedAt,
                    expires_at: freshData.cachedUntil,
                }),
            });
        }
    } catch (error) {
        console.error('Cache store error:', error);
    }

    return freshData;
}
