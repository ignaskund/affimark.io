/**
 * Policy Extractor for Product Verifier
 *
 * Extracts and scores merchant policies:
 * - Returns policy (days, conditions, clarity)
 * - Shipping policy (free threshold, estimated days)
 * - Support accessibility (contact visibility, channels)
 *
 * Generates friction flags that impact conversion.
 * Creates diffable snapshots for watchlist monitoring.
 */

import crypto from 'node:crypto';

// --- Types ---

export interface ReturnPolicy {
  days: number | null;
  conditions: string[];
  free_returns: boolean | null;
  clarity_score: number; // 0-10
  raw_text: string | null;
}

export interface ShippingPolicy {
  free_threshold: number | null;
  free_threshold_currency: string | null;
  estimated_days: string | null;
  regions: string[];
  clarity_score: number; // 0-10
  raw_text: string | null;
}

export interface SupportInfo {
  contact_visible: boolean;
  channels: ('email' | 'phone' | 'chat' | 'form')[];
  response_time: string | null;
  clarity_score: number; // 0-10
}

export interface PolicySnapshot {
  returns: ReturnPolicy;
  shipping: ShippingPolicy;
  support: SupportInfo;
  overall_clarity: number; // 0-100
  friction_flags: string[];
  snapshot_hash: string;
}

export interface PolicyInput {
  page_html: string;
  page_text: string;
  detected_links: {
    returns?: string;
    shipping?: string;
    contact?: string;
    faq?: string;
  };
  merchant: string;
  platform: string;
}

// --- Pattern Definitions ---

const RETURN_PATTERNS = {
  days: [
    /(\d+)\s*(?:day|tage|jour)s?\s*(?:return|r[üu]ckgabe|retour)/i,
    /return\s*(?:within|innerhalb|dans)\s*(\d+)\s*(?:day|tage|jour)/i,
    /(?:r[üu]ckgabe|retour|return).*?(\d+)\s*(?:day|tage|jour)/i,
  ],
  free_returns: [
    /free\s*return/i,
    /kostenlose\s*r[üu]ckgabe/i,
    /retour\s*gratuit/i,
    /return\s*(?:at\s*)?no\s*(?:extra\s*)?cost/i,
  ],
  conditions: [
    /(?:original\s*)?(?:packaging|verpackung|emballage)/i,
    /(?:unused|unbenutzt|neuf)/i,
    /(?:tags?\s*attached|etiketten?)/i,
    /(?:receipt|beleg|ticket)/i,
  ],
};

const SHIPPING_PATTERNS = {
  free_threshold: [
    /free\s*(?:shipping|delivery|versand).*?(?:over|ab|[àa]\s*partir\s*de).*?(?:€|EUR|\$|£)?\s*(\d+(?:[.,]\d{2})?)/i,
    /(?:€|EUR|\$|£)\s*(\d+(?:[.,]\d{2})?)\s*(?:for\s*)?free\s*(?:shipping|delivery)/i,
    /versandkostenfrei\s*ab\s*(?:€|EUR)?\s*(\d+(?:[.,]\d{2})?)/i,
  ],
  delivery_days: [
    /(?:delivery|lieferung|livraison)\s*(?:in|binnen|dans)?\s*(\d+(?:-\d+)?)\s*(?:business\s*)?(?:day|tag|jour)/i,
    /(\d+(?:-\d+)?)\s*(?:business\s*)?(?:day|tag|jour)\s*(?:delivery|shipping)/i,
    /arrives?\s*(?:in|within)\s*(\d+(?:-\d+)?)\s*(?:day|tag)/i,
  ],
};

const CONTACT_PATTERNS = {
  email: [/[\w.-]+@[\w.-]+\.\w+/],
  phone: [/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/],
  chat: [/live\s*chat/i, /chat\s*support/i, /chat\s*now/i],
  form: [/contact\s*form/i, /kontaktformular/i, /send\s*(?:us\s*)?(?:a\s*)?message/i],
};

// --- Main Extraction Function ---

export function extractPolicies(input: PolicyInput): PolicySnapshot {
  const { page_html, page_text } = input;
  const text = page_text.toLowerCase();

  const returns = extractReturnPolicy(text, page_html);
  const shipping = extractShippingPolicy(text, page_html, input.platform);
  const support = extractSupportInfo(text, page_html);

  const overall_clarity = Math.round(
    (returns.clarity_score * 3 + shipping.clarity_score * 4 + support.clarity_score * 3) / 10 * 10
  );

  const friction_flags = identifyFrictionFlags(returns, shipping, support, input);

  const snapshot_hash = generateSnapshotHash(returns, shipping, support);

  return {
    returns,
    shipping,
    support,
    overall_clarity,
    friction_flags,
    snapshot_hash,
  };
}

