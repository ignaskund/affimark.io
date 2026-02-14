/**
 * Review Sentiment Engine for Product Verifier
 *
 * Analyzes review text to extract:
 * - Themes (quality, shipping, support, value, etc.)
 * - Sentiment per theme
 * - Merchant vs Product blame split
 * - Refund drivers
 * - Positive angles for marketing
 *
 * Uses Workers AI for theme extraction, with deterministic fallbacks.
 */

import type { Env } from '../../index';

// --- Types ---

export type ReviewTheme =
  | 'quality'
  | 'shipping'
  | 'support'
  | 'value'
  | 'durability'
  | 'sizing'
  | 'ease_of_use'
  | 'packaging'
  | 'accuracy'
  | 'performance';

export interface ThemeAnalysis {
  theme: ReviewTheme;
  sentiment: 'positive' | 'neutral' | 'negative';
  frequency: number; // 0-100 percentage
  mention_count: number;
  dealbreaker_likelihood: 'high' | 'medium' | 'low';
  example_snippets: string[];
}

export interface ReviewAnalysis {
  themes: ThemeAnalysis[];
  merchant_vs_product_blame: {
    merchant_issues_pct: number; // shipping, support, returns issues
    product_issues_pct: number;  // quality, sizing, durability issues
    explanation: string;
  };
  refund_drivers: string[]; // Top 3 reasons people return
  positive_angles: string[]; // What customers love (for marketing)
  objection_points: string[]; // What to preempt in content
  overall_sentiment: 'positive' | 'mixed' | 'negative';
  sentiment_score: number; // 0-100
}

interface ReviewInput {
  reviews: string[]; // Array of review texts
  rating: number | null;
  review_count: number;
}

// --- Theme Keywords (for deterministic fallback) ---

const THEME_KEYWORDS: Record<ReviewTheme, { positive: string[]; negative: string[] }> = {
  quality: {
    positive: ['quality', 'well made', 'excellent', 'premium', 'solid', 'sturdy', 'durable', 'craftsmanship'],
    negative: ['cheap', 'flimsy', 'broke', 'poor quality', 'defective', 'damaged', 'fell apart', 'low quality'],
  },
  shipping: {
    positive: ['fast shipping', 'quick delivery', 'arrived early', 'well packaged', 'on time'],
    negative: ['slow shipping', 'late', 'delayed', 'took forever', 'lost package', 'wrong address', 'shipping issue'],
  },
  support: {
    positive: ['great support', 'helpful', 'responsive', 'quick response', 'resolved', 'customer service'],
    negative: ['no response', 'unhelpful', 'rude', 'ignored', 'terrible support', 'no help', 'cant reach'],
  },
  value: {
    positive: ['great value', 'worth it', 'good price', 'bargain', 'affordable', 'value for money'],
    negative: ['overpriced', 'not worth', 'too expensive', 'waste of money', 'rip off', 'poor value'],
  },
  durability: {
    positive: ['lasts', 'durable', 'still works', 'long lasting', 'holds up', 'robust'],
    negative: ['broke after', 'stopped working', 'only lasted', 'fell apart', 'wore out', 'not durable'],
  },
  sizing: {
    positive: ['fits perfectly', 'true to size', 'great fit', 'size accurate'],
    negative: ['runs small', 'runs large', 'doesnt fit', 'wrong size', 'size chart wrong', 'too big', 'too small'],
  },
  ease_of_use: {
    positive: ['easy to use', 'simple', 'intuitive', 'user friendly', 'straightforward', 'easy setup'],
    negative: ['confusing', 'complicated', 'hard to use', 'difficult', 'not intuitive', 'frustrating'],
  },
  packaging: {
    positive: ['great packaging', 'well packed', 'nice presentation', 'secure packaging'],
    negative: ['damaged packaging', 'poor packaging', 'arrived damaged', 'crushed box'],
  },
  accuracy: {
    positive: ['as described', 'matches photo', 'accurate', 'exactly as shown', 'true to description'],
    negative: ['not as shown', 'different from photo', 'misleading', 'false advertising', 'not what expected'],
  },
  performance: {
    positive: ['works great', 'performs well', 'exceeds expectations', 'powerful', 'effective'],
    negative: ['doesnt work', 'poor performance', 'disappointing', 'ineffective', 'underwhelming'],
  },
};

// Merchant-related themes (for blame split)
const MERCHANT_THEMES: ReviewTheme[] = ['shipping', 'support', 'packaging'];
const PRODUCT_THEMES: ReviewTheme[] = ['quality', 'durability', 'sizing', 'ease_of_use', 'accuracy', 'performance'];

// --- Main Analysis Function ---

