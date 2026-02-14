/**
 * Product Finder Chat API (Context-Aware)
 * Handle chat messages with full context awareness including toggles
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

interface ChatRequest {
  message: string;
  productId?: string;
  productContext?: {
    name: string;
    brand: string;
    price: number;
    currency?: string;
    matchScore: number;
    matchReasons: string[];
    priorityAlignment?: Record<string, { score: number; reason: string }>;
    affiliateNetwork?: string;
    category?: string;
  };
  // NEW: Active context from toggles
  activeContext?: {
    socials: string[];
    storefronts: string[];
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body: ChatRequest = await request.json();

    if (!body.message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Get session with ALL context
    const { data: finderSession, error: sessionError } = await supabase
      .from('product_finder_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !finderSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get user's full profile for social/storefront context
    const { data: profileData } = await supabase
      .from('user_product_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentMessages = finderSession.chat_messages || [];

    // Extract all context
    const productPriorities = finderSession.product_priorities_snapshot || [];
    const brandPriorities = finderSession.brand_priorities_snapshot || [];
    const activeContextSnapshot = finderSession.active_context_snapshot || { socials: [], storefronts: [] };
    const dynamicIntentSnapshot = finderSession.dynamic_intent_snapshot || {};

    // Use active context from request if provided, otherwise use snapshot
    const activeContext = body.activeContext || activeContextSnapshot;

    // Build social context from profile
    const socialContext = profileData ? {
      platforms: JSON.parse(profileData.social_platforms || '[]'),
      contentCategories: JSON.parse(profileData.content_categories || '[]'),
      audienceDemographics: JSON.parse(profileData.audience_demographics || '{}'),
      estimatedReach: profileData.estimated_reach || 0,
    } : undefined;

    // Build storefront context from profile
    const storefrontContext = profileData ? {
      dominantCategories: JSON.parse(profileData.dominant_categories || '[]'),
      topBrands: JSON.parse(profileData.top_brands || '[]'),
      avgPricePoint: profileData.avg_price_point || 0,
      preferredNetworks: JSON.parse(profileData.preferred_networks || '[]'),
    } : undefined;

    // Call context-aware agent (via backend)
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;

    if (backendUrl) {
      try {
        const agentResponse = await fetch(`${backendUrl}/api/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: body.message,
            conversationHistory: currentMessages,
            context: {
              productPriorities,
              brandPriorities,
              activeContext,
              socialContext,
              storefrontContext,
              dynamicIntent: dynamicIntentSnapshot,
              currentProduct: body.productContext,
            },
          }),
        });

        if (agentResponse.ok) {
          const { response: assistantContent } = await agentResponse.json();

          // Add messages to database
          const userMessage = {
            id: `msg-${Date.now()}-user`,
            role: 'user' as const,
            content: body.message,
            timestamp: new Date().toISOString(),
            context: body.productId ? { productId: body.productId } : undefined,
          };

          const assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant' as const,
            content: assistantContent,
            timestamp: new Date().toISOString(),
          };

          const updatedMessages = [...currentMessages, userMessage, assistantMessage];

          await supabase
            .from('product_finder_sessions')
            .update({
              chat_messages: updatedMessages,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          return NextResponse.json({
            message: assistantMessage,
            messages: updatedMessages,
          });
        }
      } catch (backendError) {
        console.error('[Chat] Backend agent error:', backendError);
        // Fall through to local agent
      }
    }

    // Fallback: Use local agent implementation
    const { generateAgentResponse } = await import('@/lib/context-aware-agent-client');

    const assistantContent = await generateAgentResponse(
      body.message,
      currentMessages.filter((m: any) => m.role === 'user' || m.role === 'assistant'),
      {
        productPriorities,
        brandPriorities,
        activeContext,
        socialContext,
        storefrontContext,
        dynamicIntent: dynamicIntentSnapshot,
        currentProduct: body.productContext,
      }
    );

    // Add messages
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: body.message,
      timestamp: new Date().toISOString(),
      context: body.productId ? { productId: body.productId } : undefined,
    };

    const assistantMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant' as const,
      content: assistantContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...currentMessages, userMessage, assistantMessage];

    await supabase
      .from('product_finder_sessions')
      .update({
        chat_messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      message: assistantMessage,
      messages: updatedMessages,
    });
  } catch (error) {
    console.error('[Finder Chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
