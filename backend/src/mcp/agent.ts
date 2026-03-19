/**
 * MCP Alternative Search Agent — Orchestrator
 *
 * PURPOSE: Find the BEST alternative product for the same item type,
 * from a DIFFERENT brand, scored by the creator's specific priorities.
 *
 * The user inserts a product URL. We identify WHAT it is (e.g. "dry texture
 * hair spray"), then search Datafeedr for OTHER brands' versions of the same
 * product type. We score each candidate against the creator's onboarding
 * priorities (quality, price, sustainability, commission, etc.) and return
 * the top alternatives that would be BETTER for this creator to promote.
 *
 * NOT looking for: same product from different networks, same brand variants,
 * or random keyword matches.
 *
 * LOOKING FOR: genuinely different brands/products for the same item type,
 * ranked by how well they fit this specific creator's profile and priorities.
 */

import type {
  CreatorProfile,
  IdentifiedProduct,
  SearchCandidate,
  ScoredAlternative,
  SearchIteration,
  AgentSearchResult,
} from './types';
import {
  getCreatorProfile,
  identifyProduct,
  searchAlternatives,
  scoreCandidate,
  computeSemanticScores,
} from './tools';

const MAX_ITERATIONS = 4;
const MIN_QUALITY_CANDIDATES = 5;
const SEMANTIC_THRESHOLD = 30;
const COMBINED_SCORE_FLOOR = 35;
const TOP_K = 5;

const WHITE_LABEL_MERCHANTS = new Set([
  'temu', 'wish', 'alibaba', 'aliexpress', 'shein', 'banggood', 'gearbest', 'dhgate',
]);

const AGENT_TIMEOUT_MS = 45000;

export async function runAlternativeSearchAgent(
  productUrl: string,
  userId: string,
  env: any,
): Promise<AgentSearchResult> {
  return Promise.race([
    runAlternativeSearchAgentInternal(productUrl, userId, env),
    new Promise<AgentSearchResult>((_, reject) =>
      setTimeout(() => reject(new Error('Agent search timed out')), AGENT_TIMEOUT_MS)
    ),
  ]);
}

