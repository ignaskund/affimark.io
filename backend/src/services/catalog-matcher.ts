/**
 * Product Catalog Matching Service
 * 
 * Matches products across different affiliate networks to find
 * the same or similar products with better commission rates.
 */

// ============================================================
// Types
// ============================================================

export interface ProductMatch {
    matchType: 'exact' | 'similar' | 'alternative';
    confidence: number; // 0-1
    source: 'database' | 'api' | 'ai';
    product: {
        title: string;
        brand: string;
        category: string;
        network: string;
        networkDisplayName: string;
        commissionRateLow: number;
        commissionRateHigh: number;
        productUrl?: string;
        signupUrl?: string;
    };
}

export interface CatalogSearchResult {
    originalBrand: string;
    originalProduct: string;
    matches: ProductMatch[];
    searchedAt: string;
}

// ============================================================
// Brand Alias Mapping
// ============================================================

const BRAND_ALIASES: Record<string, string[]> = {
    'sony': ['sony electronics', 'sony music', 'playstation'],
    'apple': ['apple inc', 'apple store'],
    'samsung': ['samsung electronics', 'samsung mobile'],
    'nike': ['nike inc', 'nikesportswear', 'jordan'],
    'adidas': ['adidas ag', 'adidas running', 'adidas originals'],
    'amazon': ['amazon retail', 'amazon devices'],
    'microsoft': ['microsoft store', 'xbox'],
    'google': ['google store', 'nest'],
    'lg': ['lg electronics', 'lg display'],
    'philips': ['philips lighting', 'philips electronics'],
    'bosch': ['bosch power tools', 'bosch home'],
    'dyson': ['dyson ltd'],
    'bose': ['bose corporation'],
    'jbl': ['jbl audio', 'harman'],
};

// ============================================================
// Category Mappings
// ============================================================

const CATEGORY_HIERARCHY: Record<string, string[]> = {
    'electronics': ['audio', 'video', 'computers', 'phones', 'tablets', 'wearables', 'cameras'],
    'fashion': ['clothing', 'shoes', 'accessories', 'jewelry', 'watches'],
    'beauty': ['skincare', 'makeup', 'haircare', 'fragrance'],
    'home': ['furniture', 'decor', 'kitchen', 'bedding', 'lighting'],
    'sports': ['fitness', 'outdoor', 'gym equipment', 'sportswear'],
    'baby': ['toys', 'nursery', 'feeding', 'baby gear'],
    'health': ['vitamins', 'supplements', 'wellness', 'personal care'],
};

// ============================================================
// Database Search Helper
// ============================================================

async function searchAffiliatePrograms(
    brandSlug: string,
    category: string,
    supabaseUrl: string,
    supabaseKey: string
): Promise<ProductMatch[]> {
    const results: ProductMatch[] = [];

    try {
        // Normalize brand slug
        const normalizedBrand = brandSlug.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Get all aliases for the brand
        const brandAliases = BRAND_ALIASES[normalizedBrand] || [normalizedBrand];
        const aliasConditions = brandAliases.map(a => `brand_slug.ilike.%${a}%`).join(',');

        // Search for exact brand matches
        const exactResponse = await fetch(
            `${supabaseUrl}/rest/v1/affiliate_programs?or=(brand_slug.eq.${normalizedBrand},${aliasConditions})&is_active=eq.true&select=*`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        if (exactResponse.ok) {
            const exactMatches = await exactResponse.json() as Array<{
                brand_slug: string;
                brand_name: string;
                network: string;
                network_display_name: string;
                commission_rate_low: number;
                commission_rate_high: number;
                program_url?: string;
                signup_url?: string;
                primary_category?: string;
            }>;

            for (const program of exactMatches) {
                results.push({
                    matchType: 'exact',
                    confidence: 1.0,
                    source: 'database',
                    product: {
                        title: `${program.brand_name} Affiliate Program`,
                        brand: program.brand_name,
                        category: program.primary_category || category,
                        network: program.network,
                        networkDisplayName: program.network_display_name,
                        commissionRateLow: program.commission_rate_low,
                        commissionRateHigh: program.commission_rate_high,
                        productUrl: program.program_url,
                        signupUrl: program.signup_url,
                    },
                });
            }
        }

        // Search for category matches (alternative brands)
        if (category) {
            // Find parent category and related categories
            let relatedCategories = [category];
            for (const [parent, children] of Object.entries(CATEGORY_HIERARCHY)) {
                if (parent === category || children.includes(category)) {
                    relatedCategories = [parent, ...children];
                    break;
                }
            }

            const categoryConditions = relatedCategories.map(c => `primary_category.eq.${c}`).join(',');

            const categoryResponse = await fetch(
                `${supabaseUrl}/rest/v1/affiliate_programs?or=(${categoryConditions})&brand_slug=neq.${normalizedBrand}&is_active=eq.true&select=*&limit=10`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                    },
                }
            );

            if (categoryResponse.ok) {
                const categoryMatches = await categoryResponse.json() as Array<{
                    brand_slug: string;
                    brand_name: string;
                    network: string;
                    network_display_name: string;
                    commission_rate_low: number;
                    commission_rate_high: number;
                    program_url?: string;
                    signup_url?: string;
                    primary_category?: string;
                }>;

                // Sort by commission rate (highest first)
                categoryMatches.sort((a, b) => b.commission_rate_high - a.commission_rate_high);

                for (const program of categoryMatches.slice(0, 5)) {
                    results.push({
                        matchType: 'alternative',
                        confidence: 0.7,
                        source: 'database',
                        product: {
                            title: `${program.brand_name} Affiliate Program`,
                            brand: program.brand_name,
                            category: program.primary_category || category,
                            network: program.network,
                            networkDisplayName: program.network_display_name,
                            commissionRateLow: program.commission_rate_low,
                            commissionRateHigh: program.commission_rate_high,
                            productUrl: program.program_url,
                            signupUrl: program.signup_url,
                        },
                    });
                }
            }
        }
    } catch (error) {
        console.error('Catalog search error:', error);
    }

    return results;
}

