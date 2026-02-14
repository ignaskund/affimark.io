import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from '../../index';
import {
    fetchBrandReputation,
    getBrandReputationWithCache
} from '../../services/reputation-scraper';

const reputationRoutes = new Hono<{ Bindings: Env }>();

reputationRoutes.use('*', cors());

/**
 * GET /api/reputation/:brandSlug
 * Fetch brand reputation from multiple sources
 */
reputationRoutes.get('/:brandSlug', async (c) => {
    const brandSlug = c.req.param('brandSlug');
    const useCache = c.req.query('cache') !== 'false';
    const sources = c.req.query('sources')?.split(',') as
        Array<'trustpilot' | 'google' | 'reviewsio' | 'bbb' | 'capterra'> | undefined;

    if (!brandSlug) {
        return c.json({ error: 'Brand slug required' }, 400);
    }

    try {
        let result;

        if (useCache && c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_KEY) {
            result = await getBrandReputationWithCache(
                brandSlug,
                c.env,
                c.env.SUPABASE_URL,
                c.env.SUPABASE_SERVICE_KEY
            );
        } else {
            result = await fetchBrandReputation(brandSlug, c.env, sources);
        }

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Reputation fetch error:', error);
        return c.json({
            success: false,
            error: 'Failed to fetch brand reputation',
        }, 500);
    }
});

/**
 * POST /api/reputation/batch
 * Fetch reputation for multiple brands
 */
reputationRoutes.post('/batch', async (c) => {
    const body = await c.req.json() as { brands: string[] };

    if (!body.brands || !Array.isArray(body.brands) || body.brands.length === 0) {
        return c.json({ error: 'Brands array required' }, 400);
    }

    if (body.brands.length > 10) {
        return c.json({ error: 'Maximum 10 brands per batch' }, 400);
    }

    try {
        const results = await Promise.all(
            body.brands.map(async (brandSlug) => {
                try {
                    if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_KEY) {
                        return await getBrandReputationWithCache(
                            brandSlug,
                            c.env,
                            c.env.SUPABASE_URL,
                            c.env.SUPABASE_SERVICE_KEY
                        );
                    }
                    return await fetchBrandReputation(brandSlug, c.env);
                } catch (error) {
                    return {
                        brandSlug,
                        sources: [],
                        avgRating: null,
                        totalReviews: 0,
                        overallSentiment: 'unknown' as const,
                        fetchedAt: new Date().toISOString(),
                        cachedUntil: new Date().toISOString(),
                        error: 'Fetch failed',
                    };
                }
            })
        );

        return c.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Batch reputation fetch error:', error);
        return c.json({
            success: false,
            error: 'Failed to fetch brand reputations',
        }, 500);
    }
});

/**
 * POST /api/reputation/refresh/:brandSlug
 * Force refresh cached reputation data
 */
reputationRoutes.post('/refresh/:brandSlug', async (c) => {
    const brandSlug = c.req.param('brandSlug');

    if (!brandSlug) {
        return c.json({ error: 'Brand slug required' }, 400);
    }

    try {
        // Delete existing cache entries
        if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_KEY) {
            await fetch(
                `${c.env.SUPABASE_URL}/rest/v1/brand_reputation?brand_slug=eq.${brandSlug}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': c.env.SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
                    },
                }
            );
        }

        // Fetch fresh data
        const freshData = await fetchBrandReputation(brandSlug, c.env);

        // Store in cache
        if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_KEY) {
            for (const source of freshData.sources) {
                await fetch(`${c.env.SUPABASE_URL}/rest/v1/brand_reputation`, {
                    method: 'POST',
                    headers: {
                        'apikey': c.env.SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
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
        }

        return c.json({
            success: true,
            data: freshData,
            message: 'Reputation data refreshed',
        });
    } catch (error) {
        console.error('Reputation refresh error:', error);
        return c.json({
            success: false,
            error: 'Failed to refresh reputation',
        }, 500);
    }
});

export default reputationRoutes;
