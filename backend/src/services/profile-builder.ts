/**
 * User Profile Builder
 * Builds creator profiles ONCE by analyzing socials, storefronts, and priorities
 * Profiles are cached and refreshed periodically
 */

import { aiComplete } from './ai-client';
import { analyzeMultipleNames, extractDominantCategories, ProductIntent } from './product-intent-analyzer';

export interface UserProfile {
  userId: string;

  // From onboarding priorities (already in DB)
  productPriorities: Array<{ id: string; rank: number; weightMultiplier?: number }>;
  brandPriorities: Array<{ id: string; rank: number }>;

  // From social analysis (build ONCE, refresh monthly)
  socialContext: {
    platforms: string[]; // ["youtube", "instagram"]
    contentCategories: string[]; // ["tech", "lifestyle", "gaming"]
    audienceDemographics: {
      ageRange: string; // "18-34"
      topCountries: string[]; // ["US", "UK", "DE"]
      interests: string[]; // ["technology", "gaming"]
    };
    estimatedReach: number; // 50000
  };

  // From storefront analysis (build ONCE, refresh weekly)
  storefrontContext: {
    dominantCategories: Array<{
      category: string; // "Electronics"
      percentage: number; // 0.65 (65% of products)
      avgCommission: number; // 4.5
    }>;
    topBrands: string[]; // ["Sony", "Apple", "Samsung"]
    avgPricePoint: number; // 299.99
    preferredNetworks: string[]; // ["amazon_de", "awin"]
  };

  // Metadata
  profileLastUpdated: string;
  socialLastAnalyzed: string | null;
  storefrontLastAnalyzed: string | null;
  confidenceScore: number; // 0-100
}

// AI client is initialized in ai-client.ts

/**
 * Build or refresh user profile
 */
export async function buildUserProfile(
  userId: string,
  env: any,
  forceRefresh = false
): Promise<UserProfile> {
  console.log(`[Profile Builder] Building profile for user ${userId}`);

  // Always try to load the cached profile first — we may need it as fallback
  const existingProfile = await getExistingProfile(userId, env);

  if (!forceRefresh && existingProfile && !isProfileStale(existingProfile)) {
    console.log('[Profile Builder] Using cached profile');
    return existingProfile;
  }

  // 1. Get priorities from DB (set during onboarding)
  const priorities = await getUserPriorities(userId, env);

  // 2. Analyze social accounts (ONCE, then monthly refresh)
  const socialContext = await analyzeSocialAccounts(userId, env);

  // 3. Analyze storefronts (ONCE, then weekly refresh)
  const storefrontContextOrNull = await analyzeStorefronts(userId, env);
  const storefrontContext = storefrontContextOrNull ?? { dominantCategories: [], topBrands: [], avgPricePoint: 0, preferredNetworks: [] };

  // 4. Calculate confidence score
  const confidenceScore = calculateProfileConfidence({
    hasPriorities: priorities.productPriorities.length > 0,
    hasSocials: socialContext.platforms.length > 0,
    hasStorefronts: storefrontContext.dominantCategories.length > 0,
  });

  // If the fresh build produced an empty profile but we have a cached one
  // with real data, prefer the cached version (Supabase may be unreachable)
  if (confidenceScore === 0 && existingProfile && existingProfile.confidenceScore > 0) {
    console.warn(
      `[Profile Builder] Fresh build returned empty (confidence=0) but cached profile has confidence=${existingProfile.confidenceScore}. ` +
      'Supabase queries likely failed. Returning cached profile.'
    );
    return existingProfile;
  }

  const profile: UserProfile = {
    userId,
    productPriorities: priorities.productPriorities,
    brandPriorities: priorities.brandPriorities,
    socialContext,
    storefrontContext,
    profileLastUpdated: new Date().toISOString(),
    socialLastAnalyzed: socialContext.platforms.length > 0 ? new Date().toISOString() : null,
    storefrontLastAnalyzed:
      storefrontContext.dominantCategories.length > 0 ? new Date().toISOString() : null,
    confidenceScore,
  };

  // Only persist if we actually gathered data — don't overwrite a good cache with empty data
  if (confidenceScore > 0) {
    await storeUserProfile(profile, env);
  } else {
    console.warn('[Profile Builder] Skipping DB write — empty profile would overwrite cached data');
  }

  console.log(`[Profile Builder] Profile complete. Confidence: ${confidenceScore}%`);
  return profile;
}

