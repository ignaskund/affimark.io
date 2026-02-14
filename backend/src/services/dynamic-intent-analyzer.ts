/**
 * Dynamic Intent Analyzer
 * Captures and analyzes what the user wants RIGHT NOW for this specific search
 * Combines with static profile for hybrid scoring
 */

import Anthropic from '@anthropic-ai/sdk';
import { UserProfile } from './profile-builder';

export interface DynamicIntent {
  // User-provided context
  searchReason?: string; // "Making a Christmas gift guide video"
  targetAudience?: string; // "Budget-conscious millennials"
  contentFormat?: string; // "Instagram Reel", "YouTube Review", "Blog post"
  urgencyLevel?: 'high' | 'medium' | 'low';

  // Price override
  priceMin?: number;
  priceMax?: number;

  // Temporal signals
  occasion?: string; // "Christmas", "Black Friday", "Back to School"
  deadline?: string; // ISO date

  // Analyzed signals (derived from above)
  inferredPriorityBoosts?: Array<{ priorityId: string; boost: number }>; // +20% to 'price'
  inferredCategories?: string[]; // ["Gifts", "Electronics"]
  confidenceScore?: number; // 0-100
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
 * Analyze dynamic intent from user's current search context
 */
export async function analyzeDynamicIntent(
  rawIntent: Partial<DynamicIntent>,
  userProfile: UserProfile
): Promise<DynamicIntent> {
  console.log('[Dynamic Intent] Analyzing current search context');

  const analyzed: DynamicIntent = {
    ...rawIntent,
    inferredPriorityBoosts: [],
    inferredCategories: [],
    confidenceScore: 0,
  };

  // If user provided search reason, use AI to extract signals
  if (rawIntent.searchReason) {
    const aiAnalysis = await analyzeSearchReasonWithAI(
      rawIntent.searchReason,
      rawIntent.targetAudience,
      userProfile
    );

    analyzed.inferredPriorityBoosts = aiAnalysis.priorityBoosts;
    analyzed.inferredCategories = aiAnalysis.categories;
    analyzed.occasion = aiAnalysis.occasion;
    analyzed.confidenceScore = aiAnalysis.confidence;
  }

  // Extract temporal signals
  if (rawIntent.occasion) {
    const temporalBoosts = getTemporalPriorityBoosts(rawIntent.occasion);
    analyzed.inferredPriorityBoosts = [
      ...(analyzed.inferredPriorityBoosts || []),
      ...temporalBoosts,
    ];
  }

  // Content format signals
  if (rawIntent.contentFormat) {
    const formatBoosts = getContentFormatBoosts(rawIntent.contentFormat);
    analyzed.inferredPriorityBoosts = [
      ...(analyzed.inferredPriorityBoosts || []),
      ...formatBoosts,
    ];
  }

  // Urgency signals
  if (rawIntent.urgencyLevel === 'high' || rawIntent.deadline) {
    // Boost shipping/availability priority
    analyzed.inferredPriorityBoosts?.push({ priorityId: 'shipping', boost: 30 });
  }

  return analyzed;
}

/**
 * Use Claude to analyze search reason and extract priority boosts
 */
async function analyzeSearchReasonWithAI(
  searchReason: string,
  targetAudience?: string,
  userProfile?: UserProfile
): Promise<{
  priorityBoosts: Array<{ priorityId: string; boost: number }>;
  categories: string[];
  occasion?: string;
  confidence: number;
}> {
  const prompt = `Analyze this creator's search intent and suggest priority adjustments:

Search reason: "${searchReason}"
${targetAudience ? `Target audience: "${targetAudience}"` : ''}

${userProfile ? `Their usual priorities:
${userProfile.productPriorities.map((p, i) => `${i + 1}. ${p.id}`).join('\n')}` : ''}

Based on this search context, determine:

1. Which priorities should be BOOSTED for this specific search? (Choose from: quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition)
   - If mentions "budget", "affordable", "cheap" → boost 'price' +30
   - If mentions "gift", "present" → boost 'design' +20, 'warranty' +15
   - If mentions "urgent", "ASAP", "quick" → boost 'shipping' +30
   - If mentions "best", "top quality", "premium" → boost 'quality' +25
   - If mentions "eco-friendly", "sustainable" → boost 'sustainability' +30

2. What product categories are implied? (Electronics, Fashion, Home & Garden, etc.)

3. Is there an occasion? (Christmas, Black Friday, Birthday, etc.)

4. Confidence score (0-100) based on how clear the intent is

Return ONLY valid JSON:
{
  "priorityBoosts": [
    {"priorityId": "price", "boost": 30},
    {"priorityId": "design", "boost": 20}
  ],
  "categories": ["Electronics", "Gifts"],
  "occasion": "Christmas",
  "confidence": 85
}`;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-haiku-20250219',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('[Dynamic Intent] AI analysis failed:', error);
  }

