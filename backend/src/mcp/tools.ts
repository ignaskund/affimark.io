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

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 1: get_creator_profile
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCreatorProfile(userId: string, env: any): Promise<CreatorProfile> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const [prefsRes, socialsRes, storefrontsRes, productsRes, profileRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/user_creator_preferences?user_id=eq.${userId}&select=product_priorities,brand_priorities`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_social_links?user_id=eq.${userId}&select=platform,url,display_name,follower_count`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_storefronts?user_id=eq.${userId}&select=platform,storefront_url,display_name`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=title,brand,category,current_price,platform,product_url&limit=100`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/user_product_profiles?user_id=eq.${userId}`, { headers }),
  ]);

  const [prefs, socials, storefronts, products, profiles] = await Promise.all([
    prefsRes.json(), socialsRes.json(), storefrontsRes.json(), productsRes.json(), profileRes.json(),
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
      contentCategories: profile ? JSON.parse(profile.content_categories || '[]') : [],
      audienceDemographics: profile ? JSON.parse(profile.audience_demographics || '{}') : { ageRange: '', topCountries: [], interests: [] },
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

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 2: identify_product
// ═══════════════════════════════════════════════════════════════════════════════

export async function identifyProduct(url: string, env: any): Promise<IdentifiedProduct> {
  const isAmazon = /amazon\.[a-z.]+/i.test(url);
  const asinMatch = url.match(/(?:\/dp\/|\/gp\/product\/|\/ASIN\/)([A-Z0-9]{10})/i);

  // Strategy 1: Rainforest API for Amazon
  if (isAmazon && asinMatch && env.RAINFOREST_API_KEY) {
    try {
      const asin = asinMatch[1];
      const rfRes = await fetch(
        `https://api.rainforestapi.com/request?api_key=${env.RAINFOREST_API_KEY}&type=product&asin=${asin}&amazon_domain=amazon.com`
      );
      if (rfRes.ok) {
        const data: any = await rfRes.json();
        const product = data?.product;
        if (product?.title) {
          return buildIdentifiedProduct(product.title, product.brand, product.categories?.[0]?.name,
            product.buybox_winner?.price?.value, product.buybox_winner?.price?.currency || 'USD', 'rainforest');
        }
      }
    } catch (e) { console.warn('[MCP identify_product] Rainforest failed:', e); }
  }

  // Strategy 2: URL slug extraction for Amazon
  if (isAmazon && asinMatch) {
    const slugMatch = new URL(url).pathname.match(/\/([^/]{5,})\/dp\//i);
    if (slugMatch) {
      const title = slugMatch[1].split('-').filter(w => w.length > 1).join(' ');
      if (title.length > 10) {
        return buildIdentifiedProduct(title, null, null, null, 'USD', 'url_slug');
      }
    }
  }

  // Strategy 2b: Generic URL slug parser for non-Amazon JS-heavy sites (e.g. Revolve, ASOS)
  // Works on patterns like /product-name-with-hyphens/dp/ID or /category/product-name-words/
  if (!isAmazon) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      // Find the longest path segment that looks like a product slug (has hyphens, not just an ID)
      const slugCandidate = segments
        .filter(s => s.includes('-') && s.length > 15 && !/^[A-Z0-9-]{6,15}$/.test(s))
        .sort((a, b) => b.length - a.length)[0];
      if (slugCandidate) {
        // Convert slug to title: "song-of-style-naara-cable-crew-pullover-in-brown" → proper title
        const words = slugCandidate.split('-').filter(w => w.length > 1 && !/^\d+$/.test(w));
        const title = words.join(' ');
        if (title.length > 10 && words.length >= 3) {
          console.log(`[MCP identify_product] Generic slug extracted: "${title}" from ${parsed.hostname}`);
          return buildIdentifiedProduct(title, null, null, null, 'USD', 'url_slug');
        }
      }
    } catch (e) { /* invalid URL, fall through */ }
  }

  // Strategy 3: Scrape the product page (works for ANY URL)
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
      const html = await pageRes.text();
      const title = extractTitleFromHtml(html);
      const price = extractPriceFromHtml(html);
      if (title && title.length > 10) {
        return buildIdentifiedProduct(title, null, null, price, 'USD', 'scrape');
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') console.warn('[MCP identify_product] Scrape failed:', e?.message);
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

  // Strategy 5: AI ASIN knowledge for Amazon
  if (isAmazon && asinMatch && env.OPENAI_API_KEY) {
    try {
      const { aiComplete, extractJson } = await import('../services/ai-client');
      const text = await aiComplete({
        prompt: `What Amazon product has ASIN ${asinMatch[1]}? Return JSON: {"title": "...", "brand": "...", "category": "...", "subcategory": "...", "searchQueries": ["2-4 word product type query"], "confidence": 0-100}. If unknown, set confidence to 0.`,
        maxTokens: 200,
        apiKey: env.OPENAI_API_KEY,
      });
      const parsed = extractJson(text);
      if (parsed && parsed.confidence > 30 && parsed.title) {
        return {
          title: parsed.title,
          brand: parsed.brand || null,
          category: parsed.category || 'General',
          subcategory: parsed.subcategory || '',
          price: null,
          currency: 'USD',
          keywords: [],
          searchQueries: parsed.searchQueries || [parsed.title],
          confidence: parsed.confidence,
          source: 'ai_asin',
        };
      }
    } catch (e) { console.warn('[MCP identify_product] AI ASIN failed:', e); }
  }

  return {
    title: '', brand: null, category: 'General', subcategory: '',
    price: null, currency: 'USD', keywords: [], searchQueries: [],
    confidence: 0, source: 'ai_url',
  };
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
    /"price"\s*:\s*"?(\d+\.?\d*)"?/i,
    /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,.]+)/i,
    /itemprop="price"\s+content="(\d+\.?\d*)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (price > 0 && price < 100000) return price;
    }
  }
  return null;
}

function isGarbageTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return [/^amazon/, /^sign\s*in/, /^page\s*not/, /^404/, /^error/, /^robot\s*check/,
    /^captcha/, /^sorry/, /^just\s*a\s*moment/, /^online\s*shopping/]
    .some(rx => rx.test(lower));
}

function inferBrand(title: string): string | null {
  const words = title.split(/\s+/).slice(0, 2);
  if (words.length === 0) return null;
  const candidate = words[0];
  if (candidate.length < 3 || /^\d/.test(candidate)) return null;
  const generic = new Set(['the', 'a', 'set', 'pack', 'new', 'best', 'top', 'women', 'men']);
  if (generic.has(candidate.toLowerCase())) return null;
  return candidate;
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  const map: Record<string, string[]> = {
    'Electronics': ['electronics', 'computers', 'phone', 'audio', 'headphone', 'camera', 'tv'],
    'Fashion': ['clothing', 'shoes', 'jewelry', 'watches', 'accessories', 'apparel', 'fashion', 'sweater', 'pullover', 'dress', 'jacket'],
    'Home & Garden': ['home', 'kitchen', 'garden', 'furniture', 'bedding', 'bath'],
    'Beauty & Health': ['beauty', 'health', 'personal care', 'skin', 'makeup', 'hair', 'vitamin'],
    'Sports & Outdoors': ['sports', 'outdoors', 'fitness', 'exercise'],
  };
  for (const [cat, kws] of Object.entries(map)) {
    if (kws.some(k => lower.includes(k))) return cat;
  }
  return 'General';
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  const rules: [string, string[]][] = [
    ['Beauty & Health', ['serum', 'moisturizer', 'lipstick', 'mascara', 'shampoo', 'conditioner', 'perfume', 'hair spray', 'texture spray', 'skincare', 'blush', 'foundation', 'sunscreen']],
    ['Electronics', ['headphones', 'earbuds', 'speaker', 'charger', 'bluetooth', 'camera', 'laptop', 'phone']],
    ['Fashion', ['dress', 'shirt', 'pullover', 'sweater', 'jacket', 'jeans', 'shoes', 'sneakers', 'boots', 'bag', 'handbag', 'sunglasses', 'cardigan', 'knit', 'cable crew']],
    ['Home & Garden', ['lamp', 'candle', 'pillow', 'rug', 'vase', 'pan', 'mug', 'organizer']],
    ['Sports & Outdoors', ['yoga', 'gym', 'fitness', 'running', 'hiking']],
  ];
  for (const [cat, kws] of rules) {
    if (kws.some(kw => lower.includes(kw))) return cat;
  }
  return 'General';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 3: search_alternatives
// ═══════════════════════════════════════════════════════════════════════════════

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
  env: any
): Promise<SearchCandidate[]> {
  const { searchDatafeedr, convertToAlternativeProduct } = await import('../services/datafeedr-client');

  const accessId = env.DATAFEEDR_ACCESS_ID;
  const secretKey = env.DATAFEEDR_SECRET_KEY;
  if (!accessId || !secretKey) return [];

  const priceMinCents = options.priceMin ? Math.round(options.priceMin * 100) : undefined;
  const priceMaxCents = options.priceMax ? Math.round(options.priceMax * 100) : undefined;

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

    return candidates;
  } catch (e) {
    console.error('[MCP search_alternatives] Datafeedr search failed:', e);
    return [];
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
  env: any
): Promise<ScoredAlternative> {
  const { enrichStatic } = await import('../services/enrichment');
  const { computeAllProductKpis, computeAllBrandKpis, computeWeightedPriorityScore } = await import('../services/priority-kpi-specs');
  const { scoreOutcomeFeasibility, canRecommendProduct } = await import('../services/outcome-feasibility-scorer');
  const { generateReasonCodes } = await import('../services/reason-code-engine');

  const signals = enrichStatic({
    name: candidate.name, brand: candidate.brand, category: candidate.category,
    price: candidate.price, currency: candidate.currency, affiliateNetwork: candidate.affiliateNetwork,
    merchant: candidate.merchant, inStock: candidate.inStock, imageUrl: candidate.imageUrl,
    description: candidate.description, directUrl: candidate.directUrl, affiliateUrl: candidate.affiliateUrl,
  });

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

  const baseScore = semanticScore * 0.35 + priorityWeightedScore * 0.35 + feasibility.overall * 0.30;
  const stockBonus = candidate.inStock === true ? 10 : candidate.inStock === false ? -10 : 0;
  const combinedScore = Math.min(100, Math.max(0, Math.round(baseScore + stockBonus)));

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
    reasonCodes: reasons.codes.map(c => c.code),
    reasonSummary: reasons.summary,
    warnings: feasibility.warnings || [],
    comparisonToOriginal: {
      priceDiff,
      categoryMatch: candidate.category.toLowerCase().includes(originalProduct.category.toLowerCase()) ||
        originalProduct.category.toLowerCase().includes(candidate.category.toLowerCase()) ||
        originalProduct.category === 'General',
      sameBrand: !!originalProduct.brand && candidate.brand.toLowerCase().includes(originalProduct.brand.toLowerCase()),
      betterCommission: (signals.commissionRate || 0) > 3,
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
  env: any
): Promise<Map<string, number>> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return new Map();

  try {
    const { semanticRerank } = await import('../services/semantic-ranker');
    return await semanticRerank(
      { searchQuery: queryText, category: undefined, subcategory: undefined, keywords: queryText.split(' '), brand: undefined },
      candidates,
      apiKey,
      Math.min(candidates.length, 150)
    );
  } catch (e) {
    console.warn('[MCP compute_semantic_scores] Failed:', e);
    const { keywordOverlapScore } = await import('../services/semantic-ranker');
    const scores = new Map<string, number>();
    const intent = { searchQuery: queryText, keywords: queryText.split(' ') };
    for (const c of candidates) {
      scores.set(c.id, keywordOverlapScore(intent, c));
    }
    return scores;
  }
}
