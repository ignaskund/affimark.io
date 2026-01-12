/**
 * Health Check Cron Worker
 *
 * Runs every 5 minutes to check destination health
 * Updates smartwrapper_destinations.health_status
 *
 * Trigger: GET /cron/health-check
 * Schedule: Every 5 minutes (cron: 0,5,10,15,20,25,30,35,40,45,50,55 * * * *)
 */

import { Env } from '../index';
import { createClient } from '@supabase/supabase-js';
import { HealthChecker } from '../services/health-checker';

export async function handleHealthCheck(env: Env) {
  console.log('🏥 Health Check Cron started');
  const startTime = Date.now();

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get all active destinations that haven't been checked recently
    // (or never checked)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: destinations, error } = await supabase
      .from('smartwrapper_destinations')
      .select(`
        id,
        destination_url,
        affiliate_tag,
        smartwrapper_id,
        redirect_links!inner (
          user_id,
          is_active
        )
      `)
      .eq('redirect_links.is_active', true)
      .or(`last_health_check_at.is.null,last_health_check_at.lt.${fiveMinutesAgo}`)
      .limit(100); // Limit to 100 checks per run to avoid timeout

    if (error) {
      throw error;
    }

    console.log(`Found ${destinations?.length || 0} destinations to check`);

    if (!destinations || destinations.length === 0) {
      console.log('✅ No destinations to check');
      return;
    }

    const healthChecker = new HealthChecker(supabase);
    let healthyCount = 0;
    let unhealthyCount = 0;

    // Check each destination
    for (const dest of destinations) {
      try {
        const result = await healthChecker.checkUrl(dest.destination_url, {
          expectedAffiliateTag: dest.affiliate_tag || undefined,
          timeout: 10000,
        });

        // Update destination health status
        await supabase
          .from('smartwrapper_destinations')
          .update({
            health_status: result.healthStatus,
            last_health_check_at: new Date().toISOString(),
          })
          .eq('id', dest.id);

        if (result.isHealthy) {
          healthyCount++;
        } else {
          unhealthyCount++;
          console.warn(
            `⚠️  Unhealthy destination: ${dest.destination_url} - ${result.healthStatus}`,
            result.evidence
          );
        }
      } catch (error: any) {
        console.error(`Error checking ${dest.destination_url}:`, error.message);
        unhealthyCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Health Check Complete: ${healthyCount} healthy, ${unhealthyCount} unhealthy (${duration}ms)`
    );
  } catch (error: any) {
    console.error('Health Check Cron error:', error);
    throw error;
  }
}
