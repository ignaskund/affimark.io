import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// ============================================================
// TYPES
// ============================================================

interface ProductInput {
  id: string;
  product_url: string;
  title?: string | null;
  brand?: string | null;
}

interface PlatformDetection {
  key: string;
  name: string;
  defaultRate: number;
  cookieDuration: number;
  cookieUnit: 'hours' | 'days';
  tips: string[];
  betterNetworks: string[];
  isAffiliate: boolean;
}

interface BrandResult {
  name: string;
  slug: string;
  detected_from: 'user_provided' | 'known_brands' | 'alias_db' | 'url_domain' | 'title_heuristic' | 'none';
  confidence: number;
}

interface CategoryResult {
  name: string;
  detected_from: 'keywords' | 'db_lookup' | 'default';
  rate?: number;
}

interface ActionStep {
  step: number;
  instruction: string;
  url?: string;
}

interface Insight {
  type: 'opportunity' | 'action' | 'tip' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

interface AlternativeResult {
  program_id: string;
  network: string;
  network_display: string;
  brand_name: string;
  match_type: 'exact_brand' | 'alias_match' | 'category' | 'general';
  commission_rate_low: number;
  commission_rate_high: number;
  commission_type: string;
  cookie_duration: number;
  requires_application: boolean;
  approval_difficulty: string;
  confidence_score: number;
  last_verified: string;
  regions: string[];
  potential_gain: {
    monthly_low: number;
    monthly_high: number;
    yearly_low: number;
    yearly_high: number;
  };
  action_steps: ActionStep[];
  signup_url?: string;
}

interface ProductResult {
  productId: string;
  productName: string;
  brand: { name: string; detected_from: string; confidence: number };
  category: { name: string; detected_from: string };
  current: {
    url: string;
    platform: string;
    platform_name: string;
    commission_rate: number;
    commission_type: string;
    cookie_duration: number;
    cookie_unit: 'hours' | 'days';
    has_tracking: boolean;
  };
  alternatives: AlternativeResult[];
  insights: Insight[];
  error?: string;
}

// ============================================================
// PLATFORM DETECTION
// ============================================================

const PLATFORM_CONFIGS: Record<string, {
  pattern: RegExp;
  name: string;
  defaultRate: number;
  cookieDuration: number;
  cookieUnit: 'hours' | 'days';
  tips: string[];
  betterNetworks: string[];
}> = {
  amazon_de: {
    pattern: /amazon\.de|amzn\.to/i,
    name: 'Amazon DE',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: [
      'Amazon DE pays 1-10% depending on category (electronics lowest at 1%)',
      'Consider brand-direct programs via Awin for 5-15% rates',
    ],
    betterNetworks: ['Awin', 'Tradedoubler', 'Impact'],
  },
  amazon_uk: {
    pattern: /amazon\.co\.uk/i,
    name: 'Amazon UK',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: [
      'Amazon UK rates are similar to DE (1-10%)',
      'Many UK brands offer direct programs with higher rates',
    ],
    betterNetworks: ['Awin', 'Rakuten', 'ShareASale'],
  },
  amazon_us: {
    pattern: /amazon\.com(?!\.)| amzn\.com/i,
    name: 'Amazon US',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: [
      'Amazon US has the lowest rates (1-4% for most categories)',
      'Impact and ShareASale have many US brand-direct programs',
    ],
    betterNetworks: ['Impact', 'ShareASale', 'CJ Affiliate'],
  },
  amazon_fr: {
    pattern: /amazon\.fr/i,
    name: 'Amazon FR',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: ['French brands often have direct programs via Awin'],
    betterNetworks: ['Awin'],
  },
  amazon_it: {
    pattern: /amazon\.it/i,
    name: 'Amazon IT',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: ['Italian fashion brands pay well through Awin'],
    betterNetworks: ['Awin'],
  },
  amazon_es: {
    pattern: /amazon\.es/i,
    name: 'Amazon ES',
    defaultRate: 3,
    cookieDuration: 24,
    cookieUnit: 'hours',
    tips: ['Spanish market growing - check Awin for local brands'],
    betterNetworks: ['Awin'],
  },
  awin: {
    pattern: /awin1\.com|zenaps\.com/i,
    name: 'Awin',
    defaultRate: 8,
    cookieDuration: 30,
    cookieUnit: 'days',
    tips: [
      'You\'re on a premium network - check if the brand has tiered rates',
      'Some Awin programs offer performance bonuses at higher volumes',
    ],
    betterNetworks: [],
  },
  shareasale: {
    pattern: /shareasale\.com/i,
    name: 'ShareASale',
    defaultRate: 8,
    cookieDuration: 30,
    cookieUnit: 'days',
    tips: [
      'ShareASale merchants often have promotional rate increases',
      'Apply for VIP/preferred publisher status for higher rates',
    ],
    betterNetworks: [],
  },
  impact: {
    pattern: /impact\.com|prf\.hn|sjv\.io/i,
    name: 'Impact',
    defaultRate: 10,
    cookieDuration: 30,
    cookieUnit: 'days',
    tips: [
      'Impact has many brand-direct programs with excellent rates',
      'Performance tiers can unlock 15-20%+ commission rates',
    ],
    betterNetworks: [],
  },
  ltk: {
    pattern: /liketoknow\.it|ltk\.to|shopltk|rstyle\.me/i,
    name: 'LTK',
    defaultRate: 10,
    cookieDuration: 30,
    cookieUnit: 'days',
    tips: [
      'LTK rates are usually competitive (8-15%)',
      'Some brands pay more through their direct programs vs LTK',
    ],
    betterNetworks: ['Brand Direct', 'Awin', 'Impact'],
  },
  rakuten: {
    pattern: /linksynergy\.com|rakuten/i,
    name: 'Rakuten',
    defaultRate: 5,
    cookieDuration: 30,
    cookieUnit: 'days',
    tips: [
      'Rakuten has many exclusive brand partnerships',
      'Some brands pay better through other networks',
    ],
    betterNetworks: ['Awin', 'Impact'],
  },
};

function detectPlatform(url: string): PlatformDetection | null {
  for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (config.pattern.test(url)) {
      return { key, ...config, isAffiliate: true };
    }
  }
  return null;
}

