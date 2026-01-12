/**
 * Twitter/X MCP Integration
 * Custom lightweight wrapper for Twitter API v2
 * Provides on-demand fetching of Twitter data for chat
 */

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  description: string;
  profile_image_url: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  author_id?: string;
}

/**
 * Get authenticated user's profile
 */
export async function getTwitterUserProfile(
  accessToken: string
): Promise<TwitterUser> {
  const response = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=description,profile_image_url,public_metrics',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get user's recent tweets
 */
export async function getTwitterUserTweets(
  userId: string,
  accessToken: string,
  maxResults: number = 100
): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  let nextToken: string | undefined;
  
  // Twitter API allows max 100 per request
  // For more, we need to paginate
  const requestLimit = Math.min(maxResults, 100);
  
  do {
    const url = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
    url.searchParams.set('max_results', requestLimit.toString());
    url.searchParams.set('tweet.fields', 'created_at,public_metrics');
    
    if (nextToken) {
      url.searchParams.set('pagination_token', nextToken);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    
    if (data.data) {
      tweets.push(...data.data);
    }
    
    nextToken = data.meta?.next_token;
    
    // Stop if we have enough tweets or no more pages
    if (tweets.length >= maxResults || !nextToken) {
      break;
    }
    
  } while (nextToken);
  
  return tweets.slice(0, maxResults);
}

/**
 * Search tweets (if user has elevated access)
 */
export async function searchTwitter(
  query: string,
  accessToken: string,
  maxResults: number = 10
): Promise<Tweet[]> {
  const url = new URL('https://api.twitter.com/2/tweets/search/recent');
  url.searchParams.set('query', query);
  url.searchParams.set('max_results', Math.min(maxResults, 100).toString());
  url.searchParams.set('tweet.fields', 'created_at,public_metrics');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

/**
 * Calculate engagement rate
 */
export function calculateTwitterEngagementRate(
  tweets: Tweet[],
  followerCount: number
): number {
  if (tweets.length === 0 || followerCount === 0) {
    return 0;
  }
  
  const totalEngagement = tweets.reduce((sum, tweet) => {
    return sum + 
      tweet.public_metrics.like_count +
      tweet.public_metrics.retweet_count +
      tweet.public_metrics.reply_count +
      tweet.public_metrics.quote_count;
  }, 0);
  
  const avgEngagementPerTweet = totalEngagement / tweets.length;
  const engagementRate = (avgEngagementPerTweet / followerCount) * 100;
  
  return Math.round(engagementRate * 100) / 100;
}

/**
 * Get most popular tweets
 */
export function getTopTweets(tweets: Tweet[], limit: number = 5): Tweet[] {
  return tweets
    .sort((a, b) => {
      const aEngagement = a.public_metrics.like_count + 
                          a.public_metrics.retweet_count;
      const bEngagement = b.public_metrics.like_count + 
                          b.public_metrics.retweet_count;
      return bEngagement - aEngagement;
    })
    .slice(0, limit);
}

/**
 * Format tweets for AI analysis
 */
export function formatTweetsForAI(tweets: Tweet[]): string {
  return tweets.map(tweet => `
Tweet: ${tweet.text}
Likes: ${tweet.public_metrics.like_count.toLocaleString()}
Retweets: ${tweet.public_metrics.retweet_count.toLocaleString()}
Replies: ${tweet.public_metrics.reply_count.toLocaleString()}
Posted: ${new Date(tweet.created_at).toLocaleDateString()}
---
`).join('\n');
}

/**
 * Analyze tweet topics (simple keyword extraction)
 */
export function extractTwitterTopics(tweets: Tweet[]): string[] {
  const allText = tweets.map(t => t.text.toLowerCase()).join(' ');
  
  // Remove URLs, mentions, and hashtags for cleaner analysis
  const cleanText = allText
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#/g, '');
  
  // Simple word frequency (you'd use NLP in production)
  const words = cleanText.split(/\s+/).filter(w => w.length > 4);
  const frequency: Record<string, number> = {};
  
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Return top 10 words
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

