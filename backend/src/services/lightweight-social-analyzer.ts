/**
 * Lightweight Social Context Analyzer
 * Infers content categories WITHOUT OAuth API access
 * Good for MVP - upgrade to full OAuth later for higher accuracy
 */

import Anthropic from '@anthropic-ai/sdk';

interface SocialAccount {
  platform: string;
  accountIdentifier: string; // Username/handle
  followerCount?: number;
  bio?: string;
  displayName?: string;
}

export interface LightweightSocialContext {
  platforms: string[];
  contentCategories: string[];
  audienceDemographics: {
    ageRange: string;
    topCountries: string[];
    interests: string[];
  };
  estimatedReach: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

// Lazy-init: Cloudflare Workers don't have process.env at module scope
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

/**
 * Analyze social accounts using lightweight inference (no OAuth needed)
 */
export async function analyzeSocialAccountsLightweight(
  accounts: SocialAccount[]
): Promise<LightweightSocialContext> {
  console.log(`[Lightweight Social] Analyzing ${accounts.length} accounts`);

  if (accounts.length === 0) {
    return getEmptyContext();
  }

  // Try AI inference first
  try {
    const aiInferred = await inferWithAI(accounts);
    if (aiInferred.confidenceLevel !== 'low') {
      return aiInferred;
    }
  } catch (error) {
    console.error('[Lightweight Social] AI inference failed:', error);
  }

  // Fallback to keyword-based inference
  return inferWithKeywords(accounts);
}

/**
 * Use Claude to infer niche from account info
 */
async function inferWithAI(accounts: SocialAccount[]): Promise<LightweightSocialContext> {
  const accountsDescription = accounts
    .map(
      a =>
        `${a.platform}: @${a.accountIdentifier}${a.followerCount ? ` (${formatNumber(a.followerCount)} followers)` : ''}${a.bio ? `\nBio: ${a.bio}` : ''}`
    )
    .join('\n\n');

  const prompt = `Analyze these creator social accounts and infer their content niche WITHOUT accessing any APIs:

${accountsDescription}

Based ONLY on:
- Platform choices (YouTube = long-form video, TikTok = short-form, etc.)
- Username/handle patterns (e.g., "techreviewz" = tech, "fitnessguru" = fitness)
- Follower count (if provided) suggests reach tier
- Bio/description (if provided)

Infer:

1. **Content Categories** (2-5 categories from this list ONLY):
   Electronics, Tech, Gaming, Fashion, Beauty, Lifestyle, Fitness, Food, Travel, Home Decor, Parenting, Finance, DIY, Music, Art, Sports, Books, Photography, Cars, Business, Education

2. **Audience Age Range** (pick ONE):
   - 13-17 (Gen Z teens)
   - 18-24 (Young Gen Z)
   - 25-34 (Millennials)
   - 35-44 (Older Millennials)
   - 45-54 (Gen X)
   - 55+ (Boomers+)

3. **Primary Countries** (top 3, assume based on platform popularity):
   - US, UK, DE, FR, CA, AU, etc.

4. **Confidence Level**:
   - high: Clear niche signals (tech-focused username, multiple related platforms)
   - medium: Some signals (general username, 1-2 platforms)
   - low: Unclear (generic username, no bio, minimal info)

Return ONLY valid JSON:
{
  "contentCategories": ["Tech", "Gaming"],
  "ageRange": "18-24",
  "topCountries": ["US", "UK", "DE"],
  "confidenceLevel": "high|medium|low",
  "reasoning": "Brief explanation"
}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-3-5-haiku-20250219',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const inferred = JSON.parse(jsonMatch[0]);

      return {
        platforms: accounts.map(a => a.platform),
        contentCategories: inferred.contentCategories || ['Lifestyle'],
        audienceDemographics: {
          ageRange: inferred.ageRange || '18-34',
          topCountries: inferred.topCountries || ['US', 'UK', 'DE'],
          interests: inferred.contentCategories || [],
        },
        estimatedReach: accounts.reduce((sum, a) => sum + (a.followerCount || 0), 0),
        confidenceLevel: inferred.confidenceLevel || 'medium',
      };
    }
  }

  throw new Error('Failed to parse AI response');
}

/**
 * Fallback: Keyword-based inference from usernames
 */
function inferWithKeywords(accounts: SocialAccount[]): LightweightSocialContext {
  const allText = accounts
    .map(a => `${a.accountIdentifier} ${a.bio || ''} ${a.displayName || ''}`)
    .join(' ')
    .toLowerCase();

  const categories: Set<string> = new Set();

  // Category detection via keywords
  const categoryKeywords: Record<string, string[]> = {
    Tech: ['tech', 'gadget', 'review', 'unbox', 'device', 'software', 'app'],
    Gaming: ['gaming', 'gamer', 'game', 'esport', 'stream', 'twitch', 'playthrough'],
    Fashion: ['fashion', 'style', 'outfit', 'ootd', 'clothing', 'lookbook'],
    Beauty: ['beauty', 'makeup', 'cosmetic', 'skincare', 'tutorial', 'glam'],
    Fitness: ['fitness', 'workout', 'gym', 'health', 'training', 'athlete', 'fit'],
    Food: ['food', 'recipe', 'cooking', 'chef', 'foodie', 'cuisine', 'baking'],
    Travel: ['travel', 'wanderlust', 'adventure', 'explore', 'destination', 'nomad'],
    'Home Decor': ['home', 'decor', 'interior', 'design', 'diy', 'renovation'],
    Lifestyle: ['lifestyle', 'vlog', 'daily', 'life', 'blogger'],
    Photography: ['photo', 'photography', 'camera', 'photographer', 'shots'],
    Music: ['music', 'musician', 'singer', 'artist', 'producer', 'dj'],
    Business: ['business', 'entrepreneur', 'startup', 'finance', 'invest'],
    Education: ['education', 'learn', 'teach', 'tutorial', 'course', 'study'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => allText.includes(kw))) {
      categories.add(category);
    }
  }

  // Default to Lifestyle if no clear signals
  if (categories.size === 0) {
    categories.add('Lifestyle');
  }

  // Infer age range from platform mix
  let ageRange = '18-34'; // Default
  const hasTikTok = accounts.some(a => a.platform === 'tiktok');
  const hasFacebook = accounts.some(a => a.platform === 'facebook');

  if (hasTikTok && !hasFacebook) {
    ageRange = '18-24'; // Younger skew
  } else if (hasFacebook && !hasTikTok) {
    ageRange = '35-44'; // Older skew
  }

  return {
    platforms: accounts.map(a => a.platform),
    contentCategories: Array.from(categories).slice(0, 5),
    audienceDemographics: {
      ageRange,
      topCountries: ['US', 'UK', 'DE'],
      interests: Array.from(categories),
    },
    estimatedReach: accounts.reduce((sum, a) => sum + (a.followerCount || 0), 0),
    confidenceLevel: categories.size > 1 ? 'medium' : 'low',
  };
}

/**
 * Empty context for users with no social accounts
 */
function getEmptyContext(): LightweightSocialContext {
  return {
    platforms: [],
    contentCategories: [],
    audienceDemographics: {
      ageRange: '18-34',
      topCountries: [],
      interests: [],
    },
    estimatedReach: 0,
    confidenceLevel: 'low',
  };
}

/**
 * Format follower count for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Get confidence explanation for user
 */
export function explainConfidence(context: LightweightSocialContext): string {
  switch (context.confidenceLevel) {
    case 'high':
      return 'Strong signals from account usernames and platform choices';
    case 'medium':
      return 'Some signals detected, but could be more specific';
    case 'low':
      return 'Limited information available. Consider connecting more accounts or adding bio information';
    default:
      return '';
  }
}
