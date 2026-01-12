/**
 * Schedule Check Cron Worker
 * 
 * Checks for scheduled destination overrides in SmartWrappers
 */

import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export async function handleScheduleCheck(env: Env): Promise<void> {
  console.log('🕐 Running schedule check...');
  
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    
    const now = new Date().toISOString();
    
    // Find scheduled overrides that should now be active
    const { data: scheduledOverrides, error } = await supabase
      .from('waterfall_destinations')
      .select('*')
      .lte('schedule_start', now)
      .or(`schedule_end.is.null,schedule_end.gte.${now}`)
      .eq('is_active', false);
    
    if (error) {
      console.error('Error fetching scheduled overrides:', error);
      return;
    }
    
    // Activate scheduled overrides
    for (const override of scheduledOverrides || []) {
      await supabase
        .from('waterfall_destinations')
        .update({ is_active: true })
        .eq('id', override.id);
      
      console.log(`✅ Activated scheduled override: ${override.id}`);
    }
    
    // Find overrides that should now be deactivated
    const { data: expiredOverrides } = await supabase
      .from('waterfall_destinations')
      .select('*')
      .lt('schedule_end', now)
      .eq('is_active', true);
    
    for (const override of expiredOverrides || []) {
      await supabase
        .from('waterfall_destinations')
        .update({ is_active: false })
        .eq('id', override.id);
      
      console.log(`⏹️ Deactivated expired override: ${override.id}`);
    }
    
    console.log('✅ Schedule check completed');
    
  } catch (error) {
    console.error('Schedule check failed:', error);
  }
}

