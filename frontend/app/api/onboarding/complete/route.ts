import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { supabaseServer } from '@/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const prefix = 'bearer ';
  const token = authHeader.toLowerCase().startsWith(prefix)
    ? authHeader.slice(prefix.length)
    : null;

  if (!token) return null;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabaseServer
    .from('profiles')
    .update({
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[Onboarding Complete] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to mark onboarding complete', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}


