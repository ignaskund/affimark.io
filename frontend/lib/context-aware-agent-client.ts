/**
 * Context-Aware Agent Client (Frontend)
 * Client-side wrapper for the context-aware agent
 */

import Anthropic from '@anthropic-ai/sdk';

interface AgentContext {
  productPriorities: Array<{ id: string; rank: number }>;
  brandPriorities: Array<{ id: string; rank: number }>;
  activeContext: {
    socials: string[];
    storefronts: string[];
  };
  socialContext?: any;
  storefrontContext?: any;
  dynamicIntent?: any;
  currentProduct?: any;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  dangerouslyAllowBrowser: false, // Only use in server-side
});

/**
 * Generate agent response (frontend fallback)
 * This is used when backend is not available
 */
export async function generateAgentResponse(
  message: string,
  conversationHistory: ChatMessage[],
  context: AgentContext
): Promise<string> {
  // Build simplified system prompt
  const systemPrompt = buildSystemPrompt(context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: message },
      ],
    });

    return response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'I apologize, I could not generate a response.';
  } catch (error) {
    console.error('[Agent Client] Error:', error);
    return generateFallbackResponse(message, context);
  }
}

function buildSystemPrompt(context: AgentContext): string {
  const { productPriorities, brandPriorities, activeContext, currentProduct } = context;

  let prompt = `You are a direct, professional product advisor for affiliate creators.

ACTIVE CONTEXT:
`;

  if (activeContext.socials.length > 0) {
    prompt += `Socials: ${activeContext.socials.join(', ')}\n`;
  } else {
    prompt += `Socials: None active\n`;
  }

  if (activeContext.storefronts.length > 0) {
    prompt += `Storefronts: ${activeContext.storefronts.join(', ')}\n`;
  } else {
    prompt += `Storefronts: None active\n`;
  }

  if (productPriorities.length > 0) {
    prompt += `\nProduct Priorities:\n`;
    productPriorities.forEach((p, i) => {
      prompt += `${i + 1}. ${p.id}\n`;
    });
  }

  if (currentProduct) {
    prompt += `\nCurrent Product: ${currentProduct.name}\nScore: ${currentProduct.matchScore}/100\n`;
  }

  prompt += `\nBe direct, specific, and reference the active context in your responses.`;

  return prompt;
}

function generateFallbackResponse(message: string, context: AgentContext): string {
  const hasActiveContext = context.activeContext.socials.length > 0 ||
                          context.activeContext.storefronts.length > 0;

  if (!hasActiveContext) {
    return "Toggle ON some social platforms or storefronts so I can give you personalized advice based on your context.";
  }

  if (context.currentProduct) {
    return `For ${context.currentProduct.name}: Match score is ${context.currentProduct.matchScore}/100. What would you like to know?`;
  }

  return 'I can help analyze products based on your active context. What would you like to know?';
}
