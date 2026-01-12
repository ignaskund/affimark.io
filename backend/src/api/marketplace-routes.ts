/**
 * Marketplace API Routes
 * Public discovery of creator shops
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// GET /api/marketplace - List public shops with filters
app.get('/', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Parse query parameters
    const niche = c.req.query('niche'); // Tech, gaming, lifestyle, etc.
    const category = c.req.query('category'); // Cameras, keyboards, software, etc.
    const hasDiscounts = c.req.query('has_discounts') === 'true';
    const region = c.req.query('region'); // US, UK, EU, etc.
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('shops')
      .select(`
        id,
        user_id,
        shop_name,
        shop_tagline,
        shop_description,
        banner_image_url,
        theme_color,
        handle,
        created_at,
        profile:user_id (
          full_name,
          handle,
          avatar_url,
          content_categories,
          tech_domains
        ),
        shop_items (
          id,
          inventory_item:inventory_item_id (
            id,
            custom_title,
            product:product_id (
              product_name,
              image_url,
              category,
              merchant:merchant_id (merchant_name)
            ),
            affiliate_link:affiliate_link_id (
              discount_code
            )
          )
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (niche) {
      // Filter by creator niche (content_categories in profile)
      // Note: This is a simplification - in production, use full-text search
      query = query.contains('profile.content_categories', [niche]);
    }

    // Execute query
    const { data: shops, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[Marketplace] Query error:', error);
      throw new Error('Failed to fetch shops');
    }

    // Post-process: Filter by category and discounts
    let filteredShops = shops || [];

    if (category) {
      filteredShops = filteredShops.filter((shop) =>
        shop.shop_items?.some(
          (item: any) =>
            item.inventory_item?.product?.category?.toLowerCase().includes(category.toLowerCase())
        )
      );
    }

    if (hasDiscounts) {
      filteredShops = filteredShops.filter((shop) =>
        shop.shop_items?.some((item: any) => item.inventory_item?.affiliate_link?.discount_code)
      );
    }

    // Transform to marketplace format
    const marketplaceShops = filteredShops.map((shop) => {
      const productCount = shop.shop_items?.length || 0;
      const hasDiscountCodes = shop.shop_items?.some(
        (item: any) => item.inventory_item?.affiliate_link?.discount_code
      );
      const featuredProducts = (shop.shop_items || [])
        .slice(0, 3)
        .map((item: any) => ({
          name: item.inventory_item?.custom_title || item.inventory_item?.product?.product_name,
          image_url: item.inventory_item?.product?.image_url,
        }));

      return {
        id: shop.id,
        shop_name: shop.shop_name,
        shop_tagline: shop.shop_tagline,
        shop_url: `/shop/${shop.handle || shop.profile?.handle}`,
        banner_image_url: shop.banner_image_url,
        theme_color: shop.theme_color,
        creator: {
          name: shop.profile?.full_name,
          handle: shop.profile?.handle,
          avatar_url: shop.profile?.avatar_url,
          niche: shop.profile?.content_categories || [],
          tech_domains: shop.profile?.tech_domains || [],
        },
        stats: {
          product_count: productCount,
          has_discount_codes: hasDiscountCodes,
        },
        featured_products: featuredProducts,
      };
    });

    // Get total count for pagination
    const { count } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true);

    return c.json({
      success: true,
      shops: marketplaceShops,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('[Marketplace] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch marketplace' }, 500);
  }
});

// GET /api/marketplace/search - Search creators and products
app.get('/search', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const query = c.req.query('q');
    const type = c.req.query('type') || 'all'; // 'creators', 'products', 'all'
    const limit = parseInt(c.req.query('limit') || '20');

    if (!query) {
      return c.json({ error: 'Search query is required' }, 400);
    }

    const results: any = {
      creators: [],
      products: [],
    };

    // Search creators by name or handle
    if (type === 'creators' || type === 'all') {
      const { data: creatorShops } = await supabase
        .from('shops')
        .select(`
          id,
          shop_name,
          handle,
          profile:user_id (
            full_name,
            handle,
            avatar_url,
            content_categories
          )
        `)
        .eq('is_public', true)
        .or(`shop_name.ilike.%${query}%,profile.full_name.ilike.%${query}%,profile.handle.ilike.%${query}%`)
        .limit(limit);

      results.creators = (creatorShops || []).map((shop) => ({
        id: shop.id,
        shop_name: shop.shop_name,
        shop_url: `/shop/${shop.handle || shop.profile?.handle}`,
        creator_name: shop.profile?.full_name,
        creator_handle: shop.profile?.handle,
        avatar_url: shop.profile?.avatar_url,
        niche: shop.profile?.content_categories || [],
      }));
    }

    // Search products across all public shops
    if (type === 'products' || type === 'all') {
      const { data: shopItems } = await supabase
        .from('shop_items')
        .select(`
          id,
          shop:shop_id (
            id,
            shop_name,
            handle,
            is_public,
            profile:user_id (
              full_name,
              handle,
              avatar_url
            )
          ),
          inventory_item:inventory_item_id (
            custom_title,
            product:product_id (
              product_name,
              image_url,
              price,
              currency,
              category
            )
          )
        `)
        .eq('shop.is_public', true)
        .or(`inventory_item.custom_title.ilike.%${query}%,inventory_item.product.product_name.ilike.%${query}%`)
        .limit(limit);

      results.products = (shopItems || [])
        .filter((item) => item.shop?.is_public)
        .map((item: any) => ({
          id: item.id,
          product_name:
            item.inventory_item?.custom_title || item.inventory_item?.product?.product_name,
          image_url: item.inventory_item?.product?.image_url,
          price: item.inventory_item?.product?.price,
          currency: item.inventory_item?.product?.currency,
          category: item.inventory_item?.product?.category,
          shop: {
            id: item.shop?.id,
            shop_name: item.shop?.shop_name,
            shop_url: `/shop/${item.shop?.handle || item.shop?.profile?.handle}`,
            creator_name: item.shop?.profile?.full_name,
            creator_handle: item.shop?.profile?.handle,
          },
        }));
    }

    return c.json({
      success: true,
      query,
      results,
    });
  } catch (error: any) {
    console.error('[Marketplace Search] Error:', error);
    return c.json({ error: error.message || 'Search failed' }, 500);
  }
});

// GET /api/marketplace/featured - Curated featured shops
app.get('/featured', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const limit = parseInt(c.req.query('limit') || '6');

    // Get shops with most products (popularity proxy)
    const { data: shops } = await supabase
      .from('shops')
      .select(`
        id,
        shop_name,
        shop_tagline,
        banner_image_url,
        theme_color,
        handle,
        profile:user_id (
          full_name,
          handle,
          avatar_url,
          content_categories
        ),
        shop_items (id)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50); // Get 50 to filter and sort

    if (!shops) {
      return c.json({ success: true, shops: [] });
    }

    // Sort by product count and take top N
    const sortedShops = shops
      .map((shop) => ({
        ...shop,
        product_count: shop.shop_items?.length || 0,
      }))
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, limit);

    const featuredShops = sortedShops.map((shop) => ({
      id: shop.id,
      shop_name: shop.shop_name,
      shop_tagline: shop.shop_tagline,
      shop_url: `/shop/${shop.handle || shop.profile?.handle}`,
      banner_image_url: shop.banner_image_url,
      theme_color: shop.theme_color,
      creator: {
        name: shop.profile?.full_name,
        handle: shop.profile?.handle,
        avatar_url: shop.profile?.avatar_url,
        niche: shop.profile?.content_categories || [],
      },
      product_count: shop.product_count,
    }));

    return c.json({
      success: true,
      shops: featuredShops,
    });
  } catch (error: any) {
    console.error('[Featured Shops] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch featured shops' }, 500);
  }
});

export default app;
