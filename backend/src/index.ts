/**
 * Cloudflare Workers entry point
 */

import { Hono } from 'hono';
import api from './api';
import { handleProductRefresh } from './workers/product-refresh';
import { handleDailyAudit } from './workers/daily-audit';
import { handleHealthCheck } from './workers/health-check-cron';
import { handleV2HealthCheck } from './workers/v2-health-check-cron';
import { handleScheduleCheck } from './workers/schedule-cron';
import { handleAggregation } from './workers/aggregation-cron';
import { createClient } from '@supabase/supabase-js';
import { WaterfallRouter } from './services/waterfall-router';

export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;

  // API Keys
  BACKEND_API_KEY: string;
  YOUTUBE_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;

  // OAuth
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  TWITTER_API_KEY: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_BEARER_TOKEN: string;
  TIKTOK_CLIENT_KEY: string;
  TIKTOK_CLIENT_SECRET: string;

  // Link Guard - Product Research & Stock Checking
  RAINFOREST_API_KEY?: string;
  SERPAPI_KEY?: string;

  // Link Guard - Affiliate Networks
  IMPACT_ACCOUNT_SID?: string;
  IMPACT_AUTH_TOKEN?: string;
  AMAZON_ASSOCIATES_TAG?: string;

  // Optional: Additional Affiliate Networks (for commission comparison)
  SHAREASALE_API_TOKEN?: string;
  SHAREASALE_API_SECRET?: string;
  CJ_API_KEY?: string;
  RAKUTEN_API_KEY?: string;
  AWIN_API_KEY?: string;

  // Legacy: Keep if you want creator product import features
  SHOPIFY_APP_CLIENT_ID?: string;
  SHOPIFY_APP_CLIENT_SECRET?: string;
  SHOPIFY_API_KEY?: string;
  GUMROAD_ACCESS_TOKEN?: string;

  // Email Service (choose one)
  SENDGRID_API_KEY?: string;
  POSTMARK_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME?: string;

  // OAuth - Affiliate Networks
  TRADEDOUBLER_CLIENT_ID?: string;
  TRADEDOUBLER_CLIENT_SECRET?: string;
  AWIN_CLIENT_ID?: string;
  AWIN_CLIENT_SECRET?: string;

  // URLs for OAuth redirects
  BASE_URL: string;
  FRONTEND_URL: string;

  // Cron protection
  CRON_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scheduled tasks (protected by CRON_SECRET)
app.get('/cron/product-refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleProductRefresh(c.env);
  return c.json({ success: true });
});

app.get('/cron/daily-audit', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleDailyAudit(c.env);
  return c.json({ success: true });
});

app.get('/cron/health-check', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleHealthCheck(c.env);
  return c.json({ success: true });
});

app.get('/cron/schedule-check', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleScheduleCheck(c.env);
  return c.json({ success: true });
});

app.get('/cron/aggregation', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleAggregation(c.env);
  return c.json({ success: true });
});

app.get('/cron/v2-health-check', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await handleV2HealthCheck(c.env);
  return c.json({ success: true });
});

// Mount API routes
app.route('/', api);

/**
 * AffiMark SmartWrapper - Public redirect handler
 * GET /go/:code
 *
 * The SmartWrapper system with waterfall routing - go.affimark.com/abc123
 * - Waterfall routing through priority chain
 * - Schedule-based destination overrides
 * - A/B testing with traffic splitting
 * - UTM parameter preservation
 * - Click tracking with analytics
 *
 * PERFORMANCE TARGET: <100ms total latency (edge computing)
 */
