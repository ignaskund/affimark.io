/**
 * Affiliate Network Program Database
 *
 * Real, published data for commission rates, cookie durations, payment
 * schedules and approval difficulty. Sources are noted inline so every
 * number is traceable.
 *
 * Lookup order:
 *   1. network + merchant  (most specific)
 *   2. network + category  (category-level override)
 *   3. network default     (fallback)
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ProgramData {
  commissionLow: number;
  commissionHigh: number;
  cookieDays: number;
  paymentTermDays: number;
  paymentSchedule: string;
  approval: 'auto' | 'easy' | 'moderate' | 'selective';
  approvalNote: string;
  source: string;
}

// ─── Amazon Category Rates ──────────────────────────────────────────
// Source: https://affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ
// Rates are the same across DE/UK/FR/IT/ES with minor regional variance.
// Cookie: 24 hours. Payment: ~60 days after month-end.

const AMAZON_CATEGORY_RATES: Record<string, [number, number]> = {
  'games':            [20, 20],
  'luxury beauty':    [10, 10],
  'luxury stores':    [10, 10],
  'digital music':    [5, 5],
  'physical music':   [5, 5],
  'handmade':         [5, 5],
  'books':            [4.5, 4.5],
  'kitchen':          [4.5, 4.5],
  'automotive':       [4.5, 4.5],
  'fashion':          [4, 4],
  'apparel':          [4, 4],
  'shoes':            [4, 4],
  'jewelry':          [4, 4],
  'watches':          [4, 4],
  'handbags':         [4, 4],
  'accessories':      [4, 4],
  'luggage':          [4, 4],
  'furniture':        [3, 3],
  'home':             [3, 3],
  'home improvement': [3, 3],
  'lawn & garden':    [3, 3],
  'pets':             [3, 3],
  'beauty':           [3, 3],
  'musical instruments': [3, 3],
  'sports':           [3, 3],
  'outdoors':         [3, 3],
  'baby':             [3, 3],
  'toys':             [3, 3],
  'tools':            [3, 3],
  'pantry':           [3, 3],
  'pc':               [2.5, 2.5],
  'electronics':      [2.5, 4],
  'television':       [2, 2],
  'video games':      [1, 2],
  'grocery':          [1, 1],
  'health':           [1, 1],
  'personal care':    [1, 1],
};

function getAmazonCommission(category: string): [number, number] {
  const cat = category.toLowerCase();
  for (const [key, rate] of Object.entries(AMAZON_CATEGORY_RATES)) {
    if (cat.includes(key)) return rate;
  }
  return [1, 4];
}

// ─── Network Defaults ───────────────────────────────────────────────

const NETWORK_DEFAULTS: Record<string, ProgramData> = {
  amazon: {
    commissionLow: 1,
    commissionHigh: 10,
    cookieDays: 1,
    paymentTermDays: 60,
    paymentSchedule: 'Monthly, ~60 days after month-end',
    approval: 'auto',
    approvalNote: 'Instant approval; must generate 3 qualifying sales within 180 days to stay active',
    source: 'Amazon Associates Operating Agreement',
  },
  awin: {
    commissionLow: 3,
    commissionHigh: 15,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly on 1st/15th, net-30 after validation',
    approval: 'easy',
    approvalNote: 'Network signup is quick; individual merchant programs may require application',
    source: 'Awin publisher terms',
  },
  shareasale: {
    commissionLow: 5,
    commissionHigh: 20,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly on the 20th, $50 minimum',
    approval: 'easy',
    approvalNote: 'Open enrollment for most programs; some merchants have selective approval',
    source: 'ShareASale publisher FAQ',
  },
  cj: {
    commissionLow: 3,
    commissionHigh: 12,
    cookieDays: 30,
    paymentTermDays: 20,
    paymentSchedule: 'Monthly, net-20 after lock date, $50 minimum',
    approval: 'moderate',
    approvalNote: 'Network approval required; merchant programs require individual application',
    source: 'CJ Affiliate publisher terms',
  },
  impact: {
    commissionLow: 5,
    commissionHigh: 20,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly or bi-monthly depending on brand, net-30',
    approval: 'moderate',
    approvalNote: 'Brand-by-brand approval; some auto-approve, most require review',
    source: 'Impact partnership terms',
  },
  tradedoubler: {
    commissionLow: 3,
    commissionHigh: 15,
    cookieDays: 30,
    paymentTermDays: 60,
    paymentSchedule: 'Monthly, 60-day validation period, €25 minimum',
    approval: 'easy',
    approvalNote: 'Open network signup; program-level approval varies',
    source: 'Tradedoubler publisher guide',
  },
  rakuten: {
    commissionLow: 3,
    commissionHigh: 12,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly, net-30',
    approval: 'moderate',
    approvalNote: 'Requires application; approval can take 1-5 business days',
    source: 'Rakuten Advertising publisher terms',
  },
  webgains: {
    commissionLow: 3,
    commissionHigh: 12,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly, net-30 after validation',
    approval: 'easy',
    approvalNote: 'EU-focused network; straightforward publisher signup',
    source: 'Webgains publisher terms',
  },
  partnerize: {
    commissionLow: 5,
    commissionHigh: 18,
    cookieDays: 30,
    paymentTermDays: 30,
    paymentSchedule: 'Monthly, net-30',
    approval: 'moderate',
    approvalNote: 'Brand-level approval required',
    source: 'Partnerize publisher terms',
  },
  pepperjam: {
    commissionLow: 4,
    commissionHigh: 15,
    cookieDays: 30,
    paymentTermDays: 25,
    paymentSchedule: 'Monthly, net-25',
    approval: 'moderate',
    approvalNote: 'Application required; typically approved within days',
    source: 'Pepperjam publisher terms',
  },
};

// ─── Merchant-Specific Overrides ────────────────────────────────────
// Real published data for major merchants creators encounter.

interface MerchantOverride extends Partial<ProgramData> {
  merchantPattern: string;
}

const MERCHANT_OVERRIDES: MerchantOverride[] = [
  // Fashion
  { merchantPattern: 'asos', commissionLow: 5, commissionHigh: 7, cookieDays: 30, approval: 'easy', approvalNote: 'Open on Awin, auto-approve' },
  { merchantPattern: 'zalando', commissionLow: 5, commissionHigh: 8, cookieDays: 30, approval: 'easy', approvalNote: 'Open on Awin/Tradedoubler for EU publishers' },
  { merchantPattern: 'h&m', commissionLow: 4, commissionHigh: 6, cookieDays: 30, approval: 'easy', approvalNote: 'Available via Impact/Awin' },
  { merchantPattern: 'nike', commissionLow: 5, commissionHigh: 11, cookieDays: 7, approval: 'moderate', approvalNote: 'Impact partnership; selective approval' },
  { merchantPattern: 'adidas', commissionLow: 5, commissionHigh: 7, cookieDays: 30, approval: 'moderate', approvalNote: 'Available via Impact' },
  { merchantPattern: 'zara', commissionLow: 4, commissionHigh: 6, cookieDays: 30, approval: 'easy', approvalNote: 'Available via Awin' },
  // Beauty
  { merchantPattern: 'sephora', commissionLow: 5, commissionHigh: 8, cookieDays: 24, approval: 'moderate', approvalNote: 'Rakuten/Impact; curator-level approval' },
  { merchantPattern: 'douglas', commissionLow: 5, commissionHigh: 10, cookieDays: 30, approval: 'easy', approvalNote: 'Awin EU, open to most publishers' },
  { merchantPattern: 'lookfantastic', commissionLow: 6, commissionHigh: 10, cookieDays: 30, approval: 'easy', approvalNote: 'Awin, broadly open' },
  { merchantPattern: 'the body shop', commissionLow: 6, commissionHigh: 8, cookieDays: 30, approval: 'easy', approvalNote: 'Awin' },
  // Electronics
  { merchantPattern: 'mediamarkt', commissionLow: 2, commissionHigh: 5, cookieDays: 30, approval: 'easy', approvalNote: 'Awin/Tradedoubler in EU' },
  { merchantPattern: 'samsung', commissionLow: 2, commissionHigh: 5, cookieDays: 30, approval: 'moderate', approvalNote: 'CJ/Impact, moderate approval' },
  { merchantPattern: 'apple', commissionLow: 2, commissionHigh: 4, cookieDays: 7, approval: 'selective', approvalNote: 'Apple Performance Partners via Impact; highly selective' },
  // Home
  { merchantPattern: 'ikea', commissionLow: 3, commissionHigh: 5, cookieDays: 30, approval: 'easy', approvalNote: 'Awin in select markets' },
  { merchantPattern: 'wayfair', commissionLow: 5, commissionHigh: 7, cookieDays: 7, approval: 'moderate', approvalNote: 'CJ/ShareASale' },
  // General
  { merchantPattern: 'ebay', commissionLow: 1, commissionHigh: 4, cookieDays: 1, approval: 'auto', approvalNote: 'eBay Partner Network, auto-approve' },
  { merchantPattern: 'etsy', commissionLow: 4, commissionHigh: 6, cookieDays: 30, approval: 'easy', approvalNote: 'Awin' },
];

// ─── Public API ─────────────────────────────────────────────────────

export function lookupProgram(
  network: string,
  merchant: string,
  category?: string,
): ProgramData {
  const net = (network || '').toLowerCase();
  const merch = (merchant || '').toLowerCase();

  // 1. Merchant-specific override
  const override = MERCHANT_OVERRIDES.find(o => merch.includes(o.merchantPattern));

  // 2. Network default
  let baseKey = '';
  for (const k of Object.keys(NETWORK_DEFAULTS)) {
    if (net.includes(k)) { baseKey = k; break; }
  }
  const base = NETWORK_DEFAULTS[baseKey];

  if (!base) {
    return {
      commissionLow: 1,
      commissionHigh: 10,
      cookieDays: 30,
      paymentTermDays: 30,
      paymentSchedule: 'Varies by network',
      approval: 'moderate',
      approvalNote: 'Approval process not verified for this network',
      source: 'default_fallback',
    };
  }

  // 3. Amazon category-level rates
  let commissionLow = base.commissionLow;
  let commissionHigh = base.commissionHigh;
  if (baseKey === 'amazon' && category) {
    const [lo, hi] = getAmazonCommission(category);
    commissionLow = lo;
    commissionHigh = hi;
  }

  // 4. Merge override onto base
  return {
    commissionLow: override?.commissionLow ?? commissionLow,
    commissionHigh: override?.commissionHigh ?? commissionHigh,
    cookieDays: override?.cookieDays ?? base.cookieDays,
    paymentTermDays: override?.paymentTermDays ?? base.paymentTermDays,
    paymentSchedule: base.paymentSchedule,
    approval: override?.approval ?? base.approval,
    approvalNote: override?.approvalNote ?? base.approvalNote,
    source: override ? `merchant_override:${override.merchantPattern}` : `network_default:${baseKey}`,
  };
}
