/**
 * TikTok MCP Integration
 * Uses TikTok Display API for user content
 * Provides on-demand fetching of TikTok data for chat
 */

interface TikTokUser {
  id: string;
  display_name: string;
  bio_description: string;
  avatar_url: string;
  follower_count: number;
  following_count: number;
  video_count: number;
}

interface TikTokVideo {
  id: string;
  title: string;
  description: string;
  create_time: number; // Unix timestamp
  cover_image_url: string;
  duration: number; // seconds
  height: number;
  width: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  video_url?: string;
}

/**
 * Get user info (Display API)
 */
export async function getTikTokUserInfo(
  accessToken: string
): Promise<TikTokUser> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: [
          'display_name',
          'bio_description',
          'avatar_url',
          'follower_count',
          'following_count',
          'video_count'
        ]
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`TikTok API error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  return data.data.user;
}

/**
 * Get user's videos (Display API)
 */
export async function getTikTokVideos(
  accessToken: string,
  maxCount: number = 20
): Promise<TikTokVideo[]> {
  const videos: TikTokVideo[] = [];
  let cursor = 0;
  
  do {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/video/list/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          max_count: Math.min(maxCount - videos.length, 20), // API limit: 20 per request
          cursor: cursor,
          fields: [
            'id',
            'title',
            'video_description',
            'create_time',
            'cover_image_url',
            'duration',
            'height',
            'width',
            'view_count',
            'like_count',
            'comment_count',
            'share_count'
          ]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`TikTok API error: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    
    if (data.data.videos && data.data.videos.length > 0) {
      videos.push(...data.data.videos.map((v: any) => ({
        id: v.id,
        title: v.title || '',
        description: v.video_description || '',
        create_time: v.create_time,
        cover_image_url: v.cover_image_url,
        duration: v.duration,
        height: v.height,
        width: v.width,
        view_count: v.view_count || 0,
        like_count: v.like_count || 0,
        comment_count: v.comment_count || 0,
        share_count: v.share_count || 0
      })));
    }
    
    // Check if there's more data
    if (data.data.has_more && data.data.cursor) {
      cursor = data.data.cursor;
    } else {
      break;
    }
    
    // Stop if we have enough videos
    if (videos.length >= maxCount) {
      break;
    }
    
  } while (cursor);
  
  return videos.slice(0, maxCount);
}

/**
 * Calculate engagement rate
 */
export function calculateTikTokEngagementRate(
  videos: TikTokVideo[],
  followerCount: number
): number {
  if (videos.length === 0 || followerCount === 0) {
    return 0;
  }
  
  const totalEngagement = videos.reduce((sum, video) => {
    return sum + video.like_count + video.comment_count + video.share_count;
  }, 0);
  
  const avgEngagementPerVideo = totalEngagement / videos.length;
  const engagementRate = (avgEngagementPerVideo / followerCount) * 100;
  
  return Math.round(engagementRate * 100) / 100;
}

/**
 * Get most popular videos
 */
export function getTopTikTokVideos(
  videos: TikTokVideo[],
  limit: number = 5
): TikTokVideo[] {
  return videos
    .sort((a, b) => {
      // Sort by total engagement (views + likes + comments + shares)
      const aEngagement = a.view_count + a.like_count + a.comment_count + a.share_count;
      const bEngagement = b.view_count + b.like_count + b.comment_count + b.share_count;
      return bEngagement - aEngagement;
    })
    .slice(0, limit);
}

/**
 * Format videos for AI analysis
 */
export function formatTikTokVideosForAI(videos: TikTokVideo[]): string {
  return videos.map(video => `
Title: ${video.title || 'Untitled'}
Description: ${video.description}
Views: ${video.view_count.toLocaleString()}
Likes: ${video.like_count.toLocaleString()}
Comments: ${video.comment_count.toLocaleString()}
Shares: ${video.share_count.toLocaleString()}
Duration: ${video.duration}s
Posted: ${new Date(video.create_time * 1000).toLocaleDateString()}
---
`).join('\n');
}

/**
 * Analyze video topics (from titles and descriptions)
 */
export function extractTikTokTopics(videos: TikTokVideo[]): string[] {
  const allText = videos
    .map(v => `${v.title} ${v.description}`.toLowerCase())
    .join(' ');
  
  // Remove hashtags symbol but keep the text
  const cleanText = allText.replace(/#/g, '');
  
  // Extract hashtags if present
  const hashtags = allText.match(/#\w+/g) || [];
  const hashtagWords = hashtags.map(h => h.substring(1));
  
  // Simple word frequency
  const words = cleanText.split(/\s+/).filter(w => w.length > 3);
  const frequency: Record<string, number> = {};
  
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Combine hashtags with frequent words
  const topWords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  return [...new Set([...hashtagWords, ...topWords])].slice(0, 10);
}

/**
 * Get average video performance
 */
export function getTikTokAverageMetrics(videos: TikTokVideo[]) {
  if (videos.length === 0) {
    return {
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
      avgDuration: 0
    };
  }
  
  const totals = videos.reduce((acc, video) => ({
    views: acc.views + video.view_count,
    likes: acc.likes + video.like_count,
    comments: acc.comments + video.comment_count,
    shares: acc.shares + video.share_count,
    duration: acc.duration + video.duration
  }), { views: 0, likes: 0, comments: 0, shares: 0, duration: 0 });
  
  return {
    avgViews: Math.round(totals.views / videos.length),
    avgLikes: Math.round(totals.likes / videos.length),
    avgComments: Math.round(totals.comments / videos.length),
    avgShares: Math.round(totals.shares / videos.length),
    avgDuration: Math.round(totals.duration / videos.length)
  };
}

/**
 * Format user profile for AI
 */
export function formatTikTokUserForAI(user: TikTokUser): string {
  return `
TikTok Profile:
- Display Name: ${user.display_name}
- Bio: ${user.bio_description}
- Followers: ${user.follower_count.toLocaleString()}
- Following: ${user.following_count.toLocaleString()}
- Total Videos: ${user.video_count.toLocaleString()}
`;
}

