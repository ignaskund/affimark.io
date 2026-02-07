import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { YouTubeMCP } from '../mcp/youtube';
import { TwitterMCP } from '../mcp/twitter';
import { TikTokMCP } from '../mcp/tiktok';
import { ProductResearchMCP } from '../mcp/productResearchMCP';
import { StrategyTools } from '../mcp/strategy-tools';
import { StrategyAgentService } from '../services/strategy-agent-service';
import Anthropic from '@anthropic-ai/sdk';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  BACKEND_API_KEY: string;
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  RAINFOREST_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  IMPACT_ACCOUNT_SID?: string;
  IMPACT_AUTH_TOKEN?: string;
  SERPAPI_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// MCP instances will be created per-request with environment variables

// Middleware: allow all (disable API key enforcement for local/dev)
app.use('*', async (_c, next) => {
  await next();
});

// =====================================================
// YOUTUBE MCP ENDPOINTS
// =====================================================

app.post('/get_youtube_analytics', async (c) => {
  try {
    const { account_id, days = 30 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const youtubeMCP = new YouTubeMCP(c.env);
    const result = await youtubeMCP.getAnalytics(account_id, days);
    return c.json(result);
  } catch (error: any) {
    console.error('[YouTube MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch YouTube analytics' }, 500);
  }
});

app.post('/get_youtube_videos', async (c) => {
  try {
    const { account_id, max_results = 10 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const youtubeMCP = new YouTubeMCP(c.env);
    const result = await youtubeMCP.getRecentVideos(account_id, max_results);
    return c.json(result);
  } catch (error: any) {
    console.error('[YouTube MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch YouTube videos' }, 500);
  }
});

// =====================================================
// TWITTER MCP ENDPOINTS
// =====================================================

app.post('/get_twitter_analytics', async (c) => {
  try {
    const { account_id, days = 30 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const twitterMCP = new TwitterMCP(c.env);
    const result = await twitterMCP.getAnalytics(account_id, days);
    return c.json(result);
  } catch (error: any) {
    console.error('[Twitter MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch Twitter analytics' }, 500);
  }
});

app.post('/get_twitter_tweets', async (c) => {
  try {
    const { account_id, max_results = 10 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const twitterMCP = new TwitterMCP(c.env);
    const result = await twitterMCP.getRecentTweets(account_id, max_results);
    return c.json(result);
  } catch (error: any) {
    console.error('[Twitter MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch Twitter tweets' }, 500);
  }
});

// =====================================================
// TIKTOK MCP ENDPOINTS
// =====================================================

app.post('/get_tiktok_analytics', async (c) => {
  try {
    const { account_id, days = 30 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const tiktokMCP = new TikTokMCP(c.env);
    const result = await tiktokMCP.getAnalytics(account_id, days);
    return c.json(result);
  } catch (error: any) {
    console.error('[TikTok MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch TikTok analytics' }, 500);
  }
});

app.post('/get_tiktok_videos', async (c) => {
  try {
    const { account_id, max_results = 10 } = await c.req.json();

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400);
    }

    const tiktokMCP = new TikTokMCP(c.env);
    const result = await tiktokMCP.getRecentVideos(account_id, max_results);
    return c.json(result);
  } catch (error: any) {
    console.error('[TikTok MCP] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch TikTok videos' }, 500);
  }
});

// =====================================================
// CROSS-PLATFORM ANALYTICS
// =====================================================