// --- Return Policy Extraction ---

function extractReturnPolicy(text: string, html: string): ReturnPolicy {
  let days: number | null = null;
  let free_returns: boolean | null = null;
  const conditions: string[] = [];
  let clarity_score = 5; // Start neutral

  // Extract days
  for (const pattern of RETURN_PATTERNS.days) {
    const match = text.match(pattern);
    if (match) {
      days = parseInt(match[1], 10);
      clarity_score += 2;
      break;
    }
  }

  // Check for free returns
  for (const pattern of RETURN_PATTERNS.free_returns) {
    if (pattern.test(text)) {
      free_returns = true;
      clarity_score += 1;
      break;
    }
  }

  // Extract conditions
  for (const pattern of RETURN_PATTERNS.conditions) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) conditions.push(match[0]);
    }
  }

  // Check for returns link
  if (/href.*?(?:return|r[üu]ckgabe|retour)/i.test(html)) {
    clarity_score += 1;
  }

  // Penalty for no clear policy
  if (days === null && !text.includes('return') && !text.includes('rückgabe')) {
    clarity_score = Math.max(0, clarity_score - 3);
  }

  return {
    days,
    conditions: [...new Set(conditions)].slice(0, 3),
    free_returns,
    clarity_score: Math.min(10, clarity_score),
    raw_text: null,
  };
}

// --- Shipping Policy Extraction ---

function extractShippingPolicy(text: string, html: string, platform: string): ShippingPolicy {
  let free_threshold: number | null = null;
  let free_threshold_currency: string | null = null;
  let estimated_days: string | null = null;
  const regions: string[] = [];
  let clarity_score = 5;

  // Extract free shipping threshold
  for (const pattern of SHIPPING_PATTERNS.free_threshold) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].replace(',', '.');
      free_threshold = parseFloat(value);
      // Detect currency from context
      if (text.includes('€') || text.includes('eur')) {
        free_threshold_currency = 'EUR';
      } else if (text.includes('£')) {
        free_threshold_currency = 'GBP';
      } else if (text.includes('$')) {
        free_threshold_currency = 'USD';
      }
      clarity_score += 2;
      break;
    }
  }

  // Extract delivery days
  for (const pattern of SHIPPING_PATTERNS.delivery_days) {
    const match = text.match(pattern);
    if (match) {
      estimated_days = match[1] + ' days';
      clarity_score += 2;
      break;
    }
  }

  // Detect regions from common patterns
  const regionPatterns = [
    { pattern: /germany|deutschland|de/i, region: 'DE' },
    { pattern: /austria|[öo]sterreich|at/i, region: 'AT' },
    { pattern: /switzerland|schweiz|ch/i, region: 'CH' },
    { pattern: /united\s*kingdom|uk|großbritannien/i, region: 'UK' },
    { pattern: /france|frankreich|fr/i, region: 'FR' },
    { pattern: /europe|eu|europa/i, region: 'EU' },
  ];

  for (const { pattern, region } of regionPatterns) {
    if (pattern.test(text)) {
      regions.push(region);
    }
  }

  // Check for shipping info link
  if (/href.*?(?:shipping|versand|livraison)/i.test(html)) {
    clarity_score += 1;
  }

  // Platform-specific defaults
  if (platform === 'amazon' && !free_threshold) {
    // Amazon Prime typically has free shipping
    if (text.includes('prime')) {
      free_threshold = 0;
      clarity_score += 1;
    }
  }

  return {
    free_threshold,
    free_threshold_currency,
    estimated_days,
    regions: [...new Set(regions)],
    clarity_score: Math.min(10, clarity_score),
    raw_text: null,
  };
}

// --- Support Info Extraction ---

function extractSupportInfo(text: string, html: string): SupportInfo {
  const channels: SupportInfo['channels'] = [];
  let contact_visible = false;
  let response_time: string | null = null;
  let clarity_score = 3;

  // Check for email
  for (const pattern of CONTACT_PATTERNS.email) {
    if (pattern.test(text) || pattern.test(html)) {
      channels.push('email');
      contact_visible = true;
      clarity_score += 2;
      break;
    }
  }

  // Check for phone
  for (const pattern of CONTACT_PATTERNS.phone) {
    if (pattern.test(text)) {
      channels.push('phone');
      contact_visible = true;
      clarity_score += 2;
      break;
    }
  }

  // Check for chat
  for (const pattern of CONTACT_PATTERNS.chat) {
    if (pattern.test(text) || pattern.test(html)) {
      channels.push('chat');
      contact_visible = true;
      clarity_score += 2;
      break;
    }
  }

  // Check for contact form
  for (const pattern of CONTACT_PATTERNS.form) {
    if (pattern.test(text) || pattern.test(html)) {
      channels.push('form');
      contact_visible = true;
      clarity_score += 1;
      break;
    }
  }

  // Check for contact link
  if (/href.*?(?:contact|kontakt|support)/i.test(html)) {
    contact_visible = true;
    clarity_score += 1;
  }

  // Extract response time if mentioned
  const responseMatch = text.match(/(?:response|reply|answer).*?(?:within|in)\s*(\d+)\s*(?:hour|hour)/i);
  if (responseMatch) {
    response_time = responseMatch[1] + ' hours';
  }

  return {
    contact_visible,
    channels,
    response_time,
    clarity_score: Math.min(10, clarity_score),
  };
}

