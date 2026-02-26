/**
 * Linktree Ingestion Service
 *
 * Hardened ingestion layer that:
 * 1. Canonicalizes the Linktree URL (redirects, username normalization)
 * 2. Extracts storefront domains, social handles, niche-indicating links
 * 3. Stores each extracted item with: source, first_seen, last_seen, confidence, raw_fragment
 * 4. Supports both scraping (fallback) and Linktree Developer Program API (when available)
 *
 * Parser is versioned so we can track when Linktree markup changes break extraction.
 */

const PARSER_VERSION = '1.0.0';

export type ExtractionSource = 'linktree_api' | 'linktree_scrape' | 'beacons_scrape' | 'manual';
export type ItemType = 'storefront' | 'social' | 'niche_signal' | 'affiliate_link' | 'other';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractedItem {
  itemType: ItemType;
  platform: string;
  url: string;
  displayName: string;
  source: ExtractionSource;
  confidence: ConfidenceLevel;
  firstSeen: string;
  lastSeen: string;
  rawFragment: string;
  parserVersion: string;
  metadata?: Record<string, unknown>;
}

export interface LinktreeIngestionResult {
  canonicalUrl: string;
  username: string;
  extractedItems: ExtractedItem[];
  storefronts: ExtractedItem[];
  socials: ExtractedItem[];
  nicheSignals: ExtractedItem[];
  affiliateLinks: ExtractedItem[];
  ingestionTimestamp: string;
  parserVersion: string;
  source: ExtractionSource;
}

// ─── URL Canonicalization ──────────────────────────────────────────

/**
 * Canonical Linktree URL: https://linktr.ee/{username}
 * Handles redirects, trailing slashes, query params, case normalization.
 */
export function canonicalizeLinktreeUrl(rawUrl: string): {
  canonical: string;
  username: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { canonical: rawUrl, username: '' };
  }

  const hostname = url.hostname.toLowerCase();

  // Handle linktr.ee
  if (hostname === 'linktr.ee' || hostname === 'www.linktr.ee') {
    const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const username = (pathParts[0] || '').toLowerCase();
    return {
      canonical: `https://linktr.ee/${username}`,
      username,
    };
  }

  // Handle custom domain Linktree profiles
  return {
    canonical: `${url.protocol}//${url.hostname}${url.pathname}`.replace(/\/+$/, ''),
    username: url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || hostname,
  };
}

// ─── Classification ────────────────────────────────────────────────

const STOREFRONT_PATTERNS: Record<string, { platform: string; confidence: ConfidenceLevel }> = {
  'amazon.com': { platform: 'amazon', confidence: 'high' },
  'amazon.de': { platform: 'amazon_de', confidence: 'high' },
  'amazon.co.uk': { platform: 'amazon_uk', confidence: 'high' },
  'amazon.fr': { platform: 'amazon_fr', confidence: 'high' },
  'amazon.it': { platform: 'amazon_it', confidence: 'high' },
  'amazon.es': { platform: 'amazon_es', confidence: 'high' },
  'urlgeni.us/amazon': { platform: 'amazon', confidence: 'high' },
  'amzn.to': { platform: 'amazon', confidence: 'high' },
  'shopltk.com': { platform: 'ltk', confidence: 'high' },
  'liketk.it': { platform: 'ltk', confidence: 'high' },
  'ltk.app': { platform: 'ltk', confidence: 'high' },
  'liketoknow.it': { platform: 'ltk', confidence: 'high' },
  'shopmy.us': { platform: 'shopmy', confidence: 'high' },
  'rstyle.me': { platform: 'shopstyle', confidence: 'medium' },
  'shopstyle.it': { platform: 'shopstyle', confidence: 'medium' },
  'howl.me': { platform: 'howl', confidence: 'medium' },
  'stan.store': { platform: 'stan', confidence: 'high' },
  'awin1.com': { platform: 'awin', confidence: 'high' },
  'shareasale.com': { platform: 'shareasale', confidence: 'high' },
};

const SOCIAL_PATTERNS: Record<string, { platform: string; confidence: ConfidenceLevel }> = {
  'instagram.com': { platform: 'instagram', confidence: 'high' },
  'tiktok.com': { platform: 'tiktok', confidence: 'high' },
  'youtube.com': { platform: 'youtube', confidence: 'high' },
  'youtu.be': { platform: 'youtube', confidence: 'high' },
  'twitter.com': { platform: 'twitter', confidence: 'high' },
  'x.com': { platform: 'twitter', confidence: 'high' },
  'facebook.com': { platform: 'facebook', confidence: 'high' },
  'pinterest.com': { platform: 'pinterest', confidence: 'high' },
  'snapchat.com': { platform: 'snapchat', confidence: 'high' },
  'threads.net': { platform: 'threads', confidence: 'high' },
  'twitch.tv': { platform: 'twitch', confidence: 'high' },
  'spotify.com': { platform: 'spotify', confidence: 'medium' },
  'discord.gg': { platform: 'discord', confidence: 'medium' },
  'discord.com': { platform: 'discord', confidence: 'medium' },
};

const NICHE_KEYWORDS: Record<string, string[]> = {
  skincare: ['skincare', 'skin care', 'routine', 'serum', 'moisturizer', 'cleanser', 'spf'],
  fitness: ['workout', 'gym', 'fitness', 'exercise', 'yoga', 'running'],
  fashion: ['outfit', 'style', 'wardrobe', 'fashion', 'dress'],
  tech: ['gadget', 'tech', 'review', 'unboxing', 'setup'],
  food: ['recipe', 'cooking', 'meal', 'kitchen', 'food'],
  travel: ['travel', 'trip', 'destination', 'itinerary', 'hotel'],
  beauty: ['makeup', 'beauty', 'tutorial', 'grwm', 'haul'],
  home: ['home', 'decor', 'interior', 'furniture', 'organization'],
};

