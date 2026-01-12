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

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`;

    if (!clientId) {
      console.error('[YouTube Connect] Missing YOUTUBE_CLIENT_ID');
      return NextResponse.json(
        { error: 'YouTube integration not configured' },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in database
    const supabase = await createSupabaseAdminClient();
    await supabase.from('oauth_states').insert({
      state,
      user_id: session.user.id,
      platform: 'youtube',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Build OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[YouTube Connect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate YouTube connection' },
      { status: 500 }
    );
  }
}
