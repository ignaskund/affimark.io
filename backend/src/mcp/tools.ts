/**
 * MCP Alternative Search Agent — Tool Implementations
 *
 * Each tool is a self-contained function that the agent orchestrator calls.
 * Tools handle data fetching, enrichment, and scoring independently.
 */

import type {
  CreatorProfile,
  IdentifiedProduct,
  SearchCandidate,
  ScoredAlternative,
} from './types';
import { inferBrand, inferCategory, mapCategory } from '../utils/product-inference';
import type { Env } from '../index';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch {
    console.warn('[MCP tools] Failed to parse JSON:', String(value).substring(0, 50));
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 1: get_creator_profile
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCreatorProfile(userId: string, env: Env): Promise<CreatorProfile> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[MCP getCreatorProfile] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return buildEmptyProfile(userId);
  }

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const [prefsRes, socialsRes, storefrontsRes, productsRes, profileRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/user_creator_preferences?user_id=eq.${userId}&select=product_priorities,brand_priorities`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_social_links?user_id=eq.${userId}&select=platform,url,display_name,follower_count`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_storefronts?user_id=eq.${userId}&select=platform,storefront_url,display_name`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=title,brand,category,current_price,platform,product_url&limit=100`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_product_profiles?user_id=eq.${userId}`, { headers }),
  ]);

  // Check for auth errors (any non-200 indicates bad API key or network issue)
  for (const [name, res] of [['prefs', prefsRes], ['socials', socialsRes], ['storefronts', storefrontsRes], ['products', productsRes], ['profiles', profileRes]] as const) {
    if (!res.ok) {
      const errText = await (res as Response).text().catch(() => 'unknown');
      console.error(`[MCP getCreatorProfile] Supabase ${name} query failed (${(res as Response).status}): ${errText}`);
    }
  }

  const [prefs, socials, storefronts, products, profiles] = await Promise.all([
    prefsRes.ok ? prefsRes.json() : [],
    socialsRes.ok ? socialsRes.json() : [],
    storefrontsRes.ok ? storefrontsRes.json() : [],
    productsRes.ok ? productsRes.json() : [],
    profileRes.ok ? profileRes.json() : [],
  ]);

  const pref = Array.isArray(prefs) ? prefs[0] : null;
  const profile = Array.isArray(profiles) ? profiles[0] : null;

  const socialList = Array.isArray(socials) ? socials : [];
  const storefrontList = Array.isArray(storefronts) ? storefronts : [];
  const productList = Array.isArray(products) ? products : [];

  const preferredNetworks = storefrontList.map((s: any) => s.platform).filter(Boolean);
  const dominantCategories: Array<{ category: string; percentage: number }> = [];
  const topBrands: string[] = [];
  let avgPricePoint = 0;

  if (profile) {
    try {
      const dc = JSON.parse(profile.dominant_categories || '[]');
      dominantCategories.push(...dc);
    } catch {}
    try {
      topBrands.push(...JSON.parse(profile.top_brands || '[]'));
    } catch {}
    avgPricePoint = parseFloat(profile.avg_price_point) || 0;
  }

  if (avgPricePoint === 0 && productList.length > 0) {
    const priced = productList.filter((p: any) => p.current_price && parseFloat(p.current_price) > 0);
    if (priced.length > 0) {
      avgPricePoint = priced.reduce((s: number, p: any) => s + parseFloat(p.current_price), 0) / priced.length;
    }
  }

  const hasPriorities = !!(pref?.product_priorities?.length);
  const hasSocials = socialList.length > 0;
  const hasStorefronts = storefrontList.length > 0 || productList.length > 0;
  const confidenceScore = (hasPriorities ? 40 : 0) + (hasSocials ? 30 : 0) + (hasStorefronts ? 30 : 0);

  return {
    userId,
    productPriorities: pref?.product_priorities || [],
    brandPriorities: pref?.brand_priorities || [],
    socialContext: {
      platforms: socialList.map((s: any) => s.platform),
      contentCategories: profile ? safeJsonParse(profile.content_categories, [] as string[]) : [],
      audienceDemographics: profile ? safeJsonParse(profile.audience_demographics, { ageRange: '', topCountries: [] as string[], interests: [] as string[] }) : { ageRange: '', topCountries: [], interests: [] },
      estimatedReach: profile?.estimated_reach || 0,
    },
    storefrontContext: {
      dominantCategories,
      topBrands,
      avgPricePoint,
      preferredNetworks,
    },
    storefrontProducts: productList.map((p: any) => ({
      title: p.title || '',
      brand: p.brand || null,
      category: p.category || null,
      price: p.current_price ? parseFloat(p.current_price) : null,
      platform: p.platform || '',
      url: p.product_url || '',
    })),
    confidenceScore,
  };
}

function buildEmptyProfile(userId: string): CreatorProfile {
  return {
    userId,
    productPriorities: [],
    brandPriorities: [],
    socialContext: {
      platforms: [],
      contentCategories: [],
      audienceDemographics: { ageRange: '', topCountries: [], interests: [] },
      estimatedReach: 0,
    },
    storefrontContext: {
      dominantCategories: [],
      topBrands: [],
      avgPricePoint: 0,
      preferredNetworks: [],
    },
    storefrontProducts: [],
    confidenceScore: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 2: identify_product
// ═══════════════════════════════════════════════════════════════════════════════

function detectAmazonDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('amazon.de')) return 'amazon.de';
    if (hostname.includes('amazon.co.uk')) return 'amazon.co.uk';
    if (hostname.includes('amazon.fr')) return 'amazon.fr';
    if (hostname.includes('amazon.it')) return 'amazon.it';
    if (hostname.includes('amazon.es')) return 'amazon.es';
    if (hostname.includes('amazon.co.jp')) return 'amazon.co.jp';
    if (hostname.includes('amazon.nl')) return 'amazon.nl';
    if (hostname.includes('amazon.pl')) return 'amazon.pl';
    if (hostname.includes('amazon.se')) return 'amazon.se';
  } catch {}
  return 'amazon.com';
}

const AFFILIATE_TRACKER_DOMAINS = new Set([
  'tkqlhce.com', 'jdoqocy.com', 'dpbolvw.net', 'kqzyfj.com', 'anrdoezrs.net', // CJ Affiliate
  'click.linksynergy.com', 'rd.linksynergy.com', // Rakuten
  'shareasale.com', 'shrsl.com', // ShareASale
  'go.skimresources.com', 'go.redirectingat.com', // Skimlinks
  'impact.com', 'sjv.io', 'prf.hn', 'evyy.net', // Impact
  'awin1.com', 'zenaps.com', // Awin
  'avantlink.com', 'redirect.viglink.com',
  'narrativ.com', 'bam-x.com',
  'pepperjam.com', 'gopjn.com',
  'tradedoubler.com', 'clkuk.tradedoubler.com',
]);

function isAffiliateTrackerUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const tracker of AFFILIATE_TRACKER_DOMAINS) {
      if (hostname === tracker || hostname.endsWith('.' + tracker)) return true;
    }
  } catch {}
  return false;
}

function isNonProductPage(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const nonProductDomains = [
      'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
      'instagram.com', 'tiktok.com', 'reddit.com', 'wikipedia.org',
      'linkedin.com', 'pinterest.com', 'github.com', 'stackoverflow.com',
      'medium.com', 'substack.com', 'notion.so', 'figma.com',
    ];
    for (const domain of nonProductDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return true;
    }
    const path = new URL(url).pathname;
    if (path === '/' || path === '') return true;
  } catch {}
  return false;
}

export async function identifyProduct(url: string, env: Env): Promise<IdentifiedProduct> {
  if (isAffiliateTrackerUrl(url)) {
    console.log(`[MCP identify_product] Affiliate tracker URL detected: ${url}`);
    return {
      title: '', brand: null, category: 'General', subcategory: '',
      price: null, currency: 'USD', keywords: [], searchQueries: [],
      confidence: 0, source: 'ai_url',
    };
  }

  if (isNonProductPage(url)) {
    console.log(`[MCP identify_product] Non-product page detected: ${url}`);
    return {
      title: '', brand: null, category: 'General', subcategory: '',
      price: null, currency: 'USD', keywords: [], searchQueries: [],
      confidence: 0, source: 'ai_url',
    };
  }

  const isAmazon = /amazon\.[a-z.]+/i.test(url);
  const asinMatch = url.match(/(?:\/dp\/|\/gp\/product\/|\/ASIN\/)([A-Z0-9]{10})/i);

  // Strategy 1: Rainforest API for Amazon
  if (isAmazon && asinMatch) {
    const asin = asinMatch[1];
    if (!env.RAINFOREST_API_KEY) {
      console.warn(`[MCP identify_product] RAINFOREST_API_KEY not set — skipping Rainforest for ASIN ${asin}. Set this key for deterministic Amazon identification.`);
    } else {
      try {
        const amazonDomain = detectAmazonDomain(url);
        console.log(`[MCP identify_product] Rainforest call: ASIN=${asin}, domain=${amazonDomain}`);
        const rfRes = await fetch(
          `https://api.rainforestapi.com/request?api_key=${env.RAINFOREST_API_KEY}&type=product&asin=${asin}&amazon_domain=${amazonDomain}`
        );
        console.log(`[MCP identify_product] Rainforest response: status=${rfRes.status}`);
        if (rfRes.ok) {
          const data: any = await rfRes.json();
          const product = data?.product;
          if (product?.title) {
            console.log(`[MCP identify_product] Rainforest success: "${product.title}" by ${product.brand}, price=${product.buybox_winner?.price?.value}`);
            return buildIdentifiedProduct(product.title, product.brand, product.categories?.[0]?.name,
              product.buybox_winner?.price?.value, product.buybox_winner?.price?.currency || 'USD', 'rainforest');
          } else {
            console.warn(`[MCP identify_product] Rainforest returned OK but no product.title. Keys: ${Object.keys(data || {}).join(', ')}`);
          }
        } else {
          const errBody = await rfRes.text().catch(() => '');
          console.error(`[MCP identify_product] Rainforest HTTP ${rfRes.status}: ${errBody.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.error(`[MCP identify_product] Rainforest exception: ${e?.message || e}`);
      }
    }
  }

  // Strategy 2: AI ASIN knowledge for Amazon (moved up — more reliable than slug extraction)
  if (isAmazon && asinMatch && env.OPENAI_API_KEY) {
    try {
      const { aiComplete, extractJson } = await import('../services/ai-client');
      const asin = asinMatch[1];
      const amazonDomain = detectAmazonDomain(url);
      console.log(`[MCP identify_product] AI ASIN lookup: ASIN=${asin}, domain=${amazonDomain}`);
      const text = await aiComplete({
        prompt: `What product is sold on ${amazonDomain} with ASIN ${asin}?

Return JSON: {"title": "full product name", "brand": "brand name", "category": "Electronics|Fashion|Home & Garden|Beauty & Health|Sports & Outdoors", "subcategory": "specific type like 'over-ear headphones' or 'face moisturizer'", "price": estimated_price_or_null, "searchQueries": ["2-4 word product type WITHOUT brand name", "broader category query"], "confidence": 0-100}

CRITICAL: searchQueries must describe the product TYPE, never include the brand. E.g. "over-ear noise cancelling headphones" not "Sony headphones". If you don't know this ASIN, set confidence to 0.`,
        maxTokens: 250,
        temperature: 0,
        apiKey: env.OPENAI_API_KEY,
      });
      const parsed = extractJson(text);
      if (parsed && parsed.confidence > 40 && parsed.title) {
        console.log(`[MCP identify_product] AI ASIN identified: "${parsed.title}" by ${parsed.brand} (confidence: ${parsed.confidence})`);
        return {
          title: parsed.title,
          brand: parsed.brand || null,
          category: parsed.category || 'General',
          subcategory: parsed.subcategory || '',
          price: parsed.price || null,
          currency: 'USD',
          keywords: parsed.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2).slice(0, 10),
          searchQueries: parsed.searchQueries || [parsed.title],
          confidence: Math.min(parsed.confidence, 85),
          source: 'ai_asin' as const,
        };
      }
    } catch (e: any) { console.warn('[MCP identify_product] AI ASIN failed:', e?.message); }
  }

  // Strategy 2b: URL slug extraction for Amazon
  if (isAmazon && asinMatch) {
    const slugMatch = new URL(url).pathname.match(/\/([^/]{5,})\/dp\//i);
    if (slugMatch) {
      const title = slugMatch[1].split('-').filter(w => w.length > 1).join(' ');
      if (title.length > 10) {
        // Enrich slug with AI to extract subcategory, brand, and category
        if (env?.OPENAI_API_KEY) {
          try {
            const { aiComplete, extractJson } = await import('../services/ai-client');
            const amazonDomain = detectAmazonDomain(url);
            const aiResult = await aiComplete({
              prompt: `This product slug was extracted from ${amazonDomain}: "${title}"
Identify the product type, brand, and category.
Return ONLY JSON: {"brand": "brand name or null", "product": "product name without brand", "category": "Electronics|Fashion|Home & Garden|Beauty & Health|Sports & Outdoors", "subcategory": "specific product type like 'over-ear noise cancelling headphones' or 'moisturizing face cream'"}`,
              maxTokens: 100, temperature: 0, apiKey: env.OPENAI_API_KEY,
            });
            const parsed = extractJson(aiResult);
            if (parsed) {
              console.log(`[MCP identify_product] AI slug enrichment: brand="${parsed.brand}", sub="${parsed.subcategory}", cat="${parsed.category}"`);
              const enrichedProduct = buildIdentifiedProduct(
                parsed.product || title, parsed.brand || null,
                parsed.category || null, null, 'USD', 'url_slug'
              );
              if (parsed.subcategory) enrichedProduct.subcategory = parsed.subcategory;
              return enrichedProduct;
            }
          } catch (e: any) { console.warn('[MCP identify_product] AI slug enrichment failed:', e?.message); }
        }
        return buildIdentifiedProduct(title, null, null, null, 'USD', 'url_slug');
      }
    }
  }

  // Strategy 2b: Generic URL slug parser for non-Amazon sites (e.g. Revolve, ASOS, EU shops, Shopify)
  // Handles EU patterns (/produkt/, /produit/, /prodotto/, /producto/) and Shopify (/products/)
  if (!isAmazon) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);

      // EU/Shopify-specific path markers — the product slug follows immediately after
      const EU_PRODUCT_MARKERS = ['products', 'produkt', 'produit', 'prodotto', 'producto', 'produkte'];
      const markerIdx = segments.findIndex(s => EU_PRODUCT_MARKERS.includes(s.toLowerCase()));
      const markerSlug = markerIdx >= 0 ? segments[markerIdx + 1] : undefined;

      // Fall back to the longest hyphenated segment that isn't a pure ID
      const genericSlug = segments
        .filter(s => s.includes('-') && s.length > 15 && !/^[A-Z0-9-]{6,15}$/.test(s))
        .sort((a, b) => b.length - a.length)[0];

      const slugCandidate = markerSlug || genericSlug;

      if (slugCandidate) {
        const words = slugCandidate.split('-').filter(w => w.length > 1 && !/^\d+$/.test(w));
        const title = words.join(' ');
        if (title.length > 10 && words.length >= 3) {
          console.log(`[MCP identify_product] Generic slug extracted: "${title}" from ${parsed.hostname}`);
          // Use AI to parse brand vs product from the slug (e.g. "song of style" is the brand, "naara cable crew pullover" is the product)
          if (env?.OPENAI_API_KEY) {
            try {
              const { aiComplete, extractJson } = await import('../services/ai-client');
              const aiResult = await aiComplete({
                prompt: `This product slug was extracted from ${parsed.hostname}: "${title}"
Separate the brand name from the product description.
Return ONLY JSON: {"brand": "brand name or null", "product": "product description without brand", "category": "Fashion|Beauty & Health|Electronics|Home & Garden|Sports & Outdoors|Health & Nutrition|Sports Nutrition"}
Note: Sports supplements, vitamins, and nutrition products should be "Health & Nutrition" or "Sports Nutrition", NOT "Sports & Outdoors".`,
                maxTokens: 80, temperature: 0, apiKey: env.OPENAI_API_KEY,
              });
              const parsed2 = extractJson(aiResult);
              if (parsed2?.product) {
                console.log(`[MCP identify_product] AI slug parse: brand="${parsed2.brand}", product="${parsed2.product}"`);
                return buildIdentifiedProduct(
                  parsed2.product, parsed2.brand || null,
                  parsed2.category || null, null, 'USD', 'url_slug'
                );
              }
            } catch (e: any) { console.warn('[MCP identify_product] AI slug parse failed:', e?.message || e); }
          }
          return buildIdentifiedProduct(title, null, null, null, 'USD', 'url_slug');
        }
      }
    } catch (e) { /* invalid URL, fall through */ }
  }

  // Strategy 3: Scrape the product page (works for ANY URL)
  let scrapeFailed = false;
  try {
    const cleanUrl = isAmazon && asinMatch ? `https://www.amazon.com/dp/${asinMatch[1]}` : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (pageRes.ok) {
      const finalUrl = pageRes.url || cleanUrl;
      const html = await pageRes.text();
      const title = extractTitleFromHtml(html);
      const price = extractPriceFromHtml(html);

      // Detect affiliate network landing pages even when no redirect occurred
      if (title && isGarbageTitle(title)) {
        console.log(`[MCP identify_product] Scraped title is affiliate network page: "${title}"`);
        return {
          title: '', brand: null, category: 'General', subcategory: '',
          price: null, currency: 'USD', keywords: [], searchQueries: [],
          confidence: 0, source: 'scrape' as const,
        };
      }

      // Also check if final URL landed on a known affiliate network site
      if (finalUrl !== cleanUrl) {
        try {
          const finalHostname = new URL(finalUrl).hostname.replace(/^www\./, '');
          const AFFILIATE_NETWORK_SITES = [
            'cj.com', 'commission-junction.com', 'rakuten.com', 'shareasale.com',
            'impact.com', 'awin.com', 'partnerize.com', 'pepperjam.com',
            'skimlinks.com', 'tradedoubler.com',
          ];
          if (AFFILIATE_NETWORK_SITES.some(d => finalHostname === d || finalHostname.endsWith('.' + d))) {
            console.log(`[MCP identify_product] Redirected to affiliate network site: ${finalHostname}`);
            return {
              title: '', brand: null, category: 'General', subcategory: '',
              price: null, currency: 'USD', keywords: [], searchQueries: [],
              confidence: 0, source: 'scrape' as const,
            };
          }
        } catch {}
      }

      if (title && title.length > 10) {
        // Apply domain-based brand/category hints for DTC sites
        const domainHints = getDomainHints(cleanUrl);
        const brand = domainHints?.brand || null;
        const category = domainHints?.category || null;
        const sanitizedPrice = sanitizePrice(price, title, category || inferCategory(title));
        return buildIdentifiedProduct(title, brand, category, sanitizedPrice, 'USD', 'scrape');
      }
      scrapeFailed = true;
    } else {
      scrapeFailed = true;
    }
  } catch (e: any) {
    scrapeFailed = true;
    if (e?.name !== 'AbortError') console.warn('[MCP identify_product] Scrape failed:', e?.message);
  }

  // Strategy 3b: Cloudflare Browser Rendering (for JS-heavy pages)
  // Uses the BROWSER binding to render the page with a headless browser,
  // then extracts product info from the fully rendered HTML.
  if (scrapeFailed && env?.BROWSER) {
    try {
      const puppeteer = await import('@cloudflare/puppeteer');
      const browser = await puppeteer.default.launch(env.BROWSER);
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      const html = await page.content();
      await browser.close();

      const title = extractTitleFromHtml(html);
      const price = extractPriceFromHtml(html);
      if (title && title.length > 10) {
        console.log(`[MCP identify_product] Browser Rendering extracted: "${title}" (price: ${price})`);
        return buildIdentifiedProduct(title, null, null, price, 'USD', 'scrape');
      }
      console.warn('[MCP identify_product] Browser Rendering: page rendered but no title found');
    } catch (e: any) {
      console.warn('[MCP identify_product] Browser Rendering failed:', e?.message || e);
    }
  } else if (scrapeFailed && !env?.BROWSER) {
    console.log('[MCP identify_product] No BROWSER binding — skipping Browser Rendering (local dev)');
  }

  // Strategy 4: AI analysis of URL structure
  if (env.OPENAI_API_KEY) {
    try {
      const { aiComplete, extractJson } = await import('../services/ai-client');
      const text = await aiComplete({
        prompt: `Analyze this product URL and identify what product it is:
URL: ${url}

If you can identify the product, return JSON with:
{"title": "full product name", "brand": "brand or null", "category": "one of: Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors", "subcategory": "specific type", "price": null, "keywords": ["key", "words"], "searchQueries": ["2-4 word search query without brand", "alternative query"], "confidence": 0-100}

CRITICAL: searchQueries must describe the PRODUCT TYPE specifically (e.g. "cable knit pullover", "retro square sunglasses", "dry texture hair spray") — never generic category words.
If you can't identify it, set confidence to 0.`,
        maxTokens: 300,
        temperature: 0,
        apiKey: env.OPENAI_API_KEY,
      });
      const parsed = extractJson(text);
      if (parsed && parsed.confidence > 30 && parsed.title) {
        return {
          title: parsed.title,
          brand: parsed.brand || null,
          category: parsed.category || 'General',
          subcategory: parsed.subcategory || '',
          price: parsed.price || null,
          currency: 'USD',
          keywords: parsed.keywords || [],
          searchQueries: parsed.searchQueries || [parsed.title],
          confidence: parsed.confidence,
          source: 'ai_url',
        };
      }
    } catch (e) { console.warn('[MCP identify_product] AI URL analysis failed:', e); }
  }

  // Strategy 5: Delegate to analyzeProductIntent as final fallback so both
  // identification paths share the same core AI logic and produce consistent results.
  try {
    const { analyzeProductIntent } = await import('../services/product-intent-analyzer');
    const intent = await analyzeProductIntent(url, env);
    if (intent.confidence > 30 && intent.searchQuery) {
      return {
        title: intent.searchQuery,
        brand: intent.brand || null,
        category: intent.category || 'General',
        subcategory: intent.subcategory || '',
        price: null,
        currency: 'USD',
        keywords: intent.keywords || [],
        searchQueries: [intent.searchQuery].filter(Boolean),
        confidence: intent.confidence,
        source: 'ai_url',
      };
    }
  } catch (e) {
    console.warn('[MCP identify_product] analyzeProductIntent fallback failed:', e);
  }

  return {
    title: '', brand: null, category: 'General', subcategory: '',
    price: null, currency: 'USD', keywords: [], searchQueries: [],
    confidence: 0, source: 'ai_url',
  };
}

