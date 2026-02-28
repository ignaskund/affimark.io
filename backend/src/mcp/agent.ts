/**
 * MCP Alternative Search Agent — Orchestrator
 *
 * This is the brain. It uses the MCP tools in an intelligent loop:
 *   1. Load creator profile (understand WHO is searching)
 *   2. Identify the product (understand WHAT they inserted)
 *   3. Generate multiple search strategies based on product + profile
 *   4. Execute searches iteratively, evaluate quality, refine if needed
 *   5. Score ALL candidates with full KPI pipeline
 *   6. Return the best alternatives that are BETTER than the original
 *
 * Key difference from the old pipeline: the agent ITERATES.
 * If the first search returns garbage, it reformulates and tries again.
 * It also uses the original product as a quality floor — alternatives
 * must be genuinely competitive, not just keyword-matched.
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
const SEMANTIC_THRESHOLD = 35;
const COMBINED_SCORE_FLOOR = 35;
const TOP_K = 5;

const WHITE_LABEL_MERCHANTS = new Set([
  'temu', 'wish', 'alibaba', 'aliexpress', 'shein', 'banggood', 'gearbest', 'dhgate',
]);

export async function runAlternativeSearchAgent(
  productUrl: string,
  userId: string,
  env: any,
): Promise<AgentSearchResult> {
  const startTime = Date.now();
  const iterations: SearchIteration[] = [];
  const allCandidateIds = new Set<string>();
  let allScoredCandidates: ScoredAlternative[] = [];

  // ── STEP 1: Load creator profile ──────────────────────────────────────────
  console.log('[Agent] Step 1: Loading creator profile...');
  const profile = await getCreatorProfile(userId, env);
  console.log(`[Agent] Profile loaded. Confidence: ${profile.confidenceScore}%. Priorities: product=[${profile.productPriorities.slice(0, 3).map(p => p.id).join(',')}] brand=[${profile.brandPriorities.slice(0, 3).map(p => p.id).join(',')}]`);

  const qualityFocused = profile.productPriorities.slice(0, 2).some(p =>
    ['quality', 'brand_recognition', 'reviews'].includes(p.id)
  );

  // ── STEP 2: Identify the product ──────────────────────────────────────────
  console.log('[Agent] Step 2: Identifying product from URL...');
  const product = await identifyProduct(productUrl, env);

  if (product.confidence < 15 || !product.title) {
    console.warn('[Agent] Product identification failed');
    return {
      originalProduct: product,
      alternatives: [],
      searchIterations: [],
      totalCandidatesEvaluated: 0,
      agentReasoning: 'Could not identify the product from this URL. The page may be protected or the URL structure is not recognizable.',
      searchDurationMs: Date.now() - startTime,
    };
  }

  console.log(`[Agent] Product identified: "${product.title}" | Brand: ${product.brand || 'unknown'} | Category: ${product.category} | Price: ${product.price || 'unknown'} | Confidence: ${product.confidence}%`);

  // ── STEP 3: Generate search strategies ────────────────────────────────────
  // Multiple queries with different specificity levels to maximize coverage
  const strategies = generateSearchStrategies(product, profile);
  console.log(`[Agent] Generated ${strategies.length} search strategies`);

  // ── STEP 4: Iterative search loop ─────────────────────────────────────────
  for (let i = 0; i < Math.min(strategies.length, MAX_ITERATIONS); i++) {
    const strategy = strategies[i];
    console.log(`[Agent] Iteration ${i + 1}/${strategies.length}: "${strategy.query}" (${strategy.name})`);

    const candidates = await searchAlternatives(strategy.query, {
      priceMin: strategy.priceMin,
      priceMax: strategy.priceMax,
      inStockOnly: true,
      limit: 100,
      sourceNames: strategy.sourceNames,
      excludeBrands: product.brand ? [product.brand] : undefined,
    }, env);

    const newCandidates = candidates.filter(c => !allCandidateIds.has(c.id));
    newCandidates.forEach(c => allCandidateIds.add(c.id));

    if (newCandidates.length === 0) {
      iterations.push({ query: strategy.query, strategy: strategy.name, candidateCount: 0, relevantCount: 0, topScore: 0, avgSemanticScore: 0 });
      continue;
    }

    // Compute semantic similarity in batch
    const queryText = [product.subcategory || product.category, product.title, product.keywords.slice(0, 5).join(' ')].filter(Boolean).join(' ');
    let semanticScores = await computeSemanticScores(queryText, newCandidates, env);

    // Fallback: if embedding API failed, use keyword overlap so we still have scores
    if (semanticScores.size === 0) {
      console.log('[Agent] Semantic embeddings returned empty — using keyword overlap fallback');
      const { keywordOverlapScore } = await import('../services/semantic-ranker');
      semanticScores = new Map();
      const intent = { searchQuery: queryText, keywords: product.keywords };
      for (const c of newCandidates) {
        semanticScores.set(c.id, keywordOverlapScore(intent, { name: c.name, brand: c.brand, category: c.category, description: c.description }));
      }
    }

    // Pre-filter by semantic score to avoid wasting time scoring garbage
    const semanticFiltered = newCandidates.filter(c => {
      const sem = semanticScores.get(c.id) ?? 0;
      return sem >= SEMANTIC_THRESHOLD;
    });

    // Filter white-label merchants when user cares about quality
    const qualityFiltered = qualityFocused
      ? semanticFiltered.filter(c => !WHITE_LABEL_MERCHANTS.has(c.merchant.toLowerCase()))
      : semanticFiltered;

    // Score surviving candidates
    const scored = await Promise.all(
      qualityFiltered.slice(0, 30).map(c =>
        scoreCandidate(c, product, profile, semanticScores.get(c.id) ?? 0, env)
      )
    );

    // Log detailed filter stats for debugging
    const passedCombined = scored.filter(s => s.combinedScore >= COMBINED_SCORE_FLOOR);
    const passedCategory = passedCombined.filter(s => s.comparisonToOriginal.categoryMatch);
    console.log(`[Agent] Filter breakdown: ${scored.length} scored → ${passedCombined.length} passed combined≥${COMBINED_SCORE_FLOOR} → ${passedCategory.length} passed category match`);
    if (passedCombined.length > 0 && passedCategory.length === 0) {
      console.log(`[Agent] Category mismatch examples: ${passedCombined.slice(0, 3).map(s => `"${s.name.slice(0, 40)}" (cat=${s.category}, orig=${product.category})`).join(', ')}`);
    }

    // Use category match as soft signal, not hard gate — many Datafeedr products
    // have wrong/missing categories. Combined score already penalizes mismatches.
    const relevant = passedCombined;
    allScoredCandidates.push(...relevant);

    const avgSem = semanticScores.size > 0
      ? Math.round([...semanticScores.values()].reduce((a, b) => a + b, 0) / semanticScores.size)
      : 0;
    iterations.push({
      query: strategy.query,
      strategy: strategy.name,
      candidateCount: newCandidates.length,
      relevantCount: relevant.length,
      topScore: relevant.length > 0 ? Math.max(...relevant.map(r => r.combinedScore)) : 0,
      avgSemanticScore: avgSem,
    });

    console.log(`[Agent] Iteration ${i + 1}: ${newCandidates.length} new candidates → ${semanticFiltered.length} semantic pass → ${qualityFiltered.length} quality pass → ${relevant.length} relevant (top score: ${relevant.length > 0 ? Math.max(...relevant.map(r => r.combinedScore)) : 0})`);

    // Early exit if we have enough quality results
    if (allScoredCandidates.length >= MIN_QUALITY_CANDIDATES * 2) {
      console.log(`[Agent] Sufficient candidates found (${allScoredCandidates.length}), stopping search`);
      break;
    }
  }

  // ── STEP 5: Final ranking & diversity ─────────────────────────────────────
  allScoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);

  // Deduplicate by name similarity
  const deduped = deduplicateByName(allScoredCandidates);

  // Enforce diversity: max 2 per merchant, prefer different brands
  const diverse = enforceDiversity(deduped, TOP_K);

  // ── STEP 6: Build agent reasoning ─────────────────────────────────────────
  const agentReasoning = buildAgentReasoning(product, profile, diverse, iterations);

  console.log(`[Agent] Complete: ${diverse.length} alternatives from ${allCandidateIds.size} candidates evaluated in ${Date.now() - startTime}ms`);
  for (const alt of diverse) {
    console.log(`  → "${alt.name.slice(0, 60)}" | combined=${alt.combinedScore} semantic=${alt.semanticSimilarity} priority=${alt.priorityWeightedScore} feasibility=${alt.outcomeFeasibility}`);
  }

  return {
    originalProduct: product,
    alternatives: diverse,
    searchIterations: iterations,
    totalCandidatesEvaluated: allCandidateIds.size,
    agentReasoning,
    searchDurationMs: Date.now() - startTime,
  };
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

function generateSearchStrategies(
  product: IdentifiedProduct,
  profile: CreatorProfile
): SearchStrategy[] {
  const strategies: SearchStrategy[] = [];

  // Use AI-generated search queries (most targeted)
  // Clean noise: HTML entities, stop words, trailing punctuation
  for (const rawQuery of product.searchQueries) {
    if (!rawQuery || rawQuery.length < 4) continue;
    const query = rawQuery
      .replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ')
      .replace(/[,;:!]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    // Drop overly generic queries (single word or just a brand)
    if (query.split(/\s+/).length < 2) continue;
    strategies.push({ name: 'primary_query', query });
  }

  // Category + subcategory search (broader)
  if (product.subcategory && product.subcategory.length > 3) {
    strategies.push({ name: 'subcategory', query: product.subcategory });
  }

  // Keyword-based search (broadest)
  const keywordQuery = product.keywords
    .filter(k => k.length > 3 && (!product.brand || !k.toLowerCase().includes(product.brand.toLowerCase())))
    .slice(0, 3)
    .join(' ');
  if (keywordQuery.length > 5 && !strategies.some(s => s.query === keywordQuery)) {
    strategies.push({ name: 'keywords', query: keywordQuery });
  }

  // Price-anchored version of the best query
  if (product.price && strategies.length > 0) {
    strategies.push({
      name: 'price_anchored',
      query: strategies[0].query,
      priceMin: Math.round(product.price * 0.3 * 100),
      priceMax: Math.round(product.price * 3.0 * 100),
    });
  }

  // Preferred-network search using user's connected storefronts
  const { resolveSourceNames } = require('../services/datafeedr-client');
  const sourceNames = resolveSourceNames(profile.storefrontContext.preferredNetworks);
  if (sourceNames.length > 0 && strategies.length > 0) {
    strategies.push({
      name: 'preferred_networks',
      query: strategies[0].query,
      sourceNames,
    });
  }

  // Deduplicate strategies by query
  const seen = new Set<string>();
  return strategies.filter(s => {
    const key = `${s.query}|${s.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  // Fill remaining slots if diversity was too strict
  if (result.length < targetSize) {
    for (const c of candidates) {
      if (result.length >= targetSize) break;
      if (!result.includes(c)) result.push(c);
    }
  }

  return result;
}

function buildAgentReasoning(
  product: IdentifiedProduct,
  profile: CreatorProfile,
  alternatives: ScoredAlternative[],
  iterations: SearchIteration[],
): string {
  const parts: string[] = [];

  parts.push(`Identified "${product.title}" (${product.category}, ${product.brand || 'unknown brand'}).`);

  const totalSearched = iterations.reduce((s, i) => s + i.candidateCount, 0);
  const totalRelevant = iterations.reduce((s, i) => s + i.relevantCount, 0);
  parts.push(`Searched ${totalSearched} products across ${iterations.length} strategies, found ${totalRelevant} relevant.`);

  if (profile.productPriorities.length > 0) {
    const top3 = profile.productPriorities.slice(0, 3).map(p => p.id).join(', ');
    parts.push(`Prioritized by your preferences: ${top3}.`);
  }

  if (alternatives.length > 0) {
    const topAlt = alternatives[0];
    parts.push(`Top pick: "${topAlt.name.slice(0, 50)}" (score ${topAlt.combinedScore}/100) — ${topAlt.reasonSummary || 'strong match'}.`);
  } else {
    parts.push('No alternatives met the quality threshold for your priorities.');
  }

  return parts.join(' ');
}
