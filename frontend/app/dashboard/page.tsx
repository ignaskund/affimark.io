import { supabaseServer } from '@/lib/supabase-server'; // Admin client
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import QuickActionsGrid from '@/components/dashboard/QuickActionsGrid';
import StorefrontBreakdownCard from '@/components/dashboard/StorefrontBreakdownCard';
import PortfolioHealthCard from '@/components/dashboard/PortfolioHealthCard';
import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect('/sign-in');
  }

  const supabase = supabaseServer;

  // Fetch user profile to check onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect('/onboarding/magic');
  }

  // Platform display configuration
  const platformConfig: Record<string, { displayName: string; icon: string }> = {
    amazon: { displayName: 'Amazon Storefront', icon: '🛍️' },
    ltk: { displayName: 'LTK', icon: '💄' },
    shopmy: { displayName: 'ShopMy', icon: '🛒' },
    awin: { displayName: 'Awin', icon: '🔗' },
    affiliate: { displayName: 'Affiliate', icon: '🔗' },
  };

  const [
    { data: importedStorefronts },
    { count: storefrontCount }
  ] = await Promise.all([
    supabase
      .from('user_storefronts')
      .select('id, platform, display_name, icon, storefront_url, sync_status, last_synced_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('user_storefronts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  // Get product counts for each storefront
  const storefrontIds = (importedStorefronts || []).map(s => s.id);
  let productCounts: Record<string, number> = {};
  let storefrontProducts: Record<string, any[]> = {};

  if (storefrontIds.length > 0) {
    const { data: allProducts } = await supabase
      .from('user_storefront_products')
      .select('storefront_id, title, image_url, current_price')
      .in('storefront_id', storefrontIds)
      .order('created_at', { ascending: false });

    (allProducts || []).forEach(p => {
      productCounts[p.storefront_id] = (productCounts[p.storefront_id] || 0) + 1;
      if (!storefrontProducts[p.storefront_id]) {
        storefrontProducts[p.storefront_id] = [];
      }
      if (storefrontProducts[p.storefront_id].length < 5) {
        storefrontProducts[p.storefront_id].push({
          title: p.title,
          imageUrl: p.image_url,
          price: p.current_price ? `€${parseFloat(p.current_price).toFixed(2)}` : null,
        });
      }
    });
  }

  const formattedStorefronts = (importedStorefronts || []).map(s => {
    const config = platformConfig[s.platform] || {
      displayName: s.display_name || s.platform,
      icon: s.icon || '🔗',
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
  const isNewUser = (storefrontCount || 0) === 0;

  // New user welcome screen
  if (isNewUser) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-8 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to AffiMark
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-lg mx-auto">
            Import your storefront to run your first Portfolio Risk Audit
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
          </div>

          <div className="glass-card p-6 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              What you&apos;ll unlock:
            </p>
            <ul className="text-sm text-left space-y-2">
              <li className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Portfolio Risk Audit — score every product</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Find better-commission alternatives</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Identify fragile revenue before it breaks</span>
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
          Your affiliate revenue risk intelligence
        </p>
      </div>

      {/* Quick Actions */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
          Quick Actions
        </h2>
        <QuickActionsGrid />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          <StorefrontBreakdownCard
            storefronts={formattedStorefronts}
            totalProducts={totalProducts}
          />
          <PortfolioHealthCard />
        </div>

        {/* Right Column — Audit CTA */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground">Portfolio Audit</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Score every product for revenue risk. Identify what to replace before it costs you.
            </p>
            <Link
              href="/dashboard/portfolio-audit"
              className="btn-primary w-full text-sm group"
            >
              Run Audit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
