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
      console.error('[Twitch Callback] OAuth error:', error);
      return NextResponse.redirect(new URL('/chat?error=twitch_auth_failed', req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/chat?error=twitch_missing_params', req.url));
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
      .eq('platform', 'twitch')
      .single();

    if (!storedState) {
      console.error('[Twitch Callback] Invalid state');
      return NextResponse.redirect(new URL('/chat?error=twitch_invalid_state', req.url));
    }

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/twitch/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Twitch Callback] Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/chat?error=twitch_token_failed', req.url));
    }

    const tokens = await tokenResponse.json();

    // Fetch user info
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
      },
    });

    if (!userResponse.ok) {
      console.error('[Twitch Callback] Failed to fetch user info');
      return NextResponse.redirect(new URL('/chat?error=twitch_user_failed', req.url));
    }

    const userData = await userResponse.json();
    const user = userData.data?.[0];

    if (!user) {
      return NextResponse.redirect(new URL('/chat?error=twitch_no_user', req.url));
    }

    // Fetch follower count
    const followersResponse = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID!,
        },
      }
    );

    let followerCount = 0;
    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      followerCount = followersData.total || 0;
    }

    // Store account in database
    const { error: dbError } = await supabase.from('social_accounts').upsert({
      user_id: session.user.id,
      platform: 'twitch',
      platform_user_id: user.id,
      channel_name: user.display_name,
      channel_handle: user.login,
      channel_url: `https://twitch.tv/${user.login}`,
      profile_image_url: user.profile_image_url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      follower_count: followerCount,
      is_active: true,
    }, {
      onConflict: 'user_id,platform',
    });

    if (dbError) {
      console.error('[Twitch Callback] Database error:', dbError);
      return NextResponse.redirect(new URL('/chat?error=twitch_db_failed', req.url));
    }

    return NextResponse.redirect(new URL('/chat?success=twitch_connected', req.url));
  } catch (error) {
    console.error('[Twitch Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/chat?error=twitch_unexpected', req.url));
  }
}
