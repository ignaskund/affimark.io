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
const TOP_RESULTS_LIMIT = 5;
const SEARCH_TIME_BUDGET_MS = 15000;

// Enable CORS for frontend
app.use('/*', cors({
  origin: (origin) => {
    const allowed = [
      '[REDACTED]',
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
app.post('/search', async (c) => {
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
      productIntent = await analyzeProductIntent(input, c.env);
      console.log(`[Finder Search] Product intent: ${productIntent.category} - ${productIntent.subcategory}`);
      console.log(`[Finder Search] Detected brand: ${productIntent.brand || 'Unknown'}`);

      // If we couldn't identify the product at all, return a clear error
      // instead of hallucinating a category and returning irrelevant results.
      if (productIntent.confidence < 20 || productIntent.searchQuery === productIntent.category) {
        console.warn('[Finder Search] Product identification failed — not enough info to search');
        return c.json({
          alternatives: [],
          alternativesCount: 0,
          status: 'product_unidentified',
          error: 'We couldn\'t identify this product from the URL. Try pasting the product name directly, or use a URL that includes the product name (e.g. amazon.com/Sony-Headphones/dp/B09X...).',
          intent: productIntent,
          meta: { duration: Date.now() - startTime },
        });
      }
    } else {
      // Category / text search — use AI or keyword matching to determine product category
      // e.g. "milk cosmetics" → category: "Beauty & Health", searchQuery: "milk cosmetics"
      productIntent = await analyzeCategorySearch(input, c.env);
      console.log(`[Finder Search] Category search: "${input}" → category: ${productIntent.category}`);
    }

    // STEP 5: Search across networks and score
    console.log('[Finder Search] Step 4: Searching across networks...');
    const runSearchWithBudget = async (
      searchOptions: { limit: number; excludeOriginalBrand: boolean },
      budgetMs: number
    ) => {
      return await Promise.race([
        searchAllNetworks(productIntent, adjustedProfile, c.env, searchOptions),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error(`Search timed out after ${budgetMs}ms`)), budgetMs)
        ),
      ]);
    };

    let alternatives = await runSearchWithBudget(
      {
        limit: 50,
        // Default ON: users are looking for alternatives, not same-brand variants.
        // Can be explicitly disabled with dynamicIntent.excludeOriginalBrand = false.
        excludeOriginalBrand: dynamicIntent.excludeOriginalBrand !== false,
      },
      SEARCH_TIME_BUDGET_MS
    );

    const elapsedAfterStrict = Date.now() - startTime;
    const remainingBudget = SEARCH_TIME_BUDGET_MS - elapsedAfterStrict;

    // Guarantee a usable set: if strict filtering yields too few options,
    // run a relaxed pass and top up to at least 5.
    if (alternatives.length < 5 && remainingBudget > 3000) {
      console.log(
        `[Finder Search] Only ${alternatives.length} alternatives after strict pass, running relaxed fallback (remaining budget: ${remainingBudget}ms)`
      );
      const relaxedAlternatives = await runSearchWithBudget(
        {
          limit: 50,
          excludeOriginalBrand: false,
        },
        remainingBudget
      );

      const merged = new Map<string, any>();
      for (const item of alternatives) {
        merged.set(item.id || item.url, item);
      }
      for (const item of relaxedAlternatives) {
        const key = item.id || item.url;
        if (!merged.has(key)) merged.set(key, item);
      }

      alternatives = Array.from(merged.values());
      console.log(`[Finder Search] Relaxed fallback merged total: ${alternatives.length}`);
    } else if (alternatives.length < 5) {
      console.log(
        `[Finder Search] Skipping relaxed fallback due to budget. alternatives=${alternatives.length}, remaining=${remainingBudget}ms`
      );
    }

    console.log(`[Finder Search] Found ${alternatives.length} alternatives`);

    // Session creation is handled by the frontend API route
    // Backend only returns search results

    const duration = Date.now() - startTime;
    console.log(`[Finder Search] ✓ Complete in ${duration}ms`);

    // Log operation cost (Fix #8)
    await logOperationCost(userId, budgetCheck.degradeMode === 'cached' ? 'search_cached' : 'search_full', {}, c.env);

    // Return results
    const topAlternatives = alternatives.slice(0, TOP_RESULTS_LIMIT);

    return c.json({
      alternatives: topAlternatives,
      alternativesCount: topAlternatives.length,
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
 * Manually trigger profile build/refresh.
 * Use forceRefresh: true to bypass the cache and rebuild immediately.
 *
 * Alternative: force via SQL (marks stale profiles for rebuild on next search):
 *   UPDATE user_product_profiles SET updated_at = '2020-01-01' WHERE confidence_score < 70;
 */
app.post('/profile/build', async (c) => {
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
app.get('/profile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    const supabaseUrl = c.env.SUPABASE_URL;
    const supabaseKey = c.env.SUPABASE_SERVICE_KEY;

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
app.post('/intent/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'url is required' }, 400);
    }

    const intent = await analyzeProductIntent(url, c.env);

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
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  const sessionData = {
    user_id: userId,
    input_type: inputType,
    input_value: input,
    product_priorities_snapshot: JSON.stringify(profile.productPriorities),
    brand_priorities_snapshot: JSON.stringify(profile.brandPriorities),
    active_context_snapshot: JSON.stringify(activeContext),
    original_product: inputType === 'url' ? JSON.stringify({
      intent: productIntent,
      url: input,
    }) : null,
    alternatives: JSON.stringify(alternatives),
    alternatives_count: alternatives.length,
    status: 'ready',
    updated_at: new Date().toISOString(),
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

/**
 * Helper: Analyze a free-text category search to extract proper product category
 * e.g. "milk cosmetics" → { category: "Beauty", searchQuery: "milk cosmetics", ... }
 */
async function analyzeCategorySearch(input: string, env: any): Promise<any> {
  // If input looks like a product name (not a URL), use AI directly
  const apiKey = env?.OPENAI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);
  if (apiKey && input.length > 3 && !input.includes('http')) {
    try {
      const { aiComplete, extractJson } = await import('../services/ai-client');
      const text = await aiComplete({
        prompt: `You are a product search expert. The user wants to find alternatives for: "${input}"

Extract structured search intent:
1. Primary category: Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors, Toys & Games, Books & Media, Food & Beverage, Automotive, Pet Supplies, Office & School, Arts & Crafts
2. Specific subcategory
3. Brand (if mentioned, else null)
4. A clean 3-5 word search query (no brand name) to find similar products in an affiliate feed

Return ONLY valid JSON:
{"category": "...", "subcategory": "...", "brand": null, "searchQuery": "...", "keywords": ["..."], "priceRange": "mid-range", "confidence": 85}`,
        maxTokens: 200,
        apiKey,
      });
      const intent = extractJson(text);
      if (intent?.category && intent?.searchQuery) {
        console.log(`[Category Analyzer] AI: "${input}" → "${intent.searchQuery}" (${intent.category})`);
        return intent;
      }
    } catch { /* fall through to keyword matching */ }
  }
  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Beauty': ['beauty', 'cosmetic', 'skincare', 'makeup', 'skin', 'face', 'lip', 'nail', 'hair', 'fragrance', 'perfume', 'serum', 'cream', 'lotion', 'moisturizer', 'shampoo', 'conditioner', 'mask', 'cleanser', 'toner', 'foundation', 'mascara', 'eyeshadow', 'blush', 'concealer', 'primer', 'sunscreen', 'spf', 'body wash', 'soap', 'exfoliant', 'oil', 'balm', 'milk'],
    'Electronics': ['electronics', 'headphone', 'speaker', 'phone', 'laptop', 'tablet', 'camera', 'tv', 'monitor', 'keyboard', 'mouse', 'charger', 'cable', 'earbuds', 'smartwatch', 'drone', 'gaming', 'console', 'router', 'bluetooth'],
    'Fashion': ['fashion', 'clothing', 'shirt', 'pants', 'dress', 'jacket', 'shoes', 'sneakers', 'boots', 'hat', 'scarf', 'belt', 'sunglasses', 'watch', 'jewelry', 'ring', 'necklace', 'bracelet', 'bag', 'handbag', 'wallet', 'sock'],
    'Home': ['home', 'furniture', 'lamp', 'pillow', 'blanket', 'rug', 'curtain', 'vase', 'candle', 'kitchen', 'cookware', 'bedding', 'towel', 'organizer', 'storage', 'decor', 'plant', 'garden'],
    'Sports': ['sports', 'fitness', 'yoga', 'gym', 'running', 'cycling', 'hiking', 'camping', 'swimming', 'exercise', 'workout', 'mat', 'dumbbell', 'resistance', 'protein', 'bottle'],
    'Food': ['food', 'snack', 'drink', 'coffee', 'tea', 'chocolate', 'organic', 'vegan', 'supplement', 'vitamin', 'nutrition', 'protein powder', 'grocery'],
    'Toys': ['toy', 'game', 'puzzle', 'lego', 'kids', 'baby', 'stroller', 'playmat'],
    'Books': ['book', 'novel', 'audiobook', 'kindle', 'ebook', 'journal', 'planner', 'notebook'],
    'Automotive': ['car', 'auto', 'vehicle', 'motorcycle', 'tire', 'motor', 'dash cam'],
    'Pets': ['pet', 'dog', 'cat', 'fish', 'bird', 'treat', 'leash', 'collar', 'aquarium', 'litter'],
    'Office': ['office', 'desk', 'chair', 'pen', 'stationery', 'printer', 'paper', 'stapler'],
  };

  const inputLower = input.toLowerCase();
  const words = inputLower.split(/\s+/);

  // Score each category by how many keyword matches
  let bestCategory = 'General';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Check if any word in the input matches or contains the keyword
      for (const word of words) {
        if (word.includes(keyword) || keyword.includes(word)) {
          score += 1;
        }
      }
      // Also check the full input for multi-word keywords
      if (inputLower.includes(keyword)) {
        score += 0.5;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  console.log(`[Category Analyzer] "${input}" → category: "${bestCategory}" (score: ${bestScore})`);

  return {
    category: bestCategory,
    searchQuery: input,
    keywords: words,
    confidence: bestScore > 0 ? 80 : 50,
  };
}

/**
 * POST /api/finder/search-v2
 * MCP-powered alternative search with iterative multi-strategy approach.
 * This endpoint uses the new agent orchestrator that:
 *   - Identifies products more reliably (multi-strategy scraping)
 *   - Runs multiple Datafeedr queries with different specificity
 *   - Filters by semantic similarity BEFORE scoring (rejects garbage early)
 *   - Enforces category coherence and merchant diversity
 *   - Compares alternatives against the original product
 */
app.post('/search-v2', async (c) => {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const { userId, input, inputType = 'url' } = body;

    if (!userId) return c.json({ error: 'userId is required' }, 401);
    if (!input) return c.json({ error: 'input is required' }, 400);

    console.log(`[Finder V2] User: ${userId}, Input: ${input}, Type: ${inputType}`);

    // Budget check
    const budgetCheck = await checkBudget(userId, 'search_full', c.env);
    if (!budgetCheck.allowed) {
      return c.json({ error: budgetCheck.message }, 429);
    }

    const { runAlternativeSearchAgent } = await import('../mcp/agent');
    const result = await runAlternativeSearchAgent(input, userId, c.env);

    await logOperationCost(userId, 'search_full', {}, c.env);

    const duration = Date.now() - startTime;
    console.log(`[Finder V2] Complete in ${duration}ms — ${result.alternatives.length} alternatives from ${result.totalCandidatesEvaluated} evaluated`);

    // Normalize V2 ScoredAlternative fields to match frontend AlternativeProduct type
    const normalizedAlternatives = result.alternatives.map((alt: any) => ({
      ...alt,
      matchScore: alt.combinedScore ?? alt.matchScore ?? 50,
      matchReasons: alt.reasonCodes ?? alt.matchReasons ?? [],
      productPriorityKpis: alt.productKpis ?? alt.productPriorityKpis ?? [],
      brandPriorityKpis: alt.brandKpis ?? alt.brandPriorityKpis ?? [],
      pros: alt.pros ?? [],
      cons: alt.cons ?? [],
    }));

    return c.json({
      alternatives: normalizedAlternatives,
      alternativesCount: normalizedAlternatives.length,
      originalProduct: result.originalProduct,
      agentReasoning: result.agentReasoning,
      searchIterations: result.searchIterations,
      totalEvaluated: result.totalCandidatesEvaluated,
      status: normalizedAlternatives.length > 0 ? 'ready' : (result.originalProduct.confidence < 15 ? 'product_unidentified' : 'no_alternatives'),
      meta: {
        duration,
        version: 'v2-mcp',
        intentConfidence: result.originalProduct.confidence,
      },
    });
  } catch (error: any) {
    console.error('[Finder V2] Error:', error);
    return c.json({ error: 'Search failed', message: error.message, status: 'failed' }, 500);
  }
});

/**
 * POST /api/finder/enrich-products
 * Enriches user's onboarding products with category/brand data via analyzeProductTitle.
 * Called after onboarding completes to prepare the profile for quality alternative search.
 */
app.post('/enrich-products', async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) return c.json({ error: 'userId is required' }, 401);

    const supabaseUrl = c.env.SUPABASE_URL;
    const supabaseKey = c.env.SUPABASE_SERVICE_KEY;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

    // Fetch products missing category enrichment
    const productsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=id,title,brand,category&order=created_at.desc&limit=100`,
      { headers }
    );
    const products: any[] = await productsRes.json();

    const toEnrich = products.filter(p => p.title && (!p.category || p.category === 'General'));
    if (toEnrich.length === 0) {
      return c.json({ message: 'No products need enrichment', enriched: 0 });
    }

    console.log(`[Enrich] Enriching ${toEnrich.length} products for user ${userId}`);

    const { analyzeProductTitle } = await import('../services/product-intent-analyzer');
    let enriched = 0;

    // Process in batches of 5 to respect rate limits
    for (let i = 0; i < toEnrich.length; i += 5) {
      const batch = toEnrich.slice(i, i + 5);
      await Promise.all(batch.map(async (product) => {
        try {
          const intent = await analyzeProductTitle(product.title, c.env);
          if (intent.confidence >= 30) {
            await fetch(
              `${supabaseUrl}/rest/v1/user_storefront_products?id=eq.${product.id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  category: intent.category || product.category,
                  brand: intent.brand || product.brand || null,
                }),
              }
            );
            enriched++;
          }
        } catch (e) {
          console.warn(`[Enrich] Failed for product ${product.id}:`, e);
        }
      }));
      if (i + 5 < toEnrich.length) await new Promise(r => setTimeout(r, 300));
    }

    // Trigger profile rebuild to pick up enriched categories
    await buildUserProfile(userId, c.env, true).catch(() => {});

    console.log(`[Enrich] Done: ${enriched}/${toEnrich.length} products enriched for ${userId}`);
    return c.json({ message: 'Enrichment complete', enriched, total: toEnrich.length });
  } catch (error: any) {
    console.error('[Enrich Products] Error:', error);
    return c.json({ error: 'Enrichment failed', message: error.message }, 500);
  }
});

export default app;
