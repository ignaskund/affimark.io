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
  // Note: Auth is optional for scrape - allows onboarding flow
  // The scrape just reads public pages, no user data involved

  try {
    const body = await c.req.json();
    const { url, deepScrape = true } = body; // Enable deep scraping by default

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

    // Detect platform
    const platform = detectPlatform(pageUrl);

    // ========================================
    // SPECIAL CASE: Direct LTK storefront URL
    // If user submits an LTK storefront URL directly, scrape it as LTK
    // Don't go through normal link extraction which mislabels rstyle.me as ShopStyle
    // ========================================
    const lowerUrl = url.toLowerCase();
    const isDirectLTK = lowerUrl.includes('shopltk.com/explore') ||
      lowerUrl.includes('liketoknow.it') ||
      (lowerUrl.includes('shopltk.com') && !lowerUrl.includes('login') && !lowerUrl.includes('signup'));

    if (isDirectLTK && deepScrape) {
      console.log('Direct LTK storefront detected, using LTK scraper directly');

      const fetchModule = await import('../services/storefront-scraper');
      const ltkResult = await fetchModule.scrapeStorefront(url, 5);

      console.log(`Direct LTK scrape: success=${ltkResult.success}, products=${ltkResult.products.length}`);

      // Build response for direct LTK scrape
      return c.json({
        platform: 'ltk',
        totalLinks: ltkResult.products.length,
        affiliateLinks: ltkResult.products.length,
        storefronts: [{
          name: 'LTK Storefront',
          icon: '🛍️',
          storefrontUrl: url,
          platform: 'ltk',
          products: ltkResult.products.map(p => ({
            title: p.title,
            url: p.url,
            price: p.price,
            image: p.imageUrl,
          })),
        }],
        storefrontCount: 1,
        totalProducts: ltkResult.products.length,
        displayProducts: String(ltkResult.products.length),
        socialMedia: [],
        otherLinks: [],
        links: ltkResult.products.map(p => ({
          title: p.title,
          url: p.url,
          isAffiliate: true,
        })),
        suggestions: ['LTK storefront detected - products extracted directly'],
        _debug: [{
          directLTK: true,
          success: ltkResult.success,
          productCount: ltkResult.products.length,
          error: ltkResult.error || null,
        }],
      });
    }

    // Scrape the page (for Linktree, Beacons, etc.)
    const result = await scraper.scrapePage(pageUrl.toString());

    // Categorize links into storefronts, products, and socials
    const categorized = categorizeLinks(result.links);

    // Deep scrape storefronts if enabled (extract actual products)
    const debugInfo: any[] = [];
    if (deepScrape && categorized.storefronts.length > 0) {
      // Check if browser binding is available for Puppeteer-based scraping
      const browserBinding = c.env.BROWSER;
      const hasBrowser = !!browserBinding;

      debugInfo.push({ browserAvailable: hasBrowser });

      // Import both scrapers - use fetch for LTK (follows redirects), browser for Amazon (needs JS)
      const browserModule = hasBrowser
        ? await import('../services/browser-storefront-scraper')
        : null;
      const fetchModule = await import('../services/storefront-scraper');

      for (const storefront of categorized.storefronts) {
        // Skip "Affiliate Links" category - we already have those
        if (storefront.platform === 'affiliate') continue;

        // Get the main storefront URL (first product URL or storefrontUrl)
        const storefrontUrl = storefront.storefrontUrl || storefront.products[0]?.url;
        if (!storefrontUrl) continue;

        try {
          // Use FETCH scraper for LTK (it follows redirects to get real product titles)
          // Use BROWSER scraper for Amazon (needs JavaScript rendering)
          const useBrowser = hasBrowser && storefront.platform === 'amazon';
          console.log(`Deep scraping ${storefront.name}: URL=${storefrontUrl}, useBrowser=${useBrowser}`);

          const scrapeResult = useBrowser && browserModule
            ? await browserModule.scrapeWithBrowser(browserBinding, storefrontUrl, 5)
            : await fetchModule.scrapeStorefront(storefrontUrl, 5);

          console.log(`Scrape result for ${storefront.name}: success=${scrapeResult.success}, products=${scrapeResult.products?.length || 0}, error=${scrapeResult.error || 'none'}`);


          // Capture debug info
          debugInfo.push({
            storefront: storefront.name,
            url: storefrontUrl,
            success: scrapeResult.success,
            productCount: scrapeResult.products?.length || 0,
            error: scrapeResult.error || null,
            sampleProducts: scrapeResult.products?.slice(0, 2).map((p: any) => p.title) || [],
          });

          if (scrapeResult.success && scrapeResult.products.length > 0) {
            const validProducts = scrapeResult.products.filter((p: any) => {
              const title = p.title?.trim() || '';
              // Skip if title is too short
              if (title.length < 5) return false;
              // Skip if title starts with $ or @ (prices/handles)
              if (/^[$@€£¥]/.test(title)) return false;
              // Skip if title contains "unavailable" or "error"
              if (/unavailable|error|sorry/i.test(title)) return false;
              // Skip if title looks like a handle (@something)
              if (/^@[a-z0-9._]+$/i.test(title)) return false;
              return true;
            });

            // Log what we scraped for debugging
            console.log(`Deep scrape ${storefront.name}: ${scrapeResult.products.length} products, ${validProducts.length} valid`);

            // Use scraped products if we got at least 1 valid product
            if (validProducts.length >= 1) {
              storefront.products = validProducts.slice(0, 5).map((p: any) => ({
                title: p.title,
                url: p.url,
                image: p.imageUrl,
                price: p.price,
                brand: p.brand,
              }));
            }
            // Otherwise keep the original products from Linktree
          }
        } catch (e: any) {
          console.log(`Failed to deep scrape ${storefront.name}:`, e);
          debugInfo.push({ storefront: storefront.name, error: e.message });
          // Keep existing products if deep scrape fails
        }
      }
    }

    // Recalculate total products after deep scraping
    const totalProducts = categorized.storefronts.reduce(
      (sum: number, sf: any) => sum + sf.products.length, 0
    );

    // Generate suggestions based on results
    const suggestions = generateSuggestions(result, platform);

    return c.json({
      platform,
      totalLinks: result.links.length,
      affiliateLinks: result.links.filter((l) => l.isAffiliate).length,

      // Categorized data for frontend (with deep scraped products)
      storefronts: categorized.storefronts,
      storefrontCount: categorized.storefronts.length,
      totalProducts,
      displayProducts: totalProducts > 20 ? '20+' : String(totalProducts),
      socialMedia: categorized.socialMedia,
      otherLinks: categorized.otherLinks,

      // Keep flat links for backwards compatibility
      links: result.links,
      suggestions,

      // Debug info for deep scrape troubleshooting (remove in production)
      _debug: debugInfo,
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
 * POST /api/migration/debug
 * Debug what the browser actually sees on a page
 */
migrationRoutes.post('/debug', async (c) => {
  const browserBinding = c.env.BROWSER;
  if (!browserBinding) {
    return c.json({ error: 'Browser Rendering not available' }, 400);
  }

  try {
    const body = await c.req.json();
    const { url } = body;
    if (!url) {
      return c.json({ error: 'URL required' }, 400);
    }

    const { debugScrape } = await import('../services/browser-storefront-scraper');
    const result = await debugScrape(browserBinding, url);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Categorize links into storefronts, products, and social media
 */
interface CategorizedLinks {
  storefronts: Array<{
    name: string;
    icon: string;
    storefrontUrl: string;
    platform: string;
    products: Array<{ title: string; url: string; price?: string }>;
  }>;
  totalProducts: number;
  socialMedia: Array<{ name: string; icon: string; url: string; platform: string }>;
  otherLinks: Array<{ title: string; url: string }>;
}

function categorizeLinks(links: any[]): CategorizedLinks {
  const storefrontMap = new Map<string, any>();
  const socialMedia: any[] = [];
  const otherLinks: any[] = [];

  // Define storefront patterns
  const storefrontPatterns: Record<string, { name: string; icon: string; platform: string }> = {
    'amazon.com': { name: 'Amazon Storefront', icon: '📦', platform: 'amazon' },
    'urlgeni.us/amazon': { name: 'Amazon Storefront', icon: '📦', platform: 'amazon' },
    'amzn.to': { name: 'Amazon', icon: '📦', platform: 'amazon' },
    'shopltk.com': { name: 'LTK Storefront', icon: '🛍️', platform: 'ltk' },
    'liketk.it': { name: 'LTK', icon: '🛍️', platform: 'ltk' },
    'ltk.app': { name: 'LTK', icon: '🛍️', platform: 'ltk' },
    'liketoknow.it': { name: 'LTK', icon: '🛍️', platform: 'ltk' },
    'shopmy.us': { name: 'ShopMy', icon: '🛒', platform: 'shopmy' },
    'shop-links.co': { name: 'Shop Links', icon: '🛒', platform: 'shoplinks' },
    'rstyle.me': { name: 'ShopStyle', icon: '👗', platform: 'shopstyle' },
    'shopstyle.it': { name: 'ShopStyle', icon: '👗', platform: 'shopstyle' },
    'howl.me': { name: 'Howl', icon: '🐺', platform: 'howl' },
    'stan.store': { name: 'Stan Store', icon: '⭐', platform: 'stan' },
  };

  // Define social media patterns
  const socialPatterns: Record<string, { name: string; icon: string }> = {
    'instagram.com': { name: 'Instagram', icon: '📸' },
    'tiktok.com': { name: 'TikTok', icon: '🎵' },
    'youtube.com': { name: 'YouTube', icon: '▶️' },
    'youtu.be': { name: 'YouTube', icon: '▶️' },
    'twitter.com': { name: 'Twitter', icon: '🐦' },
    'x.com': { name: 'X', icon: '𝕏' },
    'facebook.com': { name: 'Facebook', icon: '👤' },
    'pinterest.com': { name: 'Pinterest', icon: '📌' },
    'snapchat.com': { name: 'Snapchat', icon: '👻' },
    'linkedin.com': { name: 'LinkedIn', icon: '💼' },
    'twitch.tv': { name: 'Twitch', icon: '🎮' },
    'spotify.com': { name: 'Spotify', icon: '🎧' },
    'discord.gg': { name: 'Discord', icon: '💬' },
    'discord.com': { name: 'Discord', icon: '💬' },
    'threads.net': { name: 'Threads', icon: '🧵' },
  };

  for (const link of links) {
    const lowerUrl = link.url.toLowerCase();
    let matched = false;

    // Check for social media first (we want to categorize socials even if they're on the skip list)
    for (const [pattern, social] of Object.entries(socialPatterns)) {
      if (lowerUrl.includes(pattern)) {
        socialMedia.push({
          name: social.name,
          icon: social.icon,
          url: link.url,
          platform: pattern.split('.')[0],
        });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Check for storefronts
    for (const [pattern, storefront] of Object.entries(storefrontPatterns)) {
      if (lowerUrl.includes(pattern)) {
        const key = storefront.platform;

        if (!storefrontMap.has(key)) {
          storefrontMap.set(key, {
            name: storefront.name,
            icon: storefront.icon,
            storefrontUrl: link.url,
            platform: storefront.platform,
            products: [],
          });
        }

        // Add as product if it looks like an individual item
        const sf = storefrontMap.get(key)!;
        sf.products.push({
          title: link.title || 'Product',
          url: link.url,
        });

        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Check for affiliate links that should be products
    if (link.isAffiliate) {
      // Find or create "Other Affiliate Links" storefront
      if (!storefrontMap.has('affiliate')) {
        storefrontMap.set('affiliate', {
          name: 'Affiliate Links',
          icon: '🔗',
          storefrontUrl: '',
          platform: 'affiliate',
          products: [],
        });
      }
      storefrontMap.get('affiliate')!.products.push({
        title: link.title || 'Affiliate Product',
        url: link.url,
      });
      continue;
    }

    // Everything else goes to other links
    otherLinks.push({
      title: link.title || 'Link',
      url: link.url,
    });
  }

  // Convert map to array and calculate totals
  const storefronts = Array.from(storefrontMap.values());
  const totalProducts = storefronts.reduce((sum, sf) => sum + sf.products.length, 0);

  return {
    storefronts,
    totalProducts,
    socialMedia,
    otherLinks,
  };
}

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
 * Apply migration results - save storefronts, products, and social links to database
 *
 * Expected body:
 * {
 *   storefronts: [{ name, icon, storefrontUrl, platform, products: [{title, url, image, price}] }],
 *   socialMedia: [{ name, icon, url, platform }],
 *   sourcePlatform: 'linktree' | 'beacons' | 'ltk' | etc.
 * }
 */
migrationRoutes.post('/apply', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { storefronts, socialMedia, sourcePlatform } = body;

    console.log(`[Migration Apply] User ${userId} importing from ${sourcePlatform || 'unknown'}`);
    console.log(`[Migration Apply] ${storefronts?.length || 0} storefronts, ${socialMedia?.length || 0} social links`);

    const supabase = getSupabase(c);
    const results = {
      storefronts: { imported: 0, products: 0 },
      socialMedia: { imported: 0 },
      errors: [] as string[],
    };

    // ========================================
    // 1. SAVE STOREFRONTS AND THEIR PRODUCTS
    // ========================================
    if (storefronts && Array.isArray(storefronts)) {
      for (const storefront of storefronts) {
        // Skip empty storefronts
        if (!storefront.storefrontUrl || !storefront.platform) {
          console.log(`[Migration Apply] Skipping invalid storefront: ${JSON.stringify(storefront).slice(0, 100)}`);
          continue;
        }

        // Upsert storefront (insert or update if exists)
        const { data: storefrontData, error: storefrontError } = await supabase
          .from('user_storefronts')
          .upsert({
            user_id: userId,
            platform: storefront.platform,
            storefront_url: storefront.storefrontUrl,
            display_name: storefront.name || `${storefront.platform} Storefront`,
            icon: storefront.icon || '🛍️',
            is_active: true,
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,storefront_url',
          })
          .select()
          .single();

        if (storefrontError) {
          console.error(`[Migration Apply] Error saving storefront:`, storefrontError);
          results.errors.push(`Failed to save ${storefront.name}: ${storefrontError.message}`);
          continue;
        }

        console.log(`[Migration Apply] Saved storefront: ${storefrontData.display_name} (${storefrontData.id})`);
        results.storefronts.imported++;

        // Save products for this storefront
        if (storefront.products && Array.isArray(storefront.products)) {
          for (const product of storefront.products) {
            // Skip invalid products
            if (!product.url || !product.title) continue;

            const { error: productError } = await supabase
              .from('user_storefront_products')
              .upsert({
                user_id: userId,
                storefront_id: storefrontData.id,
                product_url: product.url,
                title: product.title,
                image_url: product.image || null,
                current_price: product.price ? parseFloat(product.price.replace(/[^0-9.]/g, '')) || null : null,
                currency: product.price?.includes('€') ? 'EUR' : product.price?.includes('£') ? 'GBP' : 'USD',
                platform: storefront.platform,
                brand: product.brand || null,
                is_active: true,
                enrichment_status: product.title && product.title.length > 5 ? 'enriched' : 'pending',
                last_enriched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'storefront_id,product_url',
              });

            if (productError) {
              console.error(`[Migration Apply] Error saving product:`, productError);
            } else {
              results.storefronts.products++;
            }
          }
        }
      }
    }

    // ========================================
    // 2. SAVE SOCIAL MEDIA LINKS
    // ========================================
    if (socialMedia && Array.isArray(socialMedia)) {
      for (const social of socialMedia) {
        // Skip invalid social links
        if (!social.url || !social.platform) continue;

        const { error: socialError } = await supabase
          .from('user_social_links')
          .upsert({
            user_id: userId,
            platform: social.platform,
            url: social.url,
            display_name: social.name || social.platform,
            icon: social.icon || '🔗',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,platform',
          });

        if (socialError) {
          console.error(`[Migration Apply] Error saving social link:`, socialError);
          results.errors.push(`Failed to save ${social.name}: ${socialError.message}`);
        } else {
          results.socialMedia.imported++;
        }
      }
    }

    // ========================================
    // 3. MARK ONBOARDING AS COMPLETE (if first import)
    // ========================================
    if (results.storefronts.imported > 0 || results.socialMedia.imported > 0) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId);
    }

    console.log(`[Migration Apply] Complete:`, results);

    return c.json({
      success: true,
      imported: {
        storefronts: results.storefronts.imported,
        products: results.storefronts.products,
        socialLinks: results.socialMedia.imported,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

  } catch (error: any) {
    console.error('Migration apply error:', error);
    return c.json({ error: error.message || 'Failed to apply migration' }, 500);
  }
});

export default migrationRoutes;
