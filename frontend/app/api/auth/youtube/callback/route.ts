import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[YouTube Callback] OAuth error:', error);
      return NextResponse.redirect(new URL('/chat?error=youtube_auth_failed', req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/chat?error=youtube_missing_params', req.url));
    }

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    const supabase = await createSupabaseAdminClient();

    // Verify state
    const { data: storedState } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('user_id', session.user.id)
      .eq('platform', 'youtube')
      .single();

    if (!storedState) {
      console.error('[YouTube Callback] Invalid state');
      return NextResponse.redirect(new URL('/chat?error=youtube_invalid_state', req.url));
    }

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[YouTube Callback] Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/chat?error=youtube_token_failed', req.url));
    }

    const tokens = await tokenResponse.json();

    // Fetch channel info
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!channelResponse.ok) {
      console.error('[YouTube Callback] Failed to fetch channel info');
      return NextResponse.redirect(new URL('/chat?error=youtube_channel_failed', req.url));
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return NextResponse.redirect(new URL('/chat?error=youtube_no_channel', req.url));
    }

    // Store account in database
    const { error: dbError } = await supabase.from('social_accounts').upsert({
      user_id: session.user.id,
      platform: 'youtube',
      platform_user_id: channel.id,
      channel_name: channel.snippet.title,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      follower_count: parseInt(channel.statistics.subscriberCount) || 0,
      is_active: true,
    }, {
      onConflict: 'user_id,platform',
    });

    if (dbError) {
      console.error('[YouTube Callback] Database error:', dbError);
      return NextResponse.redirect(new URL('/chat?error=youtube_db_failed', req.url));
    }

    return NextResponse.redirect(new URL('/chat?success=youtube_connected', req.url));
  } catch (error) {
    console.error('[YouTube Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/chat?error=youtube_unexpected', req.url));
  }
}