export async function analyzeReviews(
  input: ReviewInput,
  env: Env
): Promise<ReviewAnalysis> {
  const { reviews, rating, review_count } = input;

  // If no reviews, return minimal analysis based on rating
  if (!reviews || reviews.length === 0) {
    return createMinimalAnalysis(rating, review_count);
  }

  // Try AI-powered analysis first
  if (env.AI && reviews.length >= 3) {
    try {
      const aiResult = await analyzeWithAI(reviews, env);
      if (aiResult) return aiResult;
    } catch {
      // Fall through to deterministic
    }
  }

  // Fallback to deterministic keyword analysis
  return analyzeWithKeywords(reviews, rating);
}

// --- AI-Powered Analysis ---

async function analyzeWithAI(reviews: string[], env: Env): Promise<ReviewAnalysis | null> {
  const reviewSample = reviews.slice(0, 20).join('\n---\n');

  const prompt = `Analyze these product reviews and extract themes.

Reviews:
${reviewSample}

Return ONLY valid JSON:
{
  "themes": [
    {"theme": "quality|shipping|support|value|durability|sizing|ease_of_use|packaging|accuracy|performance", "sentiment": "positive|neutral|negative", "frequency": 0-100, "examples": ["quote1", "quote2"]}
  ],
  "refund_drivers": ["reason1", "reason2", "reason3"],
  "positive_angles": ["what customers love 1", "what customers love 2"],
  "objection_points": ["concern 1", "concern 2"],
  "merchant_issues_pct": 0-100,
  "product_issues_pct": 0-100
}

Focus on actionable insights. Max 6 themes, 3 refund drivers, 3 positive angles, 3 objections.`;

  try {
    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You analyze product reviews to extract themes and insights. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });

    if (!result?.response) return null;

    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return transformAIResult(parsed, reviews.length);
  } catch {
    return null;
  }
}

function transformAIResult(raw: any, reviewCount: number): ReviewAnalysis {
  const themes: ThemeAnalysis[] = (raw.themes || []).map((t: any) => ({
    theme: t.theme as ReviewTheme,
    sentiment: t.sentiment || 'neutral',
    frequency: t.frequency || 0,
    mention_count: Math.round((t.frequency / 100) * reviewCount),
    dealbreaker_likelihood: t.sentiment === 'negative' && t.frequency > 30 ? 'high' :
      t.sentiment === 'negative' && t.frequency > 15 ? 'medium' : 'low',
    example_snippets: (t.examples || []).slice(0, 2),
  }));

  const merchantPct = raw.merchant_issues_pct || 0;
  const productPct = raw.product_issues_pct || 0;

  return {
    themes,
    merchant_vs_product_blame: {
      merchant_issues_pct: merchantPct,
      product_issues_pct: productPct,
      explanation: merchantPct > productPct
        ? 'Most complaints relate to merchant (shipping/support)'
        : productPct > merchantPct
        ? 'Most complaints relate to product itself'
        : 'Issues split between merchant and product',
    },
    refund_drivers: (raw.refund_drivers || []).slice(0, 3),
    positive_angles: (raw.positive_angles || []).slice(0, 3),
    objection_points: (raw.objection_points || []).slice(0, 3),
    overall_sentiment: calculateOverallSentiment(themes),
    sentiment_score: calculateSentimentScore(themes),
  };
}

// --- Deterministic Keyword Analysis ---

