/**
 * Context-Aware Product Finder Agent
 * Agent that understands and uses active context (socials/storefronts) in conversations
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AgentContext {
  // User priorities
  productPriorities: Array<{ id: string; rank: number }>;
  brandPriorities: Array<{ id: string; rank: number }>;

  // Active context (what user has toggled ON)
  activeContext: {
    socials: string[];
    storefronts: string[];
  };

  // Full profile context
  socialContext?: {
    platforms: string[];
    contentCategories: string[];
    audienceDemographics: any;
    estimatedReach: number;
  };

  storefrontContext?: {
    dominantCategories: Array<{ category: string; percentage: number }>;
    topBrands: string[];
    avgPricePoint: number;
    preferredNetworks: string[];
  };

  // Dynamic intent
  dynamicIntent?: {
    searchReason?: string;
    targetAudience?: string;
    contentFormat?: string;
    occasion?: string;
    inferredCategories?: string[];
  };

  // Current product being discussed
  currentProduct?: {
    name: string;
    brand: string;
    price: number;
    currency: string;
    matchScore: number;
    matchReasons: string[];
    priorityAlignment?: Record<string, { score: number; reason: string }>;
    affiliateNetwork?: string;
    category?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Lazy-init: Cloudflare Workers don't have process.env at module scope
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

const PRIORITY_LABELS: Record<string, string> = {
  // Product priorities
  quality: 'Quality & Durability',
  price: 'Price & Value',
  reviews: 'Customer Reviews',
  sustainability: 'Sustainability & Ethics',
  design: 'Design & Aesthetics',
  shipping: 'Shipping & Availability',
  warranty: 'Warranty & Guarantees',
  brand_recognition: 'Brand Recognition',

  // Brand priorities
  commission: 'Commission Rate',
  customer_service: 'Customer Service',
  return_policy: 'Return Policy',
  reputation: 'Brand Reputation',
  brand_sustainability: 'Sustainability & Ethics',
  payment_speed: 'Payment Reliability',
  cookie_duration: 'Cookie Duration',
  easy_approval: 'Easy Approval',
};

/**
 * Generate agent response with full context awareness
 */
export async function generateAgentResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: AgentContext
): Promise<string> {
  const systemPrompt = buildContextAwareSystemPrompt(context);

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    return response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'I apologize, I could not generate a response.';
  } catch (error) {
    console.error('[Context-Aware Agent] Error:', error);
    return generateFallbackResponse(userMessage, context);
  }
}

/**
 * Build comprehensive system prompt with context awareness
 */