// ─── Domain → Brand/Category Hints for DTC sites ────────────────────────────
// When scraping a DTC (direct-to-consumer) site, the HTML title often doesn't
// include the brand name. This map provides brand + category from the domain.

const DOMAIN_HINTS: Record<string, { brand: string; category: string }> = {
  'glossier.com':       { brand: 'Glossier',       category: 'Beauty & Health' },
  'tatcha.com':         { brand: 'Tatcha',         category: 'Beauty & Health' },
  'cerave.com':         { brand: 'CeraVe',         category: 'Beauty & Health' },
  'theordinary.com':    { brand: 'The Ordinary',   category: 'Beauty & Health' },
  'ffrfrench.com':      { brand: 'French',         category: 'Fashion' },
  'olaplex.com':        { brand: 'Olaplex',        category: 'Beauty & Health' },
  'moroccanoil.com':    { brand: 'Moroccanoil',     category: 'Beauty & Health' },
  'dyson.com':          { brand: 'Dyson',          category: 'Electronics' },
  'bose.com':           { brand: 'Bose',           category: 'Electronics' },
  'sonos.com':          { brand: 'Sonos',          category: 'Electronics' },
  'allbirds.com':       { brand: 'Allbirds',       category: 'Fashion' },
  'lululemon.com':      { brand: 'Lululemon',      category: 'Fashion' },
  'patagonia.com':      { brand: 'Patagonia',      category: 'Fashion' },
  'nike.com':           { brand: 'Nike',           category: 'Fashion' },
  'adidas.com':         { brand: 'Adidas',         category: 'Fashion' },
  'vegamour.com':       { brand: 'Vegamour',       category: 'Beauty & Health' },
  'supergoop.com':      { brand: 'Supergoop',      category: 'Beauty & Health' },
  'drunk-elephant.com': { brand: 'Drunk Elephant', category: 'Beauty & Health' },
  'glow-recipe.com':    { brand: 'Glow Recipe',    category: 'Beauty & Health' },
  'rare-beauty.com':    { brand: 'Rare Beauty',    category: 'Beauty & Health' },
  'fentybeauty.com':    { brand: 'Fenty Beauty',   category: 'Beauty & Health' },
  'charlottetilbury.com': { brand: 'Charlotte Tilbury', category: 'Beauty & Health' },
  'kitchenaid.com':     { brand: 'KitchenAid',     category: 'Home & Garden' },
  'yeti.com':           { brand: 'YETI',           category: 'Home & Garden' },
  'hydroflask.com':     { brand: 'Hydro Flask',    category: 'Home & Garden' },
  'stanley1913.com':    { brand: 'Stanley',        category: 'Home & Garden' },
};

