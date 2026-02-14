import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

// ============================================
// RAINFOREST API CONFIGURATION
// ============================================

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY;
const RAINFOREST_BASE_URL = 'https://api.rainforestapi.com/request';

interface RainforestProductResponse {
    request_info: { success: boolean };
    product?: {
        asin: string;
        title: string;
        link: string;
        main_image?: { link: string };
        brand?: string;
        categories?: Array<{ name: string }>;
        buybox_winner?: {
            price?: { value: number; currency: string };
        };
    };
}

// ============================================
// ENRICHMENT FUNCTION
// ============================================

async function enrichProductByASIN(asin: string): Promise<{
    title?: string;
    brand?: string;
    category?: string;
    image_url?: string;
    price?: number;
    currency?: string;
} | null> {
    if (!RAINFOREST_API_KEY) {
        console.error('[Enrichment] RAINFOREST_API_KEY not configured');
        return null;
    }

    try {
        const params = new URLSearchParams({
            api_key: RAINFOREST_API_KEY,
            type: 'product',
            amazon_domain: 'amazon.com',
            asin: asin,
        });

        const response = await fetch(`${RAINFOREST_BASE_URL}?${params.toString()}`);

        if (!response.ok) {
            console.error(`[Enrichment] Rainforest API error: ${response.status}`);
            return null;
        }

        const data: RainforestProductResponse = await response.json();

        if (!data.request_info.success || !data.product) {
            console.log(`[Enrichment] Product not found for ASIN: ${asin}`);
            return null;
        }

        const product = data.product;

        return {
            title: product.title,
            brand: product.brand,
            category: product.categories?.[0]?.name,
            image_url: product.main_image?.link,
            price: product.buybox_winner?.price?.value,
            currency: product.buybox_winner?.price?.currency || 'USD',
        };

    } catch (error: any) {
        console.error(`[Enrichment] Error enriching ASIN ${asin}:`, error.message);
        return null;
    }
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await request.json();
        const { limit = 10 } = body;

        console.log(`[Enrichment] Starting enrichment for user ${userId}, limit: ${limit}`);

        // Get pending products for this user that have an external_id (ASIN)
        const { data: products, error: fetchError } = await supabaseServer
            .from('user_storefront_products')
            .select('id, external_id, title, platform')
            .eq('user_id', userId)
            .eq('enrichment_status', 'pending')
            .not('external_id', 'is', null)
            .limit(limit);

        if (fetchError) {
            console.error('[Enrichment] Error fetching products:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        if (!products || products.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No products to enrich',
                enriched: 0,
            });
        }

        console.log(`[Enrichment] Found ${products.length} products to enrich`);

        let enrichedCount = 0;
        let failedCount = 0;

        // Process products sequentially to avoid rate limiting
        for (const product of products) {
            // Only enrich Amazon products for now
            if (product.platform !== 'amazon' || !product.external_id) {
                await supabaseServer
                    .from('user_storefront_products')
                    .update({
                        enrichment_status: 'skipped',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', product.id);
                continue;
            }

            const enrichedData = await enrichProductByASIN(product.external_id);

            if (enrichedData) {
                const { error: updateError } = await supabaseServer
                    .from('user_storefront_products')
                    .update({
                        title: enrichedData.title || product.title,
                        brand: enrichedData.brand,
                        category: enrichedData.category,
                        image_url: enrichedData.image_url,
                        current_price: enrichedData.price,
                        currency: enrichedData.currency,
                        enrichment_status: 'enriched',
                        last_enriched_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', product.id);

                if (updateError) {
                    console.error(`[Enrichment] Error updating product ${product.id}:`, updateError);
                    failedCount++;
                } else {
                    enrichedCount++;
                    console.log(`[Enrichment] Enriched: ${enrichedData.title?.slice(0, 50)}...`);
                }
            } else {
                await supabaseServer
                    .from('user_storefront_products')
                    .update({
                        enrichment_status: 'failed',
                        enrichment_error: 'Product not found or API error',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', product.id);
                failedCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`[Enrichment] Complete: ${enrichedCount} enriched, ${failedCount} failed`);

        return NextResponse.json({
            success: true,
            enriched: enrichedCount,
            failed: failedCount,
            total: products.length,
        });

    } catch (error: any) {
        console.error('[Enrichment] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Enrichment failed' },
            { status: 500 }
        );
    }
}