app.get('/go/:code', async (c) => {
  const startTime = Date.now();

  try {
    const shortCode = c.req.param('code');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Use waterfall router for intelligent routing
    const router = new WaterfallRouter(supabase);
    const routeResult = await router.route(shortCode, c.req.url);

    // Extract tracking data from request headers
    const userAgent = c.req.header('user-agent') || '';
    const referer = c.req.header('referer') || '';
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const countryCode = c.req.header('cf-ipcountry') || '';

    // Extract UTM parameters from incoming URL
    const url = new URL(c.req.url);
    const utmSource = url.searchParams.get('utm_source');
    const utmMedium = url.searchParams.get('utm_medium');
    const utmCampaign = url.searchParams.get('utm_campaign');

    // Get SmartWrapper for click tracking
    const { data: smartwrapper } = await supabase
      .from('redirect_links')
      .select('id, click_count, user_id')
      .eq('short_code', shortCode)
      .single();

    if (smartwrapper) {
      // Determine device type from user agent
      const deviceType = getDeviceType(userAgent);

      // Fire-and-forget click tracking
      supabase
        .from('redirect_link_clicks')
        .insert({
          redirect_link_id: smartwrapper.id,
          destination_url: routeResult.destinationUrl,
          user_agent: userAgent,
          ip_address: ipAddress,
          referer,
          country_code: countryCode,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        })
        .then(() => {})
        .catch((err) => console.error('Click tracking error:', err));

      // Update click count
      supabase
        .from('redirect_links')
        .update({
          click_count: smartwrapper.click_count + 1,
          last_clicked_at: new Date().toISOString(),
        })
        .eq('id', smartwrapper.id)
        .then(() => {})
        .catch((err) => console.error('Click count update error:', err));

      // Update daily click stats (async aggregation)
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('click_stats_daily')
        .upsert({
          smartwrapper_id: smartwrapper.id,
          user_id: smartwrapper.user_id,
          date: today,
          total_clicks: 1,
          unique_clicks: 1,
          mobile_clicks: deviceType === 'mobile' ? 1 : 0,
          desktop_clicks: deviceType === 'desktop' ? 1 : 0,
          tablet_clicks: deviceType === 'tablet' ? 1 : 0,
          top_country: countryCode,
          top_utm_source: utmSource,
        }, {
          onConflict: 'smartwrapper_id,date',
          ignoreDuplicates: false,
        })
        .then(() => {})
        .catch((err) => console.error('Stats aggregation error:', err));
    }

    // Log routing performance
    const totalTime = Date.now() - startTime;
    if (totalTime > 100) {
      console.warn(`⚠️ Slow redirect: ${shortCode} took ${totalTime}ms`);
    }

    // Redirect to final destination (with all UTM params preserved)
    return c.redirect(routeResult.destinationUrl, 302);

  } catch (error: any) {
    console.error('SmartWrapper routing error:', error);

    // Graceful fallback - try to get original URL
    try {
      const shortCode = c.req.param('code');
      const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

      const { data } = await supabase
        .from('redirect_links')
        .select('original_url')
        .eq('short_code', shortCode)
        .single();

      if (data?.original_url) {
        return c.redirect(data.original_url, 302);
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }

    return c.text('SmartWrapper not found', 404);
  }
});

/**
 * Public cloaked redirect handler
 * GET /c/:code
 *
 * Mounted at worker root so public shop links can use
 * URLs like https://affimark.io/c/abcd123.
 */
app.get('/c/:code', async (c) => {
  try {
    const shortCode = c.req.param('code');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: link, error: linkError } = await supabase
      .from('tracking_links')
      .select('*')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (linkError || !link) {
      return c.text('Link not found', 404);
    }

    const userAgent = c.req.header('user-agent') || '';
    const referrer = c.req.header('referer') || '';
    const ipAddress =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      '';

    const country = c.req.header('cf-ipcountry') || '';
    const city = c.req.header('cf-ipcity') || '';

    const isMobile = /mobile/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Fire-and-forget click insert
    supabase
      .from('tracked_clicks')
      .insert({
        tracking_link_id: link.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        referrer,
        country,
        city,
        device_type: deviceType,
        browser: userAgent.includes('Chrome')
          ? 'Chrome'
          : userAgent.includes('Safari')
          ? 'Safari'
          : 'Other',
        os: userAgent.includes('Windows')
          ? 'Windows'
          : userAgent.includes('Mac')
          ? 'Mac'
          : userAgent.includes('Linux')
          ? 'Linux'
          : 'Other',
      })
      .then(() => {
        // ignore
      })
      .catch(() => {
        // ignore
      });

    return c.redirect(link.destination_url, 302);
  } catch (error) {
    console.error('Redirect handler error:', error);
    return c.text('Unexpected error', 500);
  }
});

/**
 * Helper function to detect device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

// Scheduled event handler (for cron jobs)
export default {
  fetch: app.fetch,

  // Cron handler for scheduled tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run both: product refresh (2 AM) and link audits (6 AM) - configured in wrangler.toml
    ctx.waitUntil(Promise.all([
      handleProductRefresh(env),
      handleDailyAudit(env)
    ]));
  },
};

