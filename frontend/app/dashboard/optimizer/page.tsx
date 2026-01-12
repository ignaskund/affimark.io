import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import OptimizerAnalyzer from '@/components/optimizer/OptimizerAnalyzer';
import OptimizationSuggestions from '@/components/optimizer/OptimizationSuggestions';
import { Sparkles, TrendingUp, MousePointer2, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OptimizerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch pending suggestions
  const { data: suggestions } = await supabase
    .from('link_optimizations')
    .select('*, affiliate_programs(*)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get user's average traffic stats
  const { data: trafficStats } = await supabase
    .from('affiliate_transactions')
    .select('clicks, commission_eur')
    .eq('user_id', user.id)
    .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const avgClicksPerMonth = trafficStats?.reduce((sum, tx) => sum + (tx.clicks || 0), 0) || 0;
  const totalCommission = trafficStats?.reduce((sum, tx) => sum + (tx.commission_eur || 0), 0) || 0;

  // Calculate potential savings
  const potentialSavings = suggestions?.reduce(
    (sum, s) => sum + ((s.potential_gain_low || 0) + (s.potential_gain_high || 0)) / 2,
    0
  ) || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="badge badge-warning">★ HERO FEATURE</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Smart Link Optimizer</h1>
        <p className="mt-2 text-muted-foreground">
          Stop using 3% links when 12% links exist. Find better-paying affiliate programs.
        </p>
      </div>

      {/* Potential Uplift Banner */}
      {potentialSavings > 0 && (
        <div className="glass-card p-6 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/30 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center animate-glow">
                <TrendingUp className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-300">
                  €{potentialSavings.toFixed(0)}/mo potential uplift
                </p>
                <p className="text-amber-400/80">
                  across {suggestions?.length || 0} optimization suggestions
                </p>
              </div>
            </div>
            <Link
              href="#suggestions"
              className="btn-primary bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
            >
              View Suggestions
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Clicks</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {avgClicksPerMonth.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <MousePointer2 className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">30-Day Earnings</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                €{totalCommission.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Suggestions</p>
              <p className="mt-2 text-3xl font-bold text-amber-400">
                {suggestions?.length || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-3">
              How Smart Link Optimizer Works
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">1</span>
                Paste any affiliate link below
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">2</span>
                We identify the brand and current commission rate
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">3</span>
                We search our database for better-paying programs
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">4</span>
                We estimate your potential extra earnings based on traffic
              </li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-4">
              <strong className="text-foreground">Note:</strong> Commission rates are estimates and may vary by product category,
              region, or your approval status. Always verify with the affiliate network.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {/* Analyzer (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Analyze a Link
            </h2>
            <OptimizerAnalyzer userId={user.id} />
          </div>
        </div>

        {/* Suggestions Sidebar (1/3 width) */}
        <div id="suggestions">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              Pending Suggestions
            </h2>
            <OptimizationSuggestions suggestions={suggestions || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