// ============================================================
// BRAND DETECTION (5-level cascade)
// ============================================================

const KNOWN_BRANDS = [
  // Electronics
  'sony', 'samsung', 'apple', 'bose', 'jbl', 'beats', 'sennheiser',
  'logitech', 'razer', 'corsair', 'steelseries', 'hyperx',
  'dyson', 'philips', 'braun', 'panasonic', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'acer',
  'gopro', 'dji', 'canon', 'nikon', 'fujifilm',
  'anker', 'belkin', 'ugreen', 'baseus',
  'fitbit', 'garmin', 'polar', 'whoop', 'oura',
  // Fashion
  'zara', 'h&m', 'mango', 'uniqlo', 'gap', 'cos', 'arket', '& other stories',
  'levi\'s', 'calvin klein', 'tommy hilfiger', 'ralph lauren', 'hugo boss',
  'nike', 'adidas', 'puma', 'reebok', 'new balance', 'asics', 'converse', 'vans',
  'lululemon', 'gymshark', 'fabletics', 'alo yoga',
  'north face', 'patagonia', 'columbia', 'arc\'teryx', 'salomon',
  'zalando', 'asos', 'aboutyou', 'na-kd', 'boohoo', 'prettylittlething',
  'net-a-porter', 'farfetch', 'mytheresa', 'ssense', 'matchesfashion',
  'nordstrom', 'revolve',
  // Beauty
  'sephora', 'douglas', 'flaconi', 'ulta',
  'mac', 'nyx', 'maybelline', 'l\'oreal', 'estee lauder', 'clinique',
  'charlotte tilbury', 'nars', 'urban decay', 'too faced', 'benefit',
  'the ordinary', 'cerave', 'paula\'s choice', 'glossier', 'drunk elephant',
  'fenty beauty', 'rare beauty', 'ilia', 'merit',
  // Home
  'ikea', 'wayfair', 'westwing', 'west elm', 'cb2', 'crate & barrel',
  'zara home', 'h&m home', 'made.com', 'article',
  // Software
  'shopify', 'canva', 'notion', 'hubspot', 'semrush', 'ahrefs',
  // Travel
  'booking.com', 'expedia', 'airbnb', 'getyourguide',
  // Food
  'hellofresh',
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

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function extractBrandFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const brandPart = parts[parts.length - 2];
      if (['shop', 'store', 'buy', 'get', 'my', 'go', 'link', 'app'].includes(brandPart)) {
        return null;
      }
      return brandPart.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return null;
  } catch {
    return null;
  }
}

