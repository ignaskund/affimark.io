/**
 * Attribution Diagnostics API
 * Test affiliate links and verify tracking confidence
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

type Bindings = Env;

const attributionTestRoutes = new Hono<{ Bindings: Bindings }>();

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
 * Detect affiliate parameters in URL
 */
function extractAffiliateParams(url: string): string[] {
  try {
    const urlObj = new URL(url);
    const params: string[] = [];

    // Common affiliate parameter names
    const affiliateParamNames = [
      'tag', 'ref', 'aff', 'aid', 'affiliate', 'partner',
      'tracking', 'source', 'campaign', 'affid', 'subid',
      'clickid', 'sid', 'pid', 'tid', 'utm_source'
    ];

    for (const param of affiliateParamNames) {
      const value = urlObj.searchParams.get(param);
      if (value) {
        params.push(`${param}=${value}`);
      }
    }

    return params;
  } catch (e) {
    return [];
  }
}

/**
 * Follow redirect chain and analyze
 */
async function followRedirectChain(url: string, maxRedirects = 10): Promise<{
  redirectChain: Array<{
    step: number;
    url: string;
    status: number;
    contains_affiliate_tag: boolean;
    affiliate_params: string[];
  }>;
  finalUrl: string;
}> {
  const chain: Array<{
    step: number;
    url: string;
    status: number;
    contains_affiliate_tag: boolean;
    affiliate_params: string[];
  }> = [];

  let currentUrl = url;
  let step = 1;

  while (step <= maxRedirects) {
    try {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Affimark-Attribution-Bot/1.0',
        },
      });

      const affiliateParams = extractAffiliateParams(currentUrl);

      chain.push({
        step,
        url: currentUrl,
        status: response.status,
        contains_affiliate_tag: affiliateParams.length > 0,
        affiliate_params: affiliateParams,
      });

      // Check if this is a redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;

        // Handle relative URLs
        currentUrl = location.startsWith('http')
          ? location
          : new URL(location, currentUrl).toString();

        step++;
      } else {
        // Final destination reached
        break;
      }
    } catch (error) {
      console.error(`Error following redirect at step ${step}:`, error);
      break;
    }
  }

  return {
    redirectChain: chain,
    finalUrl: currentUrl,
  };
}

/**
 * Calculate confidence score
 */
function calculateConfidence(chain: Array<any>): 'high' | 'medium' | 'low' {
  const finalStep = chain[chain.length - 1];
  const hasAffiliateTag = finalStep?.contains_affiliate_tag || false;
  const chainLength = chain.length;

  // High: Tag present in final URL, short chain (1-3 hops)
  if (hasAffiliateTag && chainLength <= 3) {
    return 'high';
  }

  // Medium: Tag present but long chain, or tag in intermediate steps
  if (hasAffiliateTag || chain.some(step => step.contains_affiliate_tag)) {
    return 'medium';
  }

  // Low: No tag found anywhere
  return 'low';
}

/**
 * Identify issues
 */
function identifyIssues(chain: Array<any>): string[] {
  const issues: string[] = [];
  const finalStep = chain[chain.length - 1];

  // Check for missing affiliate tag in final URL
  if (!finalStep?.contains_affiliate_tag) {
    issues.push('Affiliate tag not present in final destination URL');
  }

  // Check for broken chain (4xx/5xx errors)
  const brokenStep = chain.find(step => step.status >= 400);
  if (brokenStep) {
    issues.push(`HTTP ${brokenStep.status} error detected at step ${brokenStep.step}`);
  }

  // Check for excessively long redirect chain
  if (chain.length > 5) {
    issues.push(`Long redirect chain (${chain.length} hops) may cause tracking issues`);
  }

  // Check if affiliate parameters were stripped mid-chain
  const hadParams = chain.slice(0, -1).some(step => step.contains_affiliate_tag);
  const finalHasParams = finalStep?.contains_affiliate_tag;
  if (hadParams && !finalHasParams) {
    issues.push('Affiliate parameters were stripped during redirect chain');
  }

  return issues;
}

/**
 * Estimate cookie window (platform-specific)
 */
function estimateCookieWindow(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Platform-specific cookie windows (in days)
    if (hostname.includes('amazon.')) return 24;
    if (hostname.includes('awin.')) return 30;
    if (hostname.includes('tradedoubler.')) return 30;
    if (hostname.includes('impact.')) return 30;
    if (hostname.includes('ltk.to')) return 30;
    if (hostname.includes('shopmy.')) return 30;

    // Default for unknown platforms
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/attribution/test
 * Test an affiliate link and return diagnostics
 */
attributionTestRoutes.post('/test', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { url } = body;

  if (!url || !url.trim()) {
    return c.json({ error: 'URL is required' }, 400);
  }

  try {
    // Follow redirect chain
    const { redirectChain, finalUrl } = await followRedirectChain(url);

    if (redirectChain.length === 0) {
      return c.json({ error: 'Failed to analyze URL' }, 500);
    }

    // Extract all affiliate parameters found
    const allAffiliateParams = new Set<string>();
    redirectChain.forEach(step => {
      step.affiliate_params.forEach(param => allAffiliateParams.add(param));
    });

    // Calculate confidence
    const confidence = calculateConfidence(redirectChain);

    // Identify issues
    const issues = identifyIssues(redirectChain);

    // Check if affiliate tag is present in final URL
    const affiliateTagPresent = redirectChain[redirectChain.length - 1]?.contains_affiliate_tag || false;

    // Estimate cookie window
    const cookieWindowDays = estimateCookieWindow(finalUrl);

    // Check if in-app browser safe (always true for now, as detection happens client-side)
    const isInAppBrowserSafe = true;

    return c.json({
      url,
      final_url: finalUrl,
      redirect_chain: redirectChain,
      affiliate_tag_present: affiliateTagPresent,
      affiliate_params_found: Array.from(allAffiliateParams),
      confidence,
      issues,
      cookie_window_days: cookieWindowDays,
      is_in_app_browser_safe: isInAppBrowserSafe,
    });
  } catch (error: any) {
    console.error('Attribution test error:', error);
    return c.json({ error: error.message || 'Test failed' }, 500);
  }
});

export default attributionTestRoutes;
