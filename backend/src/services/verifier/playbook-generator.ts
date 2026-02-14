/**
 * Playbook Generator for Product Verifier
 *
 * Uses Workers AI (Llama 3) for structured playbook generation.
 * Deterministic validators enforce schema, max lengths, banned claims.
 * Falls back to templates if AI is unavailable or confidence is low.
 */

import type { Env } from '../../index';

// --- Types ---

export interface PlaybookInput {
  product_title: string;
  brand: string;
  category: string;
  merchant: string;
  price: number | null;
  currency: string;
  commission_rate: string; // e.g. "8-12%"
  network: string;
  cookie_days: number;
  top_pros: string[];
  top_risks: string[];
  user_region: string;
  traffic_type: string;
}

export interface PlaybookResult {
  approved_item: {
    id: string;
    title: string;
    brand: string;
  };
  positioning_angles: Array<{
    angle_name: string;
    hook: string;
    proof_points: string[];
  }>;
  audience: {
    primary_segment: string;
    pain_points: string[];
    objections: string[];
    buying_triggers: string[];
  };
  channel_plan: Array<{
    channel: 'SEO' | 'ADS' | 'EMAIL' | 'SOCIAL';
    recommended: boolean;
    steps: string[];
  }>;
  assets_checklist: string[];
  tracking_checklist: string[];
  test_plan: {
    kpis: string[];
    duration_days: number;
    iteration_rules: string[];
  };
  compliance_notes: string[];
}

// --- Banned Claims ---
const BANNED_PATTERNS = [
  /guaranteed? (revenue|income|earnings|money)/i,
  /you will (earn|make|receive)/i,
  /100%\s*(guarantee|certain|sure)/i,
  /risk.?free/i,
  /passive income/i,
  /get rich/i,
  /unlimited (earnings|revenue)/i,
];

/**
 * Generate a playbook for an approved product/alternative
 */
export async function generatePlaybook(
  input: PlaybookInput,
  approvedItemId: string,
  env: Env
): Promise<PlaybookResult> {
  // Try AI generation first
  if (env.AI) {
    try {
      const aiResult = await generateWithAI(input, env);
      if (aiResult) {
        const validated = validatePlaybook(aiResult, input, approvedItemId);
        if (validated) return validated;
      }
    } catch {
      // AI failed, fall through to template
    }
  }

  // Fallback to template-based generation
  return generateFromTemplate(input, approvedItemId);
}

/**
 * Generate playbook using Workers AI
 */