function extractFirstCapitalizedWord(text: string): string | null {
  const words = text.split(/[\s\-–|,]+/);
  for (const word of words.slice(0, 3)) {
    if (word.length > 2 && /^[A-Z]/.test(word) && !/^(The|And|For|With|New|Set|Kit|Pro|Max|Mini)$/.test(word)) {
      return word;
    }
  }
  return null;
}

async function detectBrand(product: ProductInput): Promise<BrandResult> {
  // LEVEL 1: User-provided brand
  if (product.brand) {
    return { name: product.brand, slug: slugify(product.brand), detected_from: 'user_provided', confidence: 5 };
  }

  // LEVEL 2: Known brands list match in title
  if (product.title) {
    const match = matchKnownBrand(product.title);
    if (match) {
      return { name: match, slug: slugify(match), detected_from: 'known_brands', confidence: 4 };
    }
  }

  // LEVEL 3: Brand aliases DB lookup by URL domain
  const domain = extractDomain(product.product_url);
  if (domain) {
    const { data: alias } = await supabaseServer
      .from('brand_aliases')
      .select('brand_slug')
      .eq('alias', domain)
      .eq('alias_type', 'domain')
      .single();

    if (alias) {
      const { data: program } = await supabaseServer
        .from('affiliate_programs')
        .select('brand_name')
        .eq('brand_slug', alias.brand_slug)
        .limit(1)
        .single();

      return {
        name: program?.brand_name || alias.brand_slug,
        slug: alias.brand_slug,
        detected_from: 'alias_db',
        confidence: 4,
      };
    }
  }

  // LEVEL 4: URL domain parsing
  const brandFromUrl = extractBrandFromUrl(product.product_url);
  if (brandFromUrl) {
    return { name: brandFromUrl, slug: slugify(brandFromUrl), detected_from: 'url_domain', confidence: 2 };
  }

  // LEVEL 5: First capitalized word from title
  if (product.title) {
    const firstCap = extractFirstCapitalizedWord(product.title);
    if (firstCap) {
      return { name: firstCap, slug: slugify(firstCap), detected_from: 'title_heuristic', confidence: 1 };
    }
  }

  return { name: 'Unknown', slug: 'unknown', detected_from: 'none', confidence: 0 };
}

// ============================================================
// CATEGORY CLASSIFICATION
// ============================================================

const CATEGORY_PATTERNS: Record<string, { keywords: string[]; rate: number }> = {
  electronics: {
    keywords: ['headphone', 'speaker', 'camera', 'laptop', 'computer', 'phone', 'tablet', 'tv', 'monitor', 'keyboard', 'mouse', 'charger', 'cable', 'adapter', 'bluetooth', 'wireless', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'earbuds', 'smartwatch', 'drone', 'printer', 'router', 'powerbank'],
    rate: 1,
  },
  fashion: {
    keywords: ['dress', 'shirt', 'pants', 'jeans', 'jacket', 'coat', 'shoes', 'sneakers', 'boots', 'bag', 'handbag', 'watch', 'jewelry', 'sunglasses', 'hat', 'scarf', 'gloves', 'belt', 'hoodie', 'sweater', 'skirt', 'leggings', 'sandals', 'heels', 'trainers'],
    rate: 4,
  },
  beauty: {
    keywords: ['makeup', 'skincare', 'serum', 'cream', 'lotion', 'shampoo', 'conditioner', 'perfume', 'fragrance', 'lipstick', 'mascara', 'foundation', 'concealer', 'beauty', 'cosmetic', 'moisturizer', 'cleanser', 'toner', 'sunscreen', 'palette', 'eyeshadow', 'blush', 'bronzer'],
    rate: 3,
  },
  home: {
    keywords: ['furniture', 'chair', 'table', 'desk', 'sofa', 'bed', 'mattress', 'pillow', 'blanket', 'curtain', 'lamp', 'decor', 'kitchen', 'cookware', 'appliance', 'rug', 'shelf', 'cabinet', 'mirror', 'vase', 'candle'],
    rate: 4,
  },
  sports: {
    keywords: ['fitness', 'workout', 'gym', 'yoga', 'running', 'cycling', 'swimming', 'weights', 'dumbbell', 'resistance', 'sports', 'athletic', 'outdoor', 'camping', 'hiking', 'climbing', 'skiing', 'snowboard'],
    rate: 3,
  },
  books: {
    keywords: ['book', 'novel', 'paperback', 'hardcover', 'kindle', 'ebook', 'audiobook'],
    rate: 3,
  },
  toys: {
    keywords: ['toy', 'game', 'puzzle', 'lego', 'doll', 'action figure', 'board game', 'kids', 'children'],
    rate: 3,
  },
  baby: {
    keywords: ['baby', 'infant', 'toddler', 'diaper', 'stroller', 'crib', 'nursery', 'pacifier', 'bottle'],
    rate: 3,
  },
  software: {
    keywords: ['software', 'app', 'saas', 'subscription', 'plan', 'premium', 'pro plan', 'enterprise'],
    rate: 3,
  },
};