/**
 * Get existing profile from DB (via Supabase REST API)
 */
async function getExistingProfile(userId: string, env: any): Promise<UserProfile | null> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_product_profiles?user_id=eq.${userId}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    console.error(`[Profile Builder] Supabase profile fetch failed (${response.status}): ${errText}`);
    return null;
  }
  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : null;

  if (!result) return null;

  function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch {
      console.warn('[ProfileBuilder] Failed to parse JSON:', String(value).substring(0, 50));
      return fallback;
    }
  }

  // Reconstruct profile from DB
  return {
    userId: result.user_id,
    productPriorities: safeJsonParse(result.product_priorities, []),
    brandPriorities: safeJsonParse(result.brand_priorities, []),
    socialContext: {
      platforms: safeJsonParse(result.social_platforms, [] as string[]),
      contentCategories: safeJsonParse(result.content_categories, [] as string[]),
      audienceDemographics: safeJsonParse(result.audience_demographics, { ageRange: '', topCountries: [] as string[], interests: [] as string[] }),
      estimatedReach: result.estimated_reach || 0,
    },
    storefrontContext: {
      dominantCategories: safeJsonParse(result.dominant_categories, [] as Array<{ category: string; percentage: number; avgCommission: number }>),
      topBrands: safeJsonParse(result.top_brands, [] as string[]),
      avgPricePoint: result.avg_price_point || 0,
      preferredNetworks: safeJsonParse(result.preferred_networks, [] as string[]),
    },
    profileLastUpdated: result.updated_at,
    socialLastAnalyzed: result.last_social_analysis,
    storefrontLastAnalyzed: result.last_storefront_analysis,
    confidenceScore: result.confidence_score || 0,
  };
}

/**
 * Check if profile needs refresh
 */
function isProfileStale(profile: UserProfile): boolean {
  const now = new Date();
  const lastUpdated = new Date(profile.profileLastUpdated);
  const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  // Refresh social context monthly
  const socialStale = profile.socialLastAnalyzed
    ? (now.getTime() - new Date(profile.socialLastAnalyzed).getTime()) / (1000 * 60 * 60 * 24) > 30
    : true;

  // Refresh storefront context weekly
  const storefrontStale = profile.storefrontLastAnalyzed
    ? (now.getTime() - new Date(profile.storefrontLastAnalyzed).getTime()) / (1000 * 60 * 60 * 24) >
      7
    : true;

  return daysSinceUpdate > 7 || socialStale || storefrontStale;
}

/**
 * Get user priorities from Supabase
 */
async function getUserPriorities(userId: string, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Profile Builder] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return { productPriorities: [], brandPriorities: [] };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_creator_preferences?user_id=eq.${userId}&select=product_priorities,brand_priorities`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      console.error(`[Profile Builder] Supabase priorities query failed (${response.status}): ${errText}`);
      return { productPriorities: [], brandPriorities: [] };
    }

    const data = await response.json();
    const prefs = Array.isArray(data) ? data[0] : null;

    if (prefs) {
      console.log(`[Profile Builder] Loaded priorities: ${prefs.product_priorities?.length || 0} product, ${prefs.brand_priorities?.length || 0} brand`);
    } else {
      console.warn(`[Profile Builder] No preferences found for user ${userId}`);
    }

    return {
      productPriorities: prefs?.product_priorities || [],
      brandPriorities: prefs?.brand_priorities || [],
    };
  } catch (err: any) {
    console.error(`[Profile Builder] Failed to fetch priorities: ${err?.message || err}`);
    return { productPriorities: [], brandPriorities: [] };
  }
}

/**
 * Analyze user's connected social accounts.
 * Queries `user_social_links` (populated during magic onboarding from Linktree scan).
 */
async function analyzeSocialAccounts(userId: string, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_social_links?user_id=eq.${userId}&select=platform,url,display_name,follower_count`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    console.error(`[Profile Builder] Supabase socials fetch failed (${response.status}): ${errText}`);
    return { platforms: [], contentCategories: [], audienceDemographics: { ageRange: '', topCountries: [], interests: [] }, estimatedReach: 0 };
  }
  const socials = await response.json();

  if (!Array.isArray(socials) || socials.length === 0) {
    console.log('[Profile Builder] No social accounts connected');
    return {
      platforms: [],
      contentCategories: [],
      audienceDemographics: { ageRange: '', topCountries: [], interests: [] },
      estimatedReach: 0,
    };
  }

  console.log(`[Profile Builder] Found ${socials.length} social accounts`);

  const { analyzeSocialAccountsLightweight } = await import('./lightweight-social-analyzer');

  const accounts = socials.map((s: any) => ({
    platform: s.platform,
    accountIdentifier: extractAccountIdentifier(s.url, s.platform),
    followerCount: s.follower_count,
    bio: undefined,
    displayName: s.display_name,
  }));

  const analysis = await analyzeSocialAccountsLightweight(accounts);

  console.log(`[Profile Builder] Social analysis complete. Confidence: ${analysis.confidenceLevel}`);
  console.log(`[Profile Builder] Content categories: ${analysis.contentCategories.join(', ')}`);

  return {
    platforms: analysis.platforms,
    contentCategories: analysis.contentCategories,
    audienceDemographics: analysis.audienceDemographics,
    estimatedReach: analysis.estimatedReach,
  };
}

