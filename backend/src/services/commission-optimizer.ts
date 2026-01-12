/**
 * Commission Optimizer Service
 *
 * Analyzes SmartWrappers to find better commission opportunities
 * Suggests switching to retailers with higher commission rates
 *
 * Features:
 * - Compare commission rates across retailers for same product
 * - Suggest better affiliate programs
 * - Calculate potential revenue gain
 * - Alert users to optimization opportunities
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface CommissionOpportunity {
  smartwrapperId: string;
  currentRetailer: string;
  currentCommission: number;
  suggestedRetailer: string;
  suggestedCommission: number;
  estimatedMonthlyGain: number;
  productName: string;
  reasoning: string;
}

export class CommissionOptimizer {
  constructor(private supabase: SupabaseClient) {}

  // Known commission rates by retailer (in production, would be scraped/updated regularly)
  private commissionRates: { [key: string]: { [key: string]: number } } = {
    amazon: {
      electronics: 4.0,
      home: 3.0,
      fashion: 10.0,
      beauty: 8.0,
      default: 4.0,
    },
    target: {
      electronics: 1.0,
      home: 1.0,
      fashion: 8.0,
      beauty: 5.0,
      default: 1.0,
    },
    walmart: {
      electronics: 1.0,
      home: 4.0,
      fashion: 1.0,
      beauty: 1.0,
      default: 1.0,
    },
    bestbuy: {
      electronics: 1.0,
      home: 0.5,
      default: 1.0,
    },
    'shopify-store': {
      default: 10.0, // Varies by store
    },
  };

  /**
   * Analyze a SmartWrapper for commission optimization opportunities
   */
  async analyzeSmartWrapper(smartwrapperId: string): Promise<CommissionOpportunity | null> {
    try {
      // Get SmartWrapper with destinations
      const { data: smartwrapper, error } = await this.supabase
        .from('redirect_links')
        .select(`
          id,
          product_name,
          click_count,
          smartwrapper_destinations (
            id,
            priority,
            retailer,
            commission_rate,
            destination_url
          )
        `)
        .eq('id', smartwrapperId)
        .single();

      if (error || !smartwrapper) {
        return null;
      }

      // Get primary destination (priority 1)
      const destinations = smartwrapper.smartwrapper_destinations as any[];
      const primary = destinations.find((d) => d.priority === 1);

      if (!primary || !primary.retailer) {
        return null;
      }

      const currentRetailer = primary.retailer.toLowerCase();
      const currentCommission = primary.commission_rate || 0;

      // Detect product category
      const category = this.detectCategory(smartwrapper.product_name);

      // Find better commission opportunities
      const betterOptions = this.findBetterOptions(currentRetailer, category, currentCommission);

      if (betterOptions.length === 0) {
        return null;
      }

      // Get best option
      const best = betterOptions[0];

      // Estimate monthly gain
      const monthlyClicks = this.estimateMonthlyClicks(smartwrapper.click_count || 0);
      const avgOrderValue = 50; // Assume $50 average order value
      const conversionRate = 0.03; // 3% conversion rate

      const currentMonthlyRevenue = monthlyClicks * conversionRate * avgOrderValue * (currentCommission / 100);
      const potentialMonthlyRevenue = monthlyClicks * conversionRate * avgOrderValue * (best.commission / 100);
      const estimatedGain = potentialMonthlyRevenue - currentMonthlyRevenue;

      // Only suggest if gain is meaningful (>$10/month)
      if (estimatedGain < 10) {
        return null;
      }

      return {
        smartwrapperId,
        currentRetailer: primary.retailer,
        currentCommission,
        suggestedRetailer: best.retailer,
        suggestedCommission: best.commission,
        estimatedMonthlyGain: parseFloat(estimatedGain.toFixed(2)),
        productName: smartwrapper.product_name || 'Unknown',
        reasoning: `${best.retailer} offers ${best.commission}% commission for ${category} products vs ${currentCommission}% at ${primary.retailer}`,
      };
    } catch (error) {
      console.error('Commission analysis error:', error);
      return null;
    }
  }

  /**
   * Find retailers with better commission rates
   */
  private findBetterOptions(
    currentRetailer: string,
    category: string,
    currentCommission: number
  ): Array<{ retailer: string; commission: number }> {
    const options: Array<{ retailer: string; commission: number }> = [];

    for (const [retailer, rates] of Object.entries(this.commissionRates)) {
      if (retailer === currentRetailer) continue;

      const commission = rates[category] || rates.default || 0;

      if (commission > currentCommission) {
        options.push({ retailer, commission });
      }
    }

    // Sort by commission descending
    return options.sort((a, b) => b.commission - a.commission);
  }

  /**
   * Detect product category from product name
   */
  private detectCategory(productName: string | null): string {
    if (!productName) return 'default';

    const lower = productName.toLowerCase();

    if (
      lower.includes('laptop') ||
      lower.includes('phone') ||
      lower.includes('camera') ||
      lower.includes('tv') ||
      lower.includes('headphones')
    ) {
      return 'electronics';
    }

    if (
      lower.includes('dress') ||
      lower.includes('shoes') ||
      lower.includes('jacket') ||
      lower.includes('shirt')
    ) {
      return 'fashion';
    }

    if (
      lower.includes('makeup') ||
      lower.includes('skincare') ||
      lower.includes('perfume') ||
      lower.includes('beauty')
    ) {
      return 'beauty';
    }

    if (
      lower.includes('furniture') ||
      lower.includes('decor') ||
      lower.includes('kitchen') ||
      lower.includes('bedding')
    ) {
      return 'home';
    }

    return 'default';
  }

  /**
   * Estimate monthly clicks from total clicks
   */
  private estimateMonthlyClicks(totalClicks: number): number {
    // Assume clicks have been accumulating for ~30 days average
    // In production, would use actual date ranges
    return Math.max(totalClicks, 10); // Minimum 10 clicks/month for estimation
  }

  /**
   * Analyze all SmartWrappers for a user and generate alerts
   */
  async analyzeUserSmartWrappers(userId: string): Promise<CommissionOpportunity[]> {
    try {
      // Get all active SmartWrappers
      const { data: smartwrappers } = await this.supabase
        .from('redirect_links')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!smartwrappers) return [];

      const opportunities: CommissionOpportunity[] = [];

      for (const sw of smartwrappers) {
        const opportunity = await this.analyzeSmartWrapper(sw.id);
        if (opportunity) {
          opportunities.push(opportunity);

          // Save as commission alert
          await this.createCommissionAlert(userId, opportunity);
        }
      }

      return opportunities;
    } catch (error) {
      console.error('User analysis error:', error);
      return [];
    }
  }

  /**
   * Create commission alert in database
   */
  private async createCommissionAlert(
    userId: string,
    opportunity: CommissionOpportunity
  ): Promise<void> {
    try {
      await this.supabase.from('commission_alerts').insert({
        user_id: userId,
        smartwrapper_id: opportunity.smartwrapperId,
        current_retailer: opportunity.currentRetailer,
        current_commission: opportunity.currentCommission,
        suggested_retailer: opportunity.suggestedRetailer,
        suggested_commission: opportunity.suggestedCommission,
        estimated_monthly_gain: opportunity.estimatedMonthlyGain,
        status: 'pending',
      });
    } catch (error) {
      console.error('Create alert error:', error);
    }
  }

  /**
   * Get commission rate for a retailer and category
   */
  getCommissionRate(retailer: string, category: string = 'default'): number {
    const rates = this.commissionRates[retailer.toLowerCase()];
    if (!rates) return 0;
    return rates[category] || rates.default || 0;
  }

  /**
   * Update commission rate (admin function)
   */
  async updateCommissionRate(
    retailer: string,
    category: string,
    rate: number
  ): Promise<void> {
    try {
      await this.supabase.from('commission_rates').upsert({
        retailer: retailer.toLowerCase(),
        category,
        commission_rate: rate,
        source: 'manual',
        last_updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update commission rate error:', error);
    }
  }
}
