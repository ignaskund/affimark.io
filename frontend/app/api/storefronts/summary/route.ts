import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

// Platform display configuration
const platformConfig: Record<string, { displayName: string; icon: string }> = {
    amazon: { displayName: 'Amazon Storefront', icon: '🛍️' },
    ltk: { displayName: 'LTK', icon: '💄' },
    shopmy: { displayName: 'ShopMy', icon: '🛒' },
    awin: { displayName: 'Awin', icon: '🔗' },
    instagram: { displayName: 'Instagram', icon: '📸' },
    tiktok: { displayName: 'TikTok', icon: '🎵' },
    youtube: { displayName: 'YouTube', icon: '▶️' },
};

// GET /api/storefronts/summary - Lightweight dashboard overview
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID not found' },
                { status: 400 }
            );
        }

        // Fetch all storefronts for this user
        const { data: storefronts, error: storefrontsError } = await supabaseServer
            .from('user_storefronts')
            .select('id, platform, display_name, icon, storefront_url, sync_status, last_synced_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (storefrontsError) {
            console.error('[Storefronts Summary] Error:', storefrontsError);
            return NextResponse.json(
                { error: 'Failed to fetch storefronts' },
                { status: 500 }
            );
        }

        // Get product counts for all storefronts in one query
        const storefrontIds = (storefronts || []).map(s => s.id);

        let productCounts: Record<string, number> = {};

        if (storefrontIds.length > 0) {
            const { data: productData } = await supabaseServer
                .from('user_storefront_products')
                .select('storefront_id')
                .in('storefront_id', storefrontIds);

            // Count products per storefront
            productCounts = (productData || []).reduce((acc, p) => {
                acc[p.storefront_id] = (acc[p.storefront_id] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
        }

        // Get top 3 products per storefront for preview
        const storefrontsWithProducts = await Promise.all(
            (storefronts || []).map(async (storefront) => {
                const { data: topProducts } = await supabaseServer
                    .from('user_storefront_products')
                    .select('title, image_url, current_price')
                    .eq('storefront_id', storefront.id)
                    .limit(3);

                const config = platformConfig[storefront.platform] || {
                    displayName: storefront.display_name || storefront.platform,
                    icon: storefront.icon || '🔗'
                };

                return {
                    id: storefront.id,
                    platform: storefront.platform,
                    displayName: storefront.display_name || config.displayName,
                    icon: storefront.icon || config.icon,
                    storefrontUrl: storefront.storefront_url,
                    productCount: productCounts[storefront.id] || 0,
                    lastSynced: storefront.last_synced_at,
                    syncStatus: storefront.sync_status,
                    topProducts: (topProducts || []).map(p => ({
                        title: p.title,
                        imageUrl: p.image_url,
                        price: p.current_price ? `€${p.current_price.toFixed(2)}` : null,
                    })),
                };
            })
        );

        const totalProducts = Object.values(productCounts).reduce((sum, count) => sum + count, 0);

        return NextResponse.json({
            storefronts: storefrontsWithProducts,
            totalStorefronts: storefrontsWithProducts.length,
            totalProducts,
        });

    } catch (error: any) {
        console.error('[Storefronts Summary] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch summary' },
            { status: 500 }
        );
    }
}