  // Fallback: basic keyword matching
  return analyzeSearchReasonWithKeywords(searchReason, targetAudience);
}

/**
 * Fallback: Keyword-based priority detection
 */
function analyzeSearchReasonWithKeywords(
  searchReason: string,
  targetAudience?: string
): {
  priorityBoosts: Array<{ priorityId: string; boost: number }>;
  categories: string[];
  occasion?: string;
  confidence: number;
} {
  const lower = (searchReason + ' ' + (targetAudience || '')).toLowerCase();
  const boosts: Array<{ priorityId: string; boost: number }> = [];
  const categories: string[] = [];
  let occasion: string | undefined;

  // Price signals
  if (lower.match(/\b(budget|affordable|cheap|under \$|value|deal)\b/)) {
    boosts.push({ priorityId: 'price', boost: 30 });
  }

  // Quality signals
  if (lower.match(/\b(best|premium|high-end|quality|luxury|pro)\b/)) {
    boosts.push({ priorityId: 'quality', boost: 25 });
  }

  // Design signals
  if (lower.match(/\b(gift|present|aesthetic|beautiful|stylish)\b/)) {
    boosts.push({ priorityId: 'design', boost: 20 });
  }

  // Urgency signals
  if (lower.match(/\b(urgent|asap|quick|fast|need soon)\b/)) {
    boosts.push({ priorityId: 'shipping', boost: 30 });
  }

  // Sustainability signals
  if (lower.match(/\b(eco|sustainable|green|ethical|organic)\b/)) {
    boosts.push({ priorityId: 'sustainability', boost: 30 });
  }

  // Reviews signals
  if (lower.match(/\b(proven|tested|reliable|trusted|reviewed)\b/)) {
    boosts.push({ priorityId: 'reviews', boost: 25 });
  }

  // Category detection
  if (lower.match(/\b(tech|electronics|gadget|device)\b/)) {
    categories.push('Electronics');
  }
  if (lower.match(/\b(fashion|clothing|apparel|outfit)\b/)) {
    categories.push('Fashion');
  }
  if (lower.match(/\b(home|decor|furniture|living)\b/)) {
    categories.push('Home & Garden');
  }
  if (lower.match(/\b(beauty|makeup|skincare|cosmetic)\b/)) {
    categories.push('Beauty');
  }
  if (lower.match(/\b(gift|present)\b/)) {
    categories.push('Gifts');
  }

  // Occasion detection
  if (lower.match(/\b(christmas|xmas|holiday)\b/)) {
    occasion = 'Christmas';
  } else if (lower.match(/\b(black friday|cyber monday)\b/)) {
    occasion = 'Black Friday';
  } else if (lower.match(/\b(valentine|anniversary)\b/)) {
    occasion = 'Valentine\'s Day';
  } else if (lower.match(/\b(birthday|bday)\b/)) {
    occasion = 'Birthday';
  }

  return {
    priorityBoosts: boosts,
    categories,
    occasion,
    confidence: boosts.length > 0 ? 70 : 30,
  };
}

/**
 * Get priority boosts based on occasion/season
 */
function getTemporalPriorityBoosts(
  occasion: string
): Array<{ priorityId: string; boost: number }> {
  const boosts: Array<{ priorityId: string; boost: number }> = [];

  switch (occasion.toLowerCase()) {
    case 'christmas':
    case 'holiday':
      boosts.push({ priorityId: 'design', boost: 25 });
      boosts.push({ priorityId: 'warranty', boost: 15 });
      boosts.push({ priorityId: 'shipping', boost: 20 });
      break;

    case 'black friday':
    case 'cyber monday':
      boosts.push({ priorityId: 'price', boost: 40 });
      boosts.push({ priorityId: 'reviews', boost: 20 });
      break;

    case 'back to school':
      boosts.push({ priorityId: 'price', boost: 25 });
      boosts.push({ priorityId: 'warranty', boost: 20 });
      break;

    case 'valentine\'s day':
    case 'anniversary':
      boosts.push({ priorityId: 'design', boost: 30 });
      boosts.push({ priorityId: 'quality', boost: 25 });
      break;

    case 'birthday':
      boosts.push({ priorityId: 'design', boost: 20 });
      break;
  }

  return boosts;
}

/**
 * Get priority boosts based on content format
 */