function classifyCategory(title: string | null | undefined, url: string): CategoryResult {
  const text = `${title || ''} ${url}`.toLowerCase();
  for (const [category, config] of Object.entries(CATEGORY_PATTERNS)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        return { name: category, detected_from: 'keywords', rate: config.rate };
      }
    }
  }
  return { name: 'general', detected_from: 'default' };
}

// ============================================================
// AFFILIATE TRACKING DETECTION
// ============================================================

function hasAffiliateTracking(url: string): boolean {
  const trackingPatterns = [
    /[?&](tag|ref|affiliate|aff_id|affid|utm_source=affiliate|aid|pid|sid)=/i,
    /\/(ref|affiliate|aff)\//i,
  ];
  return trackingPatterns.some(p => p.test(url));
}

function extractAsin(url: string): string | null {
  const asinPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\?.*asin=([A-Z0-9]{10})/i,
  ];
  for (const pattern of asinPatterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ============================================================
// ALTERNATIVE FINDING (multi-strategy)
// ============================================================

async function findAlternatives(
  brand: BrandResult,
  category: CategoryResult,
  currentRate: number,
  platform: PlatformDetection | null
): Promise<any[]> {
  let alternatives: any[] = [];

  // STRATEGY 1: Exact brand match
  if (brand.slug && brand.slug !== 'unknown') {
    const { data: brandMatches } = await supabaseServer
      .from('affiliate_programs')
      .select('*')
      .or(`brand_slug.eq.${brand.slug},brand_slug.ilike.%${brand.slug}%`)
      .eq('is_active', true)
      .order('commission_rate_high', { ascending: false })
      .limit(5);

    if (brandMatches?.length) {
      alternatives = brandMatches
        .filter(p => p.commission_rate_high > currentRate)
        .map(p => ({ ...p, match_type: 'exact_brand' as const }));
    }
  }

  // STRATEGY 2: Brand alias fuzzy match
  if (alternatives.length === 0 && brand.name !== 'Unknown') {
    const { data: aliasMatches } = await supabaseServer
      .from('brand_aliases')
      .select('brand_slug')
      .ilike('alias', `%${brand.slug}%`);

    if (aliasMatches?.length) {
      const slugs = [...new Set(aliasMatches.map(a => a.brand_slug))];
      const { data: programs } = await supabaseServer
        .from('affiliate_programs')
        .select('*')
        .in('brand_slug', slugs)
        .eq('is_active', true)
        .gt('commission_rate_high', currentRate)
        .order('commission_rate_high', { ascending: false })
        .limit(5);

      if (programs?.length) {
        alternatives = programs.map(p => ({ ...p, match_type: 'alias_match' as const }));
      }
    }
  }

  // STRATEGY 3: Same category, better rate
  if (alternatives.length === 0 && category.name !== 'general') {
    const { data: categoryMatches } = await supabaseServer
      .from('affiliate_programs')
      .select('*')
      .eq('category', category.name)
      .eq('is_active', true)
      .gt('commission_rate_high', currentRate)
      .order('commission_rate_high', { ascending: false })
      .limit(3);

    if (categoryMatches?.length) {
      alternatives = categoryMatches.map(p => ({ ...p, match_type: 'category' as const }));
    }
  }

  // Filter out programs on the same network as current
  if (platform?.key) {
    const currentNetwork = platform.key.split('_')[0];
    alternatives = alternatives.filter(a => a.network !== currentNetwork);
  }

  // Sort by rate advantage
  alternatives.sort((a, b) =>
    (b.commission_rate_high - currentRate) - (a.commission_rate_high - currentRate)
  );

  return alternatives.slice(0, 3);
}

// ============================================================
// GAIN CALCULATION
// ============================================================

function calculateGains(
  alternatives: any[],
  currentRate: number,
  estimatedClicks: number,
  productCount: number,
): AlternativeResult[] {
  const CONVERSION_RATE = 0.02;
  const AVG_ORDER_VALUE = 50;
  const clicksPerProduct = Math.max(50, Math.round(estimatedClicks / Math.max(productCount, 1)));

  return alternatives.map(alt => {
    const currentMonthly = clicksPerProduct * CONVERSION_RATE * AVG_ORDER_VALUE * (currentRate / 100);
    const newMonthlyLow = clicksPerProduct * CONVERSION_RATE * AVG_ORDER_VALUE * (alt.commission_rate_low / 100);
    const newMonthlyHigh = clicksPerProduct * CONVERSION_RATE * AVG_ORDER_VALUE * (alt.commission_rate_high / 100);

    const gainLow = Math.max(0, Math.round((newMonthlyLow - currentMonthly) * 100) / 100);
    const gainHigh = Math.max(0, Math.round((newMonthlyHigh - currentMonthly) * 100) / 100);

    return {
      program_id: alt.id,
      network: alt.network,
      network_display: formatNetworkName(alt.network),
      brand_name: alt.brand_name,
      match_type: alt.match_type,
      commission_rate_low: alt.commission_rate_low,
      commission_rate_high: alt.commission_rate_high,
      commission_type: alt.commission_type || 'cps',
      cookie_duration: alt.cookie_duration || 30,
      requires_application: alt.requires_application ?? true,
      approval_difficulty: alt.approval_difficulty || 'medium',
      confidence_score: alt.confidence_score || 3,
      last_verified: alt.last_verified_at || alt.updated_at || new Date().toISOString(),
      regions: alt.regions || [],
      potential_gain: {
        monthly_low: gainLow,
        monthly_high: gainHigh,
        yearly_low: Math.round(gainLow * 12 * 100) / 100,
        yearly_high: Math.round(gainHigh * 12 * 100) / 100,
      },
      action_steps: generateActionSteps(alt, null),
      signup_url: alt.signup_url,
    };
  });
}

function formatNetworkName(network: string): string {
  const names: Record<string, string> = {
    awin: 'Awin',
    shareasale: 'ShareASale',
    impact: 'Impact',
    cj: 'CJ Affiliate',
    rakuten: 'Rakuten',
    partnerstack: 'PartnerStack',
    tradedoubler: 'Tradedoubler',
    ltk: 'LTK',
    direct: 'Brand Direct',
  };
  return names[network] || network.charAt(0).toUpperCase() + network.slice(1);
}

// ============================================================
// ACTION STEPS GENERATION
// ============================================================

function getNetworkSignupUrl(network: string): string {
  const urls: Record<string, string> = {
    awin: 'https://www.awin.com/gb/publishers',
    shareasale: 'https://www.shareasale.com/newsignup.cfm',
    impact: 'https://impact.com/partnerships/',
    cj: 'https://www.cj.com/publisher',
    rakuten: 'https://rakutenadvertising.com/publisher/',
    partnerstack: 'https://partnerstack.com/',
    tradedoubler: 'https://www.tradedoubler.com/en/publishers/',
  };
  return urls[network] || '';
}

function getApprovalTime(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return '1-2 days';
    case 'medium': return '3-7 days';
    case 'hard': return '1-2 weeks';
    default: return '3-7 days';
  }
}

