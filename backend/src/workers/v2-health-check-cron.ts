/**
 * V2 Health Check Cron Worker (Creator Ops Platform)
 *
 * Monitors tracked_products for stock/health issues
 * Populates revenue_loss_ledger when problems detected
 * Updates platform_reliability_stats
 * Triggers auto-fallback for SmartWrappers if enabled
 *
 * Trigger: GET /cron/v2-health-check
 * Schedule: Every 30 minutes
 */

import { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

interface HealthCheckResult {
  isHealthy: boolean;
  stockStatus: 'in_stock' | 'out_of_stock' | 'unknown';
  healthStatus: 'healthy' | 'broken_link' | 'out_of_stock' | 'redirect_error' | 'missing_tag';
  statusCode?: number;
  evidence?: string;
  affiliateTagPresent?: boolean;
}

export async function handleV2HealthCheck(env: Env) {
  console.log('🏥 V2 Health Check Cron started');
  const startTime = Date.now();

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get all tracked products that need checking
    // Check products not checked in last 30 minutes OR never checked
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('alert_enabled', true)
      .or(`last_checked.is.null,last_checked.lt.${thirtyMinutesAgo}`)
      .limit(200); // Process 200 products per run

    if (error) {
      throw error;
    }

    console.log(`Found ${products?.length || 0} products to check`);

    if (!products || products.length === 0) {
      console.log('✅ No products to check');
      return;
    }

    let healthyCount = 0;
    let issuesDetected = 0;

    for (const product of products) {
      try {
        const result = await checkProductHealth(product.product_url, env);

        const previousStatus = product.health_status;
        const newStatus = result.healthStatus;

        // Update product health
        await supabase
          .from('tracked_products')
          .update({
            stock_status: result.stockStatus,
            health_status: newStatus,
            last_checked: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (result.isHealthy) {
          healthyCount++;

          // If product recovered, mark ledger entry as resolved
          if (previousStatus !== 'healthy' && previousStatus !== 'unknown') {
            await resolveRevenueLossEntry(supabase, product.id, product.user_id);
          }
        } else {
          issuesDetected++;

          // If NEW issue (wasn't broken before), create loss ledger entry
          if (previousStatus === 'healthy' || previousStatus === 'unknown') {
            await createRevenueLossEntry(
              supabase,
              product.id,
              product.user_id,
              newStatus,
              result.evidence || 'Health check detected issue'
            );

            // Trigger auto-fallback if enabled for linked SmartWrappers
            if (product.auto_fallback_enabled && product.fallback_search_url) {
              await activateFallback(supabase, product.id);
            }
          }

          console.warn(
            `⚠️ Issue detected: ${product.product_name || product.product_url} - ${newStatus}`,
            result.evidence
          );
        }

        // Update platform reliability stats
        await updatePlatformStats(
          supabase,
          product.user_id,
          product.platform,
          result.isHealthy
        );
      } catch (error: any) {
        console.error(`Error checking product ${product.id}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ V2 Health Check Complete: ${healthyCount} healthy, ${issuesDetected} issues (${duration}ms)`
    );
  } catch (error: any) {
    console.error('V2 Health Check Cron error:', error);
    throw error;
  }
}

/**
 * Check product health (stock status, link validity, affiliate tag)
 */
async function checkProductHealth(
  url: string,
  env: Env
): Promise<HealthCheckResult> {
  try {
    // Follow redirect chain to final destination
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const statusCode = response.status;

    // Check for broken links (404, 500, etc.)
    if (statusCode >= 400) {
      return {
        isHealthy: false,
        stockStatus: 'unknown',
        healthStatus: 'broken_link',
        statusCode,
        evidence: `HTTP ${statusCode}`,
      };
    }

    // If it's a redirect, follow it
    let finalUrl = url;
    if (statusCode >= 300 && statusCode < 400) {
      const location = response.headers.get('location');
      if (location) {
        finalUrl = location.startsWith('http')
          ? location
          : new URL(location, url).toString();
      }
    }

    // Check for affiliate tag presence
    const affiliateTagPresent = checkAffiliateTag(finalUrl);

    // Fetch final page to check stock status
    let stockStatus: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
    let healthStatus: 'healthy' | 'broken_link' | 'out_of_stock' | 'redirect_error' | 'missing_tag' = 'healthy';

    try {
      const finalResponse = await fetch(finalUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (finalResponse.ok) {
        const html = await finalResponse.text();

        // Check for out of stock indicators
        const oosPatterns = [
          /out of stock/i,
          /sold out/i,
          /unavailable/i,
          /not available/i,
          /currently unavailable/i,
          /temporarily out of stock/i,
          /aktuell nicht verfügbar/i, // German
          /nicht auf Lager/i, // German
          /épuisé/i, // French
          /non disponible/i, // French
        ];

        const isOutOfStock = oosPatterns.some((pattern) => pattern.test(html));

        if (isOutOfStock) {
          stockStatus = 'out_of_stock';
          healthStatus = 'out_of_stock';
        } else {
          // Look for "Add to Cart" or similar to confirm in stock
          const inStockPatterns = [
            /add to cart/i,
            /in den warenkorb/i, // German
            /ajouter au panier/i, // French
            /añadir a la cesta/i, // Spanish
            /buy now/i,
            /jetzt kaufen/i, // German
          ];

          const hasAddToCart = inStockPatterns.some((pattern) =>
            pattern.test(html)
          );

          if (hasAddToCart) {
            stockStatus = 'in_stock';
          }
        }
      }
    } catch (fetchError) {
      console.error('Error fetching final URL:', fetchError);
    }

    // If affiliate tag missing, mark as issue
    if (!affiliateTagPresent && stockStatus !== 'out_of_stock') {
      healthStatus = 'missing_tag';
    }

    // Determine overall health
    const isHealthy =
      stockStatus !== 'out_of_stock' &&
      healthStatus !== 'broken_link' &&
      healthStatus !== 'missing_tag';

    return {
      isHealthy,
      stockStatus,
      healthStatus,
      statusCode,
      affiliateTagPresent,
      evidence: !isHealthy
        ? `Stock: ${stockStatus}, Tag: ${affiliateTagPresent ? 'present' : 'missing'}`
        : undefined,
    };
  } catch (error: any) {
    return {
      isHealthy: false,
      stockStatus: 'unknown',
      healthStatus: 'redirect_error',
      evidence: error.message,
    };
  }
}

/**
 * Check if URL contains affiliate tracking parameters
 */
function checkAffiliateTag(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const affiliateParams = [
      'tag',
      'ref',
      'aff',
      'aid',
      'affiliate',
      'partner',
      'tracking',
      'affid',
      'subid',
    ];

    return affiliateParams.some((param) => urlObj.searchParams.has(param));
  } catch {
    return false;
  }
}

/**
 * Create revenue loss ledger entry
 */
async function createRevenueLossEntry(
  supabase: any,
  productId: string,
  userId: string,
  issueType: string,
  evidence: string
) {
  // Estimate potential loss based on typical EPC (conservative: €0.50-€1.50 per click)
  // Assume average 10-20 clicks per day per product
  const estimatedClicksLow = 10;
  const estimatedClicksHigh = 20;
  const estimatedLossLow = estimatedClicksLow * 0.5;
  const estimatedLossHigh = estimatedClicksHigh * 1.5;

  await supabase.from('revenue_loss_ledger').insert({
    user_id: userId,
    tracked_product_id: productId,
    issue_type: issueType,
    detected_at: new Date().toISOString(),
    estimated_clicks_low: estimatedClicksLow,
    estimated_clicks_high: estimatedClicksHigh,
    estimated_loss_low: estimatedLossLow,
    estimated_loss_high: estimatedLossHigh,
  });

  console.log(
    `📊 Created revenue loss entry for product ${productId}: ${issueType}`
  );
}

/**
 * Resolve revenue loss ledger entry when product recovers
 */
async function resolveRevenueLossEntry(
  supabase: any,
  productId: string,
  userId: string
) {
  // Find most recent unresolved entry
  const { data: entries } = await supabase
    .from('revenue_loss_ledger')
    .select('*')
    .eq('tracked_product_id', productId)
    .is('resolved_at', null)
    .order('detected_at', { ascending: false })
    .limit(1);

  if (entries && entries.length > 0) {
    const entry = entries[0];
    const detectedAt = new Date(entry.detected_at);
    const resolvedAt = new Date();
    const durationHours =
      (resolvedAt.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);

    await supabase
      .from('revenue_loss_ledger')
      .update({
        resolved_at: resolvedAt.toISOString(),
        duration_hours: durationHours,
        resolution_type: 'auto_recovered',
      })
      .eq('id', entry.id);

    console.log(
      `✅ Resolved revenue loss entry for product ${productId} after ${durationHours.toFixed(1)} hours`
    );
  }
}

/**
 * Activate fallback for SmartWrappers linked to this product
 */
async function activateFallback(supabase: any, productId: string) {
  // Find SmartWrappers pointing to this product
  const { data: smartwrappers } = await supabase
    .from('smartwrappers')
    .select('id, short_code')
    .eq('tracked_product_id', productId)
    .eq('auto_fallback_enabled', true)
    .eq('fallback_active', false);

  if (smartwrappers && smartwrappers.length > 0) {
    for (const sw of smartwrappers) {
      await supabase
        .from('smartwrappers')
        .update({ fallback_active: true })
        .eq('id', sw.id);

      console.log(
        `🔄 Activated fallback for SmartWrapper ${sw.short_code}`
      );
    }
  }
}

/**
 * Update platform reliability stats
 */
async function updatePlatformStats(
  supabase: any,
  userId: string,
  platform: string | null,
  isHealthy: boolean
) {
  if (!platform) return;

  const today = new Date().toISOString().split('T')[0];

  // Upsert daily platform stats
  const { data: existing } = await supabase
    .from('platform_reliability_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('date', today)
    .single();

  if (existing) {
    // Update existing record
    await supabase
      .from('platform_reliability_stats')
      .update({
        total_checks: existing.total_checks + 1,
        successful_checks: existing.successful_checks + (isHealthy ? 1 : 0),
        uptime_percentage:
          ((existing.successful_checks + (isHealthy ? 1 : 0)) /
            (existing.total_checks + 1)) *
          100,
      })
      .eq('id', existing.id);
  } else {
    // Create new record
    await supabase.from('platform_reliability_stats').insert({
      user_id: userId,
      platform,
      date: today,
      total_checks: 1,
      successful_checks: isHealthy ? 1 : 0,
      uptime_percentage: isHealthy ? 100 : 0,
    });
  }
}
