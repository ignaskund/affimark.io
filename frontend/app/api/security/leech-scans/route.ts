import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseUserClient } from '@/utils/supabase/server';

/**
 * GET /api/security/leech-scans
 * Get leech scan history for a SmartWrapper
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const smartwrapperId = searchParams.get('smartwrapperId');

    if (!smartwrapperId) {
      return NextResponse.json({ error: 'SmartWrapper ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseUserClient();
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();

    if (!supabaseSession?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(
      `${backendUrl}/api/security/leech-scans?smartwrapperId=${smartwrapperId}`,
      {
        headers: {
          Authorization: `Bearer ${supabaseSession.access_token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Get leech scans error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leech scans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/security/leech-scans
 * Run a new leech scan for a SmartWrapper
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { smartwrapperId } = body;

    if (!smartwrapperId) {
      return NextResponse.json({ error: 'SmartWrapper ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseUserClient();
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();

    if (!supabaseSession?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/api/security/leech-scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseSession.access_token}`,
      },
      body: JSON.stringify({ smartwrapperId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Run leech scan error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run leech scan' },
      { status: 500 }
    );
  }
}