async function generateWithAI(input: PlaybookInput, env: Env): Promise<any | null> {
  const prompt = buildPrompt(input);

  try {
    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a marketing strategist for affiliate content creators. Generate structured JSON output only. Never make claims about guaranteed revenue. Use ranges and estimates only. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    if (!result?.response) return null;

    // Try to parse JSON from response
    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Build the prompt for AI playbook generation
 */
function buildPrompt(input: PlaybookInput): string {
  return `Generate a marketing playbook for an affiliate creator promoting this product.

Product: ${input.product_title}
Brand: ${input.brand}
Category: ${input.category}
Merchant: ${input.merchant}
Price: ${input.price ? `${input.currency} ${input.price}` : 'Unknown'}
Commission: ${input.commission_rate} via ${input.network}
Cookie Window: ${input.cookie_days} days
Region: ${input.user_region}
Traffic Type: ${input.traffic_type}

Key Strengths: ${input.top_pros.join('; ')}
Key Risks: ${input.top_risks.join('; ')}

Return ONLY valid JSON with this exact structure:
{
  "positioning_angles": [
    {"angle_name": "string (max 30 chars)", "hook": "string (max 100 chars)", "proof_points": ["string (max 80 chars)", "string"]}
  ],
  "audience": {
    "primary_segment": "string (max 80 chars)",
    "pain_points": ["string (max 60 chars)"],
    "objections": ["string (max 60 chars)"],
    "buying_triggers": ["string (max 60 chars)"]
  },
  "channel_plan": [
    {"channel": "SEO|ADS|EMAIL|SOCIAL", "recommended": true/false, "steps": ["string (max 80 chars)"]}
  ],
  "assets_checklist": ["string (max 60 chars)"],
  "tracking_checklist": ["string (max 60 chars)"],
  "test_plan": {
    "kpis": ["string (max 40 chars)"],
    "duration_days": number (14-90),
    "iteration_rules": ["string (max 80 chars)"]
  },
  "compliance_notes": ["string (max 80 chars)"]
}

Provide exactly 2 positioning angles, 3 pain points, 2 objections, 3 buying triggers, all 4 channels, 5 assets, 4 tracking items, 3 KPIs, 3 iteration rules, and 2-3 compliance notes.
NEVER mention guaranteed revenue or earnings. Use "potential" and "estimated" language only.`;
}

/**
 * Validate and sanitize AI-generated playbook
 */
function validatePlaybook(
  raw: any,
  input: PlaybookInput,
  approvedItemId: string
): PlaybookResult | null {
  try {
    // Validate structure exists
    if (!raw.positioning_angles || !raw.audience || !raw.channel_plan) return null;

    const result: PlaybookResult = {
      approved_item: {
        id: approvedItemId,
        title: input.product_title,
        brand: input.brand,
      },
      positioning_angles: sanitizeAngles(raw.positioning_angles),
      audience: sanitizeAudience(raw.audience),
      channel_plan: sanitizeChannelPlan(raw.channel_plan),
      assets_checklist: sanitizeStringArray(raw.assets_checklist, 60, 8),
      tracking_checklist: sanitizeStringArray(raw.tracking_checklist, 60, 6),
      test_plan: sanitizeTestPlan(raw.test_plan),
      compliance_notes: sanitizeStringArray(raw.compliance_notes, 80, 5),
    };

    // Check for banned claims in all text fields
    const allText = JSON.stringify(result);
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(allText)) {
        // Found banned claim, fall back to template
        return null;
      }
    }

    return result;
  } catch {
    return null;
  }
}

function sanitizeAngles(angles: any[]): PlaybookResult['positioning_angles'] {
  if (!Array.isArray(angles)) return [];
  return angles.slice(0, 2).map(a => ({
    angle_name: truncate(String(a.angle_name || 'Positioning Angle'), 30),
    hook: truncate(String(a.hook || ''), 100),
    proof_points: sanitizeStringArray(a.proof_points, 80, 3),
  }));
}

function sanitizeAudience(audience: any): PlaybookResult['audience'] {
  return {
    primary_segment: truncate(String(audience?.primary_segment || 'General audience'), 80),
    pain_points: sanitizeStringArray(audience?.pain_points, 60, 3),
    objections: sanitizeStringArray(audience?.objections, 60, 3),
    buying_triggers: sanitizeStringArray(audience?.buying_triggers, 60, 3),
  };
}

function sanitizeChannelPlan(plan: any[]): PlaybookResult['channel_plan'] {
  const validChannels = ['SEO', 'ADS', 'EMAIL', 'SOCIAL'] as const;
  if (!Array.isArray(plan)) return getDefaultChannelPlan();

  const result: PlaybookResult['channel_plan'] = [];
  for (const channel of validChannels) {
    const entry = plan.find(p =>
      String(p.channel).toUpperCase() === channel
    );
    result.push({
      channel,
      recommended: entry?.recommended ?? (channel === 'SOCIAL' || channel === 'SEO'),
      steps: sanitizeStringArray(entry?.steps, 80, 4),
    });
  }
  return result;
}

function sanitizeTestPlan(plan: any): PlaybookResult['test_plan'] {
  return {
    kpis: sanitizeStringArray(plan?.kpis, 40, 4),
    duration_days: Math.min(90, Math.max(14, Number(plan?.duration_days) || 30)),
    iteration_rules: sanitizeStringArray(plan?.iteration_rules, 80, 3),
  };
}

function sanitizeStringArray(arr: any, maxLength: number, maxItems: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item: string) => truncate(item.trim(), maxLength));
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + '...';
}

// --- Template-based Fallback ---

