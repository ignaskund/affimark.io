import { Hono } from 'hono';
import type { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/optimizer/analyze
 * Analyze a URL and suggest better commission programs
 */
app.post('/analyze', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Extract brand/merchant from URL
    const brandInfo = extractBrandFromURL(url);

    if (!brandInfo) {
      return c.json({
        success: true,
        current_link: { url, platform: 'unknown', commission_rate: null },
        alternatives: [],
        message: 'Could not identify brand from URL',
      });
    }

    // Detect current platform and rate
    const currentPlatform = detectPlatform(url);
    const currentRate = getKnownRate(currentPlatform.platform, brandInfo.brand);

    // Find alternative programs for this brand
    const { data: alternatives, error: altError } = await supabase
      .from('affiliate_programs')
      .select('*')
      .ilike('brand_name', `%${brandInfo.brand}%`)
      .order('commission_rate_high', { ascending: false })
      .limit(5);

    if (altError) {
      console.error('Error fetching alternatives:', altError);
    }

    // Calculate potential gain based on user's traffic
    const { data: userStats } = await supabase
      .from('affiliate_transactions')
      .select('clicks, commission_eur')
      .eq('user_id', user.id)
      .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const avgClicksPerMonth = userStats?.reduce((sum, tx) => sum + (tx.clicks || 0), 0) || 0;
    const avgCommissionPerClick = userStats && userStats.length > 0
      ? userStats.reduce((sum, tx) => sum + (tx.commission_eur || 0), 0) / userStats.reduce((sum, tx) => sum + (tx.clicks || 0), 1)
      : 0.5; // Default estimate

    // Enhance alternatives with potential gain
    const enhancedAlternatives = (alternatives || []).map((alt) => {
      const potentialGainLow = avgClicksPerMonth * avgCommissionPerClick * (alt.commission_rate_low / 100) * 0.8;
      const potentialGainHigh = avgClicksPerMonth * avgCommissionPerClick * (alt.commission_rate_high / 100) * 1.2;

      return {
        ...alt,
        potential_gain_low: parseFloat(potentialGainLow.toFixed(2)),
        potential_gain_high: parseFloat(potentialGainHigh.toFixed(2)),
      };
    });

    // Log this analysis for user's history
    await supabase.from('link_optimizations').insert({
      user_id: user.id,
      original_url: url,
      original_program: currentPlatform.platform,
      original_rate: currentRate,
      suggested_program_id: enhancedAlternatives[0]?.id || null,
      potential_gain_low: enhancedAlternatives[0]?.potential_gain_low || 0,
      potential_gain_high: enhancedAlternatives[0]?.potential_gain_high || 0,
      status: 'pending',
    });

    return c.json({
      success: true,
      brand: brandInfo,
      current_link: {
        url,
        platform: currentPlatform.platform,
        platform_name: currentPlatform.name,
        commission_rate: currentRate,
      },
      alternatives: enhancedAlternatives,
      user_stats: {
        avg_clicks_per_month: avgClicksPerMonth,
        avg_commission_per_click: parseFloat(avgCommissionPerClick.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('Error in /analyze:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/optimizer/suggestions
 * Get all optimization suggestions for user
 */
app.get('/suggestions', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: suggestions } = await supabase
      .from('link_optimizations')
      .select('*, affiliate_programs(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    return c.json({ suggestions: suggestions || [] });
  } catch (err) {
    console.error('Error in /suggestions:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/optimizer/apply/:id
 * Mark suggestion as applied
 */
app.post('/apply/:id', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .from('link_optimizations')
      .update({ status: 'applied' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return c.json({ error: 'Failed to update suggestion' }, 500);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('Error in /apply:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/optimizer/dismiss/:id
 * Dismiss a suggestion
 */
app.post('/dismiss/:id', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .from('link_optimizations')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return c.json({ error: 'Failed to dismiss suggestion' }, 500);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('Error in /dismiss:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ========================================
// Helper Functions
// ========================================

function extractBrandFromURL(url: string): { brand: string; product?: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Amazon
    if (hostname.includes('amazon')) {
      const match = url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/);
      return {
        brand: 'Amazon',
        product: match ? match[1] : undefined,
      };
    }

    // Extract brand from common patterns
    const brandPatterns = [
      { regex: /zara\.com/i, brand: 'Zara' },
      { regex: /hm\.com/i, brand: 'H&M' },
      { regex: /nike\.com/i, brand: 'Nike' },
      { regex: /adidas\.com/i, brand: 'Adidas' },
      { regex: /sephora\.com/i, brand: 'Sephora' },
      { regex: /mediamarkt\./i, brand: 'MediaMarkt' },
      { regex: /saturn\./i, brand: 'Saturn' },
      { regex: /otto\.de/i, brand: 'Otto' },
      { regex: /zalando\./i, brand: 'Zalando' },
      { regex: /asos\.com/i, brand: 'ASOS' },
    ];

    for (const pattern of brandPatterns) {
      if (pattern.regex.test(hostname)) {
        return { brand: pattern.brand };
      }
    }

    // Generic extraction from hostname
    const parts = hostname.replace('www.', '').split('.');
    if (parts.length > 0) {
      const brandName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      return { brand: brandName };
    }

    return null;
  } catch (err) {
    return null;
  }
}

function detectPlatform(url: string): { platform: string; name: string } {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('amazon')) {
    if (urlLower.includes('amazon.de')) return { platform: 'amazon_de', name: 'Amazon Germany' };
    if (urlLower.includes('amazon.co.uk')) return { platform: 'amazon_uk', name: 'Amazon UK' };
    if (urlLower.includes('amazon.com')) return { platform: 'amazon_us', name: 'Amazon US' };
    if (urlLower.includes('amazon.fr')) return { platform: 'amazon_fr', name: 'Amazon France' };
    return { platform: 'amazon', name: 'Amazon' };
  }

  if (urlLower.includes('awin')) return { platform: 'awin', name: 'Awin' };
  if (urlLower.includes('ltk.to') || urlLower.includes('liketoknow.it')) {
    return { platform: 'ltk', name: 'LTK' };
  }
  if (urlLower.includes('shopmy')) return { platform: 'shopmy', name: 'ShopMy' };
  if (urlLower.includes('tradedoubler')) return { platform: 'tradedoubler', name: 'Tradedoubler' };

  return { platform: 'direct', name: 'Direct Link' };
}

function getKnownRate(platform: string, brand: string): number | null {
  // Amazon rates by category (approximate)
  if (platform.startsWith('amazon')) {
    const amazonRates: Record<string, number> = {
      Electronics: 2.5,
      Fashion: 4.0,
      Beauty: 3.0,
      Home: 3.5,
      Default: 3.0,
    };
    return amazonRates.Default;
  }

  // Known brand rates
  const knownRates: Record<string, number> = {
    Zara: 4.0,
    'H&M': 5.0,
    Nike: 6.0,
    Adidas: 5.5,
    Sephora: 8.0,
    MediaMarkt: 3.0,
    Zalando: 5.0,
    ASOS: 7.0,
  };

  return knownRates[brand] || null;
}

export default app;