app.post('/get_cross_platform_summary', async (c) => {
  try {
    const { user_id, days = 30 } = await c.req.json();

    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    // Fetch all social accounts for the user
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (error) {
      throw new Error('Failed to fetch social accounts');
    }

    // Fetch analytics for each platform in parallel
    const analyticsPromises = accounts.map(async (account: any) => {
      try {
        let analytics;
        if (account.platform === 'youtube') {
          const youtubeMCP = new YouTubeMCP(c.env);
          analytics = await youtubeMCP.getAnalytics(account.id, days);
        } else if (account.platform === 'twitter') {
          const twitterMCP = new TwitterMCP(c.env);
          analytics = await twitterMCP.getAnalytics(account.id, days);
        } else if (account.platform === 'tiktok') {
          const tiktokMCP = new TikTokMCP(c.env);
          analytics = await tiktokMCP.getAnalytics(account.id, days);
        }

        return {
          platform: account.platform,
          ...analytics,
        };
      } catch (error) {
        console.error(`Failed to fetch ${account.platform} analytics:`, error);
        return null;
      }
    });

    const results = await Promise.all(analyticsPromises);
    const validResults = results.filter(r => r !== null);

    // Aggregate totals
    const summary = {
      total_views: validResults.reduce((sum, r) => sum + (r.total_views || 0), 0),
      total_likes: validResults.reduce((sum, r) => sum + (r.total_likes || 0), 0),
      total_comments: validResults.reduce((sum, r) => sum + (r.total_comments || 0), 0),
      total_shares: validResults.reduce((sum, r) => sum + (r.total_shares || 0), 0),
      total_followers: validResults.reduce((sum, r) => sum + (r.followers_count || r.subscriber_count || 0), 0),
      avg_engagement_rate: validResults.reduce((sum, r) => sum + (r.engagement_rate || 0), 0) / validResults.length || 0,
      platforms: validResults,
    };

    return c.json(summary);
  } catch (error: any) {
    console.error('[Cross-Platform Summary] Error:', error);
    return c.json({ error: error.message || 'Failed to fetch cross-platform summary' }, 500);
  }
});

// =====================================================
// PRODUCT RESEARCH ENDPOINTS
// =====================================================

app.post('/find_products', async (c) => {
  try {
    const { query, category, budget_min, budget_max, limit = 10 } = await c.req.json();

    if (!query) {
      return c.json({ error: 'query is required' }, 400);
    }

    const productMCP = new ProductResearchMCP(c.env);
    const result = await productMCP.findProducts({
      query,
      category,
      budget_min,
      budget_max,
      limit,
    });

    return c.json(result);
  } catch (error: any) {
    console.error('[Product Research] Error:', error);
    return c.json({ error: error.message || 'Failed to find products' }, 500);
  }
});

