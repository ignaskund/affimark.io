import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/products - Fetch all user's products with filtering and pagination
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

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const platform = searchParams.get('platform');
        const storefrontId = searchParams.get('storefront_id');
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sort_by') || 'created_at';
        const sortOrder = searchParams.get('sort_order') === 'asc' ? true : false;

        const offset = (page - 1) * limit;

        // Build query
        let query = supabaseServer
            .from('user_storefront_products')
            .select(`
                id,
                storefront_id,
                external_id,
                product_url,
                title,
                brand,
                image_url,
                current_price,
                platform,
                enrichment_status,
                created_at,
                updated_at,
                user_storefronts!inner (
                    id,
                    display_name,
                    platform,
                    icon
                )
            `, { count: 'exact' })
            .eq('user_id', userId);

        // Apply filters
        if (platform) {
            query = query.eq('platform', platform);
        }

        if (storefrontId) {
            query = query.eq('storefront_id', storefrontId);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%`);
        }

        // Apply sorting
        const validSortFields = ['created_at', 'title', 'current_price', 'platform'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        query = query.order(sortField, { ascending: sortOrder });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: products, count, error } = await query;

        if (error) {
            console.error('[Products API] Error fetching products:', error);
            return NextResponse.json(
                { error: 'Failed to fetch products' },
                { status: 500 }
            );
        }

        // Get unique platforms for filter options
        const { data: platformsData } = await supabaseServer
            .from('user_storefront_products')
            .select('platform')
            .eq('user_id', userId);

        const platforms = [...new Set((platformsData || []).map(p => p.platform))];

        // Get storefronts for filter options
        const { data: storefronts } = await supabaseServer
            .from('user_storefronts')
            .select('id, display_name, platform, icon')
            .eq('user_id', userId);

        return NextResponse.json({
            products: products || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
            filters: {
                platforms,
                storefronts: storefronts || [],
            },
        });

    } catch (error: any) {
        console.error('[Products API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
