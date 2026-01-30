import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// Platform detection patterns
const PLATFORM_PATTERNS: Record<string, { pattern: RegExp; name: string }> = {
  amazon_de: { pattern: /amazon\.de|amzn\.to/i, name: 'Amazon DE' },
  amazon_uk: { pattern: /amazon\.co\.uk/i, name: 'Amazon UK' },
  amazon_us: { pattern: /amazon\.com(?!\.)| amzn\.com/i, name: 'Amazon US' },
  amazon_fr: { pattern: /amazon\.fr/i, name: 'Amazon FR' },
  awin: { pattern: /awin1\.com|zenaps\.com/i, name: 'Awin' },
  shareasale: { pattern: /shareasale\.com/i, name: 'ShareASale' },
  impact: { pattern: /impact\.com|prf\.hn|sjv\.io/i, name: 'Impact' },
  ltk: { pattern: /liketoknow\.it|ltk\.to|shopltk/i, name: 'LTK' },
  rakuten: { pattern: /linksynergy\.com|rakuten/i, name: 'Rakuten' },
};

function detectPlatform(url: string): string | null {
  for (const [key, config] of Object.entries(PLATFORM_PATTERNS)) {
    if (config.pattern.test(url)) {
      return key;
    }
  }
  return null;
}

function extractAsin(url: string): string | null {
  const asinPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
  ];
  for (const pattern of asinPatterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractBrand(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const brandDomains = ['nike', 'adidas', 'sony', 'samsung', 'apple', 'zalando', 'asos', 'hm', 'sephora'];
    for (const brand of brandDomains) {
      if (hostname.includes(brand)) return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

// GET: Fetch user's products with their latest analysis
// Returns two categories:
// 1. storefrontProducts - from real storefronts (Amazon, LTK, etc.)
// 2. addedProducts - manually added via optimizer
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all products with their storefront info
    const { data: allProducts } = await supabaseServer
      .from('user_storefront_products')
      .select(`
        id,
        title,
        brand,
        product_url,
        platform,
        image_url,
        current_price,
        currency,
        created_at,
        user_storefronts!inner (
          id,
          platform,
          display_name
        )
      `)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Get analysis data for products
    const { data: analyzedLinks } = await supabaseServer
      .from('link_analyses')
      .select('original_url, detected_commission_rate, alternatives_found, potential_gain_high, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    const storefrontProducts: any[] = [];
    const addedProducts: any[] = [];

    if (allProducts) {
      for (const p of allProducts) {
        const storefrontPlatform = (p.user_storefronts as any)?.platform;
        const storefrontName = (p.user_storefronts as any)?.display_name;

        // Skip generic affiliate links from onboarding
        // - 'mixed' = created by frontend fallback when no real storefronts exist
        // - 'affiliate' = created by backend scraper for unrecognized affiliate links
        if (storefrontPlatform === 'mixed' || storefrontPlatform === 'affiliate') {
          continue;
        }

        const analysis = analyzedLinks?.find(a => a.original_url === p.product_url);
        const productData = {
          id: p.id,
          title: p.title,
          brand: p.brand,
          product_url: p.product_url,
          platform: p.platform,
          image_url: p.image_url,
          current_price: p.current_price,
          currency: p.currency || 'EUR',
          storefront_name: storefrontName,
          last_analysis: analysis ? {
            detected_commission_rate: analysis.detected_commission_rate,
            alternatives_found: analysis.alternatives_found,
            potential_gain_high: analysis.potential_gain_high,
            created_at: analysis.created_at,
          } : null,
        };

        // Separate products added via optimizer from storefront products
        if (storefrontPlatform === 'optimizer') {
          addedProducts.push(productData);
        } else {
          storefrontProducts.push(productData);
        }
      }
    }

    return NextResponse.json({
      storefrontProducts,
      addedProducts,
      // Also return combined for backwards compatibility
      products: [...storefrontProducts, ...addedProducts],
    });
  } catch (error) {
    console.error('[Optimizer Products] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST: Add a new product link
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, name } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Detect platform and extract info
    const platform = detectPlatform(url);
    const asin = extractAsin(url);
    const brand = extractBrand(url);

    // Get or create a default storefront for the user's optimizer products
    // Use a unique storefront_url to avoid conflicts with other storefronts
    const optimizerStorefrontUrl = `optimizer://${session.user.id}`;

    let { data: storefront } = await supabaseServer
      .from('user_storefronts')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('platform', 'optimizer')
      .single();

    if (!storefront) {
      const { data: newStorefront, error: createError } = await supabaseServer
        .from('user_storefronts')
        .upsert({
          user_id: session.user.id,
          platform: 'optimizer',
          display_name: 'My Products',
          storefront_url: optimizerStorefrontUrl,
        }, {
          onConflict: 'user_id,storefront_url',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[Optimizer] Failed to create storefront:', createError);
        return NextResponse.json({ error: 'Failed to create product storage' }, { status: 500 });
      }
      storefront = newStorefront;
    }

    // Check if product already exists
    const { data: existing } = await supabaseServer
      .from('user_storefront_products')
      .select('id')
      .eq('storefront_id', storefront.id)
      .eq('product_url', url)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This link has already been added' }, { status: 400 });
    }

    // Insert the product
    const { data: product, error: insertError } = await supabaseServer
      .from('user_storefront_products')
      .insert({
        user_id: session.user.id,
        storefront_id: storefront.id,
        product_url: url,
        title: name || null,
        brand: brand,
        platform: platform,
        external_id: asin,
        enrichment_status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[Optimizer] Failed to insert product:', insertError);
      return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
    }

    return NextResponse.json({
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        product_url: product.product_url,
        platform: product.platform,
        image_url: product.image_url,
        current_price: product.current_price,
        currency: product.currency || 'EUR',
        last_analysis: null,
      },
    });
  } catch (error) {
    console.error('[Optimizer Products] Error:', error);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}