// --- Friction Flag Identification ---

function identifyFrictionFlags(
  returns: ReturnPolicy,
  shipping: ShippingPolicy,
  support: SupportInfo,
  input: PolicyInput
): string[] {
  const flags: string[] = [];

  // Return-related friction
  if (returns.days !== null && returns.days < 14) {
    flags.push('Short return window (less than 14 days)');
  }
  if (returns.days === null) {
    flags.push('Return policy unclear');
  }
  if (returns.free_returns === false || (returns.conditions.length > 2 && returns.free_returns !== true)) {
    flags.push('Returns may incur costs or restrictions');
  }

  // Shipping-related friction
  if (shipping.free_threshold !== null && shipping.free_threshold > 100) {
    flags.push(`High free shipping threshold (${shipping.free_threshold_currency || ''}${shipping.free_threshold})`);
  }
  if (!shipping.estimated_days) {
    flags.push('Delivery time not specified');
  }

  // Support-related friction
  if (!support.contact_visible) {
    flags.push('Contact information not visible');
  }
  if (support.channels.length === 0) {
    flags.push('No clear support channels');
  }
  if (support.channels.length === 1 && support.channels[0] === 'form') {
    flags.push('Only contact form available (no direct support)');
  }

  // Overall clarity
  const overallClarity = (returns.clarity_score + shipping.clarity_score + support.clarity_score) / 3;
  if (overallClarity < 4) {
    flags.push('Poor policy transparency overall');
  }

  return flags.slice(0, 5); // Max 5 flags
}

// --- Hash Generation for Change Detection ---

function generateSnapshotHash(
  returns: ReturnPolicy,
  shipping: ShippingPolicy,
  support: SupportInfo
): string {
  const data = JSON.stringify({
    r: { d: returns.days, f: returns.free_returns, c: returns.conditions.sort() },
    s: { t: shipping.free_threshold, e: shipping.estimated_days },
    c: { v: support.contact_visible, ch: support.channels.sort() },
  });

  return crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
}

// --- Policy Comparison for Watchlist ---

export function comparePolicies(
  oldSnapshot: PolicySnapshot,
  newSnapshot: PolicySnapshot
): { changed: boolean; changes: string[] } {
  const changes: string[] = [];

  if (oldSnapshot.snapshot_hash === newSnapshot.snapshot_hash) {
    return { changed: false, changes: [] };
  }

  // Returns changes
  if (oldSnapshot.returns.days !== newSnapshot.returns.days) {
    if (newSnapshot.returns.days !== null && oldSnapshot.returns.days !== null) {
      if (newSnapshot.returns.days < oldSnapshot.returns.days) {
        changes.push(`Return window shortened from ${oldSnapshot.returns.days} to ${newSnapshot.returns.days} days`);
      } else {
        changes.push(`Return window extended from ${oldSnapshot.returns.days} to ${newSnapshot.returns.days} days`);
      }
    }
  }

  if (oldSnapshot.returns.free_returns === true && newSnapshot.returns.free_returns !== true) {
    changes.push('Free returns no longer offered');
  }

  // Shipping changes
  if (oldSnapshot.shipping.free_threshold !== newSnapshot.shipping.free_threshold) {
    if (newSnapshot.shipping.free_threshold !== null && oldSnapshot.shipping.free_threshold !== null) {
      if (newSnapshot.shipping.free_threshold > oldSnapshot.shipping.free_threshold) {
        changes.push(`Free shipping threshold increased to ${newSnapshot.shipping.free_threshold}`);
      }
    }
  }

  // Support changes
  if (oldSnapshot.support.contact_visible && !newSnapshot.support.contact_visible) {
    changes.push('Contact information no longer visible');
  }

  if (oldSnapshot.support.channels.length > newSnapshot.support.channels.length) {
    changes.push('Support channels reduced');
  }

  return { changed: changes.length > 0, changes };
}
