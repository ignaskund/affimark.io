import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Analytics Sync API
 * Fetches latest stats from all connected platforms and stores in analytics_summary table
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all connected social accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (accountsError) {
      console.error('[Analytics Sync] Failed to fetch accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ 
        message: 'No connected accounts',
        synced: 0 
      });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const syncResults: any[] = [];

    // Sync each platform
    for (const account of accounts) {
      try {
        let stats = null;

        // Call backend MCP to fetch stats
        if (account.platform === 'youtube') {
          stats = await fetchYouTubeStats(account);
        } else if (account.platform === 'twitter') {
          stats = await fetchTwitterStats(account);
        } else if (account.platform === 'tiktok') {
          stats = await fetchTikTokStats(account);
        }

        if (stats) {
          // Upsert into analytics_summary
          const { error: upsertError } = await supabase
            .from('analytics_summary')
            .upsert({
              user_id: user.id,
              social_account_id: account.id,
              platform: account.platform,
              date: today,
              total_views: stats.views || 0,
              total_likes: stats.likes || 0,
              total_comments: stats.comments || 0,
              total_shares: stats.shares || 0,
              follower_count: stats.followers || 0,
              engagement_rate: stats.engagement_rate || 0,
              posts_published: stats.posts_count || 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'social_account_id,date',
            });

          if (upsertError) {
            console.error(`[Analytics Sync] Failed to save ${account.platform}:`, upsertError);
          } else {
            syncResults.push({
              platform: account.platform,
              success: true,
            });
          }
        }
      } catch (error) {
        console.error(`[Analytics Sync] Error syncing ${account.platform}:`, error);
        syncResults.push({
          platform: account.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Analytics synced successfully',
      synced: syncResults.filter(r => r.success).length,
      failed: syncResults.filter(r => !r.success).length,
      results: syncResults,
    });

  } catch (error) {
    console.error('[Analytics Sync] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions to fetch stats from each platform
async function fetchYouTubeStats(account: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mcp/get_youtube_analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
    },
    body: JSON.stringify({
      account_id: account.id,
      days: 1, // Just today's stats
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch YouTube stats');
  }

  const data = await response.json();
  return {
    views: data.total_views,
    likes: data.total_likes,
    comments: data.total_comments,
    shares: data.total_shares,
    followers: data.subscriber_count,
    engagement_rate: data.engagement_rate,
    posts_count: data.videos_published,
  };
}

async function fetchTwitterStats(account: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mcp/get_twitter_analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
    },
    body: JSON.stringify({
      account_id: account.id,
      days: 1,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Twitter stats');
  }

  const data = await response.json();
  return {
    views: data.impressions,
    likes: data.likes,
    comments: data.replies,
    shares: data.retweets,
    followers: data.followers_count,
    engagement_rate: data.engagement_rate,
    posts_count: data.tweets_count,
  };
}

async function fetchTikTokStats(account: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mcp/get_tiktok_analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
    },
    body: JSON.stringify({
      account_id: account.id,
      days: 1,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch TikTok stats');
  }

  const data = await response.json();
  return {
    views: data.total_views,
    likes: data.total_likes,
    comments: data.total_comments,
    shares: data.total_shares,
    followers: data.follower_count,
    engagement_rate: data.engagement_rate,
    posts_count: data.videos_count,
  };
}

// GET endpoint to retrieve analytics
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const platform = searchParams.get('platform');

    let query = supabase
      .from('analytics_summary')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Analytics GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    return NextResponse.json({ analytics: data });

  } catch (error) {
    console.error('[Analytics GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

