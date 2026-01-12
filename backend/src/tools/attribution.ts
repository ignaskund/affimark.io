/**
 * Attribution & UTM Tracking System
 * Generates tracking links and tracks conversions
 */

export interface UTMParameters {
  source: string; // e.g., 'affimark'
  medium: string; // e.g., 'creator', 'influencer'
  campaign: string; // campaign ID or name
  term?: string; // optional: keyword/search term
  content?: string; // optional: creator ID or content identifier
}

export interface TrackingLink {
  url: string;
  utm_params: UTMParameters;
  short_code?: string;
  created_at: string;
}

/**
 * Generate UTM tracking URL
 */
export function generateUTMLink(baseUrl: string, params: UTMParameters): string {
  try {
    const url = new URL(baseUrl);

    // Add UTM parameters
    url.searchParams.set('utm_source', params.source);
    url.searchParams.set('utm_medium', params.medium);
    url.searchParams.set('utm_campaign', params.campaign);

    if (params.term) {
      url.searchParams.set('utm_term', params.term);
    }

    if (params.content) {
      url.searchParams.set('utm_content', params.content);
    }

    return url.toString();
  } catch (error) {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }
}

/**
 * Generate tracking link for a campaign + creator
 */
export function generateCampaignTrackingLink(
  productUrl: string,
  campaignId: string,
  creatorId: string,
  campaignTitle?: string
): TrackingLink {
  const params: UTMParameters = {
    source: 'affimark',
    medium: 'creator',
    campaign: campaignId,
    content: creatorId,
  };

  const url = generateUTMLink(productUrl, params);

  return {
    url,
    utm_params: params,
    created_at: new Date().toISOString(),
  };
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMParameters(url: string): UTMParameters | null {
  try {
    const parsedUrl = new URL(url);
    const params = parsedUrl.searchParams;

    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');

    if (!source || !medium || !campaign) {
      return null; // Not a valid UTM link
    }

    return {
      source,
      medium,
      campaign,
      term: params.get('utm_term') || undefined,
      content: params.get('utm_content') || undefined,
    };
  } catch (error) {
    return null;
  }
}

// =====================================================
// CONVERSION TRACKING
// =====================================================

export type ConversionEvent =
  | 'click'
  | 'page_view'
  | 'signup'
  | 'trial_start'
  | 'purchase'
  | 'subscription'
  | 'custom';

export interface ConversionData {
  event: ConversionEvent;
  campaign_id: string;
  creator_id?: string;

  // Value tracking
  revenue?: number; // For purchases
  currency?: string; // e.g., 'USD'

  // User tracking (anonymized)
  user_id?: string;
  session_id?: string;

  // Metadata
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;

  // Timestamp
  timestamp: string;
}

/**
 * Validate conversion event
 */
export function validateConversionEvent(data: Partial<ConversionData>): boolean {
  // Required fields
  if (!data.event || !data.campaign_id) {
    return false;
  }

  // Valid event type
  const validEvents: ConversionEvent[] = [
    'click',
    'page_view',
    'signup',
    'trial_start',
    'purchase',
    'subscription',
    'custom',
  ];

  if (!validEvents.includes(data.event)) {
    return false;
  }

  // Revenue must be positive if present
  if (data.revenue !== undefined && data.revenue < 0) {
    return false;
  }

  return true;
}

// =====================================================
// PERFORMANCE METRICS
// =====================================================

export interface PerformanceMetrics {
  campaign_id: string;
  creator_id?: string;

  // Traffic
  clicks: number;
  page_views: number;

  // Conversions
  signups: number;
  trials: number;
  purchases: number;
  subscriptions: number;

  // Financial
  total_revenue: number;
  currency: string;

  // Rates
  click_through_rate?: number; // impressions → clicks
  conversion_rate?: number; // clicks → purchases
  cost_per_acquisition?: number; // spend / conversions

  // ROI
  spend: number;
  roi?: number; // (revenue - spend) / spend * 100

  // Time period
  period_start: string;
  period_end: string;
}

/**
 * Calculate performance metrics from conversion events
 */
export function calculatePerformanceMetrics(
  events: ConversionData[],
  spend: number,
  periodStart: string,
  periodEnd: string
): PerformanceMetrics {
  const clicks = events.filter((e) => e.event === 'click').length;
  const pageViews = events.filter((e) => e.event === 'page_view').length;
  const signups = events.filter((e) => e.event === 'signup').length;
  const trials = events.filter((e) => e.event === 'trial_start').length;
  const purchases = events.filter((e) => e.event === 'purchase').length;
  const subscriptions = events.filter((e) => e.event === 'subscription').length;

  // Calculate total revenue
  const totalRevenue = events
    .filter((e) => e.revenue && e.revenue > 0)
    .reduce((sum, e) => sum + (e.revenue || 0), 0);

  // Calculate rates
  const conversionRate = clicks > 0 ? (purchases / clicks) * 100 : 0;
  const totalConversions = signups + purchases + subscriptions;
  const costPerAcquisition = totalConversions > 0 ? spend / totalConversions : 0;

  // Calculate ROI
  const roi = spend > 0 ? ((totalRevenue - spend) / spend) * 100 : 0;

  // Get campaign_id and creator_id from first event (all should be the same)
  const firstEvent = events[0];

  return {
    campaign_id: firstEvent?.campaign_id || '',
    creator_id: firstEvent?.creator_id,

    clicks,
    page_views: pageViews,
    signups,
    trials,
    purchases,
    subscriptions,

    total_revenue: totalRevenue,
    currency: firstEvent?.currency || 'USD',

    conversion_rate: conversionRate,
    cost_per_acquisition: costPerAcquisition,
    roi,

    spend,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

/**
 * Generate short tracking code (for URL shortening)
 */
export function generateShortCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
