/**
 * User Priorities API
 * Handles product and brand priority preferences for the Product Finder
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

interface Priority {
  id: string;
  rank: number;
}

interface PrioritiesPayload {
  productPriorities: Priority[];
  brandPriorities: Priority[];
}

// GET /api/preferences/priorities - Get user's current priorities
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = supabaseServer;

    // First, ensure user_creator_preferences row exists
    const { data: existing } = await supabase
      .from('user_creator_preferences')
      .select('product_priorities, brand_priorities, active_social_context, onboarding_priorities_completed')
      .eq('user_id', userId)
      .single();

    if (!existing) {
      // Create default preferences if not exists
      const { data: created, error: createError } = await supabase
        .from('user_creator_preferences')
        .insert({
          user_id: userId,
          product_priorities: [],
          brand_priorities: [],
          active_social_context: { socials: [], storefronts: [] },
          onboarding_priorities_completed: false,
        })
        .select('product_priorities, brand_priorities, active_social_context, onboarding_priorities_completed')
        .single();

      if (createError) {
        console.error('[Priorities] Create error:', createError);
        return NextResponse.json({ error: 'Failed to initialize preferences' }, { status: 500 });
      }

      return NextResponse.json({
        productPriorities: created?.product_priorities || [],
        brandPriorities: created?.brand_priorities || [],
        activeContext: created?.active_social_context || { socials: [], storefronts: [] },
        onboardingCompleted: created?.onboarding_priorities_completed || false,
      });
    }

    return NextResponse.json({
      productPriorities: existing.product_priorities || [],
      brandPriorities: existing.brand_priorities || [],
      activeContext: existing.active_social_context || { socials: [], storefronts: [] },
      onboardingCompleted: existing.onboarding_priorities_completed || false,
    });
  } catch (error) {
    console.error('[Priorities] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/preferences/priorities - Save user's priorities (onboarding)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body: PrioritiesPayload = await request.json();

    // Validate input
    if (!Array.isArray(body.productPriorities) || !Array.isArray(body.brandPriorities)) {
      return NextResponse.json({ error: 'Invalid priorities format' }, { status: 400 });
    }

    // Validate each priority has required fields and proper ranking
    const validatePriorities = (priorities: Priority[], maxRank: number = 5): boolean => {
      if (priorities.length > maxRank) return false;
      const ranks = new Set<number>();
      for (const p of priorities) {
        if (!p.id || typeof p.rank !== 'number' || p.rank < 1 || p.rank > maxRank) {
          return false;
        }
        if (ranks.has(p.rank)) return false; // Duplicate ranks
        ranks.add(p.rank);
      }
      return true;
    };

    if (!validatePriorities(body.productPriorities) || !validatePriorities(body.brandPriorities)) {
      return NextResponse.json({ error: 'Invalid priorities: check ranks and format' }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Upsert user_creator_preferences
    const { data: existingPrefs } = await supabase
      .from('user_creator_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    let error;

    if (existingPrefs) {
      // Update existing
      const updateResult = await supabase
        .from('user_creator_preferences')
        .update({
          product_priorities: body.productPriorities,
          brand_priorities: body.brandPriorities,
          onboarding_priorities_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      result = updateResult.data;
      error = updateResult.error;
    } else {
      // Insert new
      const insertResult = await supabase
        .from('user_creator_preferences')
        .insert({
          user_id: userId,
          product_priorities: body.productPriorities,
          brand_priorities: body.brandPriorities,
          active_social_context: { socials: [], storefronts: [] },
          onboarding_priorities_completed: true,
        })
        .select()
        .single();

      result = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      console.error('[Priorities] Save error:', error);
      return NextResponse.json({ error: 'Failed to save priorities' }, { status: 500 });
    }

    console.log('[Priorities] Saved for user:', userId);
    return NextResponse.json({
      success: true,
      productPriorities: result?.product_priorities,
      brandPriorities: result?.brand_priorities,
    });
  } catch (error) {
    console.error('[Priorities] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/preferences/priorities - Update priorities (from settings)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    const supabase = supabaseServer;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only update provided fields
    if (body.productPriorities !== undefined) {
      if (!Array.isArray(body.productPriorities)) {
        return NextResponse.json({ error: 'productPriorities must be an array' }, { status: 400 });
      }
      updates.product_priorities = body.productPriorities;
    }

    if (body.brandPriorities !== undefined) {
      if (!Array.isArray(body.brandPriorities)) {
        return NextResponse.json({ error: 'brandPriorities must be an array' }, { status: 400 });
      }
      updates.brand_priorities = body.brandPriorities;
    }

    if (body.activeContext !== undefined) {
      updates.active_social_context = body.activeContext;
    }

    const { data, error } = await supabase
      .from('user_creator_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Priorities] PUT error:', error);
      return NextResponse.json({ error: 'Failed to update priorities' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      productPriorities: data?.product_priorities,
      brandPriorities: data?.brand_priorities,
      activeContext: data?.active_social_context,
    });
  } catch (error) {
    console.error('[Priorities] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
