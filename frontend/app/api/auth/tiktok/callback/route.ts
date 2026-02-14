import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[TikTok Callback] OAuth error:', error);
      return NextResponse.redirect(new URL('/chat?error=tiktok_auth_denied', req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/chat?error=tiktok_missing_params', req.url));
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Retrieve code_verifier from temporary storage
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'tiktok')
      .eq('state', state)
      .single();

    if (stateError || !oauthState) {
      console.error('[TikTok Callback] Invalid state:', stateError);
      return NextResponse.redirect(new URL('/chat?error=tiktok_invalid_state', req.url));
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
        code_verifier: oauthState.code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[TikTok Callback] Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/chat?error=tiktok_token_failed', req.url));
    }

    const tokens = await tokenResponse.json();

    // Fetch user info
    const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('[TikTok Callback] User info fetch failed');
      return NextResponse.redirect(new URL('/chat?error=tiktok_profile_failed', req.url));
    }

    const userInfo = await userInfoResponse.json();
    const tiktokUser = userInfo.data.user;

    // Save to social_accounts table
    const { error: insertError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        platform: 'tiktok',
        platform_user_id: tiktokUser.open_id,
        channel_name: tiktokUser.display_name,
        profile_image_url: tiktokUser.avatar_url,
        follower_count: tiktokUser.follower_count || 0,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'user_id,platform',
      });

    if (insertError) {
      console.error('[TikTok Callback] Save failed:', insertError);
      return NextResponse.redirect(new URL('/chat?error=tiktok_save_failed', req.url));
    }

    // Clean up OAuth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    // Redirect back to chat
    return NextResponse.redirect(new URL('/chat?success=tiktok_connected', req.url));

  } catch (error) {
    console.error('[TikTok Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/chat?error=tiktok_unexpected', req.url));
  }
}

