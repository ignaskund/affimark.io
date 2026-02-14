/**
 * Product Insights Agent (Step 1)
 * 
 * Analyzes a product URL and provides quick validation with core KPIs.
 * This is the first step in the 3-step Commission Agent flow.
 */

import { Env } from '../../index';

// ============================================================
// Types
// ============================================================

export interface ProductInsightsInput {
    productUrl: string;
    title?: string;
    brand?: string;
    userId?: string;
}

export interface KPIValue {
    key: string;
    displayName: string;
    value: number;
    unit: string;
    benchmark: {
        low: number;
        avg: number;
        high: number;
    };
    rating: 'poor' | 'average' | 'good' | 'excellent';
    tooltip?: string;
}

export interface ProductInsightsResult {
    success: boolean;
    sessionId?: string;

    // Product identification
    product: {
        url: string;
        title: string;
        imageUrl?: string;
        brand: {
            name: string;
            slug: string;
            detectedFrom: string;
            confidence: number;
        };
        category: {
            name: string;
            detectedFrom: string;
            confidence: number;
        };
    };

    // Current affiliate status
    current: {
        platform: string;
        platformName: string;
        commissionRate: number;
        cookieDuration: number;
        cookieUnit: 'hours' | 'days';
        hasTracking: boolean;
    };

    // Core KPIs
    kpis: KPIValue[];

    // Quick validation score
    worthPromotingScore: number;  // 0-100
    worthPromotingLabel: 'not_recommended' | 'proceed_with_caution' | 'recommended' | 'highly_recommended';
    worthPromotingReasons: string[];

    // Next step guidance
    nextStep: 'brand_research' | 'optimization' | 'try_another';

    error?: string;
}

// ============================================================
// Platform Detection (reusing existing logic)
// ============================================================

const PLATFORM_CONFIGS: Record<string, {
    pattern: RegExp;
    name: string;
    defaultRate: number;
    cookieDuration: number;
    cookieUnit: 'hours' | 'days';
}> = {
    amazon_de: { pattern: /amazon\.de|amzn\.to/i, name: 'Amazon DE', defaultRate: 3, cookieDuration: 24, cookieUnit: 'hours' },
    amazon_uk: { pattern: /amazon\.co\.uk/i, name: 'Amazon UK', defaultRate: 3, cookieDuration: 24, cookieUnit: 'hours' },
    amazon_us: { pattern: /amazon\.com(?!\.)|amzn\.com/i, name: 'Amazon US', defaultRate: 3, cookieDuration: 24, cookieUnit: 'hours' },
    amazon_fr: { pattern: /amazon\.fr/i, name: 'Amazon FR', defaultRate: 3, cookieDuration: 24, cookieUnit: 'hours' },
    awin: { pattern: /awin1\.com|zenaps\.com/i, name: 'Awin', defaultRate: 8, cookieDuration: 30, cookieUnit: 'days' },
    shareasale: { pattern: /shareasale\.com/i, name: 'ShareASale', defaultRate: 8, cookieDuration: 30, cookieUnit: 'days' },
    impact: { pattern: /impact\.com|prf\.hn|sjv\.io/i, name: 'Impact', defaultRate: 10, cookieDuration: 30, cookieUnit: 'days' },
    ltk: { pattern: /liketoknow\.it|ltk\.to|shopltk|rstyle\.me/i, name: 'LTK', defaultRate: 10, cookieDuration: 30, cookieUnit: 'days' },
    rakuten: { pattern: /linksynergy\.com|rakuten/i, name: 'Rakuten', defaultRate: 5, cookieDuration: 30, cookieUnit: 'days' },
};

function detectPlatform(url: string) {
    for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
        if (config.pattern.test(url)) {
            return { key, ...config };
        }
    }
    return null;
}

// ============================================================
// Brand Detection (5-level cascade)
// ============================================================

