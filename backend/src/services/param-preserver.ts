/**
 * UTM & Parameter Preservation Service
 * 
 * Preserves all tracking parameters when redirecting through SmartWrappers.
 * Critical for attribution tracking.
 */

// Parameters that should always be forwarded
const ALWAYS_FORWARD = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  
  // Affiliate parameters
  'ref',
  'sub_id',
  'aff_id',
  'affiliate_id',
  'aid',
  'partner',
  
  // Platform click IDs
  'fbclid',      // Facebook
  'gclid',       // Google
  'ttclid',      // TikTok
  'li_fat_id',   // LinkedIn
  'msclkid',     // Microsoft
  'twclid',      // Twitter
];

/**
 * Merge incoming URL parameters with destination URL
 * 
 * Rules:
 * 1. Forward all known tracking params
 * 2. Forward custom params (don't overwrite destination's existing params)
 * 3. Add Affimark tracking ID
 * 
 * @param incomingUrl - Full URL that user clicked (e.g., go.affimark.com/xyz?utm_source=tiktok)
 * @param destinationUrl - Where we're sending them (e.g., amazon.com/dp/B08N5W?tag=jessica-20)
 * @returns Final URL with all params preserved
 */
export function preserveParams(incomingUrl: string, destinationUrl: string): string {
  try {
    const incoming = new URL(incomingUrl);
    const destination = new URL(destinationUrl);

    // 1. Forward all known tracking params (high priority)
    for (const param of ALWAYS_FORWARD) {
      const value = incoming.searchParams.get(param);
      if (value && !destination.searchParams.has(param)) {
        destination.searchParams.set(param, value);
      }
    }

    // 2. Forward any other custom params (don't overwrite destination's params)
    incoming.searchParams.forEach((value, key) => {
      // Skip internal Affimark params (start with _am)
      if (key.startsWith('_am')) {
        return;
      }

      // Skip if destination already has this param
      if (!destination.searchParams.has(key)) {
        destination.searchParams.set(key, value);
      }
    });

    // 3. Add Affimark click ID for internal tracking
    const clickId = generateClickId();
    destination.searchParams.set('_am', clickId);

    return destination.toString();
  } catch (error) {
    // If URL parsing fails, return destination as-is
    console.error('Parameter preservation failed:', error);
    return destinationUrl;
  }
}

/**
 * Generate unique click ID for tracking
 */
function generateClickId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

/**
 * Extract all UTM parameters from a URL
 */
export function extractUtmParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const utmParams: Record<string, string> = {};

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((param) => {
      const value = urlObj.searchParams.get(param);
      if (value) {
        utmParams[param] = value;
      }
    });

    return utmParams;
  } catch {
    return {};
  }
}

/**
 * Check if URL has affiliate parameters
 */
export function hasAffiliateParams(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const affiliateParams = ['ref', 'tag', 'aff_id', 'affiliate_id', 'aid', 'partner'];
    
    return affiliateParams.some((param) => urlObj.searchParams.has(param));
  } catch {
    return false;
  }
}
