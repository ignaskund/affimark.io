/**
 * Data Retention Service (GDPR Compliance)
 *
 * Automatically deletes expired data according to retention policies.
 * Provides user data deletion endpoint for GDPR Article 17 (right to erasure).
 *
 * Fix #9: Legal compliance for EU users
 */

// Retention policies (in days)
export const RETENTION_POLICIES = {
  'user_product_profiles': 730, // 2 years (core user data)
  'product_finder_sessions': 90, // 3 months (search history)
  'finder_chat_messages': 90, // 3 months (conversations)
  'saved_products': 365, // 1 year (user saved items)
  'social_context_analysis': 30, // 1 month (temporary cache)
  'user_operation_costs': 365, // 1 year (billing/analytics)
  'finder_implicit_feedback': 180, // 6 months (learning data)
} as const;

/**
 * Enforce retention policies - delete expired data
 *
 * Run this as a daily cron job
 */
export async function enforceRetentionPolicies(env: any): Promise<{
  deleted: Record<string, number>;
  errors: string[];
}> {
  console.log('[Retention] Starting retention policy enforcement');

  const deleted: Record<string, number> = {};
  const errors: string[] = [];

  for (const [table, retentionDays] of Object.entries(RETENTION_POLICIES)) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffISO = cutoffDate.toISOString();

      console.log(`[Retention] Processing ${table} (${retentionDays} days, cutoff: ${cutoffDate.toISOString().split('T')[0]})`);

      // Delete records older than retention period
      const { data, error, count } = await env.supabase
        .from(table)
        .delete({ count: 'exact' })
        .lt('created_at', cutoffISO);

      if (error) {
        console.error(`[Retention] Error deleting from ${table}:`, error);
        errors.push(`${table}: ${error.message}`);
      } else {
        const deletedCount = count || 0;
        deleted[table] = deletedCount;
        console.log(`[Retention] Deleted ${deletedCount} expired records from ${table}`);
      }
    } catch (err: any) {
      console.error(`[Retention] Exception for ${table}:`, err);
      errors.push(`${table}: ${err.message}`);
    }
  }

  console.log('[Retention] Enforcement complete', { deleted, errors });
  return { deleted, errors };
}

/**
 * Delete all user data (GDPR Article 17 - Right to Erasure)
 *
 * Called when user requests account deletion or data deletion
 */
export async function deleteAllUserData(
  userId: string,
  env: any
): Promise<{
  success: boolean;
  tablesDeleted: string[];
  errors: string[];
}> {
  console.log(`[Retention] Deleting all data for user ${userId}`);

  const tables = [
    'user_product_profiles',
    'product_finder_sessions',
    'finder_chat_messages',
    'saved_products',
    'social_context_analysis',
    'user_operation_costs',
    'finder_implicit_feedback',
    // Add more tables as needed
  ];

  const tablesDeleted: string[] = [];
  const errors: string[] = [];

  for (const table of tables) {
    try {
      const { error, count } = await env.supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (error) {
        console.error(`[Retention] Error deleting from ${table}:`, error);
        errors.push(`${table}: ${error.message}`);
      } else {
        tablesDeleted.push(table);
        console.log(`[Retention] Deleted ${count || 0} records from ${table}`);
      }
    } catch (err: any) {
      console.error(`[Retention] Exception for ${table}:`, err);
      errors.push(`${table}: ${err.message}`);
    }
  }

  const success = errors.length === 0;
  console.log(`[Retention] User data deletion ${success ? 'complete' : 'completed with errors'}`, {
    tablesDeleted,
    errors,
  });

  return { success, tablesDeleted, errors };
}

/**
 * Get data retention summary for user (GDPR Article 15 - Right of Access)
 */
export async function getUserDataSummary(
  userId: string,
  env: any
): Promise<Record<string, { count: number; oldestRecord: string | null }>> {
  const tables = Object.keys(RETENTION_POLICIES);
  const summary: Record<string, { count: number; oldestRecord: string | null }> = {};

  for (const table of tables) {
    try {
      // Get count
      const { count, error: countError } = await env.supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get oldest record
      const { data, error: dataError } = await env.supabase
        .from(table)
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);

      summary[table] = {
        count: count || 0,
        oldestRecord: data?.[0]?.created_at || null,
      };
    } catch (err) {
      summary[table] = { count: 0, oldestRecord: null };
    }
  }

  return summary;
}

/**
 * Anonymize user data instead of deleting (alternative to full deletion)
 *
 * Useful if you need to keep aggregate analytics but remove PII
 */
export async function anonymizeUserData(
  userId: string,
  env: any
): Promise<{ success: boolean; errors: string[] }> {
  console.log(`[Retention] Anonymizing data for user ${userId}`);

  const errors: string[] = [];
  const anonymousId = `anonymous_${Date.now()}`;

  // Replace user_id with anonymous ID in non-critical tables
  const tablesToAnonymize = [
    'user_operation_costs', // Keep for aggregate analytics
    'finder_implicit_feedback', // Keep for ML training
  ];

  for (const table of tablesToAnonymize) {
    try {
      const { error } = await env.supabase
        .from(table)
        .update({ user_id: anonymousId })
        .eq('user_id', userId);

      if (error) {
        errors.push(`${table}: ${error.message}`);
      }
    } catch (err: any) {
      errors.push(`${table}: ${err.message}`);
    }
  }

  // Delete from critical tables (profiles, sessions, etc.)
  const tablesToDelete = [
    'user_product_profiles',
    'product_finder_sessions',
    'finder_chat_messages',
    'saved_products',
    'social_context_analysis',
  ];

  for (const table of tablesToDelete) {
    try {
      const { error } = await env.supabase
        .from(table)
        .delete()
        .eq('user_id', userId);

      if (error) {
        errors.push(`${table}: ${error.message}`);
      }
    } catch (err: any) {
      errors.push(`${table}: ${err.message}`);
    }
  }

  return { success: errors.length === 0, errors };
}
