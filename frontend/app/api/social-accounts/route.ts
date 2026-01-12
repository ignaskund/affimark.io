import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: accounts, error } = await supabaseServer
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Social Accounts] Error fetching accounts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    console.error('[Social Accounts] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