function getContentFormatBoosts(
  format: string
): Array<{ priorityId: string; boost: number }> {
  const boosts: Array<{ priorityId: string; boost: number }> = [];

  switch (format.toLowerCase()) {
    case 'instagram reel':
    case 'tiktok':
    case 'short video':
      // Visual appeal matters more
      boosts.push({ priorityId: 'design', boost: 20 });
      break;

    case 'youtube review':
    case 'long form video':
      // Thorough review, quality matters
      boosts.push({ priorityId: 'quality', boost: 20 });
      boosts.push({ priorityId: 'reviews', boost: 15 });
      break;

    case 'blog post':
    case 'article':
      // Need affiliate programs with good commission
      boosts.push({ priorityId: 'commission', boost: 15 });
      break;

    case 'newsletter':
    case 'email':
      // Higher commitment, need quality
      boosts.push({ priorityId: 'quality', boost: 20 });
      boosts.push({ priorityId: 'brand_recognition', boost: 15 });
      break;
  }

  return boosts;
}

/**
 * Apply dynamic intent to user profile (create adjusted profile)
 *
 * CRITICAL FIX: Uses WEIGHT MULTIPLIERS instead of rank swaps
 * - Prevents priority thrashing
 * - Smooth, predictable behavior
 * - Base ranking stays stable (user identity preserved)
 */
export function applyDynamicIntent(
  baseProfile: UserProfile,
  dynamicIntent: DynamicIntent
): UserProfile {
  const adjusted = { ...baseProfile };

  // Apply priority boosts using WEIGHT MULTIPLIERS (not rank changes)
  if (dynamicIntent.inferredPriorityBoosts && dynamicIntent.inferredPriorityBoosts.length > 0) {
    // Clone priorities and apply multipliers
    const boostedPriorities = baseProfile.productPriorities.map(p => ({ ...p }));

    for (const boost of dynamicIntent.inferredPriorityBoosts) {
      const existingIndex = boostedPriorities.findIndex(p => p.id === boost.priorityId);

      if (existingIndex >= 0) {
        // Apply smooth weight multiplier to existing priority
        const current = boostedPriorities[existingIndex];

        // Convert boost (0-100) to multiplier (1.0 - 2.5)
        // boost=10 → 1.1x
        // boost=20 → 1.2x
        // boost=30 → 1.4x
        // boost=50 → 1.8x
        // Max boost=100 → 2.5x (clamped to prevent extreme behavior)
        const boostFactor = Math.min(2.5, 1 + (boost.boost / 100));

        // Store multiplier (will be used during scoring)
        current.weightMultiplier = (current.weightMultiplier || 1.0) * boostFactor;

        console.log(`[Dynamic Intent] Boosted "${boost.priorityId}" rank ${current.rank} by ${boost.boost}% → ${boostFactor.toFixed(2)}x multiplier`);
      } else {
        // Add as new low-priority item with weight boost
        const boostFactor = Math.min(2.0, 1 + (boost.boost / 100));

        boostedPriorities.push({
          id: boost.priorityId,
          rank: baseProfile.productPriorities.length + 1, // Append to end
          weightMultiplier: boostFactor, // NEW: Apply multiplier to base weight
        });

        console.log(`[Dynamic Intent] Added new priority "${boost.priorityId}" with ${boostFactor.toFixed(2)}x multiplier`);
      }
    }

    // NO RE-SORTING - ranks stay stable
    adjusted.productPriorities = boostedPriorities;
  }

  // Override price range if specified
  if (dynamicIntent.priceMin !== undefined || dynamicIntent.priceMax !== undefined) {
    // Store in profile context (will be used by search)
    adjusted.storefrontContext = {
      ...adjusted.storefrontContext,
      avgPricePoint:
        dynamicIntent.priceMin && dynamicIntent.priceMax
          ? (dynamicIntent.priceMin + dynamicIntent.priceMax) / 2
          : adjusted.storefrontContext.avgPricePoint,
    };
  }

  return adjusted;
}

/**
 * Generate explanation of how dynamic intent affected the search
 */
export function explainDynamicIntent(dynamicIntent: DynamicIntent): string {
  const explanations: string[] = [];

  if (dynamicIntent.searchReason) {
    explanations.push(`Adjusted for: "${dynamicIntent.searchReason}"`);
  }

  if (dynamicIntent.inferredPriorityBoosts && dynamicIntent.inferredPriorityBoosts.length > 0) {
    const boosted = dynamicIntent.inferredPriorityBoosts.map(b => b.priorityId).join(', ');
    explanations.push(`Prioritizing: ${boosted}`);
  }

  if (dynamicIntent.priceMin || dynamicIntent.priceMax) {
    explanations.push(
      `Price range: $${dynamicIntent.priceMin || '?'} - $${dynamicIntent.priceMax || '?'}`
    );
  }

  if (dynamicIntent.occasion) {
    explanations.push(`Optimized for ${dynamicIntent.occasion}`);
  }

  return explanations.join(' • ');
}
