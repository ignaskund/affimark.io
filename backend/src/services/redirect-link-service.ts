/**
 * Redirect Link Service
 *
 * Manages Affimark redirect links (affimark.io/go/xyz)
 * - Create redirect links with short codes
 * - Track clicks
 * - Auto-swap destinations when issues detected
 * - Provide analytics
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface CreateRedirectLinkParams {
  userId: string;
  destinationUrl: string;
  linkLabel?: string;
  productName?: string;
  merchantName?: string;
  affiliateNetwork?: string;
  fallbackUrl?: string;
  isAutopilotEnabled?: boolean;
}

interface RedirectLink {
  id: string;
  user_id: string;
  short_code: string;
  destination_url: string;
  original_url: string;
  fallback_url?: string;
  link_label?: string;
  product_name?: string;
  merchant_name?: string;
  affiliate_network?: string;
  is_active: boolean;
  is_autopilot_enabled: boolean;
  click_count: number;
  swap_count: number;
  last_clicked_at?: string;
  last_swapped_at?: string;
  last_swap_reason?: string;
  link_health_id?: string;
  created_at: string;
  updated_at: string;
}

interface SwapDestinationParams {
  redirectLinkId: string;
  newDestination: string;
  swapReason: 'stock_out' | 'broken_link' | 'better_commission' | 'manual';
  triggeredBy: 'system' | 'user' | 'auto';
  issueId?: string;
  estimatedRevenueImpact?: number;
}

interface ClickTrackingParams {
  redirectLinkId: string;
  userAgent?: string;
  ipAddress?: string;
  referer?: string;
  countryCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export class RedirectLinkService {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Create a new redirect link
   */
  async createRedirectLink(params: CreateRedirectLinkParams): Promise<RedirectLink> {
    // Generate short code via database function
    const { data: codeData, error: codeError } = await this.supabase
      .rpc('generate_short_code');

    if (codeError || !codeData) {
      throw new Error(`Failed to generate short code: ${codeError?.message}`);
    }

    const shortCode = codeData as string;

    // Create redirect link
    const { data, error } = await this.supabase
      .from('redirect_links')
      .insert({
        user_id: params.userId,
        short_code: shortCode,
        destination_url: params.destinationUrl,
        original_url: params.destinationUrl,
        fallback_url: params.fallbackUrl,
        link_label: params.linkLabel,
        product_name: params.productName,
        merchant_name: params.merchantName,
        affiliate_network: params.affiliateNetwork,
        is_autopilot_enabled: params.isAutopilotEnabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create redirect link: ${error.message}`);
    }

    return data as RedirectLink;
  }

  /**
   * Get redirect link by short code
   */
  async getByShortCode(shortCode: string): Promise<RedirectLink | null> {
    const { data, error } = await this.supabase
      .from('redirect_links')
      .select('*')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get redirect link: ${error.message}`);
    }

    return data as RedirectLink | null;
  }

  /**
   * Get all redirect links for a user
   */
  async getUserRedirectLinks(userId: string): Promise<RedirectLink[]> {
    const { data, error } = await this.supabase
      .from('redirect_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user redirect links: ${error.message}`);
    }

    return data as RedirectLink[];
  }

  /**
   * Track a click on a redirect link
   */
  async trackClick(shortCode: string, params: Partial<ClickTrackingParams> = {}): Promise<void> {
    // Get redirect link
    const link = await this.getByShortCode(shortCode);
    if (!link) {
      throw new Error('Redirect link not found');
    }

    // Record click
    const { error: clickError } = await this.supabase
      .from('redirect_link_clicks')
      .insert({
        redirect_link_id: link.id,
        destination_url: link.destination_url,
        user_agent: params.userAgent,
        ip_address: params.ipAddress,
        referer: params.referer,
        country_code: params.countryCode,
        utm_source: params.utmSource,
        utm_medium: params.utmMedium,
        utm_campaign: params.utmCampaign,
      });

    if (clickError) {
      console.error('Failed to record click:', clickError);
    }

    // Update click count and last_clicked_at
    const { error: updateError } = await this.supabase
      .from('redirect_links')
      .update({
        click_count: link.click_count + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    if (updateError) {
      console.error('Failed to update click count:', updateError);
    }
  }

  /**
   * Swap destination URL (auto-fix)
   */
  async swapDestination(params: SwapDestinationParams): Promise<void> {
    // Get current redirect link
    const { data: link, error: fetchError } = await this.supabase
      .from('redirect_links')
      .select('*')
      .eq('id', params.redirectLinkId)
      .single();

    if (fetchError || !link) {
      throw new Error(`Failed to fetch redirect link: ${fetchError?.message}`);
    }

    const oldDestination = link.destination_url;

    // Update destination
    const { error: updateError } = await this.supabase
      .from('redirect_links')
      .update({
        destination_url: params.newDestination,
        swap_count: link.swap_count + 1,
        last_swapped_at: new Date().toISOString(),
        last_swap_reason: params.swapReason,
      })
      .eq('id', params.redirectLinkId);

    if (updateError) {
      throw new Error(`Failed to update destination: ${updateError.message}`);
    }

    // Record swap in history
    const { error: historyError } = await this.supabase
      .from('redirect_link_swaps')
      .insert({
        redirect_link_id: params.redirectLinkId,
        old_destination: oldDestination,
        new_destination: params.newDestination,
        swap_reason: params.swapReason,
        triggered_by: params.triggeredBy,
        issue_id: params.issueId,
        estimated_revenue_impact: params.estimatedRevenueImpact,
      });

    if (historyError) {
      console.error('Failed to record swap history:', historyError);
    }
  }

  /**
   * Auto-swap to fallback URL if stock-out detected
   */
  async handleStockOutSwap(redirectLinkId: string, issueId: string): Promise<boolean> {
    const { data: link, error } = await this.supabase
      .from('redirect_links')
      .select('*')
      .eq('id', redirectLinkId)
      .single();

    if (error || !link) {
      return false;
    }

    // Check if autopilot is enabled
    if (!link.is_autopilot_enabled) {
      return false;
    }

    // Check if fallback URL exists
    if (!link.fallback_url) {
      return false;
    }

    // Swap to fallback
    await this.swapDestination({
      redirectLinkId,
      newDestination: link.fallback_url,
      swapReason: 'stock_out',
      triggeredBy: 'auto',
      issueId,
      estimatedRevenueImpact: 0, // Could calculate based on historical clicks
    });

    return true;
  }

  /**
   * Get click analytics for a redirect link
   */
  async getClickAnalytics(redirectLinkId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('redirect_link_clicks')
      .select('*')
      .eq('redirect_link_id', redirectLinkId)
      .gte('clicked_at', startDate.toISOString())
      .order('clicked_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get click analytics: ${error.message}`);
    }

    // Aggregate by day
    const clicksByDay: Record<string, number> = {};
    data?.forEach((click: any) => {
      const date = new Date(click.clicked_at).toISOString().split('T')[0];
      clicksByDay[date] = (clicksByDay[date] || 0) + 1;
    });

    return {
      totalClicks: data?.length || 0,
      clicksByDay,
      clicks: data,
    };
  }

  /**
   * Get swap history for a redirect link
   */
  async getSwapHistory(redirectLinkId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('redirect_link_swaps')
      .select('*')
      .eq('redirect_link_id', redirectLinkId)
      .order('swapped_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get swap history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Bulk create redirect links for onboarding
   */
  async bulkCreateFromLinks(
    userId: string,
    links: Array<{ url: string; label?: string; productName?: string }>
  ): Promise<RedirectLink[]> {
    const results: RedirectLink[] = [];

    for (const link of links) {
      try {
        const redirectLink = await this.createRedirectLink({
          userId,
          destinationUrl: link.url,
          linkLabel: link.label,
          productName: link.productName,
        });
        results.push(redirectLink);
      } catch (error) {
        console.error(`Failed to create redirect for ${link.url}:`, error);
      }
    }

    return results;
  }

  /**
   * Deactivate a redirect link
   */
  async deactivate(redirectLinkId: string): Promise<void> {
    const { error } = await this.supabase
      .from('redirect_links')
      .update({ is_active: false })
      .eq('id', redirectLinkId);

    if (error) {
      throw new Error(`Failed to deactivate redirect link: ${error.message}`);
    }
  }

  /**
   * Toggle autopilot for a redirect link
   */
  async toggleAutopilot(redirectLinkId: string, enabled: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('redirect_links')
      .update({ is_autopilot_enabled: enabled })
      .eq('id', redirectLinkId);

    if (error) {
      throw new Error(`Failed to toggle autopilot: ${error.message}`);
    }
  }
}
