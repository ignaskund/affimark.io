import { supabaseServer } from '@/lib/supabase-server'; // Admin client
import { auth } from '@/lib/auth';
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
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect('/sign-in');
  }

  // Use Admin client directly since we are using NextAuth and trust the session
  const supabase = supabaseServer;

  // Fetch user profile to check onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, onboarding_completed')
    .eq('id', user.id)
    .single();

  // If onboarding not completed, redirect to magic onboarding
  if (!profile?.onboarding_completed) {
    redirect('/onboarding/magic');
  }

  // Get date ranges
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  // Platform display configuration
  const platformConfig: Record<string, { displayName: string; icon: string }> = {
    amazon: { displayName: 'Amazon Storefront', icon: 'Ã°Å¸â€ºÂÃ¯Â¸Â' },
    ltk: { displayName: 'LTK', icon: 'Ã°Å¸â€™â€ž' },
    shopmy: { displayName: 'ShopMy', icon: 'Ã°Å¸â€ºâ€™' },
    awin: { displayName: 'Awin', icon: 'Ã°Å¸â€â€”' },
  };

  // Parallelize all independent database queries
  const [
    { data: userPreferences },
    { data: currentPeriodEarnings },
    { data: growthData },
    { data: importedStorefronts },
    { count: issuesCount },
    { data: optimizationSuggestions, count: suggestionsCount },
    { count: resolvedCount },
    { count: accountsCount },
    { count: storefrontCount }
  ] = await Promise.all([
    // Fetch user preferences for currency
    supabase
      .from('user_creator_preferences')
      .select('home_currency')
      .eq('user_id', user.id)
      .single(),

    // Fetch earnings data
    supabase.rpc('get_total_earnings', {
      p_user_id: user.id,
      p_start_date: thirtyDaysAgo.toISOString().split('T')[0],
      p_end_date: today.toISOString().split('T')[0],
    }),

    supabase.rpc('get_earnings_growth', {
      p_user_id: user.id,
    }),

    // Fetch imported storefronts from user_storefronts table
    supabase
      .from('user_storefronts')
      .select('id, platform, display_name, icon, storefront_url, sync_status, last_synced_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    // Fetch open issues count
    supabase
      .from('link_health_issues')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'open'),

    // Fetch pending optimization suggestions
    supabase
      .from('link_optimizations')
      .select('potential_gain_low, potential_gain_high', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', 'pending'),

    // Fetch completed actions (revenue protected simulation)
    supabase
      .from('link_audit_actions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo.toISOString()),

    // Check connected accounts count (for earnings tracking)
    supabase
      .from('connected_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true),

    // Check imported storefronts count
    supabase
      .from('user_storefronts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
  ]);

  // Get product counts and top products for each storefront
  const storefrontIds = (importedStorefronts || []).map(s => s.id);
  let productCounts: Record<string, number> = {};
  let storefrontProducts: Record<string, any[]> = {};

  if (storefrontIds.length > 0) {
    // Get all products for these storefronts
    const { data: allProducts } = await supabase
      .from('user_storefront_products')
      .select('storefront_id, title, image_url, current_price')
      .in('storefront_id', storefrontIds)
      .order('created_at', { ascending: false });

    // Group products by storefront
    (allProducts || []).forEach(p => {
      productCounts[p.storefront_id] = (productCounts[p.storefront_id] || 0) + 1;
      if (!storefrontProducts[p.storefront_id]) {
        storefrontProducts[p.storefront_id] = [];
      }
      if (storefrontProducts[p.storefront_id].length < 5) {
        storefrontProducts[p.storefront_id].push({
          title: p.title,
          imageUrl: p.image_url,
          price: p.current_price ? `Ã¢â€šÂ¬${p.current_price.toFixed(2)}` : null,
        });
      }
    });
  }

  // Transform storefronts data for the component
  const formattedStorefronts = (importedStorefronts || []).map(s => {
    const config = platformConfig[s.platform] || {
      displayName: s.display_name || s.platform,
      icon: s.icon || 'Ã°Å¸â€â€”'
    };
    return {
      id: s.id,
      platform: s.platform,
      displayName: s.display_name || config.displayName,
      icon: s.icon || config.icon,
      storefrontUrl: s.storefront_url,
      productCount: productCounts[s.id] || 0,
      lastSynced: s.last_synced_at,
      syncStatus: s.sync_status,
      topProducts: storefrontProducts[s.id] || [],
    };
  });

  const totalProducts = Object.values(productCounts).reduce((sum, count) => sum + count, 0);

  const currency = userPreferences?.home_currency || 'EUR';

  // Calculate potential uplift
  const potentialUplift = optimizationSuggestions?.reduce(
    (sum, s) => sum + ((s.potential_gain_low || 0) + (s.potential_gain_high || 0)) / 2,
    0
  ) || 0;

  // Simulate revenue protected (in real app, sum from loss ledger)
  const revenueProtected = (resolvedCount || 0) * 42; // Average Ã¢â€šÂ¬42 per resolved issue

  const totalEarnings = currentPeriodEarnings?.[0]?.total_commission_eur || 0;
  const growthRate = growthData?.[0]?.growth_rate || 0;

  // Check if new user (no connected accounts AND no imported storefronts)
  const isNewUser = (accountsCount || 0) === 0 && (storefrontCount || 0) === 0;

  // New user welcome screen with overlay
  const welcomeOverlay = isNewUser ? (
    <div className="fixed inset-0 top-[60px] lg:top-0 lg:left-72 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 250, 250, 0.9)', backdropFilter: 'blur(12px)' }}>
      <div className="glass-card max-w-md w-full mx-4 p-8 border border-border shadow-xl animate-scale-in">
        <div className="text-center">
          {/* Heading */}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Welcome to Affimark
          </h1>
          <p className="text-foreground mb-6">
            Let's set up your revenue HQ in under 2 minutes
          </p>

          {/* Action buttons */}
          <div className="space-y-3 mb-6">
            <Link
              href="/onboarding/magic"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white w-full group transition-all duration-200 hover:opacity-90 shadow-md"
              style={{ backgroundColor: 'var(--color-brand-strong)' }}
            >
              Import from Linktree / Beacons
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/dashboard/storefronts"
              className="btn-secondary w-full"
            >
              Upload CSV Manually
            </Link>
          </div>

          {/* Features list with brand-soft background */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-brand-soft)' }}>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
              What you'll get access to
            </p>
            <ul className="text-sm text-left space-y-2.5">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand-strong)' }} />
                <span className="text-foreground font-light">Unified earnings across all platforms</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand-strong)' }} />
                <span className="text-foreground font-light">Smart link optimization suggestions</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand-strong)' }} />
                <span className="text-foreground font-light">Broken link detection & auto-fix</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand-strong)' }} />
                <span className="text-foreground font-light">One-click tax export with EU presets</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative min-h-full">
      {welcomeOverlay}
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
              storefronts={formattedStorefronts}
              totalProducts={totalProducts}
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
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-warning)/20' }}>
                  <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-warning)' }} />
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-brand)/20' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
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
    </div>
  );
}
