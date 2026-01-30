import { supabaseServer } from '@/lib/supabase-server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StorefrontsHeader from '@/components/storefronts/StorefrontsHeader';
import ConnectedAccountsList from '@/components/storefronts/ConnectedAccountsList';
import ConnectStorefrontButton from '@/components/storefronts/ConnectStorefrontButton';
import { Store, CheckCircle2, Upload, TrendingUp, Globe, Sparkles, Package, ExternalLink, ChevronRight } from 'lucide-react';
import OAuthStatusBanner from './OAuthStatusBanner';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StorefrontsPage({ searchParams }: PageProps) {
  const session = await auth();
  const user = session?.user;
  const params = await searchParams;

  if (!user) {
    redirect('/sign-in');
  }

  const supabase = supabaseServer;

  // Fetch connected accounts (for earnings tracking)
  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const hasAccounts = accounts && accounts.length > 0;
  const activeAccounts = accounts?.filter(a => a.is_active).length || 0;

  // Fetch imported storefronts (from Linktree/Beacons)
  const { data: importedStorefronts } = await supabaseServer
    .from('user_storefronts')
    .select('id, platform, storefront_url, display_name, icon, sync_status, last_synced_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get product counts for imported storefronts
  const storefrontIds = (importedStorefronts || []).map(s => s.id);
  let productCounts: Record<string, number> = {};
  let storefrontProducts: Record<string, any[]> = {};

  if (storefrontIds.length > 0) {
    const { data: allProducts } = await supabaseServer
      .from('user_storefront_products')
      .select('storefront_id, title, image_url, current_price')
      .in('storefront_id', storefrontIds)
      .order('created_at', { ascending: false });

    (allProducts || []).forEach(p => {
      productCounts[p.storefront_id] = (productCounts[p.storefront_id] || 0) + 1;
      if (!storefrontProducts[p.storefront_id]) {
        storefrontProducts[p.storefront_id] = [];
      }
      if (storefrontProducts[p.storefront_id].length < 6) {
        storefrontProducts[p.storefront_id].push({
          title: p.title,
          image_url: p.image_url,
        });
      }
    });
  }

  const hasImportedStorefronts = importedStorefronts && importedStorefronts.length > 0;

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

      {/* Imported Storefronts Section */}
      {hasImportedStorefronts && (
        <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              Imported Storefronts
            </h2>
            <Link
              href="/dashboard/products"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              View all products
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {importedStorefronts?.map(storefront => (
              <div key={storefront.id} className="glass-card p-5 hover:border-white/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{storefront.icon || '🔗'}</span>
                    <div>
                      <h3 className="font-medium text-foreground">{storefront.display_name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{storefront.platform}</p>
                    </div>
                  </div>
                  <a
                    href={storefront.storefront_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Package className="w-4 h-4" />
                  <span>{productCounts[storefront.id] || 0} products</span>
                </div>

                {storefrontProducts[storefront.id]?.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {storefrontProducts[storefront.id].slice(0, 5).map((product, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-10 rounded bg-white/5 border border-white/10 overflow-hidden"
                      >
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.title}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {(productCounts[storefront.id] || 0) > 5 && (
                      <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs text-muted-foreground">
                        +{productCounts[storefront.id] - 5}
                      </div>
                    )}
                  </div>
                )}

                <Link
                  href={`/dashboard/products?storefront_id=${storefront.id}`}
                  className="flex items-center justify-between text-sm text-indigo-400 hover:text-indigo-300 pt-3 border-t border-white/10"
                >
                  View products
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Accounts Section */}
      {hasAccounts ? (
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Earnings Tracking
          </h2>
          <ConnectedAccountsList accounts={accounts} />
        </div>
      ) : !hasImportedStorefronts && (
        <EmptyState />
      )}

      {/* Show empty state hint if no accounts but has imported storefronts */}
      {!hasAccounts && hasImportedStorefronts && (
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Track Your Earnings</h3>
              <p className="text-sm text-muted-foreground">
                Connect your affiliate platforms to track commissions and see unified earnings
              </p>
            </div>
            <ConnectStorefrontButton variant="secondary" />
          </div>
        </div>
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
