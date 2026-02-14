/**
 * Product Finder API Routes (Cloudflare Worker)
 * Complete backend implementation for Product Finder feature
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { analyzeProductIntent } from '../services/product-intent-analyzer';
import { buildUserProfile } from '../services/profile-builder';
import { searchAllNetworks, findProductAlternatives } from '../services/multi-network-search';
import { analyzeDynamicIntent, applyDynamicIntent, explainDynamicIntent } from '../services/dynamic-intent-analyzer';
import { generateContextHash, generateContextLabel } from '../services/context-hash';
import { checkBudget, logOperationCost } from '../services/cost-governor';

const app = new Hono();

// Enable CORS for frontend
app.use('/*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://affimark.io',
      'https://www.affimark.io',
      'https://affimark-frontend.vercel.app',
    ];
    return (origin && allowed.includes(origin)) ? origin : allowed[0];
  },
  credentials: true,
}));

/**
 * POST /api/finder/search
 * Main search endpoint - finds product alternatives based on user context
 */
app.post('/api/finder/search', async (c) => {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const {
      userId,
      input,
      inputType = 'url', // 'url' or 'category'
      activeContext = { socials: [], storefronts: [] },
      dynamicIntent = {},
    } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 401);
    }

    if (!input) {
      return c.json({ error: 'input is required' }, 400);
    }

    console.log(`[Finder Search] User: ${userId}, Input: ${input}, Type: ${inputType}`);
    console.log(`[Finder Search] Active context:`, activeContext);
    console.log(`[Finder Search] Dynamic intent:`, dynamicIntent);

    // STEP 0: Check cost budget (Fix #8)
    const budgetCheck = await checkBudget(userId, 'search_full', c.env);
    if (!budgetCheck.allowed) {
      return c.json({ error: budgetCheck.message }, 429); // Too Many Requests
    }

    // Generate context hash for toggle change detection (Fix #6)
    const contextHash = generateContextHash(activeContext);
    const contextLabel = generateContextLabel(activeContext);
    console.log(`[Finder Search] Context: "${contextLabel}" (hash: ${contextHash})`);

    // STEP 1: Build or get user profile
    console.log('[Finder Search] Step 1: Building user profile...');
    let userProfile = await buildUserProfile(userId, c.env);
    console.log(`[Finder Search] Profile loaded. Confidence: ${userProfile.confidenceScore}%`);

    // STEP 2: Apply context filters
    // Filter profile based on active context (toggled socials/storefronts)
    if (activeContext.socials && activeContext.socials.length > 0) {
      userProfile.socialContext.platforms = userProfile.socialContext.platforms.filter(
        (p: string) => activeContext.socials.includes(p)
      );
      console.log(`[Finder Search] Filtered to active socials:`, activeContext.socials);
    }

    if (activeContext.storefronts && activeContext.storefronts.length > 0) {
      userProfile.storefrontContext.preferredNetworks =
        userProfile.storefrontContext.preferredNetworks.filter(
          (n: string) => activeContext.storefronts.some((s: string) => n.includes(s))
        );
      console.log(`[Finder Search] Filtered to active storefronts:`, activeContext.storefronts);
    }

    // STEP 3: Analyze dynamic intent (what user wants RIGHT NOW)
    console.log('[Finder Search] Step 2: Analyzing dynamic intent...');
    const analyzedDynamicIntent = await analyzeDynamicIntent(dynamicIntent, userProfile);
    console.log(`[Finder Search] Dynamic intent confidence: ${analyzedDynamicIntent.confidenceScore}%`);

    if (analyzedDynamicIntent.inferredPriorityBoosts && analyzedDynamicIntent.inferredPriorityBoosts.length > 0) {
      console.log('[Finder Search] Priority boosts:', analyzedDynamicIntent.inferredPriorityBoosts);
    }

    // Apply dynamic intent to profile (temporary adjustments)
    const adjustedProfile = applyDynamicIntent(userProfile, analyzedDynamicIntent);

    // STEP 4: Analyze product intent from URL or category
    console.log('[Finder Search] Step 3: Analyzing product intent...');
    let productIntent;

    if (inputType === 'url') {
      productIntent = await analyzeProductIntent(input);
      console.log(`[Finder Search] Product intent: ${productIntent.category} - ${productIntent.subcategory}`);
      console.log(`[Finder Search] Detected brand: ${productIntent.brand || 'Unknown'}`);
    } else {
      // Category search
      productIntent = {
        category: input,
        searchQuery: input,
        keywords: input.split(' '),
        confidence: 80,
      };
      console.log(`[Finder Search] Category search: ${input}`);
    }

    // STEP 5: Search across networks and score
    console.log('[Finder Search] Step 4: Searching across networks...');
    const alternatives = await searchAllNetworks(
      productIntent,
      adjustedProfile,
      c.env,
      {
        limit: 50,
        excludeOriginalBrand: inputType === 'url' && dynamicIntent.excludeOriginalBrand !== false,
      }
    );

    console.log(`[Finder Search] Found ${alternatives.length} alternatives`);

    // STEP 6: Create session in Supabase
    console.log('[Finder Search] Step 5: Creating session...');
    const session = await createFinderSession(
      userId,
      input,
      inputType,
      userProfile,
      activeContext,
      contextHash,
      contextLabel,
      productIntent,
      alternatives,
      analyzedDynamicIntent,
      c.env
    );

    const duration = Date.now() - startTime;
    console.log(`[Finder Search] ✓ Complete in ${duration}ms`);

    // Log operation cost (Fix #8)
    await logOperationCost(userId, budgetCheck.degradeMode === 'cached' ? 'search_cached' : 'search_full', {
      sessionId: session.id,
    }, c.env);

    // Return results
    return c.json({
      sessionId: session.id,
      alternatives: alternatives.slice(0, 20), // Top 20 for UI
      alternativesCount: alternatives.length,
      profile: {
        confidenceScore: userProfile.confidenceScore,
        socialContext: userProfile.socialContext,
        storefrontContext: userProfile.storefrontContext,
      },
      intent: productIntent,
      dynamicIntent: {
        explanation: explainDynamicIntent(analyzedDynamicIntent),
        boosts: analyzedDynamicIntent.inferredPriorityBoosts,
      },
      status: 'ready',
      meta: {
        duration,
        profileConfidence: userProfile.confidenceScore,
        intentConfidence: productIntent.confidence,
        dynamicIntentConfidence: analyzedDynamicIntent.confidenceScore || 0,
      },
    });
  } catch (error: any) {
    console.error('[Finder Search] Error:', error);
    return c.json({
      error: 'Search failed',
      message: error.message,
      status: 'failed',
    }, 500);
  }
});

