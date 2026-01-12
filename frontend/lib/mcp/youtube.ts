/**
 * YouTube MCP Integration
 * Uses zubeid-youtube-mcp-server package
 * Provides on-demand fetching of YouTube data for chat
 */

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
}

interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
}

interface YouTubeTranscript {
  videoId: string;
  text: string;
  language: string;
  timestamps?: Array<{
    start: number;
    duration: number;
    text: string;
  }>;
}

/**
 * Fetch channel information
 */
export async function getYouTubeChannelInfo(
  channelId: string,
  accessToken: string
): Promise<YouTubeChannelInfo> {
  // In production, this would call the YouTube MCP server
  // For now, we'll call YouTube API directly
  
  const response = await fetch(
    `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Channel not found');
  }
  
  const channel = data.items[0];
  
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
    viewCount: parseInt(channel.statistics.viewCount || '0'),
    videoCount: parseInt(channel.statistics.videoCount || '0'),
    thumbnails: channel.snippet.thumbnails
  };
}

/**
 * Fetch recent videos from a channel
 */
export async function getYouTubeVideos(
  channelId: string,
  accessToken: string,
  maxResults: number = 25
): Promise<YouTubeVideo[]> {
  // Step 1: Get the uploads playlist ID
  const channelResponse = await fetch(
    `https://youtube.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const channelData = await channelResponse.json();
  const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;
  
  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist');
  }
  
  // Step 2: Get video IDs from playlist
  const playlistResponse = await fetch(
    `https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const playlistData = await playlistResponse.json();
  const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(',');
  
  // Step 3: Get video details
  const videosResponse = await fetch(
    `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const videosData = await videosResponse.json();
  
  return videosData.items.map((video: any) => ({
    id: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    publishedAt: video.snippet.publishedAt,
    viewCount: parseInt(video.statistics.viewCount || '0'),
    likeCount: parseInt(video.statistics.likeCount || '0'),
    commentCount: parseInt(video.statistics.commentCount || '0'),
    duration: video.contentDetails.duration,
    thumbnails: video.snippet.thumbnails
  }));
}

/**
 * Fetch video transcript
 * This uses YouTube's caption API
 */
export async function getYouTubeTranscript(
  videoId: string,
  accessToken: string,
  language: string = 'en'
): Promise<YouTubeTranscript> {
  try {
    // Step 1: List available captions
    const captionsResponse = await fetch(
      `https://youtube.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const captionsData = await captionsResponse.json();
    
    if (!captionsData.items || captionsData.items.length === 0) {
      return {
        videoId,
        text: '',
        language: 'none',
        timestamps: []
      };
    }
    
    // Find caption track (prefer requested language, fallback to any)
    const caption = captionsData.items.find((c: any) => 
      c.snippet.language === language
    ) || captionsData.items[0];
    
    // Step 2: Download caption track
    const trackResponse = await fetch(
      `https://youtube.googleapis.com/youtube/v3/captions/${caption.id}?tfmt=srt`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/plain'
        }
      }
    );
    
    const srtText = await trackResponse.text();
    
    // Parse SRT to plain text (remove timestamps and numbers)
    const cleanText = srtText
      .split('\n')
      .filter(line => !line.match(/^\d+$/) && !line.match(/\d{2}:\d{2}:\d{2}/))
      .filter(line => line.trim())
      .join(' ');
    
    return {
      videoId,
      text: cleanText,
      language: caption.snippet.language
    };
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return {
      videoId,
      text: '',
      language: 'error',
      timestamps: []
    };
  }
}

/**
 * Search YouTube for videos
 */
export async function searchYouTubeVideos(
  query: string,
  accessToken: string,
  maxResults: number = 10
): Promise<YouTubeVideo[]> {
  const searchResponse = await fetch(
    `https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const searchData = await searchResponse.json();
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
  
  if (!videoIds) {
    return [];
  }
  
  // Get full video details
  const videosResponse = await fetch(
    `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  
  const videosData = await videosResponse.json();
  
  return videosData.items.map((video: any) => ({
    id: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    publishedAt: video.snippet.publishedAt,
    viewCount: parseInt(video.statistics.viewCount || '0'),
    likeCount: parseInt(video.statistics.likeCount || '0'),
    commentCount: parseInt(video.statistics.commentCount || '0'),
    duration: '',
    thumbnails: video.snippet.thumbnails
  }));
}

/**
 * Format video data for AI analysis
 */
export function formatVideosForAI(videos: YouTubeVideo[]): string {
  return videos.map(video => `
Title: ${video.title}
Views: ${video.viewCount.toLocaleString()}
Likes: ${video.likeCount.toLocaleString()}
Comments: ${video.commentCount.toLocaleString()}
Published: ${new Date(video.publishedAt).toLocaleDateString()}
Description: ${video.description.substring(0, 200)}...
---
`).join('\n');
}

