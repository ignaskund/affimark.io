/**
 * Product Finder Search API
 * Starts a new product finder session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

interface SearchRequest {
  input: string;
  inputType: 'url' | 'category';
  context?: {
    socials: string[];
    storefronts: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body: SearchRequest = await request.json();

    if (!body.input || !body.inputType) {
      return NextResponse.json({ error: 'Input and inputType are required' }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Get user's priorities
    const { data: prefs } = await supabase
      .from('user_creator_preferences')
      .select('product_priorities, brand_priorities, active_social_context')
      .eq('user_id', userId)
      .single();

    const productPriorities = prefs?.product_priorities || [];
    const brandPriorities = prefs?.brand_priorities || [];
    const activeContext = body.context || prefs?.active_social_context || { socials: [], storefronts: [] };

    // Create finder session
    const { data: finderSession, error: createError } = await supabase
      .from('product_finder_sessions')
      .insert({
        user_id: userId,
        input_type: body.inputType,
        input_value: body.input,
        product_priorities_snapshot: productPriorities,
        brand_priorities_snapshot: brandPriorities,
        active_context_snapshot: activeContext,
        status: 'searching',
      })
      .select()
      .single();

    if (createError) {
      console.error('[Finder] Create session error:', createError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Call the backend Product Finder service
    let alternatives = [];
    let originalProduct = null;
    let searchResponse = null;

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || '[REDACTED]';

      // Call the V2 agentic Product Finder backend
      const finderRes = await fetch(`${backendUrl}/api/finder/search-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          input: body.input,
          inputType: body.inputType,
          productPriorities,
          brandPriorities,
          activeContext,
          dynamicIntent: {},
        }),
      });

      if (finderRes.ok) {
        searchResponse = await finderRes.json();

        // Extract results from backend response (V2 fields)
        originalProduct = searchResponse.originalProduct || null;
        alternatives = searchResponse.alternatives || [];

        console.log(`[Finder] Backend returned ${alternatives.length} alternatives (V2, ${searchResponse.searchIterations ?? 0} iterations, ${searchResponse.totalCandidatesEvaluated ?? 0} evaluated)`);
      } else {
        const errorText = await finderRes.text();
        console.error(`[Finder] Backend search failed (${finderRes.status}):`, errorText);
        // Don't silently fall back to mock data — surface the error
        return NextResponse.json(
          { error: `Backend search failed: ${finderRes.status}`, details: errorText },
          { status: finderRes.status }
        );
      }

    } catch (searchError) {
      console.error('[Finder] Search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to connect to search backend' },
        { status: 502 }
      );
    }

    // Update session with results
    const { data: updatedSession, error: updateError } = await supabase
      .from('product_finder_sessions')
      .update({
        original_product: originalProduct,
        alternatives: alternatives,
        alternatives_count: alternatives.length,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', finderSession.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Finder] Update session error:', updateError);
    }

    // If the backend couldn't identify the product from the URL, pass that
    // state through so the UI can ask the user for the product name.
    if (searchResponse?.status === 'product_unidentified') {
      await supabase
        .from('product_finder_sessions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', finderSession.id);

      return NextResponse.json({
        sessionId: finderSession.id,
        status: 'product_unidentified',
        needsProductName: true,
        pendingUrl: body.input,
        error: searchResponse.error,
        alternatives: [],
        alternativesCount: 0,
      });
    }

    return NextResponse.json({
      sessionId: finderSession.id,
      status: 'ready',
      originalProduct,
      alternatives: alternatives,
      alternativesCount: alternatives.length,
      agentReasoning: searchResponse?.agentReasoning || '',
    });
  } catch (error) {
    console.error('[Finder] Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

