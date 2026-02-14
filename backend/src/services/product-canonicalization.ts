/**
 * Product Canonicalization Service
 *
 * Deduplicates Datafeedr results by identifying the same product across merchants.
 * Uses GTIN/MPN when available, falls back to normalized attributes.
 *
 * Fixes: Same product appearing multiple times with different merchants
 */

export interface CanonicalProduct {
  canonicalId: string; // Unique identifier for this product
  variants: any[]; // All merchant variants of this product
  bestVariant: any; // Best variant based on commission, reviews, stock
  variantCount: number;
}

/**
 * Canonicalize products to remove duplicates
 */
export function canonicalizeProducts(products: any[]): CanonicalProduct[] {
  console.log(`[Canonicalization] Processing ${products.length} products`);

  const canonicalMap = new Map<string, CanonicalProduct>();

  for (const product of products) {
    const canonicalId = generateCanonicalId(product);

    if (!canonicalMap.has(canonicalId)) {
      canonicalMap.set(canonicalId, {
        canonicalId,
        variants: [],
        bestVariant: product,
        variantCount: 0,
      });
    }

    const canonical = canonicalMap.get(canonicalId)!;
    canonical.variants.push(product);
    canonical.variantCount = canonical.variants.length;

    // Update best variant if this one is better
    if (isBetterVariant(product, canonical.bestVariant)) {
      canonical.bestVariant = product;
    }
  }

  const canonicalProducts = Array.from(canonicalMap.values());
  console.log(`[Canonicalization] Reduced to ${canonicalProducts.length} unique products`);
  console.log(`[Canonicalization] Deduplication rate: ${((1 - canonicalProducts.length / products.length) * 100).toFixed(1)}%`);

  return canonicalProducts;
}

/**
 * Generate canonical ID for a product
 *
 * Priority:
 * 1. GTIN (Global Trade Item Number) - most reliable
 * 2. MPN (Manufacturer Part Number) + Brand
 * 3. Normalized title + brand + category
 */
function generateCanonicalId(product: any): string {
  // Priority 1: GTIN (UPC, EAN, ISBN)
  if (product.gtin || product.upc || product.ean || product.isbn) {
    const gtin = product.gtin || product.upc || product.ean || product.isbn;
    return `gtin:${gtin}`;
  }

  // Priority 2: MPN + Brand (very reliable combination)
  if (product.mpn && product.brand) {
    const mpn = product.mpn.toLowerCase().trim();
    const brand = product.brand.toLowerCase().trim();
    return `mpn:${brand}:${mpn}`;
  }

  // Priority 3: Normalized attributes
  const normalized = normalizeProductTitle(product.name);
  const brand = (product.brand || '').toLowerCase().trim() || 'unknown';
  const category = extractMainCategory(product.category);

  // Include price range to avoid matching different product tiers
  const priceRange = getPriceRange(product.price);

  return `title:${brand}:${category}:${priceRange}:${normalized}`;
}

/**
 * Normalize product title for matching
 */
function normalizeProductTitle(title: string): string {
  if (!title) return '';

  return title
    .toLowerCase()
    // Remove common suffixes that don't affect product identity
    .replace(/\s*-\s*(black|white|red|blue|silver|gold|gray|grey)\s*$/i, '')
    .replace(/\s*\(.*?\)\s*$/g, '') // Remove parenthetical info at end
    // Remove special characters but keep spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length to avoid minor variations
    .substring(0, 80);
}

/**
 * Extract main category (first level of hierarchy)
 */
function extractMainCategory(category: string | undefined): string {
  if (!category) return 'general';

  // Category format: "Electronics > Audio > Headphones"
  const parts = category.split('>').map(p => p.trim());
  return parts[0].toLowerCase();
}

/**
 * Get price range bucket (prevents matching different product tiers)
 */
function getPriceRange(price: number | undefined): string {
  if (!price) return 'unknown';

  if (price < 20) return 'budget'; // <€20
  if (price < 50) return 'low'; // €20-50
  if (price < 100) return 'mid'; // €50-100
  if (price < 300) return 'high'; // €100-300
  if (price < 1000) return 'premium'; // €300-1000
  return 'luxury'; // €1000+
}

/**
 * Determine which variant is better
 *
 * Priority (in order):
 * 1. In stock > out of stock
 * 2. Higher commission rate
 * 3. More reviews (demand signal)
 * 4. Higher rating
 * 5. Lower price (if all else equal)
 */
function isBetterVariant(a: any, b: any): boolean {
  // 1. Stock availability
  if (a.inStock && !b.inStock) return true;
  if (!a.inStock && b.inStock) return false;

  // 2. Commission rate (most important for business outcome)
  const aCommission = a.commissionRate || 0;
  const bCommission = b.commissionRate || 0;
  if (aCommission > bCommission + 1) return true; // +1% threshold to avoid minor fluctuations
  if (bCommission > aCommission + 1) return false;

  // 3. Review count (demand evidence)
  const aReviews = a.reviewCount || 0;
  const bReviews = b.reviewCount || 0;
  if (aReviews > bReviews * 1.5) return true; // Must be significantly more
  if (bReviews > aReviews * 1.5) return false;

  // 4. Rating quality
  const aRating = a.rating || 0;
  const bRating = b.rating || 0;
  if (aRating > bRating + 0.3) return true; // +0.3 star threshold
  if (bRating > aRating + 0.3) return false;

  // 5. Price (lower is better if everything else equal)
  const aPrice = a.price || 999999;
  const bPrice = b.price || 999999;
  return aPrice < bPrice;
}

/**
 * Get alternative variants for a canonical product
 * (for showing "also available at" in UI)
 */
export function getAlternativeVariants(canonical: CanonicalProduct): {
  merchant: string;
  price: number;
  commission: number;
  url: string;
}[] {
  return canonical.variants
    .filter(v => v.id !== canonical.bestVariant.id) // Exclude the best variant
    .sort((a, b) => (b.commissionRate || 0) - (a.commissionRate || 0)) // Sort by commission
    .slice(0, 3) // Top 3 alternatives
    .map(v => ({
      merchant: v.merchant || v.affiliateNetwork,
      price: v.price,
      commission: v.commissionRate || 0,
      url: v.url,
    }));
}

/**
 * Calculate deduplication stats for monitoring
 */
export function getDeduplicationStats(
  originalCount: number,
  canonicalProducts: CanonicalProduct[]
): {
  originalCount: number;
  uniqueCount: number;
  duplicatesRemoved: number;
  deduplicationRate: number;
  avgVariantsPerProduct: number;
  productsWithMultipleVariants: number;
} {
  const duplicatesRemoved = originalCount - canonicalProducts.length;
  const deduplicationRate = (duplicatesRemoved / originalCount) * 100;

  const variantCounts = canonicalProducts.map(p => p.variantCount);
  const avgVariants = variantCounts.reduce((sum, count) => sum + count, 0) / canonicalProducts.length;
  const multiVariant = canonicalProducts.filter(p => p.variantCount > 1).length;

  return {
    originalCount,
    uniqueCount: canonicalProducts.length,
    duplicatesRemoved,
    deduplicationRate,
    avgVariantsPerProduct: avgVariants,
    productsWithMultipleVariants: multiVariant,
  };
}