app.post('/save_product', async (c) => {
  try {
    const { user_id, product_id, notes } = await c.req.json();

    if (!user_id || !product_id) {
      return c.json({ error: 'user_id and product_id are required' }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    // Save to partnership_matches table
    const { data, error } = await supabase
      .from('partnership_matches')
      .insert({
        creator_id: user_id,
        product_id: product_id,
        match_score: 85, // Default score for manually saved products
        match_reasons: notes ? [notes] : [],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to save product');
    }

    return c.json({
      success: true,
      match: data,
    });
  } catch (error: any) {
    console.error('[Save Product] Error:', error);
    return c.json({ error: error.message || 'Failed to save product' }, 500);
  }
});

// =====================================================
// STRATEGY AGENT ENDPOINTS (Phase 6)
// =====================================================

app.post('/get_agent_context', async (c) => {
  try {
    const { user_id } = await c.req.json();

    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const agentService = new StrategyAgentService(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const context = await agentService.getAgentContext(user_id);

    return c.json({ context });
  } catch (error: any) {
    console.error('[Get Agent Context] Error:', error);
    return c.json({ error: error.message || 'Failed to get agent context' }, 500);
  }
});

app.post('/get_system_prompt', async (c) => {
  try {
    const { user_id } = await c.req.json();

    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const agentService = new StrategyAgentService(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
    const context = await agentService.getAgentContext(user_id);
    const systemPrompt = agentService.buildSystemPrompt(context);

    return c.json({ system_prompt: systemPrompt });
  } catch (error: any) {
    console.error('[Get System Prompt] Error:', error);
    return c.json({ error: error.message || 'Failed to get system prompt' }, 500);
  }
});

app.post('/tool/add_to_inventory', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id || !params.product_name) {
      return c.json({ error: 'user_id and product_name are required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
    });

    const result = await tools.addToInventory(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Add to Inventory] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

app.post('/tool/search_affiliate_programs', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.product_name) {
      return c.json({ error: 'product_name is required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
      impactAccountSid: c.env.IMPACT_ACCOUNT_SID,
      impactAuthToken: c.env.IMPACT_AUTH_TOKEN,
      serpApiKey: c.env.SERPAPI_KEY,
    });

    const result = await tools.searchAffiliatePrograms(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Search Affiliate Programs] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

app.post('/tool/get_shop_analytics', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
    });

    const result = await tools.getShopAnalytics(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Get Shop Analytics] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

app.post('/tool/suggest_products_for_content', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id || !params.topic) {
      return c.json({ error: 'user_id and topic are required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
    });

    const result = await tools.suggestProductsForContent(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Suggest Products] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

app.post('/tool/get_inventory_summary', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
    });

    const result = await tools.getInventorySummary(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Get Inventory Summary] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

/**
 * Tool: analyze_link
 * Analyze a social/content link to extract profile description, shop links, and monetizable product cues.
 */
app.post('/tool/analyze_link', async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'url is required' }, 400);
    }

    // Fetch page content (best-effort)
    let html = '';
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'AffimarkBot/1.0' } });
      html = await resp.text();
    } catch (err) {
      console.warn('[analyze_link] fetch failed:', err);
    }

    const truncated = html.slice(0, 15000);

    const client = new Anthropic({
      apiKey: c.env.ANTHROPIC_API_KEY || '',
    });

    const prompt = `You are a monetization analyst. Given a content/profile URL and the HTML snippet, extract:
- profile_description (concise)
- shop_links (array of URLs if any storefront/commerce links are present)
- detected_products: product/brand cues found in the page
- recommended_products: product ideas to monetize, with merchant hints
- summary: 2-3 sentences
Return strict JSON with keys: profile_description, shop_links, detected_products, recommended_products, summary.`;

    const completion = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      system: 'Extract monetization-relevant info from the provided page.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nURL: ${url}\n\nHTML (truncated):\n${truncated}`,
            },
          ],
        },
      ],
    });

    const text = completion.content
      .map((b: any) => (b.type === 'text' ? b.text : ''))
      .join('\n');

    let parsed: any = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch (err) {
      parsed = { raw: text, error: 'Failed to parse JSON from model response' };
    }

    return c.json({ analysis: parsed, raw: text });
  } catch (error: any) {
    console.error('[analyze_link] Error:', error);
    return c.json({ error: error.message || 'Failed to analyze link' }, 500);
  }
});

/**
 * Tool: analyze_social_profiles
 * Analyzes user's connected social media profiles for shop links and content themes
 */
app.post('/tool/analyze_social_profiles', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    });

    const result = await tools.analyzeSocialProfiles(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Analyze Social Profiles] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

/**
 * Tool: setup_shop
 * Helps user setup their shop with initial configuration
 */
app.post('/tool/setup_shop', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.user_id || !params.shop_name) {
      return c.json({ error: 'user_id and shop_name are required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
    });

    const result = await tools.setupShop(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Setup Shop] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

/**
 * Tool: get_product_market_data
 * Get comprehensive market intelligence for a product
 */
app.post('/tool/get_product_market_data', async (c) => {
  try {
    const params = await c.req.json();

    if (!params.product_name) {
      return c.json({ error: 'product_name is required' }, 400);
    }

    const tools = new StrategyTools({
      supabaseUrl: c.env.SUPABASE_URL,
      supabaseKey: c.env.SUPABASE_SERVICE_KEY,
      rainforestApiKey: c.env.RAINFOREST_API_KEY,
      serpApiKey: c.env.SERPAPI_KEY,
      impactAccountSid: c.env.IMPACT_ACCOUNT_SID,
      impactAuthToken: c.env.IMPACT_AUTH_TOKEN,
    });

    const result = await tools.getProductMarketData(params);
    return c.json(result);
  } catch (error: any) {
    console.error('[Tool: Get Product Market Data] Error:', error);
    return c.json({ error: error.message || 'Tool execution failed' }, 500);
  }
});

export default app;

