/**
 * Product Intent Analyzer
 * Uses Claude AI to extract category, brand, and search intent from product URLs
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ProductIntent {
  category: string; // "Electronics", "Home & Garden", etc.
  subcategory?: string; // "Table Lamps", "Wireless Headphones", etc.
  brand?: string; // "Philips", "Sony", "Apple", etc.
  priceRange?: 'budget' | 'mid-range' | 'premium';
  keywords: string[]; // ["smart", "LED", "dimmable"]
  searchQuery: string; // "smart LED desk lamp"
  confidence: number; // 0-100
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
 * Analyze a product URL and extract search intent using AI
 */
export async function analyzeProductIntent(url: string): Promise<ProductIntent> {
  console.log('[Intent Analyzer] Analyzing URL:', url);

  // Try AI analysis first
  try {
    const aiIntent = await analyzeWithAI(url);
    if (aiIntent.confidence >= 70) {
      console.log('[Intent Analyzer] AI analysis successful:', aiIntent);
      return aiIntent;
    }
  } catch (error) {
    console.error('[Intent Analyzer] AI analysis failed:', error);
  }

  // Fallback to URL structure analysis
  console.log('[Intent Analyzer] Using fallback analysis');
  return analyzeFromUrlStructure(url);
}

/**
 * Use Claude AI to extract intent from product URL
 */
async function analyzeWithAI(url: string): Promise<ProductIntent> {
  const prompt = `Analyze this product URL and extract search intent:

URL: ${url}

Extract:
1. Primary category from: Electronics, Fashion, Home & Garden, Beauty & Health, Sports & Outdoors, Toys & Games, Books & Media, Food & Beverage, Automotive, Pet Supplies, Office & School, Arts & Crafts
2. Subcategory (be specific, e.g., "Wireless Headphones", "Smart Light Bulbs", "Running Shoes")
3. Brand name (if identifiable from URL path/domain)
4. Price tier: "budget" if URL contains words like "lite/basic/essential", "premium" if "pro/plus/premium/deluxe", otherwise "mid-range"
5. Key product attributes from URL (e.g., "wireless", "smart", "LED", "noise-cancelling")
6. A search query to find similar products (2-5 words)
7. Confidence score 0-100 based on how clear the URL is

Examples:
- amazon.de/sony-wh1000xm5-headphones → Electronics, Wireless Headphones, Sony, mid-range, ["wireless", "noise-cancelling"], "Sony wireless headphones"
- philips-hue.com/smart-white-led → Home & Garden, Smart Lighting, Philips, mid-range, ["smart", "LED", "white"], "smart LED bulb"

Return ONLY valid JSON in this exact format:
{
  "category": "...",
  "subcategory": "...",
  "brand": "...",
  "priceRange": "budget|mid-range|premium",
  "keywords": ["...", "..."],
  "searchQuery": "...",
  "confidence": 85
}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-3-5-haiku-20250219', // Use Haiku for speed and cost
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Extract JSON from response (Claude might add explanation text)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const intent = JSON.parse(jsonMatch[0]);

  // Validate response
  if (!intent.category || !intent.searchQuery) {
    throw new Error('Invalid intent structure from Claude');
  }

  return intent;
}

/**
 * Fallback: Extract intent from URL structure without AI
 */
function analyzeFromUrlStructure(url: string): ProductIntent {
  const urlLower = url.toLowerCase();
  const pathParts = new URL(url).pathname.split('/').filter(Boolean);

  // Extract potential brand from domain
  const domain = new URL(url).hostname.replace('www.', '');
  const domainParts = domain.split('.');
  const potentialBrand = domainParts[0];

  // Extract keywords from URL path
  const keywords: string[] = [];
  const commonKeywords = [
    'smart',
    'wireless',
    'led',
    'pro',
    'plus',
    'premium',
    'lite',
    'mini',
    'max',
    'ultra',
    'portable',
    'rechargeable',
  ];

  for (const keyword of commonKeywords) {
    if (urlLower.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  // Detect price range
  let priceRange: 'budget' | 'mid-range' | 'premium' = 'mid-range';
  if (urlLower.match(/\b(lite|basic|essential|mini|budget)\b/)) {
    priceRange = 'budget';
  } else if (urlLower.match(/\b(pro|plus|premium|deluxe|ultra|max)\b/)) {
    priceRange = 'premium';
  }

  // Basic category detection from common e-commerce domains
  let category = 'General';
  let subcategory = '';

  if (urlLower.includes('amazon')) {
    // Try to extract from Amazon URL structure
    const dpMatch = urlLower.match(/\/dp\/([A-Z0-9]{10})/);
    if (dpMatch) {
      // Amazon ASIN detected
      subcategory = 'Amazon Product';
    }
  }

  // Build search query from path parts
  const relevantParts = pathParts
    .filter(part => part.length > 3 && !part.match(/^(dp|gp|product|item)$/))
    .slice(-2);
  const searchQuery = relevantParts.join(' ').replace(/[-_]/g, ' ').substring(0, 50);

  return {
    category,
    subcategory,
    brand: potentialBrand.charAt(0).toUpperCase() + potentialBrand.slice(1),
    priceRange,
    keywords,
    searchQuery: searchQuery || 'product',
    confidence: 30, // Low confidence for fallback analysis
  };
}

/**
 * Batch analyze multiple URLs (useful for storefront analysis)
 */
export async function analyzeMultipleIntents(urls: string[]): Promise<ProductIntent[]> {
  console.log(`[Intent Analyzer] Batch analyzing ${urls.length} URLs`);

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  const results: ProductIntent[] = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(analyzeProductIntent));
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Extract dominant categories from a list of intents
 */
export function extractDominantCategories(intents: ProductIntent[]): Array<{
  category: string;
  count: number;
  percentage: number;
}> {
  const categoryMap = new Map<string, number>();

  for (const intent of intents) {
    const count = categoryMap.get(intent.category) || 0;
    categoryMap.set(intent.category, count + 1);
  }

  const total = intents.length;
  const categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: count / total,
    }))
    .sort((a, b) => b.count - a.count);

  return categories;
}
