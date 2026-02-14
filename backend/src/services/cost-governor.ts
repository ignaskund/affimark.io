/**
 * Cost Governor Service
 *
 * Prevents budget overruns by:
 * - Tracking operation costs per user
 * - Enforcing daily/monthly budgets
 * - Gracefully degrading to cheaper modes when approaching limits
 *
 * Fix #8: Prevents unpredictable bills from power users
 */

interface CostBudget {
  dailyBudgetUSD: number;
  monthlyBudgetUSD: number;
}

interface CostUsage {
  dailyUsed: number;
  monthlyUsed: number;
  remainingDaily: number;
  remainingMonthly: number;
}

interface BudgetCheck {
  allowed: boolean;
  degradeMode?: 'cached' | 'cheap' | 'minimal';
  message?: string;
  remainingBudget?: number;
}

// Operation cost estimates (in USD)
export const OPERATION_COSTS = {
  // Search operations
  'search_full': 0.025, // Full Datafeedr + AI analysis + outcome scoring
  'search_cached': 0.001, // Use cached profile
  'search_rerank': 0.005, // Rerank existing results with new context

  // AI operations
  'ai_analysis_haiku': 0.003, // Claude Haiku (lightweight analysis)
  'ai_analysis_sonnet': 0.015, // Claude Sonnet (chat, complex analysis)
  'ai_chat_message': 0.008, // Agent chat message

  // Profile operations
  'profile_build_full': 0.050, // Full profile build with social analysis
  'profile_build_cached': 0.001, // Use cached profile
  'profile_refresh_social': 0.015, // Refresh social context
  'profile_refresh_storefront': 0.010, // Refresh storefront context

  // Outcome scoring
  'outcome_feasibility_check': 0.002, // Per product outcome check
} as const;

type OperationType = keyof typeof OPERATION_COSTS;

// Budget tiers by user plan
const BUDGET_TIERS: Record<string, CostBudget> = {
  'free': {
    dailyBudgetUSD: 0.10, // $0.10/day = ~$3/month
    monthlyBudgetUSD: 3.00,
  },
  'pro': {
    dailyBudgetUSD: 0.50, // $0.50/day = ~$15/month
    monthlyBudgetUSD: 15.00,
  },
  'enterprise': {
    dailyBudgetUSD: 5.00, // $5/day = ~$150/month
    monthlyBudgetUSD: 150.00,
  },
};

/**
 * Check if operation is allowed within budget
 */
export async function checkBudget(
  userId: string,
  operationType: OperationType,
  env: any
): Promise<BudgetCheck> {
  const estimatedCost = OPERATION_COSTS[operationType];
  const budget = getUserBudget(userId, env); // TODO: Get from user plan
  const usage = await getUserUsage(userId, env);

  console.log(`[Cost Governor] ${userId} - ${operationType} (est: $${estimatedCost.toFixed(4)})`);
  console.log(`[Cost Governor] Daily: $${usage.dailyUsed.toFixed(4)}/$${budget.dailyBudgetUSD.toFixed(2)} | Monthly: $${usage.monthlyUsed.toFixed(4)}/$${budget.monthlyBudgetUSD.toFixed(2)}`);

  // Hard limit: Daily budget exceeded
  if (usage.remainingDaily < estimatedCost) {
    console.warn(`[Cost Governor] BLOCKED - Daily budget exceeded`);
    return {
      allowed: false,
      message: 'Daily cost budget exceeded. Try again tomorrow or upgrade your plan.',
      remainingBudget: usage.remainingDaily,
    };
  }

  // Hard limit: Monthly budget exceeded
  if (usage.remainingMonthly < estimatedCost) {
    console.warn(`[Cost Governor] BLOCKED - Monthly budget exceeded`);
    return {
      allowed: false,
      message: 'Monthly cost budget exceeded. Upgrade your plan for more capacity.',
      remainingBudget: usage.remainingMonthly,
    };
  }

  // Soft limit: Approaching daily budget → degrade to cached mode
  if (usage.remainingDaily < estimatedCost * 3) {
    console.log(`[Cost Governor] DEGRADED - Approaching daily limit, using cached mode`);
    return {
      allowed: true,
      degradeMode: 'cached',
      message: 'Using cached data to stay within budget',
      remainingBudget: usage.remainingDaily,
    };
  }

  // Soft limit: Approaching monthly budget → degrade to cheap mode
  if (usage.remainingMonthly < estimatedCost * 10) {
    console.log(`[Cost Governor] DEGRADED - Approaching monthly limit, using cheap mode`);
    return {
      allowed: true,
      degradeMode: 'cheap',
      message: 'Using cost-optimized mode',
      remainingBudget: usage.remainingMonthly,
    };
  }

  // All clear
  return { allowed: true, remainingBudget: usage.remainingDaily };
}