/**
 * Extract a username/handle from a social URL for analysis.
 * e.g. "https://youtube.com/@SheaWhitney" → "SheaWhitney"
 */
function extractAccountIdentifier(url: string, platform: string): string {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    const lastSegment = pathname.split('/').pop() || '';
    return lastSegment.replace(/^@/, '');
  } catch {
    return url;
  }
}

/**
 * Infer content categories from social account names (basic MVP approach)
 */
async function inferContentCategories(socials: any[]): Promise<string[]> {
  const accountNames = socials.map(s => s.account_identifier || '').join(', ');

  if (!accountNames) return [];

  try {
    const prompt = `These are social media account identifiers for a creator:
${accountNames}

Based on the account names/handles, infer 2-4 broad content categories they likely create content about.

Choose from: Electronics, Fashion, Beauty, Gaming, Tech, Lifestyle, Fitness, Food, Travel, Home Decor, Parenting, Finance, DIY, Music, Art

Return only category names, comma-separated. Be concise.`;

    const text = await aiComplete({ prompt, maxTokens: 100 });
    if (text) {
      return text
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
  } catch (error) {
    console.error('[Profile Builder] Failed to infer categories:', error);
  }

  return ['Lifestyle']; // Fallback
}

/**
 * Analyze user's storefronts to understand product mix.
 * Uses two tables populated during magic onboarding:
 *   - `user_storefronts`          — storefront platform + URL (e.g. Amazon, LTK)
 *   - `user_storefront_products`  — individual products found on those storefronts
 */
async function analyzeStorefronts(userId: string, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  // 1. Get storefronts (platform info + URLs)
  const storefrontsRes = await fetch(
    `${supabaseUrl}/rest/v1/user_storefronts?user_id=eq.${userId}&select=platform,storefront_url,display_name`,
    { headers }
  );
  if (!storefrontsRes.ok) {
    const errText = await storefrontsRes.text().catch(() => 'unknown');
    console.error(`[Profile Builder] Supabase storefronts fetch failed (${storefrontsRes.status}): ${errText}`);
    return null;
  }
  const storefronts = await storefrontsRes.json();

  // 2. Get storefront products (titles, brands, prices, categories)
  const productsRes = await fetch(
    `${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=title,brand,category,current_price,platform,product_url&limit=100`,
    { headers }
  );
  if (!productsRes.ok) {
    const errText = await productsRes.text().catch(() => 'unknown');
    console.error(`[Profile Builder] Supabase products fetch failed (${productsRes.status}): ${errText}`);
    return null;
  }
  const products = await productsRes.json();

  const hasStorefronts = Array.isArray(storefronts) && storefronts.length > 0;
  const hasProducts = Array.isArray(products) && products.length > 0;

  if (!hasStorefronts && !hasProducts) {
    console.log('[Profile Builder] No storefront data available');
    return {
      dominantCategories: [],
      topBrands: [],
      avgPricePoint: 0,
      preferredNetworks: [],
    };
  }

  console.log(`[Profile Builder] Found ${(storefronts as any[])?.length || 0} storefronts, ${(products as any[])?.length || 0} products`);

  // 3. Extract preferred networks from storefronts
  const preferredNetworks: string[] = [];
  if (hasStorefronts) {
    for (const sf of storefronts as any[]) {
      if (sf.platform && !preferredNetworks.includes(sf.platform)) {
        preferredNetworks.push(sf.platform);
      }
    }
  }

  if (!hasProducts) {
    return {
      dominantCategories: [],
      topBrands: [],
      avgPricePoint: 0,
      preferredNetworks,
    };
  }

  const productList = products as any[];

  // 4. Categorize products — use existing category if available, else analyze by title
  const productsNeedingAnalysis = productList.filter(
    (p: any) => !p.category && p.title && p.title.length > 3
  );
  const productsWithCategory = productList.filter((p: any) => p.category);

  let intents: ProductIntent[] = [];
  if (productsNeedingAnalysis.length > 0) {
    const titles = productsNeedingAnalysis.map((p: any) => p.title);
    intents = await analyzeMultipleNames(titles, env);
  }

  // Merge: products that already have a category + AI-analyzed ones
  const allCategories: string[] = [];
  for (const p of productsWithCategory) {
    allCategories.push(p.category);
  }
  for (const intent of intents) {
    allCategories.push(intent.category);
  }

  // 5. Calculate dominant categories
  const categoryCounts = new Map<string, number>();
  for (const cat of allCategories) {
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const totalCategorized = allCategories.length || 1;
  const dominantCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      percentage: count / totalCategorized,
      avgCommission: 5.0,
    }));

  // 6. Extract top brands from products + intents
  const brandCounts = new Map<string, number>();
  for (const p of productList) {
    if (p.brand) {
      brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    }
  }
  for (const intent of intents) {
    if (intent.brand) {
      brandCounts.set(intent.brand, (brandCounts.get(intent.brand) || 0) + 1);
    }
  }
  const topBrands = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand]) => brand);

  // 7. Calculate average price point from products that have prices
  const pricedProducts = productList.filter((p: any) => {
    const price = parseFloat(p.current_price);
    return !isNaN(price) && price > 0;
  });
  const avgPricePoint = pricedProducts.length > 0
    ? pricedProducts.reduce((sum: number, p: any) => sum + parseFloat(p.current_price), 0) / pricedProducts.length
    : 0;

  console.log(`[Profile Builder] Storefront analysis: ${dominantCategories.length} categories, ${topBrands.length} brands, avg price: ${avgPricePoint.toFixed(2)}, networks: [${preferredNetworks.join(', ')}]`);

  return {
    dominantCategories,
    topBrands,
    avgPricePoint,
    preferredNetworks,
  };
}

