import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import TaxExportForm from '@/components/tax-export/TaxExportForm';
import TaxPersonasList from '@/components/tax-export/TaxPersonasList';
import { FileText, AlertTriangle, Calculator, Globe, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TaxExportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch user preferences for selected persona
  const { data: userPreferences } = await supabase
    .from('user_creator_preferences')
    .select('selected_tax_persona_id')
    .eq('user_id', user.id)
    .single();

  // Fetch all tax personas
  const { data: personas } = await supabase
    .from('tax_personas')
    .select('*')
    .order('country_code', { ascending: true });

  // Get transaction summary
  const { data: transactionsSummary, count: totalTransactions } = await supabase
    .from('affiliate_transactions')
    .select('commission_eur', { count: 'exact' })
    .eq('user_id', user.id);

  const totalEarnings = transactionsSummary?.reduce((sum, tx) => sum + (tx.commission_eur || 0), 0) || 0;

  // Get earliest and latest transaction dates
  const { data: dateRange } = await supabase
    .from('affiliate_transactions')
    .select('transaction_date')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: true })
    .limit(1)
    .single();

  const { data: latestDate } = await supabase
    .from('affiliate_transactions')
    .select('transaction_date')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single();

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          Tax Export
        </h1>
        <p className="mt-2 text-muted-foreground">
          Export your earnings data formatted for tax reporting with EU-focused presets.
        </p>
      </div>

      {/* Legal Disclaimer */}
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Tax Reporting Disclaimer
            </h3>
            <p className="text-sm text-muted-foreground">
              This export is <strong className="text-foreground">formatted for informational purposes</strong> and
              follows commonly accepted structures for the selected region. AffiMark does not provide tax advice.
              Please review this export with your accountant or tax advisor before submitting to tax authorities.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {totalTransactions?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Earnings (All-Time)</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                €{totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Globe className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date Range</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {formatDate(dateRange?.transaction_date)}
              </p>
              <p className="text-sm text-muted-foreground">
                → {formatDate(latestDate?.transaction_date)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {/* Export Form (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Export Configuration
            </h2>
            <TaxExportForm
              userId={user.id}
              selectedPersonaId={userPreferences?.selected_tax_persona_id || null}
              personas={personas || []}
              earliestDate={dateRange?.transaction_date || null}
              latestDate={latestDate?.transaction_date || null}
            />
          </div>
        </div>

        {/* Tax Personas Info (1/3 width) */}
        <div>
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              Available Presets
            </h2>
            <TaxPersonasList personas={personas || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
