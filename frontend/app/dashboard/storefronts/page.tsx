import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import StorefrontsHeader from '@/components/storefronts/StorefrontsHeader';
import ConnectedAccountsList from '@/components/storefronts/ConnectedAccountsList';
import ConnectStorefrontButton from '@/components/storefronts/ConnectStorefrontButton';
import { Store, CheckCircle2, Upload, TrendingUp, Globe, Sparkles } from 'lucide-react';
import OAuthStatusBanner from './OAuthStatusBanner';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StorefrontsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch connected accounts
  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const hasAccounts = accounts && accounts.length > 0;
  const activeAccounts = accounts?.filter(a => a.is_active).length || 0;

  // Check for OAuth success/error messages
  const success = params.success as string | undefined;
  const error = params.error as string | undefined;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* OAuth Status Banner */}
      <OAuthStatusBanner success={success} error={error} />

      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Store className="w-5 h-5 text-indigo-400" />
              </div>
              Storefronts
            </h1>
            <p className="mt-2 text-muted-foreground">
              Connect your affiliate platforms and import earnings data
            </p>
          </div>
          {hasAccounts && (
            <ConnectStorefrontButton variant="secondary" />
          )}
        </div>
      </div>

      {/* Stats (if has accounts) */}
      {hasAccounts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connected</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{activeAccounts}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Store className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Active platforms
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {accounts?.[0]?.last_sync_at
                    ? new Date(accounts[0].last_sync_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : 'Never'}
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
                <p className="text-sm font-medium text-muted-foreground">Regions</p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {new Set(accounts?.map(a => a.region).filter(Boolean)).size}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Globe className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {hasAccounts ? (
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <ConnectedAccountsList accounts={accounts} />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card p-12 animate-slide-up">
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <Store className="w-10 h-10 text-indigo-400" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-3">
          Connect Your First Storefront
        </h2>

        <p className="text-muted-foreground mb-8 text-lg">
          Import your affiliate earnings from Amazon, Awin, LTK, and more.
          <br />
          All your revenue in one place, normalized to your home currency.
        </p>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-4 mb-10 text-left">
          <div className="p-5 rounded-xl bg-muted/50 border border-border">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-3">
              <Store className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="font-semibold text-foreground mb-1">1. Choose Platform</div>
            <div className="text-sm text-muted-foreground">
              Amazon DE, UK, US, Awin, LTK, and more
            </div>
          </div>

          <div className="p-5 rounded-xl bg-muted/50 border border-border">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="font-semibold text-foreground mb-1">2. Import Data</div>
            <div className="text-sm text-muted-foreground">
              Upload CSV or connect via OAuth
            </div>
          </div>

          <div className="p-5 rounded-xl bg-muted/50 border border-border">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div className="font-semibold text-foreground mb-1">3. Track Earnings</div>
            <div className="text-sm text-muted-foreground">
              See unified revenue in EUR
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <ConnectStorefrontButton />

          <Link
            href="/onboarding/magic"
            className="btn-secondary"
          >
            <Sparkles className="w-4 h-4" />
            Import from Linktree
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Your data is private and secure. We never have access to your passwords.
        </p>
      </div>
    </div>
  );
}