const KNOWN_BRANDS = [
    'sony', 'samsung', 'apple', 'bose', 'jbl', 'beats', 'dyson', 'nike', 'adidas', 'puma',
    'zara', 'h&m', 'mango', 'uniqlo', 'lululemon', 'gymshark', 'north face', 'patagonia',
    'sephora', 'douglas', 'mac', 'charlotte tilbury', 'the ordinary', 'glossier',
    'ikea', 'wayfair', 'westwing', 'shopify', 'canva', 'notion',
];

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchKnownBrand(text: string): string | null {
    if (!text) return null;
    const textLower = text.toLowerCase();
    for (const brand of KNOWN_BRANDS) {
        if (textLower.includes(brand)) {
            return brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    }
    return null;
}

function extractBrandFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            const brandPart = parts[parts.length - 2];
            if (['shop', 'store', 'buy', 'get', 'my', 'go', 'link', 'app', 'amazon'].includes(brandPart)) {
                return null;
            }
            return brandPart.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        return null;
    } catch {
        return null;
    }
}

async function detectBrand(
    input: ProductInsightsInput,
    env: Env
): Promise<{ name: string; slug: string; detectedFrom: string; confidence: number }> {
    // Level 1: User provided
    if (input.brand) {
        return { name: input.brand, slug: slugify(input.brand), detectedFrom: 'user_provided', confidence: 1.0 };
    }

    // Level 2: Known brands in title
    if (input.title) {
        const match = matchKnownBrand(input.title);
        if (match) {
            return { name: match, slug: slugify(match), detectedFrom: 'known_brands', confidence: 0.9 };
        }
    }

    // Level 3: Brand aliases DB lookup
    try {
        const domain = new URL(input.productUrl).hostname.replace(/^www\./, '');
        // Query brand_aliases table (would need Supabase client)
        // For now, skip DB lookup in worker - will be handled by frontend API route
    } catch { }

    // Level 4: URL domain parsing
    const brandFromUrl = extractBrandFromUrl(input.productUrl);
    if (brandFromUrl) {
        return { name: brandFromUrl, slug: slugify(brandFromUrl), detectedFrom: 'url_domain', confidence: 0.7 };
    }

    // Level 5: Title heuristic
    if (input.title) {
        const words = input.title.split(/[\s\-–|,]+/);
        for (const word of words.slice(0, 3)) {
            if (word.length > 2 && /^[A-Z]/.test(word)) {
                return { name: word, slug: slugify(word), detectedFrom: 'title_heuristic', confidence: 0.4 };
            }
        }
    }

    return { name: 'Unknown', slug: 'unknown', detectedFrom: 'none', confidence: 0.1 };
}

// ============================================================
// Category Classification
// ============================================================

const CATEGORY_PATTERNS: Record<string, { keywords: string[]; avgRate: number }> = {
    electronics: { keywords: ['headphone', 'speaker', 'camera', 'laptop', 'phone', 'tablet', 'tv', 'gaming'], avgRate: 1 },
    fashion: { keywords: ['dress', 'shirt', 'pants', 'shoes', 'bag', 'watch', 'jewelry', 'sneakers'], avgRate: 4 },
    beauty: { keywords: ['makeup', 'skincare', 'serum', 'cream', 'perfume', 'lipstick', 'mascara'], avgRate: 3 },
    home: { keywords: ['furniture', 'chair', 'table', 'sofa', 'bed', 'lamp', 'decor', 'kitchen'], avgRate: 4 },
    sports: { keywords: ['fitness', 'workout', 'gym', 'yoga', 'running', 'cycling', 'weights'], avgRate: 3 },
};

function classifyCategory(title: string | undefined, url: string): { name: string; detectedFrom: string; confidence: number } {
    const text = `${title || ''} ${url}`.toLowerCase();

    for (const [category, config] of Object.entries(CATEGORY_PATTERNS)) {
        for (const keyword of config.keywords) {
            if (text.includes(keyword)) {
                return { name: category, detectedFrom: 'keywords', confidence: 0.8 };
            }
        }
    }

    return { name: 'general', detectedFrom: 'default', confidence: 0.3 };
}

// ============================================================
// KPI Calculation
// ============================================================

