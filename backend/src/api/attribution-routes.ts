/**
 * Attribution Tracking API
 * Link shortener, click tracking, conversion events
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

// Supabase client
const getSupabase = (c: any) => {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

// Generate short code for tracking link
function generateShortCode(creatorName: string, productName: string): string {
  const base = `${creatorName}-${productName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const random = Math.random().toString(36).substring(2, 6);
  return `${base}-${random}`;
}

/**
 * Create tracking link
 * POST /api/attribution/links
 */
app.post('/links', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { campaign_id, creator_id, destination_url, utm_source, utm_medium, utm_campaign, utm_content } = body;

    if (!campaign_id || !creator_id || !destination_url) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Get creator and campaign names for short code
    const { data: creator } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', creator_id)
      .single();

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('title')
      .eq('id', campaign_id)
      .single();

    const shortCode = generateShortCode(
      creator?.full_name || 'creator',
      campaign?.title || 'campaign'
    );

    // Create tracking link
    const { data, error } = await supabase
      .from('tracking_links')
      .insert({
        campaign_id,
        creator_id,
        short_code: shortCode,
        destination_url,
        utm_source: utm_source || 'affimark',
        utm_medium: utm_medium || 'creator',
        utm_campaign: utm_campaign || campaign?.title,
        utm_content: utm_content || creator?.full_name,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Generate full tracking URL
    const trackingUrl = `https://affimark.io/c/${shortCode}`;

    return c.json({
      tracking_link: {
        ...data,
        tracking_url: trackingUrl,
      },
    });
  } catch (error: any) {
    console.error('Error creating tracking link:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get tracking links for campaign or creator
 * GET /api/attribution/links?campaign_id=xxx or ?creator_id=xxx
 */
app.get('/links', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const campaignId = c.req.query('campaign_id');
    const creatorId = c.req.query('creator_id');

    let query = supabase.from('tracking_links').select('*');

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    } else if (creatorId) {
      query = query.eq('creator_id', creatorId);
    } else {
      return c.json({ error: 'campaign_id or creator_id required' }, 400);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Add full tracking URLs
    const linksWithUrls = data.map((link) => ({
      ...link,
      tracking_url: `https://affimark.io/c/${link.short_code}`,
    }));

    return c.json({ tracking_links: linksWithUrls });
  } catch (error: any) {
    console.error('Error fetching tracking links:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Track click (public endpoint)
 * POST /api/attribution/click/:short_code
 */
app.post('/click/:short_code', async (c) => {
  try {
    const supabase = getSupabase(c);
    const shortCode = c.req.param('short_code');

    // Get tracking link
    const { data: link, error: linkError } = await supabase
      .from('tracking_links')
      .select('*')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (linkError || !link) {
      return c.json({ error: 'Link not found' }, 404);
    }

    // Get request metadata
    const userAgent = c.req.header('user-agent') || '';
    const referrer = c.req.header('referer') || '';
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';

    // Cloudflare headers
    const country = c.req.header('cf-ipcountry') || '';
    const city = c.req.header('cf-ipcity') || '';

    // Parse user agent for device info
    const isMobile = /mobile/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Record click
    await supabase.from('tracked_clicks').insert({
      tracking_link_id: link.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer,
      country,
      city,
      device_type: deviceType,
      browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Safari') ? 'Safari' : 'Other',
      os: userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac') ? 'Mac' : userAgent.includes('Linux') ? 'Linux' : 'Other',
    });

    // Return redirect URL
    return c.json({
      redirect_url: link.destination_url,
      tracking_link_id: link.id,
    });
  } catch (error: any) {
    console.error('Error tracking click:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Track conversion event (called by company's pixel or webhook)
 * POST /api/attribution/conversion
 */
app.post('/conversion', async (c) => {
  try {
    const supabase = getSupabase(c);
    const body = await c.req.json();

    const {
      tracking_link_id,
      event_type, // 'signup', 'trial_start', 'purchase', 'subscription'
      user_email,
      user_id,
      revenue_amount,
      metadata,
    } = body;

    if (!tracking_link_id || !event_type) {
      return c.json({ error: 'tracking_link_id and event_type required' }, 400);
    }

    // Get tracking link details
    const { data: link } = await supabase
      .from('tracking_links')
      .select('*')
      .eq('id', tracking_link_id)
      .single();

    if (!link) {
      return c.json({ error: 'Tracking link not found' }, 404);
    }

    // Record conversion
    const { data: conversion, error } = await supabase
      .from('conversion_events')
      .insert({
        tracking_link_id,
        campaign_id: link.campaign_id,
        creator_id: link.creator_id,
        event_type,
        user_email,
        user_id,
        revenue_amount: revenue_amount || 0,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // If this is a purchase/subscription, check for revenue share programs
    if ((event_type === 'purchase' || event_type === 'subscription') && revenue_amount) {
      // Check if there's a revenue share program for this campaign
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', link.campaign_id)
        .single();

      if (campaign?.campaign_type === 'revenue_share' && campaign.revenue_share_percentage) {
        // Create revenue share signup
        await supabase.from('revenue_share_signups').insert({
          campaign_id: link.campaign_id,
          creator_id: link.creator_id,
          conversion_event_id: conversion.id,
          customer_id: user_id,
          customer_email: user_email,
          monthly_revenue: revenue_amount,
          revenue_share_percentage: campaign.revenue_share_percentage,
          status: 'active',
          first_payment_date: new Date().toISOString().split('T')[0],
        });
      }
    }

    // Calculate lead quality score
    await calculateLeadQualityScore(supabase, conversion.id, link.campaign_id, link.creator_id, {
      user_email,
      metadata,
    });

    return c.json({ conversion });
  } catch (error: any) {
    console.error('Error tracking conversion:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get conversion stats for campaign or creator
 * GET /api/attribution/stats?campaign_id=xxx or ?creator_id=xxx
 */
app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const campaignId = c.req.query('campaign_id');
    const creatorId = c.req.query('creator_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    if (!campaignId && !creatorId) {
      return c.json({ error: 'campaign_id or creator_id required' }, 400);
    }

    // Get clicks
    let clicksQuery = supabase
      .from('tracked_clicks')
      .select('id, tracking_link_id')
      .gte('clicked_at', startDate || '2020-01-01')
      .lte('clicked_at', endDate || '2030-12-31');

    if (campaignId) {
      const { data: links } = await supabase
        .from('tracking_links')
        .select('id')
        .eq('campaign_id', campaignId);
      const linkIds = links?.map((l) => l.id) || [];
      clicksQuery = clicksQuery.in('tracking_link_id', linkIds);
    } else if (creatorId) {
      const { data: links } = await supabase
        .from('tracking_links')
        .select('id')
        .eq('creator_id', creatorId);
      const linkIds = links?.map((l) => l.id) || [];
      clicksQuery = clicksQuery.in('tracking_link_id', linkIds);
    }

    const { data: clicks, count: clickCount } = await clicksQuery;

    // Get conversions
    let conversionsQuery = supabase
      .from('conversion_events')
      .select('*')
      .gte('converted_at', startDate || '2020-01-01')
      .lte('converted_at', endDate || '2030-12-31');

    if (campaignId) {
      conversionsQuery = conversionsQuery.eq('campaign_id', campaignId);
    } else if (creatorId) {
      conversionsQuery = conversionsQuery.eq('creator_id', creatorId);
    }

    const { data: conversions } = await conversionsQuery;

    // Calculate stats
    const stats = {
      total_clicks: clicks?.length || 0,
      total_conversions: conversions?.length || 0,
      conversion_rate: clicks?.length ? ((conversions?.length || 0) / clicks.length) * 100 : 0,

      conversions_by_type: {
        signup: conversions?.filter((c) => c.event_type === 'signup').length || 0,
        trial_start: conversions?.filter((c) => c.event_type === 'trial_start').length || 0,
        purchase: conversions?.filter((c) => c.event_type === 'purchase').length || 0,
        subscription: conversions?.filter((c) => c.event_type === 'subscription').length || 0,
      },

      total_revenue: conversions?.reduce((sum, c) => sum + (Number(c.revenue_amount) || 0), 0) || 0,
    };

    // Get lead quality breakdown
    const { data: leadScores } = await supabase
      .from('lead_quality_scores')
      .select('quality_tier')
      .in(
        'conversion_event_id',
        conversions?.map((c) => c.id) || []
      );

    stats.lead_quality = {
      high: leadScores?.filter((l) => l.quality_tier === 'high').length || 0,
      medium: leadScores?.filter((l) => l.quality_tier === 'medium').length || 0,
      low: leadScores?.filter((l) => l.quality_tier === 'low').length || 0,
    };

    return c.json({ stats });
  } catch (error: any) {
    console.error('Error fetching attribution stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get performance by creator (for brand dashboard)
 * GET /api/attribution/creators-performance?campaign_id=xxx
 */
app.get('/creators-performance', async (c) => {
  try {
    const supabase = getSupabase(c);
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const campaignId = c.req.query('campaign_id');

    if (!campaignId) {
      return c.json({ error: 'campaign_id required' }, 400);
    }

    // Get all creators for this campaign
    const { data: partnerships } = await supabase
      .from('partnerships')
      .select('creator_id, profiles!partnerships_creator_id_fkey(id, full_name, avatar_url)')
      .eq('campaign_id', campaignId)
      .eq('status', 'accepted');

    const performance = await Promise.all(
      (partnerships || []).map(async (p: any) => {
        const creatorId = p.creator_id;

        // Get stats for this creator
        const { data: conversions } = await supabase
          .from('conversion_events')
          .select('*')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creatorId);

        const { data: clicks } = await supabase
          .from('tracked_clicks')
          .select('id')
          .in(
            'tracking_link_id',
            await supabase
              .from('tracking_links')
              .select('id')
              .eq('campaign_id', campaignId)
              .eq('creator_id', creatorId)
              .then((res) => res.data?.map((l) => l.id) || [])
          );

        const totalRevenue = conversions?.reduce((sum, c) => sum + (Number(c.revenue_amount) || 0), 0) || 0;
        const signups = conversions?.filter((c) => c.event_type === 'signup').length || 0;
        const purchases = conversions?.filter((c) => ['purchase', 'subscription'].includes(c.event_type)).length || 0;

        return {
          creator: p.profiles,
          clicks: clicks?.length || 0,
          signups,
          purchases,
          revenue: totalRevenue,
          conversion_rate: clicks?.length ? (signups / clicks.length) * 100 : 0,
        };
      })
    );

    // Sort by revenue desc
    performance.sort((a, b) => b.revenue - a.revenue);

    return c.json({ creators_performance: performance });
  } catch (error: any) {
    console.error('Error fetching creators performance:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Helper: Calculate lead quality score
async function calculateLeadQualityScore(
  supabase: any,
  conversionEventId: string,
  campaignId: string,
  creatorId: string,
  data: { user_email?: string; metadata?: any }
) {
  try {
    let emailScore = 0;
    let profileScore = 0;
    let engagementScore = 0;
    let intentScore = 0;

    // Email quality (25 points)
    if (data.user_email) {
      const domain = data.user_email.split('@')[1];
      const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

      if (!freeDomains.includes(domain)) {
        emailScore = 25; // Work email
      } else {
        emailScore = 10; // Free email
      }
    }

    // Profile completion (25 points) - from metadata
    if (data.metadata?.profile_complete) {
      profileScore = 25;
    } else if (data.metadata?.profile_partial) {
      profileScore = 15;
    }

    // Engagement (25 points) - time on site, pages viewed
    const timeOnSite = data.metadata?.time_on_site_seconds || 0;
    if (timeOnSite > 300) {
      engagementScore = 25; // 5+ minutes
    } else if (timeOnSite > 120) {
      engagementScore = 15; // 2-5 minutes
    } else if (timeOnSite > 30) {
      engagementScore = 5; // 30sec - 2min
    }

    // Intent (25 points) - viewed pricing, added card, started trial
    if (data.metadata?.added_credit_card) {
      intentScore = 25;
    } else if (data.metadata?.viewed_pricing) {
      intentScore = 15;
    } else if (data.metadata?.started_trial) {
      intentScore = 20;
    }

    // Insert score
    await supabase.from('lead_quality_scores').insert({
      conversion_event_id: conversionEventId,
      campaign_id: campaignId,
      creator_id: creatorId,
      email_quality_score: emailScore,
      profile_completion_score: profileScore,
      engagement_score: engagementScore,
      intent_score: intentScore,
      // Total and tier are calculated by trigger
    });
  } catch (error) {
    console.error('Error calculating lead quality score:', error);
  }
}

export default app;