function generateActionSteps(alt: any, platform: PlatformDetection | null): ActionStep[] {
  const steps: ActionStep[] = [];
  const networkDisplay = formatNetworkName(alt.network);
  const platformName = platform?.name || 'your current platform';

  if (alt.requires_application) {
    steps.push({
      step: 1,
      instruction: `Apply to ${alt.brand_name}'s program on ${networkDisplay}`,
      url: alt.signup_url || getNetworkSignupUrl(alt.network),
    });
    steps.push({
      step: 2,
      instruction: `Wait for approval (typically ${getApprovalTime(alt.approval_difficulty || 'medium')})`,
    });
    steps.push({
      step: 3,
      instruction: `Once approved, generate your affiliate link from the ${networkDisplay} dashboard`,
    });
    steps.push({
      step: 4,
      instruction: `Replace the ${platformName} link in your storefront with the new link`,
    });
  } else {
    steps.push({
      step: 1,
      instruction: `Sign up for ${networkDisplay} as a publisher (free)`,
      url: getNetworkSignupUrl(alt.network),
    });
    steps.push({
      step: 2,
      instruction: `Search for "${alt.brand_name}" in the program directory and join`,
    });
    steps.push({
      step: 3,
      instruction: `Generate your affiliate link and replace the current one in your storefront`,
    });
  }

  return steps;
}