const KPI_BENCHMARKS: Record<string, Record<string, { low: number; avg: number; high: number }>> = {
    conversion_rate: {
        electronics: { low: 0.3, avg: 1.5, high: 3.0 },
        fashion: { low: 1.0, avg: 3.0, high: 6.0 },
        beauty: { low: 0.8, avg: 2.5, high: 5.5 },
        general: { low: 0.5, avg: 2.0, high: 5.0 },
    },
    epc: {
        electronics: { low: 0.02, avg: 0.15, high: 0.50 },
        fashion: { low: 0.10, avg: 0.35, high: 1.50 },
        beauty: { low: 0.08, avg: 0.30, high: 1.20 },
        general: { low: 0.05, avg: 0.25, high: 1.00 },
    },
    commission_rate: {
        electronics: { low: 1, avg: 3, high: 8 },
        fashion: { low: 3, avg: 8, high: 20 },
        beauty: { low: 3, avg: 10, high: 25 },
        general: { low: 1, avg: 5, high: 15 },
    },
    cookie_duration: {
        electronics: { low: 1, avg: 14, high: 45 },
        fashion: { low: 7, avg: 30, high: 60 },
        beauty: { low: 7, avg: 30, high: 90 },
        general: { low: 1, avg: 30, high: 90 },
    },
};

function rateKPI(value: number, benchmark: { low: number; avg: number; high: number }): 'poor' | 'average' | 'good' | 'excellent' {
    if (value <= benchmark.low) return 'poor';
    if (value <= benchmark.avg) return 'average';
    if (value <= benchmark.high) return 'good';
    return 'excellent';
}

function calculateKPIs(
    category: string,
    commissionRate: number,
    cookieDuration: number,
    cookieUnit: 'hours' | 'days'
): KPIValue[] {
    const cat = category in (KPI_BENCHMARKS.commission_rate || {}) ? category : 'general';

    // Convert cookie to days for comparison
    const cookieDays = cookieUnit === 'hours' ? cookieDuration / 24 : cookieDuration;

    // Estimate EPC based on commission rate and category averages
    const avgOrderValue = cat === 'electronics' ? 150 : cat === 'fashion' ? 80 : cat === 'beauty' ? 60 : 75;
    const avgConversionRate = KPI_BENCHMARKS.conversion_rate[cat]?.avg || 2.0;
    const estimatedEPC = (avgConversionRate / 100) * avgOrderValue * (commissionRate / 100);

    return [
        {
            key: 'commission_rate',
            displayName: 'Commission Rate',
            value: commissionRate,
            unit: '%',
            benchmark: KPI_BENCHMARKS.commission_rate[cat] || KPI_BENCHMARKS.commission_rate.general,
            rating: rateKPI(commissionRate, KPI_BENCHMARKS.commission_rate[cat] || KPI_BENCHMARKS.commission_rate.general),
            tooltip: 'Percentage of sale you earn',
        },
        {
            key: 'cookie_duration',
            displayName: 'Cookie Duration',
            value: cookieDays,
            unit: 'days',
            benchmark: KPI_BENCHMARKS.cookie_duration[cat] || KPI_BENCHMARKS.cookie_duration.general,
            rating: rateKPI(cookieDays, KPI_BENCHMARKS.cookie_duration[cat] || KPI_BENCHMARKS.cookie_duration.general),
            tooltip: 'How long your referral is tracked',
        },
        {
            key: 'epc',
            displayName: 'Est. Earnings/Click',
            value: Math.round(estimatedEPC * 100) / 100,
            unit: '€',
            benchmark: KPI_BENCHMARKS.epc[cat] || KPI_BENCHMARKS.epc.general,
            rating: rateKPI(estimatedEPC, KPI_BENCHMARKS.epc[cat] || KPI_BENCHMARKS.epc.general),
            tooltip: 'Estimated revenue per click',
        },
    ];
}

// ============================================================
// Worth Promoting Score
// ============================================================

