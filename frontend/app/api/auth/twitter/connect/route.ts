import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/twitter/callback`;

    if (!clientId) {
      console.error('[Twitter Connect] Missing TWITTER_CLIENT_ID');
      return NextResponse.json(
        { error: 'Twitter integration not configured' },
        { status: 500 }
      );
    }

    // Generate state and code_verifier for PKCE
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store state and code_verifier in database
    const supabase = await createSupabaseAdminClient();
    await supabase.from('oauth_states').insert({
      state,
      user_id: session.user.id,
      platform: 'twitter',
      code_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Build OAuth URL
    const scopes = ['tweet.read', 'users.read', 'follows.read', 'offline.access'].join(' ');

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[Twitter Connect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Twitter connection' },
      { status: 500 }
    );
  }
}

