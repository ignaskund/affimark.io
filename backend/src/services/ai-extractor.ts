/**
 * AI Extraction Service
 * Uses Cloudflare Workers AI to extract brand/category when rules fail
 */

interface AIExtractionInput {
  url: string;
  title?: string | null;
  userIntensity?: 'off' | 'light' | 'full';
}

interface AIExtractionResult {
  brand: {
    name: string;
    confidence: number;
    source: 'ai';
  };
  category: {
    name: string;
    confidence: number;
    source: 'ai';
  };
  reasoning: string;
}

interface Env {
  AI: any;
  AI_CACHE?: KVNamespace;
  AI_ENABLED?: string;
}

/**
 * Extract product info using Cloudflare Workers AI
 * Falls back gracefully if AI is disabled or fails
 */
export async function extractWithAI(
  input: AIExtractionInput,
  env: Env
): Promise<AIExtractionResult | null> {
  // Check if AI is enabled
  if (env.AI_ENABLED === 'false' || input.userIntensity === 'off') {
    return null;
  }

  // Check cache first (avoid re-analyzing same product)
  const cacheKey = `ai:extract:${input.url}`;
  if (env.AI_CACHE) {
    const cached = await env.AI_CACHE.get(cacheKey, 'json');
    if (cached) {
      return cached as AIExtractionResult;
    }
  }

  try {
    // Prepare context
    const context = input.title
      ? `URL: ${input.url}\nTitle: ${input.title}`
      : `URL: ${input.url}`;

    // Call Workers AI with Llama 3 8B (good for extraction)
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a product classifier. Extract the brand name and category from the given product URL/title.

Categories: electronics, fashion, beauty, home, sports, software, travel, food, kids, luxury, general

Respond ONLY with valid JSON in this exact format:
{
  "brand": "Sony",
  "category": "electronics",
  "confidence_brand": 0.85,
  "confidence_category": 0.75,
  "reasoning": "URL contains sony.com and title mentions headphones"
}

If unclear, use "Unknown" for brand and "general" for category with low confidence.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 256
    });

    // Parse AI response
    let parsed;
    try {
      // Workers AI returns { response: "..." }
      const text = response.response || response;

      // Clean up response (remove markdown code blocks if present)
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[AI Extractor] Failed to parse AI response:', response);
      return null;
    }

    // Validate and structure result
    const result: AIExtractionResult = {
      brand: {
        name: parsed.brand || 'Unknown',
        confidence: Math.max(0, Math.min(1, parsed.confidence_brand || 0.5)),
        source: 'ai'
      },
      category: {
        name: parsed.category || 'general',
        confidence: Math.max(0, Math.min(1, parsed.confidence_category || 0.5)),
        source: 'ai'
      },
      reasoning: parsed.reasoning || 'AI extraction completed'
    };

    // Cache for 7 days
    if (env.AI_CACHE) {
      await env.AI_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 60 * 60 * 24 * 7 // 7 days
      });
    }

    return result;

  } catch (error) {
    console.error('[AI Extractor] Error:', error);
    return null; // Graceful degradation
  }
}

/**
 * Personalize insights using AI
 * Rewrites generic insights to be contextual to user
 */
export async function personalizeInsights(
  insights: Array<{
    type: string;
    title: string;
    description: string;
    priority: string;
  }>,
  userContext: {
    analysisCount: number;
    primaryNiches?: string[];
    totalSavingsFound?: number;
    experienceLevel?: 'new' | 'intermediate' | 'advanced';
  },
  env: Env
): Promise<typeof insights> {
  // Only personalize if user wants full AI
  if (env.AI_ENABLED === 'false') {
    return insights;
  }

  try {
    // Build context prompt
    const contextStr = `
User Profile:
- Analyses performed: ${userContext.analysisCount}
- Experience level: ${userContext.experienceLevel || 'new'}
- Primary niches: ${userContext.primaryNiches?.join(', ') || 'unknown'}
- Total savings found: €${userContext.totalSavingsFound || 0}

Insights to personalize (keep under 200 chars each):
${insights.map((i, idx) => `${idx + 1}. ${i.title}: ${i.description}`).join('\n')}
`;

    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a helpful commission optimization assistant. Rewrite these insights to be more personal and contextual to the user's experience level.

For new users: Add encouraging context, explain basics
For intermediate users: Be concise, focus on action
For advanced users: Skip basics, show advanced opportunities

Respond with valid JSON array matching input structure:
[
  {"type": "opportunity", "title": "...", "description": "...", "priority": "high"},
  ...
]`
        },
        {
          role: 'user',
          content: contextStr
        }
      ],
      temperature: 0.3,
      max_tokens: 512
    });

    const text = response.response || response;
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const personalized = JSON.parse(cleaned);

    // Validate structure matches
    if (Array.isArray(personalized) && personalized.length === insights.length) {
      return personalized.map((p: any, idx: number) => ({
        ...insights[idx], // Keep original as fallback
        title: p.title || insights[idx].title,
        description: p.description || insights[idx].description
      }));
    }

    return insights; // Fallback to original

  } catch (error) {
    console.error('[AI Personalizer] Error:', error);
    return insights; // Graceful degradation
  }
}

/**
 * Calculate confidence score based on detection method
 */
export function calculateBrandConfidence(
  detectedFrom: 'user_provided' | 'known_brands' | 'alias_db' | 'url_domain' | 'title_heuristic' | 'ai' | 'none',
  aiConfidence?: number
): number {
  const baseConfidence: Record<string, number> = {
    user_provided: 1.0,
    known_brands: 0.9,
    alias_db: 0.85,
    url_domain: 0.7,
    ai: aiConfidence || 0.6,
    title_heuristic: 0.4,
    none: 0.1
  };

  return baseConfidence[detectedFrom] || 0.5;
}

/**
 * Calculate category confidence
 */
export function calculateCategoryConfidence(
  detectedFrom: 'keywords' | 'db_lookup' | 'ai' | 'default',
  aiConfidence?: number
): number {
  const baseConfidence: Record<string, number> = {
    keywords: 0.8,
    db_lookup: 0.9,
    ai: aiConfidence || 0.6,
    default: 0.3
  };

  return baseConfidence[detectedFrom] || 0.5;
}
