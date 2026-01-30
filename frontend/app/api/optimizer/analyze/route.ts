import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// Platform detection patterns
const PLATFORM_PATTERNS: Record<string, { pattern: RegExp; name: string; defaultRate: number }> = {
  amazon_de: { pattern: /amazon\.de|amzn\.to/i, name: 'Amazon DE', defaultRate: 3 },
  amazon_uk: { pattern: /amazon\.co\.uk/i, name: 'Amazon UK', defaultRate: 3 },
  amazon_us: { pattern: /amazon\.com(?!\.)|amzn\.com/i, name: 'Amazon US', defaultRate: 3 },
  amazon_fr: { pattern: /amazon\.fr/i, name: 'Amazon FR', defaultRate: 3 },
  amazon_it: { pattern: /amazon\.it/i, name: 'Amazon IT', defaultRate: 3 },
  amazon_es: { pattern: /amazon\.es/i, name: 'Amazon ES', defaultRate: 3 },
  awin: { pattern: /awin1\.com|zenaps\.com/i, name: 'Awin', defaultRate: 8 },
  shareasale: { pattern: /shareasale\.com/i, name: 'ShareASale', defaultRate: 8 },
  impact: { pattern: /impact\.com|prf\.hn|sjv\.io/i, name: 'Impact', defaultRate: 10 },
  ltk: { pattern: /liketoknow\.it|ltk\.to|shopltk/i, name: 'LTK', defaultRate: 10 },
  rakuten: { pattern: /linksynergy\.com|rakuten/i, name: 'Rakuten', defaultRate: 5 },
};

