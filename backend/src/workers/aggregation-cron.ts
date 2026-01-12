/**
 * Click Stats Aggregation Cron Worker
 *
 * Runs hourly to aggregate click data into daily rollups
 * Updates click_stats_daily table for fast analytics queries
 *
 * Trigger: GET /cron/aggregation
 * Schedule: 0 * * * * (every hour)
 */

import { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

export async function handleAggregation(env: Env) {
  console.log('📊 Click Stats Aggregation Cron started');
  const startTime = Date.now();

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get yesterday's and today's date for aggregation
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Aggregating clicks for ${yesterday} and ${today}`);

    // Aggregate clicks for yesterday (final)
    await aggregateDay(supabase, yesterday);

    // Aggregate clicks for today (rolling)
    await aggregateDay(supabase, today);

    const duration = Date.now() - startTime;
    console.log(`✅ Aggregation Complete (${duration}ms)`);
  } catch (error: any) {
    console.error('Aggregation Cron error:', error);
    throw error;
  }
}

async function aggregateDay(supabase: any, date: string) {
  // Get all clicks for the date
  const { data: clicks, error: clicksError } = await supabase
    .from('redirect_link_clicks')
    .select(`
      redirect_link_id,
      user_agent,
      country_code,
      utm_source,
      utm_medium,
      utm_campaign,
      redirect_links!inner (
        user_id
      )
    `)
    .gte('clicked_at', `${date}T00:00:00.000Z`)
    .lt('clicked_at', `${date}T23:59:59.999Z`);

  if (clicksError) {
    console.error(`Error fetching clicks for ${date}:`, clicksError);
    return;
  }

  if (!clicks || clicks.length === 0) {
    console.log(`No clicks found for ${date}`);
    return;
  }

  console.log(`Processing ${clicks.length} clicks for ${date}`);

  // Group by smartwrapper_id
  const grouped = clicks.reduce((acc: any, click: any) => {
    const key = click.redirect_link_id;
    if (!acc[key]) {
      acc[key] = {
        smartwrapper_id: click.redirect_link_id,
        user_id: click.redirect_links.user_id,
        date,
        total_clicks: 0,
        unique_clicks: 0, // Simplified: same as total for now
        mobile_clicks: 0,
        desktop_clicks: 0,
        tablet_clicks: 0,
        countries: {} as { [key: string]: number },
        utm_sources: {} as { [key: string]: number },
        utm_mediums: {} as { [key: string]: number },
        utm_campaigns: {} as { [key: string]: number },
      };
    }

    const stats = acc[key];
    stats.total_clicks++;
    stats.unique_clicks++; // Simplified

    // Device type
    const deviceType = getDeviceType(click.user_agent || '');
    if (deviceType === 'mobile') stats.mobile_clicks++;
    else if (deviceType === 'desktop') stats.desktop_clicks++;
    else if (deviceType === 'tablet') stats.tablet_clicks++;

    // Country
    if (click.country_code) {
      stats.countries[click.country_code] = (stats.countries[click.country_code] || 0) + 1;
    }

    // UTM tracking
    if (click.utm_source) {
      stats.utm_sources[click.utm_source] = (stats.utm_sources[click.utm_source] || 0) + 1;
    }
    if (click.utm_medium) {
      stats.utm_mediums[click.utm_medium] = (stats.utm_mediums[click.utm_medium] || 0) + 1;
    }
    if (click.utm_campaign) {
      stats.utm_campaigns[click.utm_campaign] = (stats.utm_campaigns[click.utm_campaign] || 0) + 1;
    }

    return acc;
  }, {});

  // Upsert aggregated stats
  for (const [smartwrapperId, stats] of Object.entries(grouped as any)) {
    // Find top country, utm_source, etc
    const topCountry = getTopKey(stats.countries);
    const topUtmSource = getTopKey(stats.utm_sources);
    const topUtmMedium = getTopKey(stats.utm_mediums);
    const topUtmCampaign = getTopKey(stats.utm_campaigns);

    await supabase.from('click_stats_daily').upsert(
      {
        smartwrapper_id: stats.smartwrapper_id,
        user_id: stats.user_id,
        date: stats.date,
        total_clicks: stats.total_clicks,
        unique_clicks: stats.unique_clicks,
        mobile_clicks: stats.mobile_clicks,
        desktop_clicks: stats.desktop_clicks,
        tablet_clicks: stats.tablet_clicks,
        top_country: topCountry,
        top_utm_source: topUtmSource,
        top_utm_medium: topUtmMedium,
        top_utm_campaign: topUtmCampaign,
      },
      {
        onConflict: 'smartwrapper_id,date',
      }
    );
  }

  console.log(`✅ Aggregated ${Object.keys(grouped).length} SmartWrappers for ${date}`);
}

function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function getTopKey(obj: { [key: string]: number }): string | null {
  if (Object.keys(obj).length === 0) return null;

  let topKey = null;
  let topCount = 0;

  for (const [key, count] of Object.entries(obj)) {
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }

  return topKey;
}
