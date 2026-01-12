import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Resend OTP
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      console.error('[Resend OTP] Error:', error);
      
      // Handle rate limit errors more gracefully
      if (error.message?.includes('security purposes') || error.message?.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Please wait a minute before requesting a new code' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to resend code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code resent',
    });

  } catch (error: any) {
    console.error('[Resend OTP] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

