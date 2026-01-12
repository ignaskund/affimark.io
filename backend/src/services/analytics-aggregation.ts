/**
 * Analytics Aggregation Service
 * Provides rollup stats and insights for creator shops
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ShopAnalytics {
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  total_commission: number;
  conversion_rate: number;
  average_order_value: number;
  clicks_by_day: Array<{ date: string; clicks: number }>;
  conversions_by_day: Array<{ date: string; conversions: number; revenue: number }>;
  top_products: Array<{
    product_id: string;
    product_name: string;
    clicks: number;
    conversions: number;
    revenue: number;
    conversion_rate: number;
  }>;
  underperforming_products: Array<{
    product_id: string;
    product_name: string;
    clicks: number;
    conversions: number;
    conversion_rate: number;
  }>;
}

export interface ProductAnalytics {
  product_id: string;
  product_name: string;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  total_commission: number;
  conversion_rate: number;
  average_order_value: number;
  clicks_by_day: Array<{ date: string; clicks: number }>;
  conversions_by_day: Array<{ date: string; conversions: number; revenue: number }>;
  clicks_by_source: Array<{ source: string; clicks: number }>;
  clicks_by_hour: Array<{ hour: number; clicks: number }>;
}

export interface TrendData {
  period: string; // 'daily' | 'weekly' | 'monthly'
  data: Array<{
    date: string;
    clicks: number;
    conversions: number;
    revenue: number;
    commission: number;
  }>;
}

export class AnalyticsAggregationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get shop-level analytics
   */
  async getShopAnalytics(
    userId: string,
    days: number = 30
  ): Promise<ShopAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total clicks
    const { count: totalClicks } = await this.supabase
      .from('tracked_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    // Get conversions
    const { data: conversions } = await this.supabase
      .from('conversion_events')
      .select('amount, commission, status')
      .eq('user_id', userId)
      .gte('transaction_date', startDate.toISOString());

    const approvedConversions = conversions?.filter(c => c.status === 'approved') || [];
    const totalConversions = approvedConversions.length;
    const totalRevenue = approvedConversions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCommission = approvedConversions.reduce((sum, c) => sum + (c.commission || 0), 0);
    const conversionRate = totalClicks ? (totalConversions / totalClicks) * 100 : 0;
    const averageOrderValue = totalConversions ? totalRevenue / totalConversions : 0;

    // Get clicks by day
    const { data: clicksByDay } = await this.supabase
      .from('tracked_clicks')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    const clicksByDayMap: Record<string, number> = {};
    clicksByDay?.forEach(click => {
      const date = new Date(click.created_at).toISOString().split('T')[0];
      clicksByDayMap[date] = (clicksByDayMap[date] || 0) + 1;
    });

    const clicksByDayArray = Object.entries(clicksByDayMap).map(([date, clicks]) => ({
      date,
      clicks,
    }));

    // Get conversions by day
    const conversionsByDayMap: Record<string, { conversions: number; revenue: number }> = {};
    approvedConversions.forEach(conv => {
      const date = new Date(conv.transaction_date || '').toISOString().split('T')[0];
      if (!conversionsByDayMap[date]) {
        conversionsByDayMap[date] = { conversions: 0, revenue: 0 };
      }
      conversionsByDayMap[date].conversions++;
      conversionsByDayMap[date].revenue += conv.amount || 0;
    });

    const conversionsByDayArray = Object.entries(conversionsByDayMap).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Get top products
    const { data: productClicks } = await this.supabase
      .from('tracked_clicks')
      .select(`
        inventory_item_id,
        inventory_item:inventory_item_id (
          product:product_id (
            id,
            product_name
          )
        )
      `)
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    const productStatsMap: Record<string, {
      product_id: string;
      product_name: string;
      clicks: number;
      conversions: number;
      revenue: number;
    }> = {};

    productClicks?.forEach((click: any) => {
      const product = click.inventory_item?.product;
      if (!product) return;

      const productId = product.id;
      if (!productStatsMap[productId]) {
        productStatsMap[productId] = {
          product_id: productId,
          product_name: product.product_name,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        };
      }
      productStatsMap[productId].clicks++;
    });

    // Match conversions to products
    const { data: conversionClicks } = await this.supabase
      .from('conversion_events')
      .select(`
        tracked_click:tracked_click_id (
          inventory_item:inventory_item_id (
            product:product_id (id)
          )
        ),
        amount
      `)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('transaction_date', startDate.toISOString());

    conversionClicks?.forEach((conv: any) => {
      const productId = conv.tracked_click?.inventory_item?.product?.id;
      if (productId && productStatsMap[productId]) {
        productStatsMap[productId].conversions++;
        productStatsMap[productId].revenue += conv.amount || 0;
      }
    });

    const topProducts = Object.values(productStatsMap)
      .map(p => ({
        ...p,
        conversion_rate: p.clicks ? (p.conversions / p.clicks) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Underperforming products (high clicks, low conversions)
    const underperformingProducts = Object.values(productStatsMap)
      .filter(p => p.clicks >= 10) // At least 10 clicks
      .map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        clicks: p.clicks,
        conversions: p.conversions,
        conversion_rate: p.clicks ? (p.conversions / p.clicks) * 100 : 0,
      }))
      .filter(p => p.conversion_rate < 2) // Less than 2% conversion
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    return {
      total_clicks: totalClicks || 0,
      total_conversions: totalConversions,
      total_revenue: totalRevenue,
      total_commission: totalCommission,
      conversion_rate: conversionRate,
      average_order_value: averageOrderValue,
      clicks_by_day: clicksByDayArray,
      conversions_by_day: conversionsByDayArray,
      top_products: topProducts,
      underperforming_products: underperformingProducts,
    };
  }

  /**
   * Get product-level analytics
   */
  async getProductAnalytics(
    userId: string,
    productId: string,
    days: number = 30
  ): Promise<ProductAnalytics | null> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get product info
    const { data: product } = await this.supabase
      .from('products')
      .select('id, product_name')
      .eq('id', productId)
      .single();

    if (!product) return null;

    // Get inventory item ID for this product
    const { data: inventoryItem } = await this.supabase
      .from('inventory_items')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (!inventoryItem) return null;

    // Get clicks for this product
    const { data: clicks } = await this.supabase
      .from('tracked_clicks')
      .select('created_at, referrer, user_agent')
      .eq('user_id', userId)
      .eq('inventory_item_id', inventoryItem.id)
      .gte('created_at', startDate.toISOString());

    const totalClicks = clicks?.length || 0;

    // Get conversions
    const { data: conversions } = await this.supabase
      .from('conversion_events')
      .select('transaction_date, amount, commission')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .in('tracked_click_id', (clicks || []).map((c: any) => c.id));

    const totalConversions = conversions?.length || 0;
    const totalRevenue = conversions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
    const totalCommission = conversions?.reduce((sum, c) => sum + (c.commission || 0), 0) || 0;
    const conversionRate = totalClicks ? (totalConversions / totalClicks) * 100 : 0;
    const averageOrderValue = totalConversions ? totalRevenue / totalConversions : 0;

    // Clicks by day
    const clicksByDayMap: Record<string, number> = {};
    clicks?.forEach(click => {
      const date = new Date(click.created_at).toISOString().split('T')[0];
      clicksByDayMap[date] = (clicksByDayMap[date] || 0) + 1;
    });

    const clicksByDay = Object.entries(clicksByDayMap).map(([date, clicks]) => ({
      date,
      clicks,
    }));

    // Conversions by day
    const conversionsByDayMap: Record<string, { conversions: number; revenue: number }> = {};
    conversions?.forEach(conv => {
      const date = new Date(conv.transaction_date || '').toISOString().split('T')[0];
      if (!conversionsByDayMap[date]) {
        conversionsByDayMap[date] = { conversions: 0, revenue: 0 };
      }
      conversionsByDayMap[date].conversions++;
      conversionsByDayMap[date].revenue += conv.amount || 0;
    });

    const conversionsByDay = Object.entries(conversionsByDayMap).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Clicks by source (referrer)
    const clicksBySourceMap: Record<string, number> = {};
    clicks?.forEach(click => {
      const source = this.extractSource(click.referrer);
      clicksBySourceMap[source] = (clicksBySourceMap[source] || 0) + 1;
    });

    const clicksBySource = Object.entries(clicksBySourceMap)
      .map(([source, clicks]) => ({ source, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    // Clicks by hour
    const clicksByHourMap: Record<number, number> = {};
    clicks?.forEach(click => {
      const hour = new Date(click.created_at).getHours();
      clicksByHourMap[hour] = (clicksByHourMap[hour] || 0) + 1;
    });

    const clicksByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      clicks: clicksByHourMap[hour] || 0,
    }));

    return {
      product_id: productId,
      product_name: product.product_name,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      total_revenue: totalRevenue,
      total_commission: totalCommission,
      conversion_rate: conversionRate,
      average_order_value: averageOrderValue,
      clicks_by_day: clicksByDay,
      conversions_by_day: conversionsByDay,
      clicks_by_source: clicksBySource,
      clicks_by_hour: clicksByHour,
    };
  }

  /**
   * Get trend data (daily, weekly, or monthly)
   */
  async getTrends(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    days: number = 90
  ): Promise<TrendData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all clicks and conversions
    const { data: clicks } = await this.supabase
      .from('tracked_clicks')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    const { data: conversions } = await this.supabase
      .from('conversion_events')
      .select('transaction_date, amount, commission, status')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('transaction_date', startDate.toISOString());

    // Aggregate by period
    const dataMap: Record<string, {
      clicks: number;
      conversions: number;
      revenue: number;
      commission: number;
    }> = {};

    clicks?.forEach(click => {
      const date = this.getPeriodKey(new Date(click.created_at), period);
      if (!dataMap[date]) {
        dataMap[date] = { clicks: 0, conversions: 0, revenue: 0, commission: 0 };
      }
      dataMap[date].clicks++;
    });

    conversions?.forEach(conv => {
      const date = this.getPeriodKey(new Date(conv.transaction_date || ''), period);
      if (!dataMap[date]) {
        dataMap[date] = { clicks: 0, conversions: 0, revenue: 0, commission: 0 };
      }
      dataMap[date].conversions++;
      dataMap[date].revenue += conv.amount || 0;
      dataMap[date].commission += conv.commission || 0;
    });

    const data = Object.entries(dataMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { period, data };
  }

  /**
   * Extract source from referrer URL
   */
  private extractSource(referrer?: string): string {
    if (!referrer) return 'Direct';

    try {
      const url = new URL(referrer);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Get period key for aggregation
   */
  private getPeriodKey(date: Date, period: 'daily' | 'weekly' | 'monthly'): string {
    if (period === 'daily') {
      return date.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return startOfWeek.toISOString().split('T')[0];
    } else {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}
