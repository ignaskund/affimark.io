/**
 * Conversion Sync Service
 * Polls affiliate networks for conversion data and matches to tracked clicks
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ConversionData {
  network_transaction_id: string;
  click_id?: string;
  order_id?: string;
  amount: number;
  currency: string;
  commission: number;
  commission_currency: string;
  status: 'pending' | 'approved' | 'rejected';
  transaction_date: string;
  merchant: string;
  product_name?: string;
}

export class ConversionSyncService {
  constructor(
    private supabase: SupabaseClient,
    private impactApiKey?: string,
    // Using Rainforest API key placeholder for Amazon conversions (optional)
    private rainforestApiKey?: string
  ) {}

  /**
   * Sync conversions from all configured networks
   */
  async syncAllNetworks(userId: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let synced = 0;

    // Sync Impact.com conversions
    if (this.impactApiKey) {
      try {
        const impactResults = await this.syncImpactConversions(userId);
        synced += impactResults;
      } catch (error) {
        errors.push(`Impact.com sync failed: ${error}`);
      }
    }

    // Sync Amazon Associates conversions (via Rainforest key if provided)
    if (this.rainforestApiKey) {
      try {
        const amazonResults = await this.syncAmazonConversions(userId);
        synced += amazonResults;
      } catch (error) {
        errors.push(`Amazon sync failed: ${error}`);
      }
    }

    // Sync other networks as needed
    // TODO: Add B&H Photo, BestBuy, Walmart affiliate APIs

    return { synced, errors };
  }

  /**
   * Sync conversions from Impact.com
   */
  private async syncImpactConversions(userId: string): Promise<number> {
    if (!this.impactApiKey) {
      throw new Error('Impact.com API key not configured');
    }

    // Get user's Impact.com account ID from merchant_credentials
    const { data: credentials } = await this.supabase
      .from('merchant_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('merchant_id', (await this.getMerchantId('impact')))
      .single();

    if (!credentials?.credentials?.account_id) {
      throw new Error('Impact.com account not connected');
    }

    const accountId = credentials.credentials.account_id;

    // Fetch conversions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const response = await fetch(
      `https://api.impact.com/Mediapartners/${accountId}/Actions`,
      {
        headers: {
          Authorization: `Bearer ${this.impactApiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Impact.com API error: ${response.status}`);
    }

    const data = await response.json();
    const conversions: ConversionData[] = data.Actions?.map((action: any) => ({
      network_transaction_id: action.Id,
      click_id: action.ClickId,
      order_id: action.OrderId,
      amount: parseFloat(action.Amount || '0'),
      currency: action.Currency || 'USD',
      commission: parseFloat(action.Payout || '0'),
      commission_currency: action.PayoutCurrency || 'USD',
      status: this.mapImpactStatus(action.State),
      transaction_date: action.EventDate,
      merchant: action.CampaignName,
      product_name: action.ProductName,
    })) || [];

    // Save conversions to database
    let syncedCount = 0;
    for (const conversion of conversions) {
      const saved = await this.saveConversion(userId, conversion, 'impact');
      if (saved) syncedCount++;
    }

    return syncedCount;
  }

  /**
   * Sync conversions from Amazon Associates
   * Note: Amazon doesn't provide a real-time API, this is a placeholder
   */
  private async syncAmazonConversions(userId: string): Promise<number> {
    if (!this.rainforestApiKey) {
      throw new Error('Amazon/Rainforest API key not configured');
    }

    // Amazon Associates doesn't provide conversion API access
    // This would require manual CSV upload or scraping (not recommended)
    // For now, return 0 and rely on manual import

    console.log('[ConversionSync] Amazon manual import required');
    return 0;
  }

  /**
   * Save conversion to database and match to tracked click
   */
  private async saveConversion(
    userId: string,
    conversion: ConversionData,
    network: string
  ): Promise<boolean> {
    try {
      // Check if conversion already exists
      const { data: existing } = await this.supabase
        .from('conversion_events')
        .select('id')
        .eq('network_transaction_id', conversion.network_transaction_id)
        .single();

      if (existing) {
        console.log(`[ConversionSync] Conversion ${conversion.network_transaction_id} already exists`);
        return false;
      }

      // Try to match conversion to tracked click
      let trackedClickId: string | null = null;

      if (conversion.click_id) {
        const { data: click } = await this.supabase
          .from('tracked_clicks')
          .select('id')
          .eq('click_id', conversion.click_id)
          .eq('user_id', userId)
          .single();

        trackedClickId = click?.id || null;
      }

      // If no direct match, try fuzzy matching by timestamp + product
      if (!trackedClickId && conversion.product_name) {
        const conversionDate = new Date(conversion.transaction_date);
        const windowStart = new Date(conversionDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before

        const { data: recentClicks } = await this.supabase
          .from('tracked_clicks')
          .select('id, inventory_item_id, created_at')
          .eq('user_id', userId)
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', conversionDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        // Try to match by product name similarity
        for (const click of recentClicks || []) {
          const { data: inventoryItem } = await this.supabase
            .from('inventory_items')
            .select('product:product_id(product_name)')
            .eq('id', click.inventory_item_id)
            .single();

          const productName = (inventoryItem?.product as any)?.product_name || '';
          if (this.similarStrings(productName, conversion.product_name)) {
            trackedClickId = click.id;
            break;
          }
        }
      }

      // Insert conversion event
      const { error } = await this.supabase
        .from('conversion_events')
        .insert({
          tracked_click_id: trackedClickId,
          user_id: userId,
          network_transaction_id: conversion.network_transaction_id,
          order_id: conversion.order_id,
          amount: conversion.amount,
          currency: conversion.currency,
          commission: conversion.commission,
          commission_currency: conversion.commission_currency,
          status: conversion.status,
          transaction_date: conversion.transaction_date,
          network,
          metadata: {
            merchant: conversion.merchant,
            product_name: conversion.product_name,
            matched: !!trackedClickId,
          },
        });

      if (error) {
        console.error('[ConversionSync] Insert error:', error);
        return false;
      }

      console.log(`[ConversionSync] Saved conversion ${conversion.network_transaction_id}`);
      return true;
    } catch (error) {
      console.error('[ConversionSync] Save error:', error);
      return false;
    }
  }

  /**
   * Map Impact.com status to our status enum
   */
  private mapImpactStatus(impactState: string): 'pending' | 'approved' | 'rejected' {
    const state = impactState?.toLowerCase() || '';
    if (state.includes('approved')) return 'approved';
    if (state.includes('rejected') || state.includes('reversed')) return 'rejected';
    return 'pending';
  }

  /**
   * Get merchant ID by slug
   */
  private async getMerchantId(slug: string): Promise<string> {
    const { data } = await this.supabase
      .from('merchants')
      .select('id')
      .eq('merchant_slug', slug)
      .single();

    return data?.id || '';
  }

  /**
   * Simple string similarity check
   */
  private similarStrings(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const aNorm = normalize(a);
    const bNorm = normalize(b);

    // Check if one contains the other
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
      return true;
    }

    // Check word overlap
    const aWords = aNorm.split(/\s+/);
    const bWords = bNorm.split(/\s+/);
    const overlap = aWords.filter(w => bWords.includes(w)).length;

    return overlap >= Math.min(aWords.length, bWords.length) * 0.5;
  }

  /**
   * Manual conversion import from CSV
   */
  async importConversionsFromCSV(
    userId: string,
    csvContent: string,
    network: string
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      // Expected columns: transaction_id, order_id, amount, currency, commission, date, product
      const requiredColumns = ['transaction_id', 'amount', 'commission', 'date'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const conversion: ConversionData = {
          network_transaction_id: row.transaction_id,
          order_id: row.order_id,
          amount: parseFloat(row.amount || '0'),
          currency: row.currency || 'USD',
          commission: parseFloat(row.commission || '0'),
          commission_currency: row.commission_currency || row.currency || 'USD',
          status: (row.status as any) || 'approved',
          transaction_date: row.date,
          merchant: row.merchant || network,
          product_name: row.product,
        };

        const saved = await this.saveConversion(userId, conversion, network);
        if (saved) {
          imported++;
        } else {
          errors.push(`Row ${i + 1}: Failed to import or already exists`);
        }
      }

      return { imported, errors };
    } catch (error) {
      return { imported, errors: [`CSV parse error: ${error}`] };
    }
  }
}