// ============================================================
// INSIGHT GENERATION (max 3, quality over quantity)
// ============================================================

function generateInsights(
  platform: PlatformDetection | null,
  brand: BrandResult,
  category: CategoryResult,
  currentRate: number,
  alternatives: AlternativeResult[],
  url: string
): Insight[] {
  const insights: Insight[] = [];

  // RULE 1: Significant gain found
  if (alternatives.length > 0 && alternatives[0].potential_gain.monthly_high > 5) {
    insights.push({
      type: 'opportunity',
      title: `Save up to €${Math.round(alternatives[0].potential_gain.yearly_high)}/year`,
      description: `${alternatives[0].brand_name} products earn ${alternatives[0].commission_rate_low}-${alternatives[0].commission_rate_high}% on ${alternatives[0].network_display} vs ${currentRate}% currently.`,
      priority: 'high',
    });
  }

  // RULE 2: No affiliate tracking detected
  if (!platform && !hasAffiliateTracking(url)) {
    insights.push({
      type: 'warning',
      title: 'No affiliate tracking detected',
      description: 'This appears to be a direct link without commission tracking. You\'re sending traffic but not earning from it.',
      priority: 'high',
    });
  }

  // RULE 3: Amazon electronics (worst case scenario)
  if (platform?.key?.startsWith('amazon_') && category.name === 'electronics') {
    insights.push({
      type: 'tip',
      title: 'Electronics: Amazon\'s lowest category',
      description: 'Electronics earn only 1% on Amazon. Brand-direct programs typically pay 3-10%. This is the single biggest commission upgrade for most creators.',
      priority: 'high',
    });
  }

  // RULE 4: Cookie duration advantage
  if (alternatives.length > 0 && platform?.cookieUnit === 'hours') {
    const bestCookie = Math.max(...alternatives.map(a => a.cookie_duration));
    insights.push({
      type: 'tip',
      title: `${bestCookie}-day cookie vs ${platform.cookieDuration}-hour`,
      description: `Amazon's 24-hour cookie means you lose credit if the customer doesn't buy immediately. ${alternatives[0].network_display} gives ${bestCookie} days.`,
      priority: 'medium',
    });
  }

  // RULE 5: Already on premium network
  if (platform && ['awin', 'impact', 'shareasale'].includes(platform.key) && alternatives.length === 0) {
    insights.push({
      type: 'tip',
      title: 'You\'re on a premium network',
      description: `${platform.name} typically offers good rates. Check if you qualify for tiered bonuses based on performance volume.`,
      priority: 'low',
    });
  }

  // RULE 6: Brand not in DB but detected
  if (alternatives.length === 0 && brand.name !== 'Unknown' && brand.confidence > 1) {
    insights.push({
      type: 'action',
      title: `Search for ${brand.name}'s affiliate program`,
      description: `We don't have ${brand.name} in our database yet. Search "${brand.name} affiliate program" or check Awin, Impact, and ShareASale.`,
      priority: 'medium',
      action_url: 'https://www.awin.com/gb/publishers',
    });
  }

  // RULE 7: Amazon category-specific tips (non-electronics)
  if (platform?.key?.startsWith('amazon_') && category.name === 'fashion' && alternatives.length > 0) {
    insights.push({
      type: 'tip',
      title: 'Fashion pays better direct',
      description: 'Fashion brands often pay 8-15% through Awin or LTK vs 4% on Amazon. Zalando pays 6-12%, ASOS 5-10%.',
      priority: 'medium',
    });
  }

  if (platform?.key?.startsWith('amazon_') && category.name === 'beauty' && alternatives.length > 0) {
    insights.push({
      type: 'tip',
      title: 'Beauty brands pay premium rates',
      description: 'Sephora, Douglas, and Flaconi pay 5-15% through Awin. Apply for brand-direct programs for even higher rates.',
      priority: 'medium',
    });
  }

  // Sort by priority and return max 3
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return insights
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 3);
}