function generateFromTemplate(input: PlaybookInput, approvedItemId: string): PlaybookResult {
  const { product_title, brand, category, commission_rate, network, cookie_days, traffic_type } = input;

  return {
    approved_item: {
      id: approvedItemId,
      title: product_title,
      brand,
    },
    positioning_angles: [
      {
        angle_name: 'Value Comparison',
        hook: `Why ${brand} stands out in ${category}: honest review with real numbers`,
        proof_points: [
          `Price-to-quality analysis vs top 3 competitors`,
          `Real user feedback highlights and concerns`,
          `Feature comparison that helps your audience decide`,
        ],
      },
      {
        angle_name: 'Problem Solver',
        hook: `The ${category} product I actually recommend (and why)`,
        proof_points: [
          `Address the specific pain point this product solves`,
          `Show before/after or use-case scenarios`,
          `Include your personal experience or testing results`,
        ],
      },
    ],
    audience: {
      primary_segment: `${category} enthusiasts researching before purchase`,
      pain_points: [
        `Overwhelmed by too many ${category} options`,
        `Worried about quality vs price trade-offs`,
        `Need trusted recommendations from real users`,
      ],
      objections: [
        `"Is this really worth the price?"`,
        `"Are there better alternatives I'm missing?"`,
      ],
      buying_triggers: [
        `Detailed comparison content with clear winner`,
        `Limited-time deals or seasonal promotions`,
        `Social proof from other buyers`,
      ],
    },
    channel_plan: getCategoryChannelPlan(category, traffic_type),
    assets_checklist: [
      `Product review article/video (1000+ words or 5+ min)`,
      `Comparison table: ${brand} vs top 2-3 alternatives`,
      `Social media carousel or short-form video`,
      `Email template for existing audience`,
      `Affiliate disclosure statement`,
    ],
    tracking_checklist: [
      `Set up affiliate link with UTM parameters`,
      `Create SmartWrapper link for tracking`,
      `Add conversion pixel or postback URL`,
      `Set up click tracking per channel`,
    ],
    test_plan: {
      kpis: [
        'Click-through rate (CTR)',
        'Conversion rate',
        `Earnings per click (EPC)`,
      ],
      duration_days: 30,
      iteration_rules: [
        `If CTR < 2% after 7 days: revise headline and hook`,
        `If conversion < 1% after 14 days: test different positioning angle`,
        `If EPC meets target after 30 days: scale to additional channels`,
      ],
    },
    compliance_notes: [
      `Include FTC/ASA affiliate disclosure in all content`,
      `Avoid income claims — use "potential" and "estimated" language`,
      `${commission_rate} commission via ${network}, ${cookie_days}-day cookie`,
    ],
  };
}

function getCategoryChannelPlan(
  category: string,
  trafficType: string
): PlaybookResult['channel_plan'] {
  const isPaid = trafficType === 'PAID' || trafficType === 'MIXED';

  return [
    {
      channel: 'SEO',
      recommended: true,
      steps: [
        `Create "Best ${category}" or "${category} Review" long-form content`,
        `Target comparison keywords: "${category} vs" queries`,
        `Add internal links from existing related content`,
        `Optimize for featured snippets with structured data`,
      ],
    },
    {
      channel: 'ADS',
      recommended: isPaid,
      steps: isPaid ? [
        `Test 2-3 ad creatives with different angles`,
        `Start with small daily budget to validate conversion rate`,
        `Target purchase-intent keywords only`,
        `Set up conversion tracking before launching`,
      ] : [
        `Consider testing with small budget once organic validates`,
        `Focus on retargeting existing blog/video visitors`,
        `Use platform-native shopping ads if available`,
      ],
    },
    {
      channel: 'EMAIL',
      recommended: true,
      steps: [
        `Send dedicated product recommendation to relevant segment`,
        `Include in next newsletter with comparison angle`,
        `Create automated sequence for new subscribers interested in ${category}`,
        `A/B test subject lines (review vs comparison framing)`,
      ],
    },
    {
      channel: 'SOCIAL',
      recommended: true,
      steps: [
        `Create short-form video review (TikTok/Reels/Shorts)`,
        `Post comparison carousel on Instagram/LinkedIn`,
        `Share authentic use case or unboxing content`,
        `Pin affiliate link in bio with clear CTA`,
      ],
    },
  ];
}

function getDefaultChannelPlan(): PlaybookResult['channel_plan'] {
  return getCategoryChannelPlan('products', 'ORGANIC');
}
