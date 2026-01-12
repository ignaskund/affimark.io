import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import RevenueLossLedger from '@/components/revenue-loss/RevenueLossLedger';
import { ShieldCheck, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Link Health | AffiMark',
  description: 'Monitor link health and track protected revenue',
};

export default async function RevenueLossPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Get revenue loss summary
  const { data: summary } = await supabase.rpc('get_revenue_loss_summary', {
    p_user_id: user.id,
    p_days: 30,
  });

  // Get open issues count
  const { count: openIssues } = await supabase
    .from('link_health_issues')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'open');

  // Get resolved count this month
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: resolvedCount } = await supabase
    .from('link_audit_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', thirtyDaysAgo.toISOString());

  // Get all revenue loss entries
  const { data: lossEntries } = await supabase
    .from('revenue_loss_ledger')
    .select(`
      *,
      tracked_products (
        product_name,
        platform,
        product_url
      )
    `)
    .eq('user_id', user.id)
    .order('detected_at', { ascending: false });

  const summaryData = summary?.[0] || {
    total_prevented_low: 0,
    total_prevented_high: 0,
    total_issues: 0,
    resolved_issues: 0,
  };

  const avgProtected = Math.round(
    ((summaryData.total_prevented_low || 0) + (summaryData.total_prevented_high || 0)) / 2
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          Link Health Monitor
        </h1>
        <p className="mt-2 text-muted-foreground">
          Track protected revenue and resolve link health issues
        </p>
      </div>

      {/* Revenue Protected Hero */}
      <div className="glass-card p-8 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border-emerald-500/30 animate-slide-up">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400 mb-1">Revenue Protected This Month</p>
              <p className="text-4xl font-bold gradient-text" style={{ background: 'linear-gradient(to right, #10b981, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                €{avgProtected.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Every issue we catch is money saved.</p>
            <p>Broken links, stockouts, and missing tags — caught before they cost you.</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className={`stat-card ${(openIssues || 0) > 0 ? 'border-amber-500/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Issues</p>
              <p className={`mt-2 text-3xl font-bold ${(openIssues || 0) > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                {openIssues || 0}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${(openIssues || 0) > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
              {(openIssues || 0) > 0 ? (
                <AlertCircle className="w-6 h-6 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>
          </div>
          {(openIssues || 0) > 0 && (
            <p className="mt-3 text-sm text-amber-400">
              Needs your attention
            </p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Resolved This Month</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">
                {resolvedCount || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Auto-Fixed</p>
              <p className="mt-2 text-3xl font-bold text-purple-400">
                {summaryData.resolved_issues || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            By autopilot
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <RevenueLossLedger
          summary={summary?.[0] || null}
          lossEntries={lossEntries || []}
        />
      </div>
    </div>
  );
}
