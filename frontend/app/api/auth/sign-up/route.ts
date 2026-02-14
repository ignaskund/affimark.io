/**
 * Direct Sign-Up API
 * Creates user account with email/password in Supabase Auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, userType } = await request.json();

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Use ANON client for signUp (not admin) so user is properly created in auth.users
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create user in Supabase Auth - this sends OTP automatically
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0],
          user_type: userType || 'creator',
        },
      },
    });

    if (authError) {
      console.error('[Sign-Up] Auth error:', authError);

      // Handle duplicate email
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'This email is already registered. Please sign in instead.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: authError.message || 'Failed to create account' },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    console.log('[Sign-Up] User created in auth:', authData.user.id, email);

    // Store full_name in user metadata for later use
    // We'll create public.users and profiles AFTER email verification
    console.log('[Sign-Up] User pending email verification - tables will be created after verification');

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
      },
      message: 'Account created! Please check your email to verify your account.',
      requiresVerification: true,
    });

  } catch (error: any) {
    console.error('[Sign-Up] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
