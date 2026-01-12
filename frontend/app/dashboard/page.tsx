import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import RevenueHeroWidget from '@/components/dashboard/RevenueHeroWidget';
import QuickActionsGrid from '@/components/dashboard/QuickActionsGrid';
import UpliftAlert from '@/components/dashboard/UpliftAlert';
import InsightsPanel from '@/components/dashboard/InsightsPanel';
import StorefrontBreakdownCard from '@/components/dashboard/StorefrontBreakdownCard';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ArrowRight, Clock, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch user preferences for currency
  const { data: userPreferences } = await supabase
    .from('user_creator_preferences')
    .select('home_currency')
    .eq('user_id', user.id)
    .single();

  const currency = userPreferences?.home_currency || 'EUR';

  // Get date ranges
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  // Fetch earnings data
  const { data: currentPeriodEarnings } = await supabase.rpc('get_total_earnings', {
    p_user_id: user.id,
    p_start_date: thirtyDaysAgo.toISOString().split('T')[0],
    p_end_date: today.toISOString().split('T')[0],
  });

  const { data: growthData } = await supabase.rpc('get_earnings_growth', {
    p_user_id: user.id,
  });

  // Fetch storefronts
  const { data: topStorefronts } = await supabase.rpc('get_top_storefronts', {
    p_user_id: user.id,
    p_limit: 5,
  });

  // Fetch open issues count
  const { count: issuesCount } = await supabase
    .from('link_health_issues')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'open');

  // Fetch pending optimization suggestions
  const { data: optimizationSuggestions, count: suggestionsCount } = await supabase
    .from('link_optimizations')
    .select('potential_gain_low, potential_gain_high', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  // Calculate potential uplift
  const potentialUplift = optimizationSuggestions?.reduce(
    (sum, s) => sum + ((s.potential_gain_low || 0) + (s.potential_gain_high || 0)) / 2,
    0
  ) || 0;

  // Fetch completed actions (revenue protected simulation)
  const { count: resolvedCount } = await supabase
    .from('link_audit_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', thirtyDaysAgo.toISOString());

  // Simulate revenue protected (in real app, sum from loss ledger)
  const revenueProtected = (resolvedCount || 0) * 42; // Average €42 per resolved issue

  const totalEarnings = currentPeriodEarnings?.[0]?.total_commission_eur || 0;
  const growthRate = growthData?.[0]?.growth_rate || 0;

  // Check if new user (no connected accounts)
  const { count: accountsCount } = await supabase
    .from('connected_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isNewUser = (accountsCount || 0) === 0;

  // New user welcome screen
  if (isNewUser) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-8 shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to AffiMark
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-lg mx-auto">
            Let's set up your revenue HQ in under 2 minutes
          </p>

          <div className="grid gap-4 max-w-md mx-auto mb-12">
            <Link
              href="/onboarding/magic"
              className="btn-primary py-4 text-lg group"
            >
              <Sparkles className="w-5 h-5" />
              Import from Linktree / Beacons
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/dashboard/storefronts"
              className="btn-secondary py-4"
            >
              Upload CSV Manually
            </Link>
          </div>

          <div className="glass-card p-6 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              What you'll get access to:
            </p>
            <ul className="text-sm text-left space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Unified earnings across all platforms</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Smart link optimization suggestions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Broken link detection & auto-fix</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>One-click tax export with EU presets</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Your creator revenue at a glance
        </p>
      </div>

      {/* Uplift Alert (if suggestions available) */}
      {potentialUplift > 0 && (
        <UpliftAlert
          potentialUplift={potentialUplift}
          linkCount={suggestionsCount || 0}
          currency={currency}
        />
      )}

      {/* Revenue Hero Widget */}
      <RevenueHeroWidget
        totalEarnings={totalEarnings}
        growthRate={growthRate}
        revenueProtected={revenueProtected}
        potentialUplift={potentialUplift}
        currency={currency}
      />

      {/* Quick Actions */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
          Quick Actions
        </h2>
        <QuickActionsGrid />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {/* Left Column - Storefronts */}
        <div className="lg:col-span-2">
          <StorefrontBreakdownCard
            storefronts={topStorefronts || []}
            totalEarnings={totalEarnings}
            currency={currency}
          />
        </div>

        {/* Right Column - Insights */}
        <div>
          <InsightsPanel
            topProduct={undefined}
            urgentIssues={issuesCount || 0}
            weeklyTrend={growthRate}
          />
        </div>
      </div>

      {/* Issues Summary (if any) */}
      {(issuesCount || 0) > 0 && (
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {issuesCount} issue{issuesCount !== 1 ? 's' : ''} need{issuesCount === 1 ? 's' : ''} attention
                </p>
                <p className="text-sm text-muted-foreground">
                  Click to review and resolve link health issues
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/revenue-loss"
              className="btn-secondary text-sm"
            >
              View Issues
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
          </div>
        </div>

        <div className="text-center py-8 text-muted-foreground">
          <p>Activity feed coming soon</p>
          <p className="text-sm mt-1">Track imports, link changes, and earnings updates</p>
        </div>
      </div>
    </div>
  );
}
