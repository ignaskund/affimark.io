/**
 * Waterfall Routing Engine
 * 
 * Routes SmartWrapper traffic through priority chain with <100ms latency.
 * Order of checks:
 * 1. Active schedule (time-based override)
 * 2. Active A/B test (traffic splitting)
 * 3. Waterfall through priorities (health-checked)
 * 4. Fail-safe URL
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { preserveParams } from './param-preserver';

interface RouteResult {
  destinationUrl: string;
  priorityUsed: number;
  routingReason: 'primary' | 'fallback' | 'scheduled' | 'ab_test' | 'failsafe';
  responseTimeMs: number;
}

interface Destination {
  id: string;
  priority: number;
  destination_url: string;
  health_status: string;
  last_health_check_at: string | null;
}

export class WaterfallRouter {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Route a click through the SmartWrapper waterfall
   * MUST complete in <100ms for good UX
   */
  async route(shortCode: string, incomingUrl: string): Promise<RouteResult> {
    const startTime = Date.now();

    // 1. Lookup SmartWrapper
    const { data: smartwrapper, error } = await this.supabase
      .from('redirect_links')
      .select('*')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (error || !smartwrapper) {
      throw new Error(`SmartWrapper not found: ${shortCode}`);
    }

    // 2. Check for active schedule (priority override)
    const activeSchedule = await this.getActiveSchedule(smartwrapper.id);
    if (activeSchedule) {
      return {
        destinationUrl: preserveParams(incomingUrl, activeSchedule.destination_url),
        priorityUsed: 0,
        routingReason: 'scheduled',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // 3. Check for active A/B test
    const abTest = await this.getActiveAbTest(smartwrapper.id);
    if (abTest) {
      const variant = this.selectVariant(abTest);
      const destinationUrl = variant === 'a' ? abTest.variant_a_url : abTest.variant_b_url;
      
      // Increment click count (async, don't wait)
      this.incrementAbTestClicks(abTest.id, variant).catch(console.error);

      return {
        destinationUrl: preserveParams(incomingUrl, destinationUrl),
        priorityUsed: 0,
        routingReason: 'ab_test',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // 4. Waterfall through priority chain
    const destinations = await this.getDestinations(smartwrapper.id);

    for (const dest of destinations) {
      // Use destination if:
      // - Status is healthy
      // - Status is unknown (give it a try)
      // - Cache is fresh enough (avoid re-checking on every click)
      if (this.isHealthy(dest)) {
        return {
          destinationUrl: preserveParams(incomingUrl, dest.destination_url),
          priorityUsed: dest.priority,
          routingReason: dest.priority === 1 ? 'primary' : 'fallback',
          responseTimeMs: Date.now() - startTime,
        };
      }
    }

    // 5. All priorities failed - use fallback_url or original_url
    const failsafeUrl = smartwrapper.fallback_url || smartwrapper.original_url;

    return {
      destinationUrl: preserveParams(incomingUrl, failsafeUrl),
      priorityUsed: 999,
      routingReason: 'failsafe',
      responseTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get active schedule for SmartWrapper
   */
  private async getActiveSchedule(smartwrapperId: string): Promise<any | null> {
    const { data } = await this.supabase
      .rpc('get_active_schedule', { p_smartwrapper_id: smartwrapperId });

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Get active A/B test
   */
  private async getActiveAbTest(smartwrapperId: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('smartwrapper_id', smartwrapperId)
      .eq('status', 'running')
      .maybeSingle();

    return data;
  }

  /**
   * Select variant based on weights
   */
  private selectVariant(abTest: any): 'a' | 'b' {
    const random = Math.random() * 100;
    return random < abTest.variant_a_weight ? 'a' : 'b';
  }

  /**
   * Increment A/B test click count
   */
  private async incrementAbTestClicks(testId: string, variant: 'a' | 'b') {
    const field = variant === 'a' ? 'variant_a_clicks' : 'variant_b_clicks';
    
    await this.supabase.rpc('increment', {
      table_name: 'ab_tests',
      row_id: testId,
      field_name: field,
    });
  }

  /**
   * Get destinations ordered by priority
   */
  private async getDestinations(smartwrapperId: string): Promise<Destination[]> {
    const { data } = await this.supabase
      .rpc('get_healthy_destinations', { p_smartwrapper_id: smartwrapperId });

    return data || [];
  }

  /**
   * Check if destination is healthy based on cached status
   */
  private isHealthy(dest: Destination): boolean {
    // If explicitly marked as healthy, use it
    if (dest.health_status === 'healthy') {
      return true;
    }

    // If status is unknown or null, give it a try
    if (!dest.health_status || dest.health_status === 'unknown') {
      return true;
    }

    // If status is broken/out_of_stock, check cache age
    // Primary: re-check if cache > 5 min old
    // Backup: re-check if cache > 1 hour old
    if (dest.health_status === 'broken' || dest.health_status === 'out_of_stock') {
      if (!dest.last_health_check_at) {
        return true; // Never checked, try it
      }

      const cacheAge = Date.now() - new Date(dest.last_health_check_at).getTime();
      const maxAge = dest.priority === 1 ? 5 * 60 * 1000 : 60 * 60 * 1000;

      // If cache is stale, optimistically try it (health check will update later)
      return cacheAge > maxAge;
    }

    return false;
  }
}