/**
 * POST /api/finder/profile/build
 * Manually trigger profile build/refresh
 */
app.post('/api/finder/profile/build', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, forceRefresh = false } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 401);
    }

    console.log(`[Profile Build] Building profile for user ${userId} (force: ${forceRefresh})`);

    const profile = await buildUserProfile(userId, c.env, forceRefresh);

    return c.json({
      profile,
      message: forceRefresh
        ? 'Profile rebuilt successfully'
        : 'Profile retrieved or built',
    });
  } catch (error: any) {
    console.error('[Profile Build] Error:', error);
    return c.json({
      error: 'Profile build failed',
      message: error.message,
    }, 500);
  }
});

/**
 * GET /api/finder/profile/:userId
 * Get cached user profile
 */
app.get('/api/finder/profile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    const supabaseUrl = c.env.SUPABASE_URL;
    const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_product_profiles?user_id=eq.${userId}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    const profileData = data[0];

    if (!profileData) {
      return c.json({
        error: 'Profile not found',
        message: 'Run POST /api/finder/profile/build to create profile',
      }, 404);
    }

    // Reconstruct profile from DB
    const profile = {
      userId: profileData.user_id,
      productPriorities: JSON.parse(profileData.product_priorities || '[]'),
      brandPriorities: JSON.parse(profileData.brand_priorities || '[]'),
      socialContext: {
        platforms: JSON.parse(profileData.social_platforms || '[]'),
        contentCategories: JSON.parse(profileData.content_categories || '[]'),
        audienceDemographics: JSON.parse(profileData.audience_demographics || '{}'),
        estimatedReach: profileData.estimated_reach || 0,
      },
      storefrontContext: {
        dominantCategories: JSON.parse(profileData.dominant_categories || '[]'),
        topBrands: JSON.parse(profileData.top_brands || '[]'),
        avgPricePoint: profileData.avg_price_point || 0,
        preferredNetworks: JSON.parse(profileData.preferred_networks || '[]'),
      },
      profileLastUpdated: profileData.updated_at,
      socialLastAnalyzed: profileData.last_social_analysis,
      storefrontLastAnalyzed: profileData.last_storefront_analysis,
      confidenceScore: profileData.confidence_score || 0,
    };

    return c.json({ profile });
  } catch (error: any) {
    console.error('[Get Profile] Error:', error);
    return c.json({
      error: 'Failed to get profile',
      message: error.message,
    }, 500);
  }
});

/**
 * POST /api/finder/intent/analyze
 * Analyze product intent from URL (for testing/debugging)
 */
app.post('/api/finder/intent/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'url is required' }, 400);
    }

    const intent = await analyzeProductIntent(url);

    return c.json({ intent });
  } catch (error: any) {
    console.error('[Intent Analyze] Error:', error);
    return c.json({
      error: 'Intent analysis failed',
      message: error.message,
    }, 500);
  }
});

/**
 * Helper: Create finder session in Supabase
 */
async function createFinderSession(
  userId: string,
  input: string,
  inputType: string,
  profile: any,
  activeContext: any,
  contextHash: string, // NEW: Fix #6
  contextLabel: string, // NEW: Fix #6
  productIntent: any,
  alternatives: any[],
  dynamicIntent: any,
  env: any
): Promise<any> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const sessionData = {
    user_id: userId,
    input_type: inputType,
    input_value: input,
    product_priorities_snapshot: JSON.stringify(profile.productPriorities),
    brand_priorities_snapshot: JSON.stringify(profile.brandPriorities),
    active_context_snapshot: JSON.stringify(activeContext),
    active_context_hash: contextHash, // NEW: Fix #6
    // Store context label in original_product metadata for display
    context_label: contextLabel,
    original_product: inputType === 'url' ? JSON.stringify({
      intent: productIntent,
      url: input,
    }) : null,
    alternatives: JSON.stringify(alternatives),
    alternatives_count: alternatives.length,
    current_index: 0,
    viewed_alternatives: JSON.stringify([]),
    saved_alternatives: JSON.stringify([]),
    skipped_alternatives: JSON.stringify([]),
    chat_messages: JSON.stringify([]),
    status: 'ready',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Store dynamic intent for context
    dynamic_intent_snapshot: JSON.stringify(dynamicIntent),
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/product_finder_sessions`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(sessionData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create session: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

export default app;
