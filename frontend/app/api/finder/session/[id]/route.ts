/**
 * Product Finder Session API
 * Get session details and interact with a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/finder/session/[id] - Get session details
export async function GET(
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

    const { data: finderSession, error } = await supabase
      .from('product_finder_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !finderSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: finderSession.id,
      inputType: finderSession.input_type,
      inputValue: finderSession.input_value,
      status: finderSession.status,
      alternatives: finderSession.alternatives || [],
      alternativesCount: finderSession.alternatives_count || 0,
      currentIndex: finderSession.current_index || 0,
      savedAlternatives: finderSession.saved_alternatives || [],
      skippedAlternatives: finderSession.skipped_alternatives || [],
      chatMessages: finderSession.chat_messages || [],
      createdAt: finderSession.created_at,
    });
  } catch (error) {
    console.error('[Finder] Get session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/finder/session/[id] - Update session (index, interactions)
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

    // Get current session
    const { data: currentSession } = await supabase
      .from('product_finder_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!currentSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Update current index
    if (typeof body.currentIndex === 'number') {
      updates.current_index = body.currentIndex;
    }

    // Add to viewed alternatives
    if (body.viewedAlternativeId) {
      const viewed = currentSession.viewed_alternatives || [];
      if (!viewed.includes(body.viewedAlternativeId)) {
        updates.viewed_alternatives = [...viewed, body.viewedAlternativeId];
      }
    }

    // Add to saved alternatives
    if (body.savedAlternativeId) {
      const saved = currentSession.saved_alternatives || [];
      if (!saved.includes(body.savedAlternativeId)) {
        updates.saved_alternatives = [...saved, body.savedAlternativeId];
      }
      // Also increment index
      updates.current_index = (currentSession.current_index || 0) + 1;
    }

    // Add to skipped alternatives
    if (body.skippedAlternativeId) {
      const skipped = currentSession.skipped_alternatives || [];
      if (!skipped.includes(body.skippedAlternativeId)) {
        updates.skipped_alternatives = [...skipped, body.skippedAlternativeId];
      }
      // Also increment index
      updates.current_index = (currentSession.current_index || 0) + 1;
    }

    // Update chat messages
    if (body.chatMessages) {
      updates.chat_messages = body.chatMessages;
    }

    // Mark as completed if all products reviewed
    const totalProducts = currentSession.alternatives_count || 0;
    if (updates.current_index >= totalProducts) {
      updates.status = 'completed';
    } else if (currentSession.status === 'ready') {
      updates.status = 'browsing';
    }

    const { data: updatedSession, error } = await supabase
      .from('product_finder_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Finder] Update session error:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      currentIndex: updatedSession.current_index,
      status: updatedSession.status,
    });
  } catch (error) {
    console.error('[Finder] Update session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
