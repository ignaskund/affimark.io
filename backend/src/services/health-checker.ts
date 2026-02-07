/**
 * SmartWrapper Health Checker
 *
 * Monitors destination URLs for:
 * - HTTP availability (200 OK vs 404/500)
 * - Stock status (in stock, out of stock, unavailable)
 * - Affiliate tag presence
 * - Destination drift (product page vs homepage redirect)
 *
 * Used by cron workers to update smartwrapper_destinations.health_status
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface HealthCheckResult {
  url: string;
  isHealthy: boolean;
  healthStatus: 'healthy' | 'out_of_stock' | 'broken' | 'tag_missing' | 'unknown';
  httpStatus: number | null;
  responseTimeMs: number;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'unknown';
  hasAffiliateTag: boolean;
  destinationChanged: boolean;
  errorMessage?: string;
  evidence?: string[];
}

export class HealthChecker {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Check health of a single destination URL
   */
  async checkUrl(
    url: string,
    options: {
      expectedAffiliateTag?: string;
      originalFingerprint?: string;
      timeout?: number;
    } = {}
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 10000; // 10s default

    try {
      // Fetch URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AffimarkBot/1.0 (Link Health Monitor; +https://affimark.com/bot)',
        },
      });

      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - startTime;
      const httpStatus = response.status;

      // Check if URL is broken
      if (httpStatus >= 400) {
        return {
          url,
          isHealthy: false,
          healthStatus: 'broken',
          httpStatus,
          responseTimeMs,
          hasAffiliateTag: false,
          destinationChanged: false,
          errorMessage: `HTTP ${httpStatus}`,
          evidence: [`Returned HTTP ${httpStatus}`],
        };
      }

      // Get page HTML
      const html = await response.text();
      const finalUrl = response.url; // After redirects

      // Check stock status
      const stockStatus = this.detectStockStatus(html);
      const evidence: string[] = [];

      // Check affiliate tag
      const hasAffiliateTag = options.expectedAffiliateTag
        ? finalUrl.includes(options.expectedAffiliateTag) || url.includes(options.expectedAffiliateTag)
        : true; // If no expected tag provided, assume healthy

      if (!hasAffiliateTag && options.expectedAffiliateTag) {
        evidence.push(`Missing affiliate tag: ${options.expectedAffiliateTag}`);
      }

      // Check destination drift
      const currentFingerprint = this.generateFingerprint(html, finalUrl);
      const destinationChanged = options.originalFingerprint
        ? currentFingerprint !== options.originalFingerprint
        : false;

      if (destinationChanged) {
        evidence.push('Page content or structure changed significantly');
      }

      // Determine overall health status
      let healthStatus: HealthCheckResult['healthStatus'] = 'healthy';
      let isHealthy = true;

      if (stockStatus === 'out_of_stock') {
        healthStatus = 'out_of_stock';
        isHealthy = false;
        evidence.push('Product appears to be out of stock');
      } else if (!hasAffiliateTag) {
        healthStatus = 'tag_missing';
        isHealthy = false;
      } else if (destinationChanged) {
        healthStatus = 'broken';
        isHealthy = false;
      }

      return {
        url,
        isHealthy,
        healthStatus,
        httpStatus,
        responseTimeMs,
        stockStatus,
        hasAffiliateTag,
        destinationChanged,
        evidence: evidence.length > 0 ? evidence : undefined,
      };
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;

      return {
        url,
        isHealthy: false,
        healthStatus: 'broken',
        httpStatus: null,
        responseTimeMs,
        hasAffiliateTag: false,
        destinationChanged: false,
        errorMessage: error.message,
        evidence: [`Network error: ${error.message}`],
      };
    }
  }

  /**
   * Detect stock status from page HTML
   * Looks for common "out of stock" indicators
   */
  private detectStockStatus(html: string): 'in_stock' | 'out_of_stock' | 'unknown' {
    const lowerHtml = html.toLowerCase();

    // Out of stock indicators
    const outOfStockPhrases = [
      'out of stock',
      'sold out',
      'unavailable',
      'currently unavailable',
      'not available',
      'no longer available',
      'out-of-stock',
      'soldout',
      'stock: 0',
      'inventory: 0',
    ];

    for (const phrase of outOfStockPhrases) {
      if (lowerHtml.includes(phrase)) {
        return 'out_of_stock';
      }
    }

    // In stock indicators
    const inStockPhrases = [
      'add to cart',
      'add to bag',
      'buy now',
      'in stock',
      'available now',
      'ships today',
      'free shipping',
    ];

    for (const phrase of inStockPhrases) {
      if (lowerHtml.includes(phrase)) {
        return 'in_stock';
      }
    }

    return 'unknown';
  }

  /**
   * Generate fingerprint of page for drift detection
   * Uses title, main heading, and product ID patterns
   */
  private generateFingerprint(html: string, url: string): string {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);

    // Extract product ID from URL (common patterns)
    const productIdMatch = url.match(/\/(?:product|item|dp|p)\/([A-Z0-9]+)/i);

    const components = [
      titleMatch ? titleMatch[1].substring(0, 100) : '',
      h1Match ? h1Match[1].substring(0, 100) : '',
      productIdMatch ? productIdMatch[1] : '',
      url.split('?')[0].substring(0, 100), // URL path without params
    ];

    // Simple hash
    const combined = components.join('||');
    return this.simpleHash(combined);
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check health of all destinations for a SmartWrapper
   */
  async checkSmartWrapper(smartwrapperId: string): Promise<void> {
    // Get all destinations for this SmartWrapper
    const { data: destinations, error } = await this.supabase
      .from('smartwrapper_destinations')
      .select('*')
      .eq('smartwrapper_id', smartwrapperId);

    if (error || !destinations) {
      console.error('Failed to get destinations:', error);
      return;
    }

    // Check each destination
    for (const dest of destinations) {
      const result = await this.checkUrl(dest.destination_url, {
        expectedAffiliateTag: dest.affiliate_tag || undefined,
        timeout: 15000,
      });

      // Update destination health status
      await this.supabase
        .from('smartwrapper_destinations')
        .update({
          health_status: result.healthStatus,
          last_health_check_at: new Date().toISOString(),
        })
        .eq('id', dest.id);

      console.log(
        `Checked ${dest.destination_url}: ${result.healthStatus} (${result.responseTimeMs}ms)`
      );
    }
  }

  /**
   * Check health of all destinations for a user
   */
  async checkUserDestinations(userId: string, limit: number = 100): Promise<void> {
    // Get user's SmartWrappers
    const { data: smartwrappers, error } = await this.supabase
      .from('redirect_links')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(limit);

    if (error || !smartwrappers) {
      console.error('Failed to get SmartWrappers:', error);
      return;
    }

    // Check each SmartWrapper
    for (const sw of smartwrappers) {
      await this.checkSmartWrapper(sw.id);
    }
  }
}
