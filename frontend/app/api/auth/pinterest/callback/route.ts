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
      console.error('[Pinterest Callback] OAuth error:', error);
      return NextResponse.redirect(new URL('/chat?error=pinterest_auth_failed', req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/chat?error=pinterest_missing_params', req.url));
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
      .eq('platform', 'pinterest')
      .single();

    if (!storedState) {
      console.error('[Pinterest Callback] Invalid state');
      return NextResponse.redirect(new URL('/chat?error=pinterest_invalid_state', req.url));
    }

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/pinterest/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Pinterest Callback] Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/chat?error=pinterest_token_failed', req.url));
    }

    const tokens = await tokenResponse.json();

    // Fetch user info
    const userResponse = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[Pinterest Callback] Failed to fetch user info');
      return NextResponse.redirect(new URL('/chat?error=pinterest_user_failed', req.url));
    }

    const user = await userResponse.json();

    if (!user || !user.username) {
      return NextResponse.redirect(new URL('/chat?error=pinterest_no_user', req.url));
    }

    // Store account in database
    const { error: dbError } = await supabase.from('social_accounts').upsert({
      user_id: session.user.id,
      platform: 'pinterest',
      platform_user_id: user.username,
      channel_name: user.username,
      channel_handle: user.username,
      channel_url: `https://pinterest.com/${user.username}`,
      profile_image_url: user.profile_image,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      follower_count: user.follower_count || 0,
      is_active: true,
    }, {
      onConflict: 'user_id,platform',
    });

    if (dbError) {
      console.error('[Pinterest Callback] Database error:', dbError);
      return NextResponse.redirect(new URL('/chat?error=pinterest_db_failed', req.url));
    }

    return NextResponse.redirect(new URL('/chat?success=pinterest_connected', req.url));
  } catch (error) {
    console.error('[Pinterest Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/chat?error=pinterest_unexpected', req.url));
  }
}
