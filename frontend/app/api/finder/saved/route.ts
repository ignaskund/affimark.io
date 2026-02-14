/**
 * Saved Products API
 * Manage user's saved products from the finder
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/finder/saved - Get all saved products
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = supabaseServer;

    const { data: products, error } = await supabase
      .from('saved_products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Saved Products] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch saved products' }, { status: 500 });
    }

    // Transform to camelCase
    const transformed = products.map((p) => ({
      id: p.id,
      userId: p.user_id,
      finderSessionId: p.finder_session_id,
      productUrl: p.product_url,
      productName: p.product_name,
      brand: p.brand,
      category: p.category,
      imageUrl: p.image_url,
      price: p.price,
      currency: p.currency,
      matchScore: p.match_score,
      matchReasons: p.match_reasons || [],
      priorityAlignment: p.priority_alignment || {},
      listType: p.list_type,
      notes: p.notes,
      tags: p.tags || [],
      affiliateNetwork: p.affiliate_network,
      affiliateLink: p.affiliate_link,
      commissionRate: p.commission_rate,
      cookieDurationDays: p.cookie_duration_days,
      isArchived: p.is_archived,
      promotedAt: p.promoted_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({ products: transformed });
  } catch (error) {
    console.error('[Saved Products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/finder/saved - Save a new product
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.productUrl) {
      return NextResponse.json({ error: 'productUrl is required' }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Check for existing product (upsert)
    const { data: existing } = await supabase
      .from('saved_products')
      .select('id')
      .eq('user_id', userId)
      .eq('product_url', body.productUrl)
      .single();

    if (existing) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('saved_products')
        .update({
          list_type: body.listType || 'saved',
          match_score: body.matchScore,
          match_reasons: body.matchReasons,
          priority_alignment: body.priorityAlignment,
          is_archived: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[Saved Products] Update error:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
      }

      return NextResponse.json({ product: updated, updated: true });
    }

    // Insert new
    const { data: product, error } = await supabase
      .from('saved_products')
      .insert({
        user_id: userId,
        finder_session_id: body.finderSessionId,
        product_url: body.productUrl,
        product_name: body.productName,
        brand: body.brand,
        category: body.category,
        image_url: body.imageUrl,
        price: body.price,
        currency: body.currency || 'EUR',
        match_score: body.matchScore,
        match_reasons: body.matchReasons || [],
        priority_alignment: body.priorityAlignment || {},
        list_type: body.listType || 'saved',
        affiliate_network: body.affiliateNetwork,
        affiliate_link: body.affiliateLink,
        commission_rate: body.commissionRate,
        cookie_duration_days: body.cookieDurationDays,
      })
      .select()
      .single();

    if (error) {
      console.error('[Saved Products] Insert error:', error);
      return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
    }

    return NextResponse.json({ product, created: true });
  } catch (error) {
    console.error('[Saved Products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
