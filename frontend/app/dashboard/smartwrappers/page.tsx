import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SmartWrapperList from '@/components/smartwrappers/SmartWrapperList';
import CreateSmartWrapperButton from '@/components/smartwrappers/CreateSmartWrapperButton';
import { Link2, Shield, MousePointer2, Zap, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SmartWrappersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch SmartWrappers
  const { data: smartwrappers } = await supabase
    .from('smartwrappers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get total clicks
  const totalClicks = smartwrappers?.reduce((sum, sw) => sum + (sw.click_count || 0), 0) || 0;
  const activeCount = smartwrappers?.filter((sw) => sw.is_active).length || 0;
  const withFallback = smartwrappers?.filter((sw) => sw.auto_fallback_enabled).length || 0;

  // Calculate avg clicks per link
  const avgClicks = activeCount > 0 ? Math.round(totalClicks / activeCount) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-indigo-400" />
              </div>
              SmartWrapper Links
            </h1>
            <p className="mt-2 text-muted-foreground">
              Own your traffic with platform-independent links, analytics, and automatic fallbacks.
            </p>
          </div>
          {smartwrappers && smartwrappers.length > 0 && (
            <CreateSmartWrapperButton userId={user.id} />
          )}
        </div>
      </div>

      {/* Trust Banner */}
      <div className="glass-card p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-3">
              Trust-First Design
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-muted-foreground">Affiliate tags pass through untouched</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-muted-foreground">We never skim commissions</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-muted-foreground">Transparent redirect chain</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-muted-foreground">Your data, your control</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Links</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{activeCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{totalClicks.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <MousePointer2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Avg. {avgClicks.toLocaleString()} per link
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Auto-Fallback</p>
              <p className="mt-2 text-3xl font-bold text-purple-400">{withFallback}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Protected from stockouts
          </p>
        </div>
      </div>

      {/* Main Content */}
      {(!smartwrappers || smartwrappers.length === 0) ? (
        <div className="glass-card p-12 text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Link2 className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-3">
            Create Your First SmartWrapper
          </h3>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            SmartWrapper links give you control over your traffic with click analytics,
            automatic fallbacks when products go out of stock, and in-app browser detection.
          </p>
          <CreateSmartWrapperButton userId={user.id} />

          {/* Features list */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
                <MousePointer2 className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">Click Analytics</h4>
              <p className="text-sm text-muted-foreground">Track clicks by device, location, and referrer</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">Auto-Fallback</h4>
              <p className="text-sm text-muted-foreground">Redirect to alternatives when OOS</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">In-App Detection</h4>
              <p className="text-sm text-muted-foreground">Help users escape Instagram browser</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Your SmartWrappers</h2>
          </div>
          <SmartWrapperList smartwrappers={smartwrappers} />
        </div>
      )}
    </div>
  );
}