function getDomainHints(url: string): { brand: string; category: string } | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return DOMAIN_HINTS[hostname] || null;
  } catch {
    return null;
  }
}

// ─── Price Sanitization ──────────────────────────────────────────────────────
// Scraped prices from structured data can be wildly wrong (e.g. Glossier returns
// $1900 for a $14 lip balm because JSON-LD has a schema variant price). Apply
// category-based caps to reject obviously-wrong prices.

const CATEGORY_PRICE_CAPS: Record<string, number> = {
  'beauty': 500,
  'skincare': 500,
  'hair': 400,
  'lip': 200,
  'balm': 200,
  'nail': 200,
  'makeup': 500,
  'cosmetics': 500,
  'personal care': 300,
  'fragrance': 800,
  'health': 500,
  'fashion': 5000,
  'clothing': 3000,
  'shoes': 3000,
  'accessories': 5000,
  'home': 10000,
  'kitchen': 5000,
  'garden': 5000,
  'toys': 1000,
  'pet': 500,
  'food': 500,
  'supplement': 300,
  'nutrition': 300,
};

function sanitizePrice(price: number | null, title: string, category: string): number | null {
  if (price == null || price <= 0) return price;

  // Universal sanity cap: individual consumer products rarely exceed $10,000
  if (price > 10000) {
    console.log(`[MCP sanitizePrice] Rejected $${price} for "${title}" — exceeds universal cap`);
    return null;
  }

  // Check against category-specific caps using both category and title keywords
  const searchText = `${category} ${title}`.toLowerCase();
  for (const [keyword, cap] of Object.entries(CATEGORY_PRICE_CAPS)) {
    if (searchText.includes(keyword) && price > cap) {
      console.log(`[MCP sanitizePrice] Rejected $${price} for "${title}" — exceeds ${keyword} cap of $${cap}`);
      return null;
    }
  }

  return price;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function cleanProductTitle(rawTitle: string): string {
  return decodeHtmlEntities(rawTitle)
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[-–]\s*(black|white|silver|blue|red|pink|gray|grey|gold)\s*$/i, '')
    .replace(/,\s*\d+\s*(pack|count|ct|pcs?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIdentifiedProduct(
  rawTitle: string, brand: string | null, categoryHint: string | null,
  price: number | null, currency: string, source: IdentifiedProduct['source']
): IdentifiedProduct {
  const title = cleanProductTitle(rawTitle);
  const keywords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 10);

  const brandName = brand || inferBrand(title);
  const category = categoryHint ? mapCategory(categoryHint) : inferCategory(title);

  const queryWithoutBrand = title.split(/\s+/)
    .filter(w => !brandName || !w.toLowerCase().startsWith(brandName.toLowerCase().split(' ')[0]))
    .slice(0, 6).join(' ');

  const shortQuery = title.split(/\s+/).slice(0, 4).join(' ');

  return {
    title,
    brand: brandName,
    category,
    subcategory: categoryHint || '',
    price,
    currency,
    keywords,
    searchQueries: [queryWithoutBrand, shortQuery].filter(q => q.length > 3),
    confidence: source === 'rainforest' ? 90 : source === 'scrape' ? 65 : 50,
    source,
  };
}

function extractTitleFromHtml(html: string): string | null {
  const patterns = [
    /id="productTitle"[^>]*>\s*([^<]+)/i,
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /"name"\s*:\s*"([^"]{10,200})"/,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].trim()
        .replace(/^Amazon\.\w+\s*:\s*/i, '')
        .replace(/\s*[-–|]\s*Amazon\.\w+.*$/i, '')
        .replace(/\s*[-–|]\s*REVOLVE.*$/i, '')
        .replace(/\s*[-–|]\s*Nordstrom.*$/i, '')
        .trim();
      if (cleaned.length > 10 && !isGarbageTitle(cleaned)) return cleaned;
    }
  }
  return null;
}

