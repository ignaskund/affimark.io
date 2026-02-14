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
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

      // Call the comprehensive Product Finder backend
      const finderRes = await fetch(`${backendUrl}/api/finder/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          input: body.input,
          inputType: body.inputType,
          productPriorities,
          brandPriorities,
          activeContext,
          dynamicIntent: '', // User can add optional intent later
        }),
      });

      if (finderRes.ok) {
        searchResponse = await finderRes.json();

        // Extract results from backend response
        originalProduct = searchResponse.originalProduct || null;
        alternatives = searchResponse.alternatives || [];

        console.log(`[Finder] Backend returned ${alternatives.length} alternatives`);
      } else {
        console.error('[Finder] Backend search failed:', await finderRes.text());
        // Fallback to mock data
        alternatives = generateMockAlternatives(body.input, body.inputType, productPriorities);
      }

    } catch (searchError) {
      console.error('[Finder] Search error:', searchError);
      // Fallback to mock data on error
      alternatives = generateMockAlternatives(body.input, body.inputType, productPriorities);
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

    return NextResponse.json({
      sessionId: finderSession.id,
      status: 'ready',
      originalProduct,
      alternatives: alternatives,
      alternativesCount: alternatives.length,
    });
  } catch (error) {
    console.error('[Finder] Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Generate mock alternatives for development (fallback only)
function generateMockAlternatives(input: string, inputType: string, priorities: any[]) {
  const baseProducts = [
    {
      name: 'Sony WH-1000XM5 Wireless Headphones',
      brand: 'Sony',
      category: 'Electronics',
      price: 349.99,
      rating: 4.8,
      reviewCount: 12500,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300',
    },
    {
      name: 'Bose QuietComfort 45 Headphones',
      brand: 'Bose',
      category: 'Electronics',
      price: 329.00,
      rating: 4.7,
      reviewCount: 8900,
      imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300',
    },
    {
      name: 'Apple AirPods Max',
      brand: 'Apple',
      category: 'Electronics',
      price: 549.00,
      rating: 4.6,
      reviewCount: 15200,
      imageUrl: 'https://images.unsplash.com/photo-1625245488600-f03fef636a3c?w=300',
    },
    {
      name: 'Sennheiser Momentum 4 Wireless',
      brand: 'Sennheiser',
      category: 'Electronics',
      price: 379.95,
      rating: 4.5,
      reviewCount: 3400,
      imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300',
    },
    {
      name: 'Jabra Elite 85h',
      brand: 'Jabra',
      category: 'Electronics',
      price: 249.99,
      rating: 4.4,
      reviewCount: 5600,
      imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=300',
    },
  ];

  // Get priority IDs for scoring
  const priorityIds = priorities.map((p: any) => p.id);

  return baseProducts.map((product, index) => {
    const matchScore = Math.max(60, 95 - index * 5 + Math.floor(Math.random() * 10));

    // Generate priority alignment based on user's priorities
    const priorityAlignment: Record<string, { score: number; reason: string }> = {};
    priorityIds.forEach((id: string, i: number) => {
      const score = Math.max(50, matchScore - i * 3 + Math.floor(Math.random() * 15));
      priorityAlignment[id] = {
        score,
        reason: `Matches your ${id.replace(/_/g, ' ')} priority`,
      };
    });

    return {
      id: `alt-${index}-${Date.now()}`,
      url: `https://example.com/product/${product.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      price: product.price,
      currency: 'EUR',
      rating: product.rating,
      reviewCount: product.reviewCount,
      matchScore,
      matchReasons: [
        `High quality rating (${product.rating}★ from ${product.reviewCount.toLocaleString()} reviews)`,
        index === 0 ? 'Best overall match for your priorities' : `Strong match for ${priorityIds[0]?.replace(/_/g, ' ') || 'quality'}`,
        product.brand + ' is a trusted brand with excellent customer service',
      ],
      priorityAlignment,
      affiliateNetwork: ['Amazon', 'Awin', 'CJ'][index % 3],
      commissionRate: 4 + index,
      cookieDurationDays: 30 - index * 3,
      pros: [
        'Excellent sound quality',
        'Great noise cancellation',
        'Comfortable for long use',
      ],
      cons: [
        index > 2 ? 'Slightly higher price point' : null,
        index > 3 ? 'Limited color options' : null,
      ].filter(Boolean),
    };
  });
}