// ============================================================
// Product Similarity Scoring
// ============================================================

function calculateSimilarityScore(
    original: { brand: string; category: string; title?: string },
    match: { brand: string; category: string; title?: string }
): number {
    let score = 0;

    // Brand match (highest weight)
    const originalBrand = original.brand.toLowerCase();
    const matchBrand = match.brand.toLowerCase();

    if (originalBrand === matchBrand) {
        score += 0.5;
    } else if (BRAND_ALIASES[originalBrand]?.includes(matchBrand)) {
        score += 0.4;
    } else if (matchBrand.includes(originalBrand) || originalBrand.includes(matchBrand)) {
        score += 0.3;
    }

    // Category match
    const originalCat = original.category.toLowerCase();
    const matchCat = match.category.toLowerCase();

    if (originalCat === matchCat) {
        score += 0.3;
    } else {
        // Check parent/child relationship
        for (const [parent, children] of Object.entries(CATEGORY_HIERARCHY)) {
            const allRelated = [parent, ...children];
            if (allRelated.includes(originalCat) && allRelated.includes(matchCat)) {
                score += 0.2;
                break;
            }
        }
    }

    // Title similarity (if available)
    if (original.title && match.title) {
        const originalWords = new Set(original.title.toLowerCase().split(/\s+/));
        const matchWords = new Set(match.title.toLowerCase().split(/\s+/));
        const intersection = [...originalWords].filter(w => matchWords.has(w));
        const titleScore = intersection.length / Math.max(originalWords.size, 1);
        score += titleScore * 0.2;
    }

    return Math.min(score, 1);
}

// ============================================================
// Main Catalog Search Function
// ============================================================

export async function searchProductCatalog(
    brandSlug: string,
    category: string,
    productTitle: string,
    supabaseUrl: string,
    supabaseKey: string
): Promise<CatalogSearchResult> {
    // Search affiliate programs database
    const matches = await searchAffiliatePrograms(
        brandSlug,
        category,
        supabaseUrl,
        supabaseKey
    );

    // Calculate similarity scores and sort
    const scoredMatches = matches.map(match => ({
        ...match,
        confidence: match.matchType === 'exact'
            ? match.confidence
            : calculateSimilarityScore(
                { brand: brandSlug, category, title: productTitle },
                { brand: match.product.brand, category: match.product.category }
            ),
    }));

    // Sort by: exact matches first, then by confidence
    scoredMatches.sort((a, b) => {
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
        if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
        return b.confidence - a.confidence;
    });

    return {
        originalBrand: brandSlug,
        originalProduct: productTitle,
        matches: scoredMatches,
        searchedAt: new Date().toISOString(),
    };
}

// ============================================================
// Find Best Commission Program
// ============================================================

export async function findBestCommissionProgram(
    brandSlug: string,
    category: string,
    currentRate: number,
    supabaseUrl: string,
    supabaseKey: string
): Promise<ProductMatch | null> {
    const catalog = await searchProductCatalog(
        brandSlug,
        category,
        '',
        supabaseUrl,
        supabaseKey
    );

    // Find the program with the best improvement over current rate
    const improvements = catalog.matches
        .filter(m => m.product.commissionRateHigh > currentRate)
        .sort((a, b) => b.product.commissionRateHigh - a.product.commissionRateHigh);

    return improvements[0] || null;
}
