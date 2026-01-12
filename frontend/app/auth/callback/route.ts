import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/onboarding';

  if (token_hash && type) {
    const supabase = await createSupabaseAdminClient();

    // Verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    if (!error) {
      // Email verified successfully, redirect to sign-in
      return NextResponse.redirect(new URL(`/sign-in?verified=true&callbackUrl=${encodeURIComponent(next)}`, request.url));
    }
  }

  // Verification failed, redirect to sign-in with error
  return NextResponse.redirect(new URL('/sign-in?error=verification_failed', request.url));
}