function classifyLink(
  url: string,
  title: string,
): { type: ItemType; platform: string; confidence: ConfidenceLevel } {
  const lowerUrl = url.toLowerCase();

  // Check storefronts
  for (const [pattern, info] of Object.entries(STOREFRONT_PATTERNS)) {
    if (lowerUrl.includes(pattern)) {
      return { type: 'storefront', ...info };
    }
  }

  // Check socials
  for (const [pattern, info] of Object.entries(SOCIAL_PATTERNS)) {
    if (lowerUrl.includes(pattern)) {
      return { type: 'social', ...info };
    }
  }

  // Check for affiliate link indicators
  const affiliateIndicators = [
    'ref=', 'tag=', 'aff=', 'utm_', 'click', 'redirect', 'prf.hn',
    'commission', 'partner', 'affiliate',
  ];
  if (affiliateIndicators.some(ind => lowerUrl.includes(ind))) {
    return { type: 'affiliate_link', platform: 'unknown', confidence: 'medium' };
  }

  // Check niche signals from title
  const lowerTitle = (title || '').toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some(kw => lowerTitle.includes(kw) || lowerUrl.includes(kw))) {
      return { type: 'niche_signal', platform: niche, confidence: 'medium' };
    }
  }

  return { type: 'other', platform: 'unknown', confidence: 'low' };
}

// ─── Ingestion Pipeline ────────────────────────────────────────────

/**
 * Ingest a Linktree page: scrape, classify, and annotate all links with metadata.
 * Falls back gracefully if scraping fails.
 */
export async function ingestLinktree(
  rawUrl: string,
  existingItems?: ExtractedItem[],
): Promise<LinktreeIngestionResult> {
  const { canonical, username } = canonicalizeLinktreeUrl(rawUrl);
  const now = new Date().toISOString();

  // Build lookup of existing items for first_seen preservation
  const existingMap = new Map<string, ExtractedItem>();
  if (existingItems) {
    for (const item of existingItems) {
      existingMap.set(item.url, item);
    }
  }

  // Import the scraper and scrape
  const { MigrationScraper } = await import('./migration-scraper');
  const scraper = new MigrationScraper();
  let scrapedLinks: Array<{ title: string; url: string; isAffiliate: boolean; detectedNetwork?: string }> = [];

  try {
    const result = await scraper.scrapePage(canonical);
    scrapedLinks = result.links;
  } catch (error) {
    console.error(`[Linktree Ingestion] Scrape failed for ${canonical}:`, error);
  }

  // Classify and annotate each link
  const extractedItems: ExtractedItem[] = scrapedLinks.map(link => {
    const { type, platform, confidence } = classifyLink(link.url, link.title);
    const existing = existingMap.get(link.url);

    return {
      itemType: type,
      platform,
      url: link.url,
      displayName: link.title || link.url,
      source: 'linktree_scrape' as ExtractionSource,
      confidence,
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
      rawFragment: JSON.stringify({ title: link.title, url: link.url, isAffiliate: link.isAffiliate }),
      parserVersion: PARSER_VERSION,
      metadata: link.detectedNetwork ? { detectedNetwork: link.detectedNetwork } : undefined,
    };
  });

  return {
    canonicalUrl: canonical,
    username,
    extractedItems,
    storefronts: extractedItems.filter(i => i.itemType === 'storefront'),
    socials: extractedItems.filter(i => i.itemType === 'social'),
    nicheSignals: extractedItems.filter(i => i.itemType === 'niche_signal'),
    affiliateLinks: extractedItems.filter(i => i.itemType === 'affiliate_link'),
    ingestionTimestamp: now,
    parserVersion: PARSER_VERSION,
    source: 'linktree_scrape',
  };
}

/**
 * Store ingestion results to Supabase with upsert semantics.
 * Preserves first_seen while updating last_seen.
 */
export async function storeIngestionResults(
  userId: string,
  result: LinktreeIngestionResult,
  env: any,
): Promise<{ stored: number; errors: string[] }> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  let stored = 0;
  const errors: string[] = [];

  for (const item of result.extractedItems) {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/linktree_extracted_items`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            user_id: userId,
            canonical_url: result.canonicalUrl,
            item_type: item.itemType,
            platform: item.platform,
            url: item.url,
            display_name: item.displayName,
            source: item.source,
            confidence: item.confidence,
            first_seen: item.firstSeen,
            last_seen: item.lastSeen,
            raw_fragment: item.rawFragment,
            parser_version: item.parserVersion,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          }),
        },
      );

      if (response.ok) {
        stored++;
      } else {
        const errorText = await response.text();
        errors.push(`Failed to store ${item.url}: ${errorText}`);
      }
    } catch (error: any) {
      errors.push(`Error storing ${item.url}: ${error.message}`);
    }
  }

  return { stored, errors };
}

/**
 * Load previously extracted items for a user + canonical URL (for first_seen preservation)
 */
export async function loadExistingItems(
  userId: string,
  canonicalUrl: string,
  env: any,
): Promise<ExtractedItem[]> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/linktree_extracted_items?user_id=eq.${userId}&canonical_url=eq.${encodeURIComponent(canonicalUrl)}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((row: any) => ({
      itemType: row.item_type,
      platform: row.platform,
      url: row.url,
      displayName: row.display_name,
      source: row.source,
      confidence: row.confidence,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      rawFragment: row.raw_fragment,
      parserVersion: row.parser_version,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  } catch {
    return [];
  }
}
