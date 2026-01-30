import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/storefronts - Fetch all user's imported storefronts with product counts
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

        // Fetch storefronts with product count
        const { data: storefronts, error: storefrontsError } = await supabaseServer
            .from('user_storefronts')
            .select(`
                id,
                platform,
                storefront_url,
                display_name,
                icon,
                sync_status,
                last_synced_at,
                created_at
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (storefrontsError) {
            console.error('[Storefronts API] Error fetching storefronts:', storefrontsError);
            return NextResponse.json(
                { error: 'Failed to fetch storefronts' },
                { status: 500 }
            );
        }

        // For each storefront, get product count and top products
        const storefrontsWithProducts = await Promise.all(
            (storefronts || []).map(async (storefront) => {
                // Get product count
                const { count } = await supabaseServer
                    .from('user_storefront_products')
                    .select('*', { count: 'exact', head: true })
                    .eq('storefront_id', storefront.id);

                // Get top 5 products for preview
                const { data: topProducts } = await supabaseServer
                    .from('user_storefront_products')
                    .select('id, title, product_url, image_url, current_price, brand')
                    .eq('storefront_id', storefront.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                return {
                    ...storefront,
                    productCount: count || 0,
                    topProducts: topProducts || [],
                };
            })
        );

        // Calculate totals
        const totalProducts = storefrontsWithProducts.reduce(
            (sum, s) => sum + s.productCount,
            0
        );

        return NextResponse.json({
            storefronts: storefrontsWithProducts,
            totalStorefronts: storefrontsWithProducts.length,
            totalProducts,
        });

    } catch (error: any) {
        console.error('[Storefronts API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch storefronts' },
            { status: 500 }
        );
    }
}