function extractPriceFromHtml(html: string): number | null {
  const patterns = [
    // JSON-LD / structured data
    /"price"\s*:\s*"?(\d+[.,]?\d*)"?/i,
    /itemprop="price"\s+content="(\d+[.,]?\d*)"/i,
    /"offers"[^}]*"price"\s*:\s*"?(\d+[.,]?\d*)"?/i,
    // Meta tags (common on Shopify, European stores)
    /property="product:price:amount"\s+content="(\d+[.,]?\d*)"/i,
    /property="og:price:amount"\s+content="(\d+[.,]?\d*)"/i,
    // European price formats: €29,90 or 29,90 € or EUR 29.90
    /(\d+[.,]\d{2})\s*€/,
    /€\s*(\d+[.,]\d{2})/,
    /EUR\s*(\d+[.,]\d{2})/i,
    // CSS class patterns
    /class="[^"]*price[^"]*"[^>]*>\s*[€$£]?\s*([\d.,]+)/i,
    /class="[^"]*product-price[^"]*"[^>]*>\s*[€$£]?\s*([\d.,]+)/i,
    /data-price="(\d+[.,]?\d*)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      // Handle European comma-as-decimal: "29,90" → 29.90
      let priceStr = match[1];
      if (/^\d+,\d{2}$/.test(priceStr)) {
        priceStr = priceStr.replace(',', '.');
      } else {
        priceStr = priceStr.replace(/,/g, '');
      }
      const price = parseFloat(priceStr);
      if (price > 0 && price < 100000) return price;
    }
  }
  return null;
}

function isGarbageTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return [/^amazon/, /^sign\s*in/, /^page\s*not/, /^404/, /^error/, /^robot\s*check/,
    /^captcha/, /^sorry/, /^just\s*a\s*moment/, /^online\s*shopping/,
    /^cj\s*affiliate/i, /^commission\s*junction/i, /^rakuten\s*(advertising|marketing)?$/i,
    /^shareasale/i, /^impact\s*(radius)?$/i, /^awin/i, /^partnerize/i, /^pepperjam/i,
    /^linksynergy/i, /^skimlinks/i, /^tradedoubler/i, /^webgains/i, /^flexoffers/i,
    /^affiliate\s*(network|program|marketing|platform)/i,
  ]
    .some(rx => rx.test(lower));
}

// inferBrand, inferCategory, mapCategory are imported from '../utils/product-inference'

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 3: search_alternatives
// ═══════════════════════════════════════════════════════════════════════════════

export interface SearchAlternativesResult {
  products: SearchCandidate[];
  error?: string;
}

export async function searchAlternatives(
  query: string,
  options: {
    priceMin?: number;
    priceMax?: number;
    inStockOnly?: boolean;
    limit?: number;
    sourceNames?: string[];
    excludeBrands?: string[];
  },
  env: Env
): Promise<SearchAlternativesResult> {
  const { searchDatafeedr, convertToAlternativeProduct } = await import('../services/datafeedr-client');

  const accessId = env.DATAFEEDR_ACCESS_ID;
  const secretKey = env.DATAFEEDR_SECRET_KEY;
  if (!accessId || !secretKey) return { products: [], error: 'Datafeedr credentials not configured' };

  const priceMinCents = options.priceMin !== undefined ? Math.round(options.priceMin * 100) : undefined;
  const priceMaxCents = options.priceMax !== undefined ? Math.round(options.priceMax * 100) : undefined;

  try {
    const response = await searchDatafeedr(
      {
        query,
        source_names: options.sourceNames?.length ? options.sourceNames : undefined,
        price_min: priceMinCents,
        price_max: priceMaxCents,
        limit: options.limit || 100,
        in_stock: options.inStockOnly !== false,
      },
      accessId,
      secretKey
    );

    let candidates = (response.products || []).map((p: any) => {
      const alt = convertToAlternativeProduct(p);
      return {
        id: String(p._id || alt.id),
        name: alt.name,
        brand: alt.brand || p.merchant || '',
        category: alt.category || '',
        price: alt.price || 0,
        currency: alt.currency || 'USD',
        imageUrl: alt.imageUrl,
        description: alt.description,
        merchant: alt.merchant || p.merchant || '',
        affiliateNetwork: alt.affiliateNetwork || p.network || '',
        affiliateUrl: alt.url,
        directUrl: alt.directUrl,
        inStock: alt.inStock,
      } satisfies SearchCandidate;
    });

    if (options.excludeBrands?.length) {
      const excluded = new Set(options.excludeBrands.map(b => b.toLowerCase()));
      candidates = candidates.filter((c: SearchCandidate) =>
        !excluded.has(c.brand.toLowerCase()) && !excluded.has(c.merchant.toLowerCase())
      );
    }

    return { products: candidates };
  } catch (e) {
    console.error('[MCP search_alternatives] Datafeedr search failed:', e);
    return { products: [], error: 'Product database temporarily unavailable' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 4: score_candidate
// ═══════════════════════════════════════════════════════════════════════════════

export async function scoreCandidate(
  candidate: SearchCandidate,
  originalProduct: IdentifiedProduct,
  profile: CreatorProfile,
  semanticScore: number,
  env: Env
): Promise<ScoredAlternative> {
  const { enrichStatic } = await import('../services/enrichment');
  const { computeAllProductKpis, computeAllBrandKpis, computeWeightedPriorityScore } = await import('../services/priority-kpi-specs');
  const { scoreOutcomeFeasibility, canRecommendProduct } = await import('../services/outcome-feasibility-scorer');
  const generateReasonCodes = (product: any, _ctx: any) => {
    const codes: Array<{ code: string }> = [];
    if ((product.commissionRate || 0) > 5) codes.push({ code: 'high_commission' });
    if ((product.rating || 0) >= 4.5) codes.push({ code: 'top_rated' });
    if (product.inStock === true) codes.push({ code: 'in_stock' });
    if ((product.cookieDurationDays || 0) >= 30) codes.push({ code: 'long_cookie' });
    return { codes, summary: codes.map((c: { code: string }) => c.code.replace(/_/g, ' ')).join(', ') || 'alternative product' };
  };

  const signals = enrichStatic({
    name: candidate.name, brand: candidate.brand, category: candidate.category,
    price: candidate.price, currency: candidate.currency, affiliateNetwork: candidate.affiliateNetwork,
    merchant: candidate.merchant, inStock: candidate.inStock, imageUrl: candidate.imageUrl,
    description: candidate.description, directUrl: candidate.directUrl, affiliateUrl: candidate.affiliateUrl,
  });

  // Derive the original product's expected commission baseline (by its category/network)
  // so betterCommission compares against the actual baseline, not a hardcoded 3%.
  const originalSignals = enrichStatic({
    name: originalProduct.title, brand: originalProduct.brand || '',
    category: originalProduct.category, price: originalProduct.price || 0,
    currency: originalProduct.currency, affiliateNetwork: '', merchant: originalProduct.brand || '',
    inStock: true,
  });
  const originalCommissionBaseline = originalSignals.commissionRate ?? 5;

  const productKpis = computeAllProductKpis(signals, profile.productPriorities);
  const brandKpis = computeAllBrandKpis(signals, profile.brandPriorities);
  const productPriorityScore = profile.productPriorities.length > 0
    ? computeWeightedPriorityScore(signals, profile.productPriorities) : 50;
  const brandPriorityScore = profile.brandPriorities.length > 0
    ? computeWeightedPriorityScore(signals, profile.brandPriorities) : 50;

  const feasibility = await scoreOutcomeFeasibility({
    name: candidate.name, brand: candidate.brand, category: candidate.category,
    price: candidate.price, currency: candidate.currency, affiliateNetwork: candidate.affiliateNetwork,
    merchantName: candidate.merchant, rating: signals.rating, reviewCount: signals.reviewCount,
    availability: candidate.inStock ? 'in_stock' : 'unknown',
    commissionRate: signals.commissionRate, cookieDuration: signals.cookieDurationDays,
  }, env);

  const priorityWeightedScore = Math.round(productPriorityScore * 0.65 + brandPriorityScore * 0.35);

  // Semantic similarity is the strongest signal — a product with 90% semantic match
  // that has unknown brand data (50 priority score) is still a good result.
  // Weight semantic higher when priority data is sparse (low-confidence enrichment).
  const hasRichEnrichment = (signals.commissionRate !== undefined && signals.commissionRate > 0)
    || (signals.rating !== undefined && signals.rating > 0);
  const semWeight = hasRichEnrichment ? 0.30 : 0.40;
  const priWeight = hasRichEnrichment ? 0.40 : 0.30;
  const feaWeight = 0.30;

  const baseScore = semanticScore * semWeight + priorityWeightedScore * priWeight + feasibility.overall * feaWeight;
  const stockBonus = candidate.inStock === true ? 8 : candidate.inStock === false ? -5 : 0;

  // Priority #1 boost: if the user's top priority KPI is strong (>=70), add a
  // bonus proportional to how strong it is. This ensures that a Caudalie with
  // q=97 ranks above a TOZO with q=40 when quality is the user's #1 priority.
  let priority1Bonus = 0;
  if (productKpis.length > 0) {
    const topKpi = productKpis[0];
    if (topKpi.score >= 70) {
      priority1Bonus = Math.round((topKpi.score - 50) * 0.08);
    }
  }

  const combinedScore = Math.min(100, Math.max(0, Math.round(baseScore + stockBonus + priority1Bonus)));

  const priceDiff = originalProduct.price && candidate.price
    ? ((candidate.price - originalProduct.price) / originalProduct.price * 100).toFixed(0) + '%'
    : 'unknown';

  const reasons = generateReasonCodes(
    { id: candidate.id, name: candidate.name, brand: candidate.brand, category: candidate.category,
      price: candidate.price, currency: candidate.currency, rating: signals.rating,
      reviewCount: signals.reviewCount, commissionRate: signals.commissionRate,
      cookieDurationDays: signals.cookieDurationDays, affiliateNetwork: candidate.affiliateNetwork,
      merchant: candidate.merchant, matchScore: priorityWeightedScore,
      outcomeFeasibility: feasibility.overall, inStock: candidate.inStock,
      requiresVerification: feasibility.requiresVerification, productPriorityKpis: productKpis },
    { intentCategory: originalProduct.category, intentSubcategory: originalProduct.subcategory,
      userTopBrands: profile.storefrontContext.topBrands,
      userAvgPricePoint: profile.storefrontContext.avgPricePoint,
      userDominantCategories: profile.storefrontContext.dominantCategories.map(d => d.category) },
  );

  return {
    ...candidate,
    semanticSimilarity: semanticScore,
    productKpis,
    brandKpis,
    priorityWeightedScore,
    outcomeFeasibility: feasibility.overall,
    combinedScore,
    reasonCodes: reasons.codes.map((c: { code: string }) => c.code),
    reasonSummary: reasons.summary,
    warnings: feasibility.warnings || [],
    comparisonToOriginal: {
      priceDiff,
      categoryMatch: originalProduct.category === 'General' ||
        candidate.category.toLowerCase().includes(originalProduct.category.toLowerCase()) ||
        originalProduct.category.toLowerCase().includes(candidate.category.toLowerCase()) ||
        categoriesInSameGroup(candidate.category, originalProduct.category),
      sameBrand: !!originalProduct.brand && candidate.brand.toLowerCase().includes(originalProduct.brand.toLowerCase()),
      betterCommission: (signals.commissionRate || 0) > originalCommissionBaseline,
      betterForPriority1: productKpis[0]?.score >= 60,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 5: compute_semantic_scores (batch)
// ═══════════════════════════════════════════════════════════════════════════════

export async function computeSemanticScores(
  queryText: string,
  candidates: Array<{ id: string; name: string; brand?: string; category?: string; description?: string }>,
  env: Env
): Promise<Map<string, number>> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return new Map();

  try {
    // Use OpenAI embeddings for semantic reranking
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const texts = candidates.map(c => `${c.name} ${c.brand || ''} ${c.category || ''}`.trim());
    const [queryEmb, ...candidateEmbs] = await Promise.all([
      client.embeddings.create({ model: 'text-embedding-3-small', input: queryText }).then(r => r.data[0].embedding),
      ...texts.map(t => client.embeddings.create({ model: 'text-embedding-3-small', input: t }).then(r => r.data[0].embedding)),
    ]);
    const scores = new Map<string, number>();
    const cosineSim = (a: number[], b: number[]) => {
      const dot = a.reduce((s, v, i) => s + v * b[i], 0);
      const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
      return na && nb ? dot / (na * nb) : 0;
    };
    candidates.forEach((c, i) => {
      const sim = cosineSim(queryEmb, candidateEmbs[i]);
      scores.set(c.id, Math.round(((sim + 1) / 2) * 100));
    });
    return scores;
  } catch (e) {
    console.warn('[MCP compute_semantic_scores] Embedding failed, using keyword fallback:', e);
    const scores = new Map<string, number>();
    const keywords = queryText.split(' ');
    for (const c of candidates) {
      const text = `${c.name || ''} ${c.brand || ''} ${c.category || ''} ${c.description || ''}`.toLowerCase();
      const matches = keywords.filter((kw: string) => text.includes(kw.toLowerCase())).length;
      scores.set(c.id, keywords.length > 0 ? Math.round((matches / keywords.length) * 100) : 50);
    }
    return scores;
  }
}

function categoriesInSameGroup(catA: string, catB: string): boolean {
  const a = catA.toLowerCase();
  const b = catB.toLowerCase();
  const groups: string[][] = [
    ['beauty', 'health', 'personal care', 'skincare', 'makeup', 'hair', 'cosmetics', 'fragrance'],
    ['fashion', 'clothing', 'apparel', 'shoes', 'accessories', 'jewelry', 'sunglasses'],
    ['electronics', 'audio', 'computers', 'phones', 'cameras', 'gaming', 'smart home'],
    ['home', 'garden', 'furniture', 'kitchen', 'bedding', 'bath', 'decor'],
    ['sports', 'fitness', 'outdoors', 'exercise'],
  ];
  for (const group of groups) {
    const aIn = group.some(kw => a.includes(kw));
    const bIn = group.some(kw => b.includes(kw));
    if (aIn && bIn) return true;
  }
  return false;
}
