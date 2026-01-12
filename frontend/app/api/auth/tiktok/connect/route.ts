import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// TikTok Login Kit OAuth 2.0
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Generate state for security
    const state = crypto.randomBytes(16).toString('hex');

    // Generate code_verifier for PKCE
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store state and code_verifier
    await supabase.from('oauth_states').insert({
      user_id: user.id,
      platform: 'tiktok',
      state: state,
      code_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Build TikTok OAuth URL
    const csrfState = Math.random().toString(36).substring(2);
    
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      scope: 'user.info.basic,video.list',
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[TikTok OAuth] Error:', error);
    return NextResponse.redirect(new URL('/chat?error=tiktok_oauth_failed', req.url));
  }
}