async function runAlternativeSearchAgentInternal(
  productUrl: string,
  userId: string,
  env: any,
): Promise<AgentSearchResult> {
  const startTime = Date.now();
  const iterations: SearchIteration[] = [];
  const allCandidateIds = new Set<string>();
  let allScoredCandidates: ScoredAlternative[] = [];
  const degradationIssues: string[] = [];

  // ── STEP 1: Load creator profile ──────────────────────────────────────────
  console.log('[Agent] Step 1: Loading creator profile...');
  const profile = await getCreatorProfile(userId, env);
  console.log(`[Agent] Profile: confidence=${profile.confidenceScore}% product=[${profile.productPriorities.slice(0, 3).map(p => p.id)}] brand=[${profile.brandPriorities.slice(0, 3).map(p => p.id)}]`);
  if (profile.confidenceScore === 0) {
    degradationIssues.push('profile_unavailable');
  }

  const qualityFocused = profile.productPriorities.slice(0, 2).some(p =>
    ['quality', 'brand_recognition', 'reviews'].includes(p.id)
  );

  // ── STEP 2: Identify the product ──────────────────────────────────────────
  console.log('[Agent] Step 2: Identifying product from URL...');
  const product = await identifyProduct(productUrl, env);

  if (product.confidence < 15 || !product.title) {
    // If identification failed, try AI with URL-only
    if (env.OPENAI_API_KEY) {
      const aiProduct = await identifyProductWithAI(productUrl, env);
      if (aiProduct && aiProduct.confidence >= 30) {
        Object.assign(product, aiProduct);
      }
    }
    if (product.confidence < 15 || !product.title) {
      return {
        originalProduct: product, alternatives: [], searchIterations: [],
        totalCandidatesEvaluated: 0,
        agentReasoning: 'Could not identify the product from this URL. Try pasting the product name instead.',
        searchDurationMs: Date.now() - startTime,
      };
    }
  }

  console.log(`[Agent] Product: "${product.title}" | Brand: ${product.brand || '?'} | Category: ${product.category} | Price: $${product.price || '?'} | Confidence: ${product.confidence}%`);

  // ── STEP 2b: Score risk on the ORIGINAL product ───────────────────────────
  let originalProductRisk: import('./types').AgentSearchResult['originalProductRisk'] | undefined;
  try {
    const { enrichStatic } = await import('../services/enrichment');
    const { scoreOutcomeFeasibility } = await import('../services/outcome-feasibility-scorer');
    const signals = enrichStatic({
      name: product.title,
      brand: product.brand || '',
      category: product.category,
      price: product.price || 0,
      currency: product.currency || 'USD',
      affiliateNetwork: '',
      merchant: product.brand || '',
    });
    originalProductRisk = await scoreOutcomeFeasibility({
      name: product.title,
      brand: product.brand || '',
      category: product.category,
      price: product.price || 0,
      currency: product.currency || 'USD',
      affiliateNetwork: '',
      merchantName: product.brand || '',
      commissionRate: signals.commissionRate,
      cookieDuration: signals.cookieDurationDays,
    }, env);
    console.log(`[Agent] Original product risk: overall=${originalProductRisk.overall} confidence=${originalProductRisk.confidence}`);
  } catch (e) {
    console.warn('[Agent] Could not score original product risk:', e);
    degradationIssues.push('original_risk_scoring_failed');
  }

  // ── STEP 3: Generate search queries for the PRODUCT TYPE (no brand) ──────
  // This is the critical step. We extract the generic product type description
  // and strip ALL brand references. "Kristin Ess Dry Texture Hair Spray" → "dry texture hair spray"
  const productTypeQueries = await generateProductTypeQueries(product, env);
  console.log(`[Agent] Product type queries: ${productTypeQueries.map(q => `"${q}"`).join(', ')}`);

  // Collect all brand name tokens to exclude (original brand + any variations)
  const brandExclusions = buildBrandExclusions(product);
  console.log(`[Agent] Brand exclusions: [${brandExclusions.join(', ')}]`);

  // ── STEP 4: Generate search strategies ────────────────────────────────────
  const strategies = await generateSearchStrategies(productTypeQueries, product, profile);
  console.log(`[Agent] ${strategies.length} search strategies generated`);

  // ── STEP 5: Iterative search loop ─────────────────────────────────────────
  for (let i = 0; i < Math.min(strategies.length, MAX_ITERATIONS); i++) {
    const strategy = strategies[i];
    console.log(`[Agent] Search ${i + 1}/${strategies.length}: "${strategy.query}" (${strategy.name})`);

    let candidates: import('./types').SearchCandidate[] = [];
    try {
      candidates = await searchAlternatives(strategy.query, {
        priceMin: strategy.priceMin,
        priceMax: strategy.priceMax,
        inStockOnly: true,
        limit: 100,
        sourceNames: strategy.sourceNames,
        excludeBrands: brandExclusions,
      }, env);
    } catch (e) {
      console.error('[Agent] Datafeedr search failed:', e);
      if (!degradationIssues.includes('product_database_unavailable')) {
        degradationIssues.push('product_database_unavailable');
      }
      iterations.push({ query: strategy.query, strategy: strategy.name, candidateCount: 0, relevantCount: 0, topScore: 0, avgSemanticScore: 0 });
      continue;
    }

    // Remove candidates that are the same brand under a different name
    const filtered = candidates.filter(c => {
      if (!allCandidateIds.has(c.id)) {
        // Double-check brand exclusion with fuzzy matching
        return !isSameBrandFuzzy(c.brand, product.brand) &&
               !isSameBrandFuzzy(c.merchant, product.brand);
      }
      return false;
    });
    filtered.forEach(c => allCandidateIds.add(c.id));

    if (filtered.length === 0) {
      iterations.push({ query: strategy.query, strategy: strategy.name, candidateCount: 0, relevantCount: 0, topScore: 0, avgSemanticScore: 0 });
      continue;
    }

    // Semantic similarity: how close is this candidate to the original product TYPE
    const semanticQueryText = buildSemanticQueryText(product);
    let semanticScores = await computeSemanticScores(semanticQueryText, filtered, env);

    if (semanticScores.size === 0) {
      semanticScores = new Map();
      const keywords = (product.keywords || semanticQueryText.split(' ')) as string[];
      for (const c of filtered) {
        const text = `${c.name || ''} ${c.brand || ''} ${c.category || ''} ${c.description || ''}`.toLowerCase();
        const matches = keywords.filter((kw: string) => text.includes(kw.toLowerCase())).length;
        semanticScores.set(c.id, keywords.length > 0 ? Math.round((matches / keywords.length) * 100) : 50);
      }
    }

    // Semantic pre-filter
    const semanticPassed = filtered.filter(c => (semanticScores.get(c.id) ?? 0) >= SEMANTIC_THRESHOLD);

    // White-label filter for quality-focused creators
    const qualityPassed = qualityFocused
      ? semanticPassed.filter(c => !WHITE_LABEL_MERCHANTS.has(c.merchant.toLowerCase()))
      : semanticPassed;

    // Score candidates against creator's priorities
    const scored = await Promise.all(
      qualityPassed.slice(0, 30).map(c =>
        scoreCandidate(c, product, profile, semanticScores.get(c.id) ?? 0, env)
      )
    );

    // Hard category gate: reject products from completely wrong categories
    // A comforter must never appear in a hair spray search. A Barbie doll must never appear for a pullover.
    const categoryPassed = scored.filter(s => {
      if (product.category === 'General' || !product.category) return true;
      if (!s.category || s.category === 'General') return true;
      return categoriesOverlap(s.category, product.category);
    });

    const passing = categoryPassed.filter(s => s.combinedScore >= COMBINED_SCORE_FLOOR);
    allScoredCandidates.push(...passing);

    const avgSem = semanticScores.size > 0
      ? Math.round([...semanticScores.values()].reduce((a, b) => a + b, 0) / semanticScores.size)
      : 0;

    iterations.push({
      query: strategy.query, strategy: strategy.name,
      candidateCount: filtered.length, relevantCount: passing.length,
      topScore: passing.length > 0 ? Math.max(...passing.map(r => r.combinedScore)) : 0,
      avgSemanticScore: avgSem,
    });

    console.log(`[Agent] Search ${i + 1}: ${candidates.length} raw → ${filtered.length} new → ${semanticPassed.length} semantic → ${qualityPassed.length} quality → ${passing.length} passed (top=${passing.length > 0 ? Math.max(...passing.map(r => r.combinedScore)) : 0})`);

    // Only stop early if we have enough IN-STOCK candidates
    const inStockCount = allScoredCandidates.filter(c => c.inStock).length;
    if (inStockCount >= MIN_QUALITY_CANDIDATES * 2) {
      console.log(`[Agent] Sufficient in-stock candidates (${inStockCount}), stopping`);
      break;
    }
    if (allScoredCandidates.length >= MIN_QUALITY_CANDIDATES * 5) {
      console.log(`[Agent] Max candidates reached (${allScoredCandidates.length}), stopping`);
      break;
    }
  }

  // ── STEP 6: Final ranking & diversity ─────────────────────────────────────
  allScoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);

  const deduped = deduplicateByName(allScoredCandidates);
  const diverse = enforceDiversity(deduped, TOP_K);

  // ── STEP 7: Dynamic enrichment for top results ──────────────────────────
  // Fetch actual product pages to get real ratings and review counts.
  // This fixes the quality/reviews KPIs which otherwise show "pending enrichment".
  if (diverse.length > 0) {
    try {
      const { enrichDynamic } = await import('../services/enrichment');
      const { computeAllProductKpis, computeAllBrandKpis } = await import('../services/priority-kpi-specs');

      const signals = diverse.map(d => (d as any)._enrichedSignals).filter(Boolean);
      const urls = diverse.map(d => ({ directUrl: (d as any).directUrl, affiliateUrl: d.affiliateUrl }));

      if (signals.length > 0) {
        // Compute price percentiles across final candidates
        const { computePricePercentiles } = await import('../services/enrichment');
        computePricePercentiles(signals);

        // Dynamic enrichment: fetch product pages for real ratings/reviews
        await enrichDynamic(signals, urls);
        console.log(`[Agent] Dynamic enrichment complete for ${signals.length} products`);

        // Re-compute all KPIs with full enriched data
        for (let i = 0; i < diverse.length; i++) {
          const s = signals[i];
          if (!s) continue;
          diverse[i].productKpis = computeAllProductKpis(s, profile.productPriorities);
          diverse[i].brandKpis = computeAllBrandKpis(s, profile.brandPriorities);
          // Update comparisonToOriginal.betterForPriority1 with enriched KPI
          if (diverse[i].productKpis[0]) {
            diverse[i].comparisonToOriginal.betterForPriority1 = diverse[i].productKpis[0].score >= 60;
          }
        }
      }
    } catch (e) {
      console.warn('[Agent] Dynamic enrichment failed (non-fatal):', e);
    }
  }

  const agentReasoning = buildAgentReasoning(product, profile, diverse, iterations);

  const durationMs = Date.now() - startTime;
  console.log(`[Agent] Done: ${diverse.length} alternatives from ${allCandidateIds.size} evaluated in ${durationMs}ms`);
  for (const alt of diverse) {
    console.log(`  → "${alt.name.slice(0, 55)}" | ${alt.brand} | $${alt.price} | combined=${alt.combinedScore} sem=${alt.semanticSimilarity} pri=${alt.priorityWeightedScore}`);
  }

  // U9: Structured metrics — parseable by log aggregators (Logflare, Cloudflare Analytics Engine, etc.)
  const avgCombinedScore = diverse.length > 0
    ? Math.round(diverse.reduce((s, a) => s + a.combinedScore, 0) / diverse.length)
    : 0;
  const avgSemanticScore = diverse.length > 0
    ? Math.round(diverse.reduce((s, a) => s + (a.semanticSimilarity ?? 0), 0) / diverse.length)
    : 0;
  const iterationQueries = iterations.map(it => it.query);
  console.log('[Agent:metrics] ' + JSON.stringify({
    userId,
    productCategory: product.category,
    productBrand: product.brand ?? null,
    productConfidence: product.confidence ?? null,
    profileConfidence: profile.confidenceScore,
    searchIterations: iterations.length,
    iterationQueries,
    totalCandidatesEvaluated: allCandidateIds.size,
    alternativesReturned: diverse.length,
    avgCombinedScore,
    avgSemanticScore,
    zeroResults: diverse.length === 0,
    durationMs,
  }));

  const degradation = degradationIssues.length > 0 ? {
    level: (degradationIssues.length >= 3 ? 'severe' : 'partial') as 'partial' | 'severe',
    issues: degradationIssues,
    message: degradationIssues.length >= 3
      ? 'Results may be significantly less personalized due to service issues.'
      : 'Some personalization features are temporarily reduced.',
  } : undefined;

  return {
    originalProduct: product,
    originalProductRisk,
    alternatives: diverse,
    searchIterations: iterations,
    totalCandidatesEvaluated: allCandidateIds.size,
    agentReasoning,
    searchDurationMs: Date.now() - startTime,
    degradation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Product Type Query Generation — strips brand, keeps ONLY the item type
// ═══════════════════════════════════════════════════════════════════════════════

async function generateProductTypeQueries(product: IdentifiedProduct, env: any): Promise<string[]> {
  const queries: string[] = [];
  const brandTokens = extractBrandTokens(product.brand);

  // Method 1: Strip brand from the existing searchQueries
  for (const raw of product.searchQueries) {
    const cleaned = stripBrandFromQuery(raw, brandTokens);
    if (cleaned.length > 5) queries.push(cleaned);
  }

  // Method 2: Strip brand from full title, take first 5-6 meaningful words
  const titleWithoutBrand = stripBrandFromQuery(product.title, brandTokens);
  const titleWords = titleWithoutBrand.split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(' ');
  if (titleWords.length > 5 && !queries.includes(titleWords)) queries.push(titleWords);

  // Method 3: Use subcategory if available (e.g. "Dry Texture Hair Spray")
  if (product.subcategory && product.subcategory.length > 3) {
    const subWithoutBrand = stripBrandFromQuery(product.subcategory, brandTokens);
    if (subWithoutBrand.length > 5 && !queries.includes(subWithoutBrand)) queries.push(subWithoutBrand);
  }

  // Method 4: Keywords without brand
  const keywordQuery = product.keywords
    .filter(k => k.length > 3 && !brandTokens.has(k.toLowerCase()))
    .slice(0, 4).join(' ');
  if (keywordQuery.length > 8 && !queries.includes(keywordQuery)) queries.push(keywordQuery);

  // Deduplicate and clean
  const unique = [...new Set(queries.map(q =>
    q.replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/[,;:!()[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  ))].filter(q => q.split(/\s+/).length >= 2);

  // AI distillation: produce concise ENGLISH product-type queries for Datafeedr.
  // Handles: non-English product titles, multi-product sets, ambiguous product types.
  const apiKey = env?.OPENAI_API_KEY;
  if (apiKey && unique.length > 0) {
    try {
      const { aiComplete } = await import('../services/ai-client');
      const context = unique.slice(0, 3).join(' | ');
      const categoryHint = product.category !== 'General' ? product.category : '';
      console.log(`[Agent] AI distillation input: "${context}" (category: ${categoryHint})`);
      const distilled = await aiComplete({
        prompt: `You are an affiliate product search expert. Given these product descriptions:
"${context}"
${categoryHint ? `Product category: ${categoryHint}` : ''}
${product.title ? `Full product name: "${product.title}"` : ''}

Generate exactly 2 search queries IN ENGLISH that would find similar products in an affiliate product database.
- Query 1: The most specific 2-4 word product type (e.g. "hyaluronic acid face serum", "air fryer", "mma sparring gloves", "merino hiking socks", "hair moisture treatment set")
- Query 2: A broader 1-3 word product category (e.g. "face serum", "kitchen fryer", "boxing gloves", "hiking socks", "hair care set")

RULES:
- ALWAYS output in English, even if the input is in German/French/other languages
- Never include brand names
- For nutrition/supplement products, use terms like "sports supplement" or "protein powder", NOT "sports gear"
- For product sets/kits, describe what's IN the set (e.g. "hair care travel kit" not just "travel set")

Return ONLY two lines, nothing else:
specific query
broad query`,
        maxTokens: 40,
        apiKey,
      });
      const lines = distilled.trim().split('\n').map(l => l.trim().replace(/^["'\d.)\-]+\s*/, '').replace(/["']/g, '').toLowerCase()).filter(l => l.length >= 3);
      console.log(`[Agent] AI distillation output: ${lines.map(l => `"${l}"`).join(', ')}`);

      const validQueries = lines.filter(l => l.split(/\s+/).length >= 1 && l.split(/\s+/).length <= 6);
      if (validQueries.length > 0) {
        const merged = [...validQueries, ...unique.filter(q => !validQueries.includes(q.toLowerCase()))];
        console.log(`[Agent] AI distilled queries accepted: ${validQueries.map(q => `"${q}"`).join(', ')}`);
        return merged;
      }
    } catch (e: any) {
      console.warn(`[Agent] AI distillation failed: ${e?.message || e}`);
    }
  } else if (!apiKey) {
    console.warn('[Agent] No OPENAI_API_KEY — skipping AI distillation');
  }

  return unique.length > 0 ? unique : [product.title.slice(0, 50)];
}

function extractBrandTokens(brand: string | null): Set<string> {
  if (!brand) return new Set();
  return new Set(
    brand.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1)
  );
}

function stripBrandFromQuery(text: string, brandTokens: Set<string>): string {
  if (brandTokens.size === 0) return text;
  return text.split(/\s+/)
    .filter(word => !brandTokens.has(word.toLowerCase().replace(/[^a-z0-9]/g, '')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBrandExclusions(product: IdentifiedProduct): string[] {
  const exclusions: string[] = [];
  if (product.brand) {
    exclusions.push(product.brand);
    const parts = product.brand.split(/\s+/).filter(w => w.length > 2);
    for (const part of parts) {
      if (!exclusions.includes(part)) exclusions.push(part);
    }
  }
  return exclusions;
}

function isSameBrandFuzzy(candidateBrand: string | null | undefined, originalBrand: string | null): boolean {
  if (!candidateBrand || !originalBrand) return false;
  const a = candidateBrand.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const b = originalBrand.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aFirst = a.split(' ')[0];
  const bFirst = b.split(' ')[0];
  return aFirst.length >= 3 && aFirst === bFirst;
}

function buildSemanticQueryText(product: IdentifiedProduct): string {
  // Build a rich text description of the PRODUCT TYPE for semantic matching
  // Include category context so embeddings understand intent
  const parts = [
    product.subcategory || '',
    product.title,
    product.category !== 'General' ? product.category : '',
    product.keywords.slice(0, 5).join(' '),
  ].filter(Boolean);
  return parts.join(' ').slice(0, 400);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Search Strategy Generator
// ═══════════════════════════════════════════════════════════════════════════════

interface SearchStrategy {
  name: string;
  query: string;
  priceMin?: number;
  priceMax?: number;
  sourceNames?: string[];
}

async function generateSearchStrategies(
  productTypeQueries: string[],
  product: IdentifiedProduct,
  profile: CreatorProfile
): Promise<SearchStrategy[]> {
  const strategies: SearchStrategy[] = [];

  // Strategy 1: Direct product type search (most targeted)
  for (const query of productTypeQueries.slice(0, 2)) {
    strategies.push({ name: 'product_type', query });
  }

  // Strategy 2: Broader single-word category search to catch in-stock products
  // "square sunglasses" might be too narrow — also try just "sunglasses"
  if (productTypeQueries.length > 0) {
    const words = productTypeQueries[0].split(/\s+/);
    if (words.length >= 2) {
      const lastWord = words[words.length - 1];
      if (lastWord.length >= 5) {
        strategies.push({ name: 'broad_type', query: lastWord });
      }
    }
  }

  // Strategy 3: Product type + price range anchored to original
  if (product.price && productTypeQueries.length > 0) {
    strategies.push({
      name: 'price_anchored',
      query: productTypeQueries[0],
      priceMin: Math.round(product.price * 0.3 * 100),
      priceMax: Math.round(product.price * 3.0 * 100),
    });
  }

  // Strategy 4: Search within creator's preferred networks
  const { resolveSourceNames } = await import('../services/datafeedr-client');
  const sourceNames = resolveSourceNames(profile.storefrontContext.preferredNetworks);
  if (sourceNames.length > 0 && productTypeQueries.length > 0) {
    strategies.push({
      name: 'preferred_networks',
      query: productTypeQueries[0],
      sourceNames,
    });
  }

  // Strategy 5: Broader category search if product type queries are narrow
  if (product.subcategory && product.subcategory !== productTypeQueries[0]) {
    const brandTokens = extractBrandTokens(product.brand);
    const cleaned = stripBrandFromQuery(product.subcategory, brandTokens);
    if (cleaned.length > 3) {
      strategies.push({ name: 'broader_category', query: cleaned });
    }
  }

  // Strategy 6: Category-anchored fallback
  // When the product type queries are ambiguous (e.g. "sport perform" for a supplement),
  // add a search using the inferred category as a search term.
  // This ensures that Health & Nutrition products get queries like "nutrition supplement"
  // instead of relying solely on the product name.
  if (product.category && product.category !== 'General') {
    const categoryQueries = buildCategoryFallbackQueries(product.category);
    for (const cq of categoryQueries) {
      if (!strategies.some(s => s.query.toLowerCase() === cq.toLowerCase())) {
        strategies.push({ name: 'category_fallback', query: cq });
      }
    }
  }

  return strategies;
}

function buildCategoryFallbackQueries(category: string): string[] {
  const categoryQueryMap: Record<string, string[]> = {
    'Health & Nutrition': ['nutrition supplement', 'sports supplement', 'health supplement'],
    'Sports Nutrition': ['sports nutrition', 'protein supplement', 'sports drink'],
    'Beauty & Health': ['beauty health product', 'skincare', 'personal care'],
    'Electronics': ['electronics gadget', 'tech accessory'],
    'Fashion': ['fashion clothing', 'apparel'],
    'Home & Garden': ['home decor', 'household'],
    'Sports & Outdoors': ['sports equipment', 'fitness gear'],
  };
  return categoryQueryMap[category] || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI Fallback for Product Identification (when scraping fails)
// ═══════════════════════════════════════════════════════════════════════════════

async function identifyProductWithAI(url: string, env: any): Promise<IdentifiedProduct | null> {
  if (!env.OPENAI_API_KEY) return null;
  try {
    const { aiComplete, extractJson } = await import('../services/ai-client');
    const text = await aiComplete({
      prompt: `What product is sold at this URL? Analyze the URL structure to identify the product.
URL: ${url}

Return JSON: {"title":"product name","brand":"brand or null","category":"Electronics|Fashion|Home & Garden|Beauty & Health|Sports & Outdoors","subcategory":"specific type","searchQueries":["2-4 word product type WITHOUT brand name","alternative query"],"confidence":0-100}

CRITICAL: searchQueries must describe the product TYPE only, never include the brand. E.g. "cable knit pullover" not "Song of Style pullover".`,
      maxTokens: 250, apiKey: env.OPENAI_API_KEY,
    });
    const parsed = extractJson(text);
    if (parsed?.title && parsed.confidence > 20) {
      return {
        title: parsed.title, brand: parsed.brand || null,
        category: parsed.category || 'General', subcategory: parsed.subcategory || '',
        price: null, currency: 'USD', keywords: [],
        searchQueries: parsed.searchQueries || [], confidence: parsed.confidence,
        source: 'ai_url',
      };
    }
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Post-processing
// ═══════════════════════════════════════════════════════════════════════════════

function deduplicateByName(candidates: ScoredAlternative[]): ScoredAlternative[] {
  const seen = new Map<string, ScoredAlternative>();
  for (const c of candidates) {
    const normalized = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').slice(0, 60);
    const existing = seen.get(normalized);
    if (!existing || c.combinedScore > existing.combinedScore) {
      seen.set(normalized, c);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.combinedScore - a.combinedScore);
}

function enforceDiversity(candidates: ScoredAlternative[], targetSize: number): ScoredAlternative[] {
  const result: ScoredAlternative[] = [];
  const merchantCount = new Map<string, number>();
  const brandCount = new Map<string, number>();

  for (const c of candidates) {
    if (result.length >= targetSize) break;

    const merchant = c.merchant.toLowerCase();
    const brand = c.brand.toLowerCase();

    if ((merchantCount.get(merchant) || 0) >= 2) continue;
    if ((brandCount.get(brand) || 0) >= 2) continue;

    result.push(c);
    merchantCount.set(merchant, (merchantCount.get(merchant) || 0) + 1);
    brandCount.set(brand, (brandCount.get(brand) || 0) + 1);
  }

  if (result.length < targetSize) {
    for (const c of candidates) {
      if (result.length >= targetSize) break;
      if (!result.includes(c)) result.push(c);
    }
  }

  return result;
}

/**
 * Hard category gate — checks if two categories could reasonably overlap.
 * "Beauty > Hair Care" and "Beauty & Health" overlap. "Home > Bedding" and "Beauty" do not.
 */
function categoriesOverlap(candidateCategory: string, originalCategory: string): boolean {
  const a = candidateCategory.toLowerCase();
  const b = originalCategory.toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const groups: string[][] = [
    ['beauty', 'health', 'personal care', 'skincare', 'makeup', 'hair', 'cosmetics', 'fragrance', 'face', 'body care'],
    ['fashion', 'clothing', 'apparel', 'shoes', 'accessories', 'jewelry', 'watches', 'bags', 'sunglasses', 'hosiery', 'socks', 'gloves', 'scarves'],
    ['electronics', 'technology', 'audio', 'computers', 'phones', 'cameras', 'gaming', 'smart home', 'appliances', 'kitchen appliances'],
    ['home', 'garden', 'furniture', 'kitchen', 'bedding', 'bath', 'decor', 'household'],
    ['sports', 'fitness', 'outdoors', 'camping', 'exercise', 'yoga', 'martial arts', 'boxing', 'mma', 'hiking', 'running', 'cycling', 'socks', 'athletic', 'sportswear'],
    ['food', 'beverage', 'grocery', 'supplements', 'nutrition', 'vitamins', 'protein', 'health supplements', 'sports nutrition'],
    ['toys', 'games', 'kids', 'baby', 'dolls'],
    ['books', 'media', 'music', 'movies'],
    ['automotive', 'car', 'vehicle'],
    ['pets', 'dog', 'cat', 'animal'],
  ];

  for (const group of groups) {
    const aInGroup = group.some(kw => a.includes(kw));
    const bInGroup = group.some(kw => b.includes(kw));
    if (aInGroup && bInGroup) return true;
  }

  // Cross-group overlaps that are valid
  const crossLinks: [string[], string[]][] = [
    [['sports', 'fitness', 'outdoors', 'hiking', 'athletic'], ['fashion', 'clothing', 'apparel', 'hosiery', 'socks', 'gloves', 'sportswear']],
    [['sports', 'fitness'], ['food', 'nutrition', 'supplements', 'health']],
    [['home', 'kitchen'], ['electronics', 'appliances']],
    [['beauty', 'health'], ['electronics', 'devices', 'massager']],
  ];

  for (const [groupA, groupB] of crossLinks) {
    const aInA = groupA.some(kw => a.includes(kw));
    const bInB = groupB.some(kw => b.includes(kw));
    const aInB = groupB.some(kw => a.includes(kw));
    const bInA = groupA.some(kw => b.includes(kw));
    if ((aInA && bInB) || (aInB && bInA)) return true;
  }

  return false;
}

function buildAgentReasoning(
  product: IdentifiedProduct,
  profile: CreatorProfile,
  alternatives: ScoredAlternative[],
  iterations: SearchIteration[],
): string {
  const parts: string[] = [];
  parts.push(`Identified "${product.title}" (${product.category}${product.brand ? `, by ${product.brand}` : ''}).`);

  const totalSearched = iterations.reduce((s, i) => s + i.candidateCount, 0);
  parts.push(`Evaluated ${totalSearched} alternatives from different brands across ${iterations.length} searches.`);

  if (profile.productPriorities.length > 0) {
    const top3 = profile.productPriorities.slice(0, 3).map(p => p.id).join(', ');
    parts.push(`Ranked by your priorities: ${top3}.`);
  }

  if (alternatives.length > 0) {
    const topAlt = alternatives[0];
    parts.push(`Best match: "${topAlt.name.slice(0, 50)}" by ${topAlt.brand} (${topAlt.combinedScore}/100).`);
  } else {
    parts.push('No alternatives from different brands met the quality threshold for your priorities.');
  }

  return parts.join(' ');
}
