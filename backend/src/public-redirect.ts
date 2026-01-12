/**
 * Public SmartWrapper Redirect Handler
 * Handles: go.affimark.com/{short_code}
 *
 * This is a PUBLIC endpoint (no auth required)
 * Tracks clicks and redirects to destination
 */

import { Hono } from 'hono';
import type { Env } from './index';
import { createClient } from '@supabase/supabase-js';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /go/:code
 * Public redirect endpoint
 */
app.get('/:code', async (c) => {
  const shortCode = c.req.param('code');

  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_KEY // Use service key for public access
    );

    // Fetch SmartWrapper
    const { data: smartwrapper, error } = await supabase
      .from('smartwrappers')
      .select('*')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (error || !smartwrapper) {
      return c.html(getNotFoundPage(), 404);
    }

    // Check if fallback is active
    const destinationUrl = smartwrapper.fallback_active && smartwrapper.fallback_url
      ? smartwrapper.fallback_url
      : smartwrapper.destination_url;

    // Detect user agent
    const userAgent = c.req.header('user-agent') || '';
    const isInAppBrowser = detectInAppBrowser(userAgent);

    // Get client info
    const cfData = c.req.raw.cf;
    const country = cfData?.country || 'unknown';
    const deviceType = getDeviceType(userAgent);
    const referrer = c.req.header('referer') || null;

    // Track click asynchronously (don't wait)
    trackClick(supabase, {
      smartwrapper_id: smartwrapper.id,
      user_agent: userAgent,
      device_type: deviceType,
      country: country as string,
      referrer,
      is_in_app_browser: isInAppBrowser,
      redirect_url: destinationUrl,
    });

    // Increment click count
    supabase
      .from('smartwrappers')
      .update({ click_count: (smartwrapper.click_count || 0) + 1 })
      .eq('id', smartwrapper.id)
      .then(() => {});

    // If in-app browser detected, show interstitial
    if (isInAppBrowser) {
      return c.html(getInAppBrowserInterstitial(destinationUrl, getBrowserName(userAgent)));
    }

    // Normal redirect
    return c.redirect(destinationUrl, 302);
  } catch (err) {
    console.error('Redirect error:', err);
    return c.html(getErrorPage(), 500);
  }
});

/**
 * GET /go/:code/debug
 * Debug info for SmartWrapper (shows redirect chain)
 */
app.get('/:code/debug', async (c) => {
  const shortCode = c.req.param('code');

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const { data: smartwrapper } = await supabase
      .from('smartwrappers')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (!smartwrapper) {
      return c.json({ error: 'SmartWrapper not found' }, 404);
    }

    // Get recent clicks
    const { data: recentClicks } = await supabase
      .from('smartwrapper_clicks')
      .select('*')
      .eq('smartwrapper_id', smartwrapper.id)
      .order('clicked_at', { ascending: false })
      .limit(10);

    return c.json({
      smartwrapper: {
        short_code: smartwrapper.short_code,
        name: smartwrapper.name,
        destination_url: smartwrapper.destination_url,
        affiliate_tag: smartwrapper.affiliate_tag,
        fallback_url: smartwrapper.fallback_url,
        fallback_active: smartwrapper.fallback_active,
        click_count: smartwrapper.click_count,
        is_active: smartwrapper.is_active,
      },
      recent_clicks: recentClicks,
      transparency_note: 'Your affiliate tag passes through untouched. We never skim commissions.',
    });
  } catch (err) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ========================================
// Helper Functions
// ========================================

async function trackClick(supabase: any, data: any) {
  try {
    await supabase.from('smartwrapper_clicks').insert({
      ...data,
      clicked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to track click:', err);
  }
}

function detectInAppBrowser(userAgent: string): boolean {
  const inAppPatterns = [
    /FBAN|FBAV/i, // Facebook
    /Instagram/i, // Instagram
    /Twitter/i, // Twitter
    /Line\//i, // Line
    /KAKAOTALK/i, // KakaoTalk
    /BytedanceWebview/i, // TikTok
  ];

  return inAppPatterns.some((pattern) => pattern.test(userAgent));
}

function getBrowserName(userAgent: string): string {
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV/i.test(userAgent)) return 'Facebook';
  if (/Twitter/i.test(userAgent)) return 'Twitter';
  if (/BytedanceWebview/i.test(userAgent)) return 'TikTok';
  return 'In-app browser';
}

function getDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

// ========================================
// HTML Pages
// ========================================

function getInAppBrowserInterstitial(destinationUrl: string, browserName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Open in Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { font-size: 24px; color: #1a202c; margin-bottom: 10px; }
    p { color: #4a5568; line-height: 1.6; margin-bottom: 30px; }
    .buttons { display: flex; flex-direction: column; gap: 12px; }
    .btn {
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s;
      font-size: 16px;
    }
    .btn-primary {
      background: #667eea;
      color: white;
      border: none;
    }
    .btn-primary:hover { background: #5568d3; transform: translateY(-2px); }
    .btn-secondary {
      background: transparent;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }
    .btn-secondary:hover { background: #f7fafc; }
    .trust { margin-top: 30px; padding-top: 30px; border-top: 1px solid #e2e8f0; }
    .trust-item { color: #2d3748; font-size: 14px; margin: 8px 0; }
    .trust-item::before { content: '✓'; color: #48bb78; margin-right: 8px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📱</div>
    <h1>You're in ${browserName}'s browser</h1>
    <p>For the best shopping experience and to ensure any discounts work properly, please open this link in your browser.</p>

    <div class="buttons">
      <a href="${destinationUrl}" class="btn btn-primary" id="openInBrowser">
        🔗 Open in Safari
      </a>
      <a href="${destinationUrl}" class="btn btn-secondary">
        Continue anyway →
      </a>
    </div>

    <div class="trust">
      <div class="trust-item">Your affiliate tags pass through untouched</div>
      <div class="trust-item">We never skim commissions</div>
      <div class="trust-item">Fully transparent redirect chain</div>
    </div>
  </div>

  <script>
    document.getElementById('openInBrowser').addEventListener('click', function(e) {
      e.preventDefault();
      // Try to open in default browser
      const url = '${destinationUrl}';

      // iOS Safari
      if (/(iPhone|iPad|iPod)/i.test(navigator.userAgent)) {
        window.location.href = 'x-safari-https://' + url.replace(/^https?:\\/\\//, '');
      } else {
        // Android Chrome or fallback
        window.open(url, '_blank');
      }

      // Fallback: just redirect after 1 second
      setTimeout(() => {
        window.location.href = url;
      }, 1000);
    });
  </script>
</body>
</html>
`;
}

function getNotFoundPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Not Found</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .icon { font-size: 80px; margin-bottom: 20px; }
    h1 { font-size: 28px; color: #1a202c; margin-bottom: 10px; }
    p { color: #718096; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔗</div>
    <h1>Link Not Found</h1>
    <p>This SmartWrapper link doesn't exist or has been deactivated.</p>
  </div>
</body>
</html>
`;
}

function getErrorPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .icon { font-size: 80px; margin-bottom: 20px; }
    h1 { font-size: 28px; color: #1a202c; margin-bottom: 10px; }
    p { color: #718096; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Something went wrong</h1>
    <p>We encountered an error processing this link. Please try again later.</p>
  </div>
</body>
</html>
`;
}

export default app;