function buildContextAwareSystemPrompt(context: AgentContext): string {
  let prompt = `You are a direct, professional product advisor for affiliate creators. Your personality is: accurate, direct, argumentative (when needed), personal, and professional. You give honest, data-driven advice without unnecessary praise or filler.

CRITICAL: The user has TOGGLE CONTROLS for their context. They can turn specific social accounts and storefronts ON or OFF. You MUST be aware of what's currently ACTIVE.

`;

  // ===== ACTIVE CONTEXT (Most Important) =====
  prompt += `═══════════════════════════════════════════════
ACTIVE CONTEXT (User has toggled these ON):
═══════════════════════════════════════════════

`;

  if (context.activeContext.socials.length > 0) {
    prompt += `📱 ACTIVE SOCIAL PLATFORMS:\n`;
    context.activeContext.socials.forEach(s => {
      prompt += `   • ${s.charAt(0).toUpperCase() + s.slice(1)}\n`;
    });

    // Add insights from social context if available
    if (context.socialContext && context.socialContext.contentCategories.length > 0) {
      const activePlatforms = context.socialContext.platforms.filter(p =>
        context.activeContext.socials.includes(p)
      );

      if (activePlatforms.length > 0) {
        prompt += `\n   Your content on these platforms focuses on: ${context.socialContext.contentCategories.join(', ')}\n`;
        if (context.socialContext.estimatedReach > 0) {
          prompt += `   Combined reach: ${formatNumber(context.socialContext.estimatedReach)} followers\n`;
        }
      }
    }
  } else {
    prompt += `📱 ACTIVE SOCIAL PLATFORMS: None selected\n   (User has turned OFF all social context)\n`;
  }

  prompt += `\n`;

  if (context.activeContext.storefronts.length > 0) {
    prompt += `🏪 ACTIVE STOREFRONTS:\n`;
    context.activeContext.storefronts.forEach(s => {
      prompt += `   • ${s.replace('_', ' ').toUpperCase()}\n`;
    });

    // Add insights from storefront context if available
    if (context.storefrontContext) {
      const { dominantCategories, topBrands, avgPricePoint } = context.storefrontContext;

      if (dominantCategories.length > 0) {
        prompt += `\n   Your typical product mix:\n`;
        dominantCategories.slice(0, 3).forEach(cat => {
          prompt += `   • ${cat.category}: ${(cat.percentage * 100).toFixed(0)}% of products\n`;
        });
      }

      if (topBrands.length > 0) {
        prompt += `   Brands you've promoted: ${topBrands.slice(0, 5).join(', ')}\n`;
      }

      if (avgPricePoint > 0) {
        prompt += `   Typical price point: €${avgPricePoint.toFixed(2)}\n`;
      }
    }
  } else {
    prompt += `🏪 ACTIVE STOREFRONTS: None selected\n   (User has turned OFF all storefront context)\n`;
  }

  // ===== PRIORITIES =====
  prompt += `\n═══════════════════════════════════════════════
USER PRIORITIES (Ranked):
═══════════════════════════════════════════════

`;

  if (context.productPriorities.length > 0) {
    prompt += `PRODUCT PRIORITIES:\n`;
    context.productPriorities.forEach((p, i) => {
      prompt += `   ${i + 1}. ${PRIORITY_LABELS[p.id] || p.id}\n`;
    });
  }

  if (context.brandPriorities.length > 0) {
    prompt += `\nBRAND PRIORITIES:\n`;
    context.brandPriorities.forEach((p, i) => {
      prompt += `   ${i + 1}. ${PRIORITY_LABELS[p.id] || p.id}\n`;
    });
  }

  // ===== DYNAMIC INTENT (What user wants RIGHT NOW) =====
  if (context.dynamicIntent) {
    const { searchReason, targetAudience, contentFormat, occasion, inferredCategories } = context.dynamicIntent;

    if (searchReason || targetAudience || contentFormat || occasion) {
      prompt += `\n═══════════════════════════════════════════════
CURRENT SEARCH CONTEXT:
═══════════════════════════════════════════════

`;

      if (searchReason) {
        prompt += `🎯 SEARCH REASON: "${searchReason}"\n`;
      }

      if (targetAudience) {
        prompt += `👥 TARGET AUDIENCE: ${targetAudience}\n`;
      }

      if (contentFormat) {
        prompt += `📹 CONTENT FORMAT: ${contentFormat}\n`;
      }

      if (occasion) {
        prompt += `🎉 OCCASION: ${occasion}\n`;
      }

      if (inferredCategories && inferredCategories.length > 0) {
        prompt += `📦 RELEVANT CATEGORIES: ${inferredCategories.join(', ')}\n`;
      }
    }
  }

  // ===== CURRENT PRODUCT =====
  if (context.currentProduct) {
    const { name, brand, price, currency, matchScore, matchReasons, priorityAlignment, affiliateNetwork, category } = context.currentProduct;

    prompt += `\n═══════════════════════════════════════════════
CURRENT PRODUCT BEING DISCUSSED:
═══════════════════════════════════════════════

📦 ${name}
   Brand: ${brand}
   Price: ${currency}${price.toFixed(2)}
   Category: ${category || 'N/A'}
   Network: ${affiliateNetwork || 'N/A'}

🎯 MATCH SCORE: ${matchScore}/100

WHY IT MATCHES:
${matchReasons.map((r, i) => `   ${i + 1}. ${r}`).join('\n')}

`;

    if (priorityAlignment) {
      prompt += `PRIORITY ALIGNMENT SCORES:\n`;
      Object.entries(priorityAlignment).forEach(([key, val]) => {
        prompt += `   • ${PRIORITY_LABELS[key] || key}: ${val.score}/100 - ${val.reason}\n`;
      });
    }
  }

  // ===== INSTRUCTIONS =====
  prompt += `\n═══════════════════════════════════════════════
YOUR INSTRUCTIONS:
═══════════════════════════════════════════════

1. **Context Awareness**:
   - ALWAYS reference which platforms/storefronts are ACTIVE
   - If user asks about a platform that's OFF, tell them to toggle it ON
   - Explain how your recommendations fit their ACTIVE context

2. **Priority-Based Advice**:
   - Reference their RANKED priorities in explanations
   - Explain how products score on their TOP 3 priorities
   - Be honest when something doesn't align with their priorities

3. **Dynamic Intent**:
   - If they specified a search reason/occasion, make sure recommendations fit
   - For gift guides: emphasize design, packaging, giftability
   - For budget content: emphasize value, price-to-quality ratio
   - For urgent needs: emphasize shipping/availability

4. **Personality**:
   - Direct and specific. No fluff or filler.
   - Argumentative when needed - challenge bad assumptions
   - Personal - address them directly as a peer/expert
   - Use data and numbers when available
   - 2-4 sentences unless more detail requested

5. **Honesty**:
   - If a product has downsides, say so
   - If you don't have information, admit it
   - If something doesn't align with their priorities, explain why it still showed up

6. **Context References**:
   - "Based on your ACTIVE YouTube context..."
   - "Since you have Amazon DE toggled ON..."
   - "This fits your lifestyle content on Instagram..."
   - "Given your top priority is [X]..."

REMEMBER: The toggle system means context can change mid-conversation. Always reference what's CURRENTLY active.
`;

  return prompt;
}

