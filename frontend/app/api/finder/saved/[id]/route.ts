/**
 * Single Saved Product API
 * Update or delete a saved product
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// PATCH /api/finder/saved/[id] - Update a saved product
export async function PATCH(
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
    const body = await request.json();

    const supabase = supabaseServer;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.listType !== undefined) {
      updates.list_type = body.listType;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.tags !== undefined) {
      updates.tags = body.tags;
    }
    if (body.isArchived !== undefined) {
      updates.is_archived = body.isArchived;
    }
    if (body.promotedAt !== undefined) {
      updates.promoted_at = body.promotedAt;
    }

    const { data: product, error } = await supabase
      .from('saved_products')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Saved Products] Update error:', error);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('[Saved Products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/finder/saved/[id] - Delete a saved product
export async function DELETE(
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

    const supabase = supabaseServer;

    const { error } = await supabase
      .from('saved_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Saved Products] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Saved Products] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
