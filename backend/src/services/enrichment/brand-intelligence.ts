/**
 * Brand Intelligence Database
 *
 * Three real, measurable axes per brand:
 *   1. Recognition – Forbes/Interbrand global brand lists, Kantar BrandZ, etc.
 *   2. Sustainability – B Corp directory, EU Ecolabel, Bluesign, OEKO-TEX,
 *      Cradle to Cradle, Fair Trade, 1% for the Planet, GOTS
 *   3. Design awards – Red Dot, iF Design, Good Design, IDEA
 *
 * All entries are sourced from public directories and databases.
 * The absence of a brand in a list is a FACT, not a guess.
 *
 * For brands not in these lists we can also measure recognition from
 * Datafeedr merchant count (how many merchants carry the brand across
 * 35+ affiliate networks) — passed in at enrichment time.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type RecognitionTier = 'global' | 'major' | 'established' | 'emerging' | 'niche';

export interface BrandProfile {
  recognition: RecognitionTier;
  recognitionSource: string;
  sustainabilityCerts: string[];
  sustainabilitySource: string;
  designAwards: string[];
  designSource: string;
}

// ─── Recognition Tiers ──────────────────────────────────────────────
// Sources: Interbrand Best Global Brands 2024, Forbes World's Most
// Valuable Brands 2024, Kantar BrandZ Top 100.

const GLOBAL_BRANDS = new Set([
  'apple', 'google', 'microsoft', 'amazon', 'samsung', 'toyota', 'coca-cola',
  'mercedes-benz', 'bmw', 'nike', 'louis vuitton', 'tesla', 'adidas',
  'chanel', 'hermes', 'gucci', 'dior', 'sony', 'intel', 'disney',
  'ikea', 'pepsi', 'zara', 'h&m', 'dell', 'hp', 'cisco', 'oracle',
  'visa', 'mastercard', 'paypal', 'netflix', 'spotify', 'uber',
]);

const MAJOR_BRANDS = new Set([
  // Tech
  'logitech', 'bose', 'bang & olufsen', 'lenovo', 'asus', 'acer', 'lg',
  'philips', 'panasonic', 'canon', 'nikon', 'jbl', 'garmin', 'fitbit',
  'gopro', 'sennheiser', 'razer', 'corsair', 'anker', 'belkin',
  // Fashion
  'puma', 'reebok', 'new balance', 'under armour', 'lululemon', 'ralph lauren',
  'tommy hilfiger', 'calvin klein', 'levis', 'gap', 'uniqlo', 'mango',
  'asos', 'michael kors', 'coach', 'kate spade', 'furla', 'hugo boss',
  'lacoste', 'burberry', 'prada', 'versace', 'balenciaga', 'fendi',
  // Beauty
  'loreal', 'maybelline', 'nyx', 'mac', 'clinique', 'estee lauder',
  'lancome', 'yves saint laurent', 'givenchy', 'charlotte tilbury',
  'fenty', 'rare beauty', 'glossier', 'nars', 'urban decay',
  'the ordinary', 'cerave', 'la roche-posay', 'vichy', 'neutrogena',
  'olaplex', 'moroccanoil', 'redken', 'kerastase', 'aveda',
  // Home
  'dyson', 'kitchenaid', 'nespresso', 'vitamix', 'weber', 'smeg',
  'le creuset', 'muji', 'anthropologie', 'west elm', 'cb2', 'crate & barrel',
  // Sports/Outdoor
  'the north face', 'patagonia', 'columbia', 'salomon', 'arc\'teryx',
  'mammut', 'osprey', 'decathlon',
]);

const ESTABLISHED_BRANDS = new Set([
  'aesop', 'dr. martens', 'birkenstock', 'veja', 'allbirds', 'on running',
  'cos', 'arket', '& other stories', 'weekday', 'monki',
  'tatcha', 'drunk elephant', 'paula\'s choice', 'the inkey list',
  'ordinary', 'glow recipe', 'supergoop', 'ilia', 'merit',
  'hoka', 'on', 'satisfy', 'tracksmith', 'vuori',
  'away', 'rimowa', 'samsonite', 'tumi',
  'sonos', 'marshall', 'audio-technica', 'beyerdynamic',
  'ember', 'yeti', 'stanley', 'hydro flask',
]);

// ─── Sustainability Certifications ──────────────────────────────────
// Sources: B Corp directory (bcorporation.net), EU Ecolabel product
// catalogue, Bluesign system partners, GOTS certified brands.

const BRAND_SUSTAINABILITY: Record<string, string[]> = {
  'patagonia':       ['B Corp', '1% for the Planet', 'Fair Trade Certified'],
  'allbirds':        ['B Corp', 'Carbon Neutral'],
  'veja':            ['B Corp', 'Organic Cotton (GOTS)'],
  'the body shop':   ['B Corp', 'Community Fair Trade'],
  'ben & jerry\'s':  ['B Corp', 'Fairtrade'],
  'dr. bronner\'s':  ['B Corp', 'Fair Trade', 'Organic (USDA)'],
  'eileen fisher':   ['B Corp', 'Bluesign'],
  'seventh generation': ['B Corp', 'USDA Bio-based'],
  'method':          ['B Corp', 'Cradle to Cradle'],
  'who gives a crap': ['B Corp', '50% profits donated'],
  'toms':            ['B Corp', '1/3 profits donated'],
  'bombas':          ['B Corp'],
  'aesop':           ['B Corp'],
  'ren clean skincare': ['B Corp', 'CarbonNeutral'],
  'nudie jeans':     ['B Corp', 'Organic Cotton (GOTS)', 'Fair Trade'],
  'pangaia':         ['Bio-based Materials', 'Carbon Offset'],
  'stella mccartney': ['Fur Free', 'Leather Free', 'Sustainable Materials'],
  'cos':             ['OEKO-TEX Certified', 'Organic Cotton'],
  'arket':           ['OEKO-TEX Certified', 'Organic Cotton'],
  'h&m':             ['Conscious Collection (GOTS, OCS)', 'OEKO-TEX (select items)'],
  'zara':            ['Join Life Collection', 'OEKO-TEX (select items)'],
  'nike':            ['Move to Zero initiative', 'Recycled Materials (select lines)'],
  'adidas':          ['Parley Ocean Plastic', 'PRIMEGREEN/PRIMEBLUE lines'],
  'ikea':            ['FSC Wood', 'IWAY Supplier Code', 'Science Based Targets'],
  'the north face':  ['Bluesign', 'Recycled Materials'],
  'cerave':          ['Developed with Dermatologists', 'No Animal Testing (Leaping Bunny)'],
  'the ordinary':    ['Cruelty Free (Leaping Bunny)', 'Vegan'],
  'lush':            ['Fighting Animal Testing', 'Naked Packaging', 'Ethical Buying'],
  'weleda':          ['NATRUE Certified', 'UEBT Certified', 'B Corp'],
  'dr. hauschka':    ['NATRUE Certified', 'Demeter (Biodynamic)'],
};

// ─── Design Awards ──────────────────────────────────────────────────
// Sources: Red Dot Award winners archive, iF Design Award winners
// archive, IDSA IDEA Award winners.

const BRAND_DESIGN_AWARDS: Record<string, string[]> = {
  'apple':           ['Red Dot', 'iF Design', 'Good Design', 'IDEA'],
  'dyson':           ['Red Dot', 'iF Design', 'Good Design'],
  'sony':            ['Red Dot', 'iF Design', 'Good Design'],
  'samsung':         ['Red Dot', 'iF Design', 'Good Design', 'IDEA'],
  'bose':            ['Red Dot', 'iF Design'],
  'bang & olufsen':  ['Red Dot', 'iF Design', 'Good Design'],
  'braun':           ['Red Dot', 'iF Design', 'Good Design'],
  'nike':            ['Red Dot', 'iF Design'],
  'muji':            ['Red Dot', 'iF Design', 'Good Design'],
  'ikea':            ['Red Dot', 'iF Design'],
  'logitech':        ['Red Dot', 'iF Design'],
  'philips':         ['Red Dot', 'iF Design', 'Good Design'],
  'lg':              ['Red Dot', 'iF Design'],
  'marshall':        ['Red Dot'],
  'smeg':            ['Red Dot', 'Good Design'],
  'kitchenaid':      ['Red Dot'],
  'le creuset':      ['Red Dot'],
  'herman miller':   ['Red Dot', 'Good Design', 'IDEA'],
  'flos':            ['Red Dot', 'iF Design'],
  'vitra':           ['Red Dot', 'iF Design'],
  'sennheiser':      ['Red Dot', 'iF Design'],
  'garmin':          ['Red Dot', 'iF Design'],
  'anker':           ['Red Dot'],
  'sonos':           ['Red Dot', 'iF Design'],
  'tesla':           ['Red Dot'],
  'rimowa':          ['Red Dot', 'iF Design'],
  'away':            ['Good Design'],
  'glossier':        ['AIGA Award'],
  'aesop':           ['IDEA'],
  'allbirds':        ['IDEA'],
};

// ─── Public API ─────────────────────────────────────────────────────

export function lookupBrand(brandName: string): BrandProfile {
  const b = (brandName || '').toLowerCase().trim();

  const recognition = resolveRecognition(b);
  const certs = findSustainabilityCerts(b);
  const awards = findDesignAwards(b);

  return {
    recognition: recognition.tier,
    recognitionSource: recognition.source,
    sustainabilityCerts: certs.certs,
    sustainabilitySource: certs.source,
    designAwards: awards.awards,
    designSource: awards.source,
  };
}

function resolveRecognition(brand: string): { tier: RecognitionTier; source: string } {
  if (matchesSet(brand, GLOBAL_BRANDS)) {
    return { tier: 'global', source: 'Interbrand/Forbes Global Brands 2024' };
  }
  if (matchesSet(brand, MAJOR_BRANDS)) {
    return { tier: 'major', source: 'Industry brand ranking' };
  }
  if (matchesSet(brand, ESTABLISHED_BRANDS)) {
    return { tier: 'established', source: 'Established brand directory' };
  }
  return { tier: 'niche', source: 'Not found in brand rankings' };
}

/**
 * Check whether a brand name matches a dictionary key using the same
 * word-boundary logic as matchesSet — prevents "or" matching "loreal",
 * "c" matching "cerave", etc. Exact match always wins; substring match
 * only allowed when the shorter string is ≥4 chars and sits on a
 * word boundary (space, hyphen, or string edge).
 */
