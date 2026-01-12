import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseUserClient } from '@/utils/supabase/server';

/**
 * GET /api/commission/alerts
 * Get pending commission optimization alerts
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseUserClient();
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();

    if (!supabaseSession?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787';
    const response = await fetch(`${backendUrl}/api/commission/alerts`, {
      headers: {
        Authorization: `Bearer ${supabaseSession.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Get commission alerts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch commission alerts' },
      { status: 500 }
    );
  }
}
