/**
 * Migration API Routes
 *
 * Endpoints for importing links from Linktree, Beacons, Stan, etc.
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { MigrationScraper } from '../services/migration-scraper';
import type { Env } from '../index';

type Bindings = Env;

const migrationRoutes = new Hono<{ Bindings: Bindings }>();

// Helper to get Supabase client
function getSupabase(c: any) {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );
}

// Helper to get user ID from auth header
async function getUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase(c);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

/**
 * POST /api/migration/scrape
 * Scrape a link-in-bio page and extract links
 */
migrationRoutes.post('/scrape', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Validate URL format
    let pageUrl: URL;
    try {
      pageUrl = new URL(url);
    } catch (e) {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    // Initialize scraper
    const scraper = new MigrationScraper();

    // Scrape the page
    const result = await scraper.scrapePage(pageUrl.toString());

    // Detect platform
    const platform = detectPlatform(pageUrl);

    // Generate suggestions based on platform
    const suggestions = generateSuggestions(result, platform);

    return c.json({
      platform,
      totalLinks: result.links.length,
      affiliateLinks: result.links.filter((l) => l.isAffiliate).length,
      links: result.links,
      suggestions,
    });
  } catch (error: any) {
    console.error('Migration scrape error:', error);

    // Provide helpful error messages
    if (error.message?.includes('fetch')) {
      return c.json({
        error: 'Failed to fetch the page. Please check the URL and try again.'
      }, 500);
    }

    if (error.message?.includes('timeout')) {
      return c.json({
        error: 'Page took too long to load. Please try again.'
      }, 500);
    }

    return c.json({
      error: error.message || 'Failed to scrape page'
    }, 500);
  }
});

/**
 * Detect platform from URL
 */
function detectPlatform(url: URL): string {
  const hostname = url.hostname.toLowerCase();

  if (hostname.includes('linktr.ee')) {
    return 'linktree';
  }

  if (hostname.includes('beacons.ai')) {
    return 'beacons';
  }

  if (hostname.includes('stan.store')) {
    return 'stan';
  }

  if (hostname.includes('carrd.co')) {
    return 'carrd';
  }

  if (hostname.includes('bio.link')) {
    return 'biolink';
  }

  if (hostname.includes('tap.bio')) {
    return 'tapbio';
  }

  return 'custom';
}

/**
 * Generate helpful suggestions based on scrape results
 */
function generateSuggestions(
  result: { links: any[]; metadata?: any },
  platform: string
): string[] {
  const suggestions: string[] = [];

  const affiliateCount = result.links.filter((l) => l.isAffiliate).length;
  const totalCount = result.links.length;

  // Platform-specific suggestions
  if (platform === 'linktree') {
    suggestions.push('Import these links and replace them in Linktree with your new SmartWrapper URLs');
  } else if (platform === 'beacons') {
    suggestions.push('Import and swap your Beacons links with SmartWrapper URLs for better control');
  } else if (platform === 'stan') {
    suggestions.push('Migrate to SmartWrappers for advanced link management and analytics');
  } else {
    suggestions.push('Import your links to gain automated health monitoring and failover');
  }

  // Affiliate link suggestions
  if (affiliateCount > 0) {
    suggestions.push(`Found ${affiliateCount} affiliate links - these are auto-selected for import`);
  }

  if (affiliateCount === 0 && totalCount > 0) {
    suggestions.push('No affiliate links detected - you can still import for link management and analytics');
  }

  // Health monitoring suggestion
  if (affiliateCount > 5) {
    suggestions.push('Enable autopilot on imported links for automatic stock-out detection');
  }

  // Priority chain suggestion
  if (affiliateCount > 3) {
    suggestions.push('Add backup destinations to your priority chains for maximum uptime');
  }

  return suggestions;
}

/**
 * GET /api/migration/history
 * Get migration history for user
 */
migrationRoutes.get('/history', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);

    // Get recent SmartWrappers created via migration
    // Note: We'd need a 'source' or 'imported_from' field to track this properly
    // For now, just return recent SmartWrappers
    const { data: imports, error } = await supabase
      .from('redirect_links')
      .select(`
        id,
        short_code,
        link_label,
        product_name,
        created_at,
        destinations:redirect_destinations(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return c.json({
      imports: imports || []
    });
  } catch (error: any) {
    console.error('Get migration history error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/migration/apply
 * Apply migration results (save to DB)
 */
migrationRoutes.post('/apply', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { links, platform } = body;

    if (!links || !Array.isArray(links)) {
      return c.json({ error: 'Links array is required' }, 400);
    }

    const supabase = getSupabase(c);
    const results = [];

    // Filter for valid links to import
    // We import affiliate links AND custom platform links (if user wants complete migration)
    // For now, let's import everything but mark affiliate ones specially if needed

    for (const link of links) {
      // Create a SmartWrapper (redirect_link)
      const { data: linkData, error: linkError } = await supabase
        .from('redirect_links')
        .insert({
          user_id: userId,
          original_url: link.url,
          link_label: link.title || 'Imported Link',
          product_name: link.detectedNetwork || link.title || 'Imported Product',
          short_code: Math.random().toString(36).substring(2, 8), // Simple random code for now
          is_active: true,
          // If we had an 'imported_from' column, we'd set it to platform
        })
        .select()
        .single();

      if (!linkError && linkData) {
        results.push(linkData);
      }
    }

    return c.json({
      success: true,
      imported: results.length,
      links: results
    });

  } catch (error: any) {
    console.error('Migration apply error:', error);
    return c.json({ error: error.message || 'Failed to apply migration' }, 500);
  }
});

export default migrationRoutes;