function analyzeWithKeywords(reviews: string[], rating: number | null): ReviewAnalysis {
  const allText = reviews.join(' ').toLowerCase();
  const themes: ThemeAnalysis[] = [];

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    const positiveMatches = keywords.positive.filter(kw => allText.includes(kw)).length;
    const negativeMatches = keywords.negative.filter(kw => allText.includes(kw)).length;

    if (positiveMatches > 0 || negativeMatches > 0) {
      const totalMatches = positiveMatches + negativeMatches;
      const frequency = Math.min(100, (totalMatches / reviews.length) * 50);

      themes.push({
        theme: theme as ReviewTheme,
        sentiment: positiveMatches > negativeMatches ? 'positive' :
          negativeMatches > positiveMatches ? 'negative' : 'neutral',
        frequency,
        mention_count: totalMatches,
        dealbreaker_likelihood: negativeMatches > 2 && negativeMatches > positiveMatches ? 'high' :
          negativeMatches > 0 ? 'medium' : 'low',
        example_snippets: [], // Would need more sophisticated extraction
      });
    }
  }

  // Sort by frequency
  themes.sort((a, b) => b.frequency - a.frequency);

  // Calculate merchant vs product blame
  const merchantIssues = themes
    .filter(t => MERCHANT_THEMES.includes(t.theme) && t.sentiment === 'negative')
    .reduce((sum, t) => sum + t.frequency, 0);

  const productIssues = themes
    .filter(t => PRODUCT_THEMES.includes(t.theme) && t.sentiment === 'negative')
    .reduce((sum, t) => sum + t.frequency, 0);

  const total = merchantIssues + productIssues || 1;

  // Extract refund drivers from negative themes
  const refundDrivers = themes
    .filter(t => t.sentiment === 'negative' && t.dealbreaker_likelihood !== 'low')
    .slice(0, 3)
    .map(t => `${formatThemeName(t.theme)} issues`);

  // Extract positive angles
  const positiveAngles = themes
    .filter(t => t.sentiment === 'positive')
    .slice(0, 3)
    .map(t => `Strong ${formatThemeName(t.theme).toLowerCase()}`);

  // Extract objection points
  const objectionPoints = themes
    .filter(t => t.sentiment === 'negative')
    .slice(0, 3)
    .map(t => `${formatThemeName(t.theme)} concerns`);

  return {
    themes: themes.slice(0, 8),
    merchant_vs_product_blame: {
      merchant_issues_pct: Math.round((merchantIssues / total) * 100),
      product_issues_pct: Math.round((productIssues / total) * 100),
      explanation: merchantIssues > productIssues
        ? 'Most complaints relate to merchant operations'
        : 'Most complaints relate to product quality',
    },
    refund_drivers: refundDrivers.length > 0 ? refundDrivers : ['No clear refund drivers identified'],
    positive_angles: positiveAngles.length > 0 ? positiveAngles : ['General satisfaction'],
    objection_points: objectionPoints.length > 0 ? objectionPoints : ['No major objections identified'],
    overall_sentiment: calculateOverallSentiment(themes),
    sentiment_score: rating ? ratingToScore(rating) : calculateSentimentScore(themes),
  };
}

// --- Minimal Analysis (no reviews) ---

function createMinimalAnalysis(rating: number | null, review_count: number): ReviewAnalysis {
  const sentiment_score = rating ? ratingToScore(rating) : 50;
  const overall_sentiment = sentiment_score >= 70 ? 'positive' : sentiment_score >= 40 ? 'mixed' : 'negative';

  return {
    themes: [],
    merchant_vs_product_blame: {
      merchant_issues_pct: 0,
      product_issues_pct: 0,
      explanation: 'No review data available for analysis',
    },
    refund_drivers: review_count === 0
      ? ['No reviews - refund risk unknown']
      : ['Unable to analyze review text'],
    positive_angles: rating && rating >= 4
      ? ['High star rating']
      : ['No positive themes identified'],
    objection_points: review_count < 10
      ? ['Limited reviews - unproven product']
      : [],
    overall_sentiment,
    sentiment_score,
  };
}

// --- Helper Functions ---

function formatThemeName(theme: ReviewTheme): string {
  return theme.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function calculateOverallSentiment(themes: ThemeAnalysis[]): 'positive' | 'mixed' | 'negative' {
  if (themes.length === 0) return 'mixed';

  const positiveWeight = themes
    .filter(t => t.sentiment === 'positive')
    .reduce((sum, t) => sum + t.frequency, 0);

  const negativeWeight = themes
    .filter(t => t.sentiment === 'negative')
    .reduce((sum, t) => sum + t.frequency, 0);

  if (positiveWeight > negativeWeight * 2) return 'positive';
  if (negativeWeight > positiveWeight * 2) return 'negative';
  return 'mixed';
}

function calculateSentimentScore(themes: ThemeAnalysis[]): number {
  if (themes.length === 0) return 50;

  let score = 50;
  for (const theme of themes) {
    const weight = theme.frequency / 100;
    if (theme.sentiment === 'positive') score += 10 * weight;
    else if (theme.sentiment === 'negative') score -= 15 * weight; // Negative weighs more
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function ratingToScore(rating: number): number {
  // Convert 1-5 rating to 0-100 score
  return Math.round(((rating - 1) / 4) * 100);
}

// --- Export utilities ---

export function getRefundRiskFromThemes(themes: ThemeAnalysis[]): 'high' | 'medium' | 'low' {
  const highRiskCount = themes.filter(t =>
    t.sentiment === 'negative' && t.dealbreaker_likelihood === 'high'
  ).length;

  const mediumRiskCount = themes.filter(t =>
    t.sentiment === 'negative' && t.dealbreaker_likelihood === 'medium'
  ).length;

  if (highRiskCount >= 2) return 'high';
  if (highRiskCount >= 1 || mediumRiskCount >= 2) return 'medium';
  return 'low';
}