// ============================================================
// MAIN ANALYSIS PIPELINE
// ============================================================

async function analyzeProduct(
  product: ProductInput,
  userId: string,
  estimatedClicks: number,
  productCount: number,
  sessionId: string | null,
): Promise<ProductResult> {
  const url = product.product_url;

  // STEP 1: Platform Detection
  const platform = detectPlatform(url);

  // STEP 2: Brand Detection
  const brand = await detectBrand(product);

  // STEP 3: Category Classification
  const category = classifyCategory(product.title, url);

  // STEP 4: Current Commission Rate
  let currentRate = platform?.defaultRate || 0;
  let cookieDuration = platform?.cookieDuration || 0;
  let cookieUnit: 'hours' | 'days' = platform?.cookieUnit || 'days';
  const hasTracking = platform ? true : hasAffiliateTracking(url);

  if (platform?.key?.startsWith('amazon_') && category.name !== 'general') {
    const { data: categoryRate } = await supabaseServer
      .from('platform_commission_rates')
      .select('commission_rate')
      .eq('platform', platform.key)
      .eq('category', category.name)
      .single();

    if (categoryRate) {
      currentRate = categoryRate.commission_rate;
    }
  } else if (platform?.key && !platform.key.startsWith('amazon_') && category.name !== 'general') {
    const { data: categoryRate } = await supabaseServer
      .from('platform_commission_rates')
      .select('commission_rate')
      .eq('platform', platform.key)
      .eq('category', category.name)
      .single();

    if (categoryRate) {
      currentRate = categoryRate.commission_rate;
    }
  }

  // STEP 5: Find Alternatives
  const rawAlternatives = await findAlternatives(brand, category, currentRate, platform);

  // STEP 6: Calculate Gains & Generate Action Steps
  const alternatives = calculateGains(rawAlternatives, currentRate, estimatedClicks, productCount);

  // Update action steps with platform context
  for (const alt of alternatives) {
    alt.action_steps = generateActionSteps(
      { ...alt, brand_name: alt.brand_name, network: alt.network, signup_url: alt.signup_url, requires_application: alt.requires_application, approval_difficulty: alt.approval_difficulty },
      platform,
    );
  }

  // STEP 7: Generate Insights
  const insights = generateInsights(platform, brand, category, currentRate, alternatives, url);

  // STEP 8: Persist to DB
  const bestAlternative = alternatives[0];
  try {
    await supabaseServer.from('link_analyses').insert({
      user_id: userId,
      original_url: url,
      original_platform: platform?.key || 'direct',
      detected_brand: brand.name !== 'Unknown' ? brand.name : null,
      detected_product: product.title,
      detected_asin: extractAsin(url),
      detected_commission_rate: currentRate,
      alternatives_found: alternatives.length,
      best_alternative_id: bestAlternative?.program_id || null,
      potential_gain_low: bestAlternative?.potential_gain.monthly_low || 0,
      potential_gain_high: bestAlternative?.potential_gain.monthly_high || 0,
      yearly_projection_low: bestAlternative?.potential_gain.yearly_low || 0,
      yearly_projection_high: bestAlternative?.potential_gain.yearly_high || 0,
      session_id: sessionId,
      action_steps: bestAlternative?.action_steps || null,
      cookie_comparison: platform ? {
        current: cookieDuration,
        current_unit: cookieUnit,
        alternative: bestAlternative?.cookie_duration || null,
        alternative_unit: 'days',
      } : null,
      analysis_metadata: {
        platform: platform ? { key: platform.key, name: platform.name } : null,
        brand,
        category,
        alternatives_count: alternatives.length,
        insights_count: insights.length,
      },
    });
  } catch (e) {
    console.error('[CommissionAgent] Failed to persist analysis:', e);
  }

  return {
    productId: product.id,
    productName: product.title || brand.name || 'Unknown Product',
    brand: {
      name: brand.name,
      detected_from: brand.detected_from,
      confidence: brand.confidence,
    },
    category: {
      name: category.name,
      detected_from: category.detected_from,
    },
    current: {
      url,
      platform: platform?.key || 'direct',
      platform_name: platform?.name || (hasTracking ? 'Unknown Network' : 'Direct Link (No Tracking)'),
      commission_rate: currentRate,
      commission_type: 'cps',
      cookie_duration: cookieDuration,
      cookie_unit: cookieUnit,
      has_tracking: hasTracking,
    },
    alternatives,
    insights,
  };
}

