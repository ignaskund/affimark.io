/**
 * Shared product inference utilities.
 *
 * Previously duplicated between mcp/tools.ts (inferBrand / inferCategory / mapCategory)
 * and services/product-intent-analyzer.ts (inferBrandFromTitle / mapAmazonCategory).
 * Single source of truth — import from here in both places.
 */

// ─── Brand inference ──────────────────────────────────────────────────────────

/**
 * Attempt to infer the brand from the first 1-2 words of a product title.
 * Returns null when the first word is generic, too short, or numeric.
 */
export function inferBrand(title: string): string | null {
  if (!title) return null;
  const cleaned = title.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(/\s+/).slice(0, 2);
  if (words.length === 0) return null;

  const GENERIC_FIRST_WORDS = new Set([
    'the', 'a', 'an', 'new', 'best', 'top', 'great', 'nice', 'amazing',
    'set', 'pack', 'kit', 'bundle', 'gift', 'women', 'men', 'mens', 'womens',
    'hydrating', 'lip', 'balm', 'gloss', 'with', 'for', 'by', 'and',
    'shade', 'color', 'size', 'dry', 'wet', 'mini', 'pro', 'ultra',
    'wireless', 'portable', 'organic', 'natural', 'premium', 'classic',
    'vintage', 'retro', 'modern', 'smart', 'digital', 'professional',
    'sport', 'perform', 'recover', 'active', 'energy', 'power',
  ]);

  const candidate = words[0];
  if (candidate.length < 3) return null;
  if (/^\d/.test(candidate)) return null;
  if (GENERIC_FIRST_WORDS.has(candidate.toLowerCase())) return null;

  // Don't return single-word brand if title starts with that word followed by
  // a connector (e.g. "Hydrating Serum" — "Hydrating" is not a brand).
  const secondWord = words[1]?.toLowerCase();
  const DESCRIPTOR_SECOND = new Set(['and', 'with', 'for', 'or', 'of', 'from', 'by', 'in', 'set', 'kit']);
  if (secondWord && DESCRIPTOR_SECOND.has(secondWord)) return null;

  return candidate;
}

// ─── Category mapping ─────────────────────────────────────────────────────────

/**
 * Canonical category list used throughout the codebase.
 */
export const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Beauty & Health',
  'Health & Nutrition',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Media',
  'Food & Beverage',
  'Automotive',
  'Pet Supplies',
  'General',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Keywords that map to each canonical category. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Electronics': [
    'electronics', 'computers', 'cell phones', 'phone', 'audio', 'headphone',
    'headphones', 'earbuds', 'speaker', 'charger', 'bluetooth', 'camera', 'laptop',
    'tv', 'tablet', 'smartwatch', 'keyboard', 'mouse', 'monitor',
  ],
  'Fashion': [
    'clothing', 'shoes', 'jewelry', 'watches', 'accessories', 'apparel', 'fashion',
    'sweater', 'pullover', 'dress', 'jacket', 'jeans', 'sneakers', 'boots', 'bag',
    'handbag', 'sunglasses', 'cardigan', 'knit', 'cable crew', 'shirt', 'pants',
    'skirt', 'coat', 'hoodie', 'leggings', 'blouse',
  ],
  'Home & Garden': [
    'home', 'kitchen', 'garden', 'furniture', 'bedding', 'bath', 'patio',
    'lamp', 'candle', 'pillow', 'rug', 'vase', 'pan', 'mug', 'organizer',
    'shelf', 'curtain', 'towel', 'cookware', 'dinnerware',
  ],
  'Beauty & Health': [
    'beauty', 'health', 'personal care', 'skin', 'makeup', 'hair', 'vitamin',
    'serum', 'moisturizer', 'lipstick', 'mascara', 'shampoo', 'conditioner',
    'perfume', 'hair spray', 'texture spray', 'skincare', 'blush', 'foundation',
    'sunscreen', 'supplement', 'wellness', 'collagen', 'probiotic', 'biotin',
    // EU languages
    'schönheit', 'gesundheit', 'pflege', 'kosmetik',
    'beauté', 'santé', 'soin', 'cosmétique',
  ],
  'Health & Nutrition': [
    'supplement', 'nutrition', 'protein', 'mineral', 'dietary',
    'orthomol', 'electrolyte', 'probiotic', 'omega', 'creatine', 'bcaa',
    'magnesium', 'multivitamin', 'whey', 'casein', 'amino acid',
    'pre workout', 'post workout', 'energy gel', 'energy bar',
    'sport perform', 'sport recover', 'zinc', 'iron supplement',
  ],
  'Sports & Outdoors': [
    'sports', 'outdoors', 'fitness', 'exercise', 'yoga', 'gym', 'running',
    'hiking', 'cycling', 'swimming', 'tennis', 'golf', 'skiing',
    'sport', 'athletic', 'training',
  ],
  'Toys & Games': [
    'toys', 'games', 'lego', 'puzzle', 'doll', 'action figure', 'board game',
  ],
  'Books & Media': ['books', 'music', 'movies', 'kindle', 'novel', 'album'],
  'Food & Beverage': [
    'grocery', 'food', 'beverages', 'gourmet', 'coffee', 'tea', 'snack', 'organic',
  ],
  'Automotive': ['automotive', 'car', 'vehicle', 'motorcycle', 'truck'],
  'Pet Supplies': ['pet supplies', 'dog', 'cat', 'bird', 'fish', 'pet'],
};

/**
 * Map a raw category string (from an API/URL/HTML) to a canonical category.
 * Handles Amazon category names, EU language terms, and general keywords.
 */
export function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'General';
}

/**
 * Infer category from a product title using keyword matching.
 * More specific terms take priority (e.g. 'serum' → Beauty before General).
 */
export function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  // Check in specificity order: more specific categories first
  const ORDER: string[] = [
    'Health & Nutrition', 'Beauty & Health', 'Electronics', 'Fashion',
    'Home & Garden', 'Sports & Outdoors', 'Toys & Games', 'Books & Media',
    'Food & Beverage', 'Automotive', 'Pet Supplies',
  ];
  for (const cat of ORDER) {
    const keywords = CATEGORY_KEYWORDS[cat];
    if (keywords && keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'General';
}