/**
 * Calculate profile confidence score
 */
function calculateProfileConfidence(factors: {
  hasPriorities: boolean;
  hasSocials: boolean;
  hasStorefronts: boolean;
}): number {
  let score = 0;

  if (factors.hasPriorities) score += 40; // Most important
  if (factors.hasSocials) score += 30;
  if (factors.hasStorefronts) score += 30;

  return score;
}

/**
 * Store profile in database
 */
async function storeUserProfile(profile: UserProfile, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  const payload = {
    user_id: profile.userId,
    product_priorities: JSON.stringify(profile.productPriorities),
    brand_priorities: JSON.stringify(profile.brandPriorities),
    social_platforms: JSON.stringify(profile.socialContext.platforms),
    content_categories: JSON.stringify(profile.socialContext.contentCategories),
    audience_demographics: JSON.stringify(profile.socialContext.audienceDemographics),
    estimated_reach: profile.socialContext.estimatedReach,
    dominant_categories: JSON.stringify(profile.storefrontContext.dominantCategories),
    top_brands: JSON.stringify(profile.storefrontContext.topBrands),
    avg_price_point: profile.storefrontContext.avgPricePoint,
    preferred_networks: JSON.stringify(profile.storefrontContext.preferredNetworks),
    confidence_score: profile.confidenceScore,
    last_social_analysis: profile.socialLastAnalyzed,
    last_storefront_analysis: profile.storefrontLastAnalyzed,
    updated_at: new Date().toISOString(),
  };

  await fetch(`${supabaseUrl}/rest/v1/user_product_profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });

  console.log('[Profile Builder] Profile stored in database');
}