// ============================================================
// API HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { products } = await request.json() as { products: ProductInput[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required' }, { status: 400 });
    }

    if (products.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 products per batch' }, { status: 400 });
    }

    // Get user's traffic stats for gain estimation
    const { data: trafficStats } = await supabaseServer
      .from('affiliate_transactions')
      .select('clicks, commission_eur')
      .eq('user_id', session.user.id)
      .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const monthlyClicks = trafficStats?.reduce((sum, tx) => sum + (tx.clicks || 0), 0) || 0;
    const estimatedClicks = monthlyClicks > 0 ? monthlyClicks : 500;

    // Create session
    let sessionId: string | null = null;
    try {
      const { data: agentSession } = await supabaseServer
        .from('commission_agent_sessions')
        .insert({
          user_id: session.user.id,
          session_type: 'batch',
          products_analyzed: products.length,
          status: 'running',
        })
        .select('id')
        .single();
      sessionId = agentSession?.id || null;
    } catch (e) {
      console.error('[CommissionAgent] Failed to create session:', e);
    }

    // Analyze each product (per-product error handling)
    const results: ProductResult[] = [];
    for (const product of products) {
      try {
        const result = await analyzeProduct(product, session.user.id, estimatedClicks, products.length, sessionId);
        results.push(result);
      } catch (error) {
        console.error(`[CommissionAgent] Failed to analyze ${product.product_url}:`, error);
        results.push({
          productId: product.id,
          productName: product.title || 'Unknown Product',
          brand: { name: 'Unknown', detected_from: 'none', confidence: 0 },
          category: { name: 'general', detected_from: 'default' },
          current: {
            url: product.product_url,
            platform: 'unknown',
            platform_name: 'Unknown',
            commission_rate: 0,
            commission_type: 'cps',
            cookie_duration: 0,
            cookie_unit: 'days',
            has_tracking: false,
          },
          alternatives: [],
          insights: [],
          error: 'Analysis failed for this product. Please try again.',
        });
      }
    }

    // Compute summary
    const opportunitiesFound = results.filter(r => r.alternatives.length > 0).length;
    const totalGainLow = results.reduce((sum, r) => sum + (r.alternatives[0]?.potential_gain.monthly_low || 0), 0);
    const totalGainHigh = results.reduce((sum, r) => sum + (r.alternatives[0]?.potential_gain.monthly_high || 0), 0);

    // Update session
    if (sessionId) {
      try {
        await supabaseServer
          .from('commission_agent_sessions')
          .update({
            status: 'completed',
            opportunities_found: opportunitiesFound,
            total_potential_gain_low: totalGainLow,
            total_potential_gain_high: totalGainHigh,
          })
          .eq('id', sessionId);
      } catch (e) {
        console.error('[CommissionAgent] Failed to update session:', e);
      }
    }

    return NextResponse.json({
      session_id: sessionId,
      summary: {
        products_analyzed: results.length,
        opportunities_found: opportunitiesFound,
        total_potential_gain_low: Math.round(totalGainLow * 100) / 100,
        total_potential_gain_high: Math.round(totalGainHigh * 100) / 100,
        total_yearly_low: Math.round(totalGainLow * 12 * 100) / 100,
        total_yearly_high: Math.round(totalGainHigh * 12 * 100) / 100,
      },
      results,
    });
  } catch (error) {
    console.error('[CommissionAgent] Batch analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze products. Please try again.' },
      { status: 500 }
    );
  }
}