/**
 * Log operation cost for tracking
 */
export async function logOperationCost(
  userId: string,
  operationType: OperationType,
  metadata: {
    tokensUsed?: number;
    modelUsed?: string;
    sessionId?: string;
  },
  env: any
): Promise<void> {
  const costEstimate = OPERATION_COSTS[operationType];
  const today = new Date().toISOString().split('T')[0];

  try {
    // Insert into cost tracking table
    const { error } = await env.supabase
      .from('user_operation_costs')
      .insert({
        user_id: userId,
        operation_type: operationType,
        operation_date: today,
        cost_estimate_usd: costEstimate,
        tokens_used: metadata.tokensUsed || 0,
        model_used: metadata.modelUsed || '',
        session_id: metadata.sessionId,
      });

    if (error) {
      console.error('[Cost Governor] Failed to log cost:', error);
    } else {
      console.log(`[Cost Governor] Logged $${costEstimate.toFixed(4)} for ${operationType}`);
    }
  } catch (err) {
    console.error('[Cost Governor] Error logging cost:', err);
  }
}

/**
 * Get user's cost budget based on plan
 */
function getUserBudget(userId: string, env: any): CostBudget {
  // TODO: Fetch from user's plan in database
  // For now, default to 'free' tier
  return BUDGET_TIERS['free'];
}

/**
 * Get user's current usage (daily and monthly)
 */
async function getUserUsage(userId: string, env: any): Promise<CostUsage> {
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().split('T')[0];

  try {
    // Get daily usage
    const { data: dailyData, error: dailyError } = await env.supabase
      .from('user_operation_costs')
      .select('cost_estimate_usd')
      .eq('user_id', userId)
      .eq('operation_date', today);

    const dailyUsed = dailyData?.reduce((sum: number, row: any) => sum + (parseFloat(row.cost_estimate_usd) || 0), 0) || 0;

    // Get monthly usage
    const { data: monthlyData, error: monthlyError } = await env.supabase
      .from('user_operation_costs')
      .select('cost_estimate_usd')
      .eq('user_id', userId)
      .gte('operation_date', monthStart);

    const monthlyUsed = monthlyData?.reduce((sum: number, row: any) => sum + (parseFloat(row.cost_estimate_usd) || 0), 0) || 0;

    const budget = getUserBudget(userId, env);

    return {
      dailyUsed,
      monthlyUsed,
      remainingDaily: Math.max(0, budget.dailyBudgetUSD - dailyUsed),
      remainingMonthly: Math.max(0, budget.monthlyBudgetUSD - monthlyUsed),
    };
  } catch (err) {
    console.error('[Cost Governor] Error fetching usage:', err);
    // Fail open (allow operation) rather than fail closed
    return {
      dailyUsed: 0,
      monthlyUsed: 0,
      remainingDaily: 999,
      remainingMonthly: 999,
    };
  }
}

/**
 * Get cost breakdown for user (for analytics/billing)
 */
export async function getCostBreakdown(
  userId: string,
  startDate: string,
  endDate: string,
  env: any
): Promise<{
  totalCost: number;
  byOperationType: Record<string, number>;
  byDate: Record<string, number>;
}> {
  const { data, error } = await env.supabase
    .from('user_operation_costs')
    .select('*')
    .eq('user_id', userId)
    .gte('operation_date', startDate)
    .lte('operation_date', endDate);

  if (error || !data) {
    return { totalCost: 0, byOperationType: {}, byDate: {} };
  }

  const totalCost = data.reduce((sum, row) => sum + parseFloat(row.cost_estimate_usd || 0), 0);

  const byOperationType: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  for (const row of data) {
    const cost = parseFloat(row.cost_estimate_usd || 0);

    // By operation type
    byOperationType[row.operation_type] = (byOperationType[row.operation_type] || 0) + cost;

    // By date
    byDate[row.operation_date] = (byDate[row.operation_date] || 0) + cost;
  }

  return { totalCost, byOperationType, byDate };
}
