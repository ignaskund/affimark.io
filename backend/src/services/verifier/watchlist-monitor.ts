/**
 * Watchlist Monitor Service
 *
 * Cron-triggered service that monitors watchlist items for changes:
 * - Review sentiment changes
 * - Commission rate changes
 * - Policy/shipping changes
 * - New higher-ranked alternatives
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../index';
import { scrapeProductPage, type ScrapedProductData } from './page-scraper';
import { normalizeUrl } from './url-normalizer';
import { getBrandReputationWithCache } from '../reputation-scraper';

interface WatchlistItem {
  id: string;
  user_id: string;
  url: string;
  normalized_url: string | null;
  product_name: string;
  brand: string | null;
  merchant: string | null;
  category: string | null;
  last_snapshot: {
    scores: {
      product_viability: number;
      offer_merchant: number;
      economics_feasibility: number;
    };
    verdict: string;
    confidence: string;
  } | null;
  monitoring_config: {
    review_sentiment: boolean;
    commission_changes: boolean;
    policy_changes: boolean;
    better_alternatives: boolean;
  };
  last_checked_at: string | null;
}

interface AlertData {
  user_id: string;
  watchlist_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  previous_value: any;
  new_value: any;
}

/**
 * Main monitoring function - called by cron
 */
export async function runWatchlistMonitor(env: Env): Promise<{ checked: number; alerts: number }> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get items due for checking
  const { data: items, error } = await supabase
    .from('verifier_watchlist')
    .select('*')
    .eq('is_active', true)
    .lte('next_check_at', new Date().toISOString())
    .limit(50); // Process in batches

  if (error || !items || items.length === 0) {
    return { checked: 0, alerts: 0 };
  }

  let totalAlerts = 0;

  for (const item of items as WatchlistItem[]) {
    try {
      const alerts = await checkWatchlistItem(item, supabase, env);
      totalAlerts += alerts.length;

      // Insert alerts
      if (alerts.length > 0) {
        await supabase.from('verifier_alerts').insert(alerts);

        // Update alert count
        await supabase
          .from('verifier_watchlist')
          .update({
            alert_count: (item as any).alert_count + alerts.length,
          })
          .eq('id', item.id);
      }

      // Update last_checked and schedule next check
      await supabase
        .from('verifier_watchlist')
        .update({
          last_checked_at: new Date().toISOString(),
          next_check_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    } catch (err) {
      console.error(`Error checking watchlist item ${item.id}:`, err);
    }
  }

  return { checked: items.length, alerts: totalAlerts };
}

/**
 * Check a single watchlist item for changes
 */
async function checkWatchlistItem(
  item: WatchlistItem,
  supabase: SupabaseClient,
  env: Env
): Promise<AlertData[]> {
  const alerts: AlertData[] = [];
  const config = item.monitoring_config;

  // Scrape current product data
  const normalized = normalizeUrl(item.url);
  let currentData: ScrapedProductData;

  try {
    currentData = await scrapeProductPage(normalized.normalized, normalized.platform, env);
  } catch {
    // Scrape failed - could generate an alert for this too
    return alerts;
  }

  // Get previous snapshot
  const prevSnapshot = item.last_snapshot;
  if (!prevSnapshot) return alerts;

  // 1. Review Sentiment Changes
  if (config.review_sentiment && currentData.rating !== null) {
    const prevRating = estimatePreviousRating(prevSnapshot.scores.product_viability);

    if (currentData.rating !== null && prevRating !== null) {
      const ratingDelta = currentData.rating - prevRating;

      if (Math.abs(ratingDelta) >= 0.3) {
        alerts.push({
          user_id: item.user_id,
          watchlist_id: item.id,
          alert_type: 'review_sentiment_change',
          severity: ratingDelta < 0 ? 'warning' : 'info',
          title: ratingDelta > 0
            ? `${item.product_name} ratings improved`
            : `${item.product_name} ratings dropped`,
          description: `Rating changed from ~${prevRating.toFixed(1)} to ${currentData.rating.toFixed(1)}`,
          previous_value: { rating: prevRating },
          new_value: { rating: currentData.rating },
        });
      }
    }
  }

  // 2. Commission Changes
  if (config.commission_changes && item.brand) {
    const brandSlug = item.brand.toLowerCase().replace(/[^a-z0-9]/g, '');

    const { data: currentProgram } = await supabase
      .from('affiliate_programs')
      .select('commission_rate_low, commission_rate_high')
      .eq('brand_slug', brandSlug)
      .eq('is_active', true)
      .order('commission_rate_high', { ascending: false })
      .limit(1)
      .single();

    if (currentProgram) {
      // Check if economics score suggests significant commission change
      const currentAvg = (currentProgram.commission_rate_low + currentProgram.commission_rate_high) / 2;
      const estimatedPrevAvg = estimatePreviousCommission(prevSnapshot.scores.economics_feasibility);

      if (estimatedPrevAvg && Math.abs(currentAvg - estimatedPrevAvg) >= 1.5) {
        alerts.push({
          user_id: item.user_id,
          watchlist_id: item.id,
          alert_type: 'commission_change',
          severity: currentAvg > estimatedPrevAvg ? 'info' : 'warning',
          title: currentAvg > estimatedPrevAvg
            ? `Commission rate increased for ${item.brand}`
            : `Commission rate decreased for ${item.brand}`,
          description: `Now offering ${currentProgram.commission_rate_low}-${currentProgram.commission_rate_high}%`,
          previous_value: { estimated_avg: estimatedPrevAvg },
          new_value: { rate_low: currentProgram.commission_rate_low, rate_high: currentProgram.commission_rate_high },
        });
      }
    }
  }

  // 3. Availability Changes
  if (currentData.availability === 'out_of_stock') {
    alerts.push({
      user_id: item.user_id,
      watchlist_id: item.id,
      alert_type: 'availability_change',
      severity: 'critical',
      title: `${item.product_name} is out of stock`,
      description: 'Product is currently unavailable. Consider finding alternatives.',
      previous_value: { availability: 'in_stock' },
      new_value: { availability: 'out_of_stock' },
    });
  }

  // 4. Price Changes
  if (currentData.price.amount !== null) {
    // We don't have previous price stored directly, but significant changes might be worth flagging
    // This would need more sophisticated tracking
  }

  // 5. Better Alternatives
  if (config.better_alternatives && item.category) {
    const { data: betterPrograms } = await supabase
      .from('affiliate_programs')
      .select('brand_name, commission_rate_high, network')
      .eq('primary_category', item.category.toLowerCase())
      .eq('is_active', true)
      .neq('brand_slug', item.brand?.toLowerCase().replace(/[^a-z0-9]/g, '') || '')
      .gte('commission_rate_high', 10) // Only high-commission alternatives
      .order('commission_rate_high', { ascending: false })
      .limit(3);

    if (betterPrograms && betterPrograms.length > 0) {
      const bestAlt = betterPrograms[0];
      // Only alert if significantly better than current snapshot economics
      if (prevSnapshot.scores.economics_feasibility < 60 && bestAlt.commission_rate_high >= 10) {
        alerts.push({
          user_id: item.user_id,
          watchlist_id: item.id,
          alert_type: 'better_alternative',
          severity: 'info',
          title: `Better alternative found: ${bestAlt.brand_name}`,
          description: `${bestAlt.brand_name} offers up to ${bestAlt.commission_rate_high}% via ${bestAlt.network}`,
          previous_value: null,
          new_value: { brand: bestAlt.brand_name, rate: bestAlt.commission_rate_high },
        });
      }
    }
  }

  // Update snapshot with new data
  const newSnapshot = {
    scores: prevSnapshot.scores, // Keep same scores until full re-analysis
    verdict: prevSnapshot.verdict,
    confidence: prevSnapshot.confidence,
    last_rating: currentData.rating,
    last_availability: currentData.availability,
  };

  await supabase
    .from('verifier_watchlist')
    .update({ last_snapshot: newSnapshot })
    .eq('id', item.id);

  return alerts;
}

/**
 * Estimate previous rating from product viability score
 * This is a rough approximation
 */
function estimatePreviousRating(pvScore: number): number | null {
  // Reverse engineer from scoring formula:
  // review_sentiment (0-25): >4.5=25, >4.2=22, >4.0=20, >3.5=15, >3.0=10, >2.0=5, else=2
  // This is just an estimate
  if (pvScore >= 80) return 4.5;
  if (pvScore >= 70) return 4.2;
  if (pvScore >= 60) return 4.0;
  if (pvScore >= 50) return 3.5;
  if (pvScore >= 40) return 3.0;
  return 2.5;
}

/**
 * Estimate previous commission from economics score
 */
function estimatePreviousCommission(ecScore: number): number | null {
  // Rough estimation based on scoring formula
  if (ecScore >= 80) return 10;
  if (ecScore >= 65) return 7;
  if (ecScore >= 50) return 5;
  if (ecScore >= 35) return 3;
  return 2;
}
