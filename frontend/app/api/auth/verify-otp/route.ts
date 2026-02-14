import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, token, type } = await request.json();

    if (!email || !token || !type) {
      return NextResponse.json(
        { error: 'Email, token, and type are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify the OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type as any,
    });

    if (error) {
      console.error('[Verify OTP] Error:', error);
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    console.log('[Verify OTP] Email verified, now creating database records...');

    // NOW create the user in public.users and profiles (AFTER email verification)
    const supabaseAdmin = createSupabaseAdminClient();
    const fullName = data.user.user_metadata?.full_name || email.split('@')[0];
    const userType = data.user.user_metadata?.user_type || 'creator';

    // Step 1: Create user in public.users
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .insert({
        id: data.user.id,
        email: email,
        name: fullName,
        email_verified: new Date().toISOString(),
      });

    if (usersError && usersError.code !== '23505') {
      // Ignore if already exists (23505)
      console.error('[Verify OTP] Users table insert error:', usersError);
      // Don't fail - they verified, we can retry profile creation
    } else if (!usersError) {
      console.log('[Verify OTP] User record created in public.users');
    }

    // Step 2: Create profile with user type from metadata
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        email: email,
        full_name: fullName,
        user_type: userType,
        onboarding_completed: false,
      });

    if (profileError && profileError.code !== '23505') {
      // Ignore if already exists (23505)
      console.error('[Verify OTP] Profile creation error:', profileError);
      // Don't fail - they verified, we can retry later
    } else if (!profileError) {
      console.log('[Verify OTP] Profile created successfully');
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: fullName,
      }
    });

  } catch (error: any) {
    console.error('[Verify OTP] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

