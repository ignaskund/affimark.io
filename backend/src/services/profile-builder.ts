/**
 * User Profile Builder
 * Builds creator profiles ONCE by analyzing socials, storefronts, and priorities
 * Profiles are cached and refreshed periodically
 */

import Anthropic from '@anthropic-ai/sdk';
import { analyzeMultipleIntents, extractDominantCategories, ProductIntent } from './product-intent-analyzer';

export interface UserProfile {
  userId: string;

  // From onboarding priorities (already in DB)
  productPriorities: Array<{ id: string; rank: number }>;
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

// Lazy-init: Cloudflare Workers don't have process.env at module scope
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

/**
 * Build or refresh user profile
 */
export async function buildUserProfile(
  userId: string,
  env: any,
  forceRefresh = false
): Promise<UserProfile> {
  console.log(`[Profile Builder] Building profile for user ${userId}`);

  // Check if we have a recent profile (skip if force refresh)
  if (!forceRefresh) {
    const existingProfile = await getExistingProfile(userId, env);
    if (existingProfile && !isProfileStale(existingProfile)) {
      console.log('[Profile Builder] Using cached profile');
      return existingProfile;
    }
  }

  // 1. Get priorities from DB (set during onboarding)
  const priorities = await getUserPriorities(userId, env);

  // 2. Analyze social accounts (ONCE, then monthly refresh)
  const socialContext = await analyzeSocialAccounts(userId, env);

  // 3. Analyze storefronts (ONCE, then weekly refresh)
  const storefrontContext = await analyzeStorefronts(userId, env);

  // 4. Calculate confidence score
  const confidenceScore = calculateProfileConfidence({
    hasPriorities: priorities.productPriorities.length > 0,
    hasSocials: socialContext.platforms.length > 0,
    hasStorefronts: storefrontContext.dominantCategories.length > 0,
  });

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

  // Store in database
  await storeUserProfile(profile, env);

  console.log(`[Profile Builder] Profile complete. Confidence: ${confidenceScore}%`);
  return profile;
}

/**
 * Get existing profile from DB
 */
async function getExistingProfile(userId: string, env: any): Promise<UserProfile | null> {
  const result = await env.DB.prepare(
    `SELECT * FROM user_product_profiles WHERE user_id = ?`
  )
    .bind(userId)
    .first();

  if (!result) return null;

  // Reconstruct profile from DB
  return {
    userId: result.user_id,
    productPriorities: JSON.parse(result.product_priorities || '[]'),
    brandPriorities: JSON.parse(result.brand_priorities || '[]'),
    socialContext: {
      platforms: JSON.parse(result.social_platforms || '[]'),
      contentCategories: JSON.parse(result.content_categories || '[]'),
      audienceDemographics: JSON.parse(result.audience_demographics || '{}'),
      estimatedReach: result.estimated_reach || 0,
    },
    storefrontContext: {
      dominantCategories: JSON.parse(result.dominant_categories || '[]'),
      topBrands: JSON.parse(result.top_brands || '[]'),
      avgPricePoint: result.avg_price_point || 0,
      preferredNetworks: JSON.parse(result.preferred_networks || '[]'),
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
  // Query Supabase via REST API
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_creator_preferences?user_id=eq.${userId}&select=product_priorities,brand_priorities`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const data = await response.json();
  const prefs = data[0];

  return {
    productPriorities: prefs?.product_priorities || [],
    brandPriorities: prefs?.brand_priorities || [],
  };
}

/**
 * Analyze user's connected social accounts
 */
async function analyzeSocialAccounts(userId: string, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // Get connected social accounts
  const response = await fetch(
    `${supabaseUrl}/rest/v1/connected_accounts?user_id=eq.${userId}&platform=in.(youtube,instagram,tiktok,twitter)&is_active=eq.true&select=platform,account_identifier`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const socials = await response.json();

  if (!socials || socials.length === 0) {
    console.log('[Profile Builder] No social accounts connected');
    return {
      platforms: [],
      contentCategories: [],
      audienceDemographics: { ageRange: '', topCountries: [], interests: [] },
      estimatedReach: 0,
    };
  }

  // NEW: Use lightweight social analyzer
  const { analyzeSocialAccountsLightweight } = await import('./lightweight-social-analyzer');

  const accounts = socials.map((s: any) => ({
    platform: s.platform,
    accountIdentifier: s.account_identifier,
    followerCount: s.follower_count, // If available
    bio: s.bio, // If available
    displayName: s.display_name, // If available
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

    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-haiku-20250219',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text
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
 * Analyze user's storefronts to understand product mix
 */
async function analyzeStorefronts(userId: string, env: any) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // Get affiliate transactions to understand product mix
  const response = await fetch(
    `${supabaseUrl}/rest/v1/affiliate_transactions?user_id=eq.${userId}&select=product_name,product_id,platform,commission,revenue&limit=100`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  const transactions = await response.json();

  if (!transactions || transactions.length === 0) {
    console.log('[Profile Builder] No storefront data available');
    return {
      dominantCategories: [],
      topBrands: [],
      avgPricePoint: 0,
      preferredNetworks: [],
    };
  }

  // Extract product URLs from transaction data
  const productUrls = transactions
    .map((t: any) => t.product_id)
    .filter(Boolean)
    .slice(0, 50); // Limit for AI analysis

  // Use AI to categorize products
  const intents = await analyzeMultipleIntents(productUrls);
  const dominantCategories = extractDominantCategories(intents);

  // Calculate average price point
  const avgRevenue =
    transactions.reduce((sum: number, t: any) => sum + (parseFloat(t.revenue) || 0), 0) /
    transactions.length;
  const avgPricePoint = avgRevenue / 0.05; // Assume ~5% commission

  // Extract preferred networks
  const networkCounts = new Map<string, number>();
  for (const t of transactions) {
    const count = networkCounts.get(t.platform) || 0;
    networkCounts.set(t.platform, count + 1);
  }
  const preferredNetworks = Array.from(networkCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([platform]) => platform);

  // Extract top brands from intents
  const brandCounts = new Map<string, number>();
  for (const intent of intents) {
    if (intent.brand) {
      const count = brandCounts.get(intent.brand) || 0;
      brandCounts.set(intent.brand, count + 1);
    }
  }
  const topBrands = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand]) => brand);

  return {
    dominantCategories: dominantCategories.slice(0, 5).map(cat => ({
      category: cat.category,
      percentage: cat.percentage,
      avgCommission: 5.0, // Placeholder
    })),
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
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

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

  await fetch(`${supabaseUrl}/rest/v1/user_product_profiles`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  console.log('[Profile Builder] Profile stored in database');
}