function calculateWorthPromotingScore(
    kpis: KPIValue[],
    brand: { confidence: number },
    hasTracking: boolean
): { score: number; label: ProductInsightsResult['worthPromotingLabel']; reasons: string[] } {
    let score = 50; // Start neutral
    const reasons: string[] = [];

    // Commission rate impact (+/-20)
    const commissionKPI = kpis.find(k => k.key === 'commission_rate');
    if (commissionKPI) {
        if (commissionKPI.rating === 'excellent') { score += 20; reasons.push('Excellent commission rate'); }
        else if (commissionKPI.rating === 'good') { score += 10; reasons.push('Good commission rate'); }
        else if (commissionKPI.rating === 'poor') { score -= 20; reasons.push('Very low commission rate'); }
    }

    // Cookie duration impact (+/-15)
    const cookieKPI = kpis.find(k => k.key === 'cookie_duration');
    if (cookieKPI) {
        if (cookieKPI.rating === 'excellent') { score += 15; reasons.push('Long cookie duration'); }
        else if (cookieKPI.rating === 'poor') { score -= 15; reasons.push('Very short cookie window'); }
    }

    // Brand confidence impact (+/-10)
    if (brand.confidence >= 0.9) { score += 10; reasons.push('Well-known brand'); }
    else if (brand.confidence < 0.5) { score -= 5; reasons.push('Brand unclear'); }

    // Tracking impact (+/-10)
    if (!hasTracking) { score -= 10; reasons.push('No affiliate tracking detected'); }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine label
    let label: ProductInsightsResult['worthPromotingLabel'];
    if (score >= 75) label = 'highly_recommended';
    else if (score >= 50) label = 'recommended';
    else if (score >= 30) label = 'proceed_with_caution';
    else label = 'not_recommended';

    return { score, label, reasons };
}

// ============================================================
// Main Agent Function
// ============================================================

export async function runProductInsightsAgent(
    input: ProductInsightsInput,
    env: Env
): Promise<ProductInsightsResult> {
    try {
        // Detect platform
        const platform = detectPlatform(input.productUrl);
        const platformKey = platform?.key || 'unknown';
        const platformName = platform?.name || 'Unknown';
        const commissionRate = platform?.defaultRate || 3;
        const cookieDuration = platform?.cookieDuration || 30;
        const cookieUnit = platform?.cookieUnit || 'days';

        // Detect brand
        const brand = await detectBrand(input, env);

        // Classify category
        const category = classifyCategory(input.title, input.productUrl);

        // Check for tracking
        const hasTracking = /[?&](tag|ref|affiliate|aff_id|utm_source=affiliate)=/i.test(input.productUrl);

        // Calculate KPIs
        const kpis = calculateKPIs(category.name, commissionRate, cookieDuration, cookieUnit);

        // Calculate worth promoting score
        const worthPromoting = calculateWorthPromotingScore(kpis, brand, hasTracking);

        return {
            success: true,
            product: {
                url: input.productUrl,
                title: input.title || 'Product',
                brand,
                category,
            },
            current: {
                platform: platformKey,
                platformName,
                commissionRate,
                cookieDuration,
                cookieUnit,
                hasTracking,
            },
            kpis,
            worthPromotingScore: worthPromoting.score,
            worthPromotingLabel: worthPromoting.label,
            worthPromotingReasons: worthPromoting.reasons,
            nextStep: worthPromoting.score >= 30 ? 'brand_research' : 'try_another',
        };
    } catch (error) {
        return {
            success: false,
            product: { url: input.productUrl, title: '', brand: { name: 'Unknown', slug: 'unknown', detectedFrom: 'none', confidence: 0 }, category: { name: 'general', detectedFrom: 'default', confidence: 0 } },
            current: { platform: 'unknown', platformName: 'Unknown', commissionRate: 0, cookieDuration: 0, cookieUnit: 'days', hasTracking: false },
            kpis: [],
            worthPromotingScore: 0,
            worthPromotingLabel: 'not_recommended',
            worthPromotingReasons: ['Error analyzing product'],
            nextStep: 'try_another',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