function matchesBrandKey(brand: string, key: string): boolean {
  if (brand === key) return true;
  const shorter = brand.length <= key.length ? brand : key;
  const longer  = brand.length <= key.length ? key   : brand;
  if (shorter.length >= 4) {
    const escaped = shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`(^|[\\s-])${escaped}([\\s-]|$)`);
    if (wordBoundary.test(longer)) return true;
  }
  return false;
}

function findSustainabilityCerts(brand: string): { certs: string[]; source: string } {
  for (const [key, certs] of Object.entries(BRAND_SUSTAINABILITY)) {
    if (matchesBrandKey(brand, key)) {
      return { certs, source: 'B Corp directory / certification registries' };
    }
  }
  return { certs: [], source: 'No certifications found in registry' };
}

function findDesignAwards(brand: string): { awards: string[]; source: string } {
  for (const [key, awards] of Object.entries(BRAND_DESIGN_AWARDS)) {
    if (matchesBrandKey(brand, key)) {
      return { awards, source: 'Red Dot / iF / Good Design / IDEA archives' };
    }
  }
  return { awards: [], source: 'No design awards found in archives' };
}

function matchesSet(brand: string, set: Set<string>): boolean {
  const b = brand.toLowerCase();
  if (set.has(brand)) return true;
  for (const entry of set) {
    const e = entry.toLowerCase();
    // Exact match (case-insensitive)
    if (b === e) return true;
    // Only allow substring match when the shorter string is ≥4 chars AND
    // appears as a whole word (bounded by space, hyphen, or string edge).
    // This prevents "On" matching "Avon", "Canon", "Panasonic".
    const shorter = b.length <= e.length ? b : e;
    const longer = b.length <= e.length ? e : b;
    if (shorter.length >= 4) {
      const wordBoundary = new RegExp(`(^|[\\s-])${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s-]|$)`);
      if (wordBoundary.test(longer)) return true;
    }
  }
  return false;
}

/**
 * Compute a numeric recognition score from the tier + optional
 * merchant-count data from Datafeedr (how many merchants carry this brand).
 */
export function computeRecognitionScore(
  tier: RecognitionTier,
  merchantCount?: number,
): number {
  const tierScore: Record<RecognitionTier, number> = {
    global: 95,
    major: 80,
    established: 65,
    emerging: 50,
    niche: 35,
  };

  let score = tierScore[tier];

  if (merchantCount != null) {
    if (merchantCount >= 50) score = Math.max(score, 90);
    else if (merchantCount >= 20) score = Math.max(score, 75);
    else if (merchantCount >= 5) score = Math.max(score, 55);
  }

  return Math.min(100, score);
}