/**
 * Fallback response generator
 */
function generateFallbackResponse(message: string, context: AgentContext): string {
  const lowerMessage = message.toLowerCase();

  // Context-aware fallback
  const hasActiveContext = context.activeContext.socials.length > 0 ||
                          context.activeContext.storefronts.length > 0;

  if (!hasActiveContext) {
    return "I notice you don't have any social platforms or storefronts toggled ON. Turn on the contexts you want me to consider, then I can give you more personalized advice.";
  }

  if (lowerMessage.includes('match') || lowerMessage.includes('why')) {
    return context.currentProduct
      ? `This scores ${context.currentProduct.matchScore}/100 based on your active context. ${context.currentProduct.matchReasons[0]}. The match is particularly strong for your top priority: ${PRIORITY_LABELS[context.productPriorities[0]?.id] || 'your criteria'}.`
      : 'Check the match score breakdown to see how this aligns with your priorities and active context.';
  }

  if (lowerMessage.includes('risk') || lowerMessage.includes('downside')) {
    return 'Key considerations: Verify current stock before promoting, check recent reviews for quality concerns, and test with a small campaign first. Want me to analyze specific risks?';
  }

  if (lowerMessage.includes('context') || lowerMessage.includes('toggle')) {
    const activeSocials = context.activeContext.socials.join(', ') || 'none';
    const activeStorefronts = context.activeContext.storefronts.join(', ') || 'none';
    return `Currently active - Socials: ${activeSocials}. Storefronts: ${activeStorefronts}. Toggle these to change what I consider in my recommendations.`;
  }

  return context.currentProduct
    ? `For ${context.currentProduct.name}: This is a ${context.currentProduct.matchScore >= 80 ? 'strong' : 'solid'} match based on your active context. What specific aspect should I elaborate on?`
    : 'I can explain match scores, assess risks, compare alternatives, or discuss how products fit your active context. What would you like to know?';
}

/**
 * Format number with K/M suffix
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
 * Validate that active context makes sense
 */
export function validateActiveContext(
  activeContext: { socials: string[]; storefronts: string[] },
  availableSocials: string[],
  availableStorefronts: string[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check if toggled socials actually exist
  const invalidSocials = activeContext.socials.filter(
    s => !availableSocials.includes(s)
  );
  if (invalidSocials.length > 0) {
    warnings.push(`These social platforms are toggled ON but not connected: ${invalidSocials.join(', ')}`);
  }

  // Check if toggled storefronts actually exist
  const invalidStorefronts = activeContext.storefronts.filter(
    s => !availableStorefronts.includes(s)
  );
  if (invalidStorefronts.length > 0) {
    warnings.push(`These storefronts are toggled ON but not connected: ${invalidStorefronts.join(', ')}`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