// Extract ASIN from Amazon URLs
function extractAsin(url: string): string | null {
  // Pattern: /dp/ASIN, /gp/product/ASIN, /product/ASIN
  const asinPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\?.*asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of asinPatterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract brand from URL or page title
function extractBrandFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    // Check if it's a brand direct site (e.g., nike.com)
    const brandDomains = ['nike', 'adidas', 'sony', 'samsung', 'apple', 'zalando', 'asos', 'hm'];
    for (const brand of brandDomains) {
      if (hostname.includes(brand)) return brand;
    }

    // Extract from path for marketplace URLs
    const pathParts = urlObj.pathname.toLowerCase().split('/').filter(Boolean);
    for (const part of pathParts) {
      // Skip common path segments
      if (['dp', 'gp', 'product', 'ref', 'store', 'shop'].includes(part)) continue;
      if (part.length > 3 && part.length < 30 && /^[a-z-]+$/.test(part)) {
        return part;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Detect platform from URL
function detectPlatform(url: string): { platform: string; name: string; defaultRate: number } | null {
  for (const [key, config] of Object.entries(PLATFORM_PATTERNS)) {
    if (config.pattern.test(url)) {
      return { platform: key, name: config.name, defaultRate: config.defaultRate };
    }
  }
  return null;
}

// Calculate potential earnings
function calculatePotentialGain(
  currentRate: number,
  newRateLow: number,
  newRateHigh: number,
  avgClicksPerMonth: number,
  avgCommissionPerClick: number
): { low: number; high: number } {
  // If no traffic data, use defaults
  const clicks = avgClicksPerMonth || 500;
  const conversionRate = 0.02; // 2% average conversion
  const avgOrderValue = 50; // €50 average order

  const currentEarnings = clicks * conversionRate * avgOrderValue * (currentRate / 100);
  const newEarningsLow = clicks * conversionRate * avgOrderValue * (newRateLow / 100);
  const newEarningsHigh = clicks * conversionRate * avgOrderValue * (newRateHigh / 100);

  return {
    low: Math.max(0, newEarningsLow - currentEarnings),
    high: Math.max(0, newEarningsHigh - currentEarnings),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // 1. Detect platform
    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json(
        { error: 'Could not identify the affiliate platform. Try an Amazon, Awin, or LTK link.' },
        { status: 400 }
      );
    }

    // 2. Extract product info
    const asin = extractAsin(url);
    const detectedBrand = extractBrandFromUrl(url);

    // 3. Get current commission rate (for Amazon, look up category rate)
    let currentCommissionRate = platform.defaultRate;
    if (platform.platform.startsWith('amazon_')) {
      const { data: categoryRate } = await supabaseServer
        .from('platform_commission_rates')
        .select('commission_rate')
        .eq('platform', platform.platform)
        .eq('category', 'default')
        .single();

      if (categoryRate) {
        currentCommissionRate = categoryRate.commission_rate;
      }
    }

    // 4. Find better alternatives
    let alternatives: any[] = [];

    if (detectedBrand) {
      // First try exact brand match
      const { data: brandPrograms } = await supabaseServer
        .from('affiliate_programs')
        .select('*')
        .ilike('brand_slug', `%${detectedBrand}%`)
        .eq('is_active', true)
        .order('commission_rate_high', { ascending: false })
        .limit(5);

      if (brandPrograms && brandPrograms.length > 0) {
        alternatives = brandPrograms;
      }
    }

    // If no brand match, find category alternatives
    if (alternatives.length === 0) {
      // Try to infer category from URL keywords
      const urlLower = url.toLowerCase();
      let category = 'default';

      if (urlLower.includes('fashion') || urlLower.includes('clothing') || urlLower.includes('dress')) {
        category = 'fashion';
      } else if (urlLower.includes('beauty') || urlLower.includes('makeup') || urlLower.includes('skincare')) {
        category = 'beauty';
      } else if (urlLower.includes('electronic') || urlLower.includes('tech') || urlLower.includes('computer')) {
        category = 'electronics';
      } else if (urlLower.includes('home') || urlLower.includes('furniture') || urlLower.includes('kitchen')) {
        category = 'home';
      } else if (urlLower.includes('sport') || urlLower.includes('fitness') || urlLower.includes('outdoor')) {
        category = 'sports';
      }

      if (category !== 'default') {
        const { data: categoryPrograms } = await supabaseServer
          .from('affiliate_programs')
          .select('*')
          .eq('category', category)
          .eq('is_active', true)
          .gt('commission_rate_high', currentCommissionRate)
          .order('commission_rate_high', { ascending: false })
          .limit(5);

        if (categoryPrograms) {
          alternatives = categoryPrograms;
        }
      }
    }

    // 5. Get user's traffic stats for earnings calculation
    const { data: trafficStats } = await supabaseServer
      .from('affiliate_transactions')
      .select('clicks, commission_eur')
      .eq('user_id', session.user.id)
      .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const avgClicksPerMonth = trafficStats?.reduce((sum, tx) => sum + (tx.clicks || 0), 0) || 500;
    const totalCommission = trafficStats?.reduce((sum, tx) => sum + (tx.commission_eur || 0), 0) || 0;
    const avgCommissionPerClick = avgClicksPerMonth > 0 ? totalCommission / avgClicksPerMonth : 0.5;

    // 6. Calculate potential gains for each alternative
    const alternativesWithGains = alternatives
      .filter(alt => alt.commission_rate_high > currentCommissionRate)
      .map(alt => {
        const gains = calculatePotentialGain(
          currentCommissionRate,
          alt.commission_rate_low,
          alt.commission_rate_high,
          avgClicksPerMonth,
          avgCommissionPerClick
        );

        return {
          id: alt.id,
          network: alt.network,
          brand_name: alt.brand_name,
          commission_rate_low: alt.commission_rate_low,
          commission_rate_high: alt.commission_rate_high,
          cookie_duration: alt.cookie_duration || 30,
          requires_application: alt.requires_application,
          confidence_score: alt.confidence_score || 3,
          last_verified: alt.last_verified_at || alt.updated_at,
          potential_gain_low: gains.low,
          potential_gain_high: gains.high,
          signup_url: alt.signup_url,
        };
      })
      .sort((a, b) => b.potential_gain_high - a.potential_gain_high);

    // 7. Save analysis to database
    const bestAlternative = alternativesWithGains[0];
    await supabaseServer.from('link_analyses').insert({
      user_id: session.user.id,
      original_url: url,
      original_platform: platform.platform,
      detected_brand: detectedBrand,
      detected_asin: asin,
      detected_commission_rate: currentCommissionRate,
      alternatives_found: alternativesWithGains.length,
      best_alternative_id: bestAlternative?.id || null,
      potential_gain_low: bestAlternative?.potential_gain_low || 0,
      potential_gain_high: bestAlternative?.potential_gain_high || 0,
      analysis_metadata: {
        platform,
        alternatives: alternativesWithGains,
        user_stats: { avgClicksPerMonth, avgCommissionPerClick },
      },
    });

    // 8. Return results
    return NextResponse.json({
      brand: {
        brand: detectedBrand || 'Unknown Brand',
        product: asin ? `ASIN: ${asin}` : null,
      },
      current_link: {
        url,
        platform: platform.platform,
        platform_name: platform.name,
        commission_rate: currentCommissionRate,
      },
      alternatives: alternativesWithGains,
      user_stats: {
        avg_clicks_per_month: avgClicksPerMonth,
        avg_commission_per_click: avgCommissionPerClick,
      },
    });
  } catch (error) {
    console.error('[Optimizer] Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze link. Please try again.' },
      { status: 500 }
    );
  }
}
