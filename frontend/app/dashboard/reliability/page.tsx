import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PlatformReliabilityDashboard from '@/components/reliability/PlatformReliabilityDashboard';

export const metadata = {
  title: 'Platform Reliability | AffiMark',
  description: 'Track link stability and uptime across affiliate platforms',
};

export default async function PlatformReliabilityPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get reliability stats for last 30 days
  const { data: reliabilityStats, error } = await supabase
    .rpc('get_platform_reliability', {
      p_user_id: user.id,
      p_days: 30,
    });

  // Get recent issues from revenue loss ledger
  const { data: recentIssues } = await supabase
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
    .order('detected_at', { ascending: false })
    .limit(20);

  // Get tracked products count by platform
  const { data: trackedProducts } = await supabase
    .from('tracked_products')
    .select('platform')
    .eq('user_id', user.id);

  const platformCounts = trackedProducts?.reduce((acc: Record<string, number>, product) => {
    const platform = product.platform || 'unknown';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Reliability</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor link stability and uptime across your affiliate platforms
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300">
          <strong>Note:</strong> Reliability metrics are based on health checks for your tracked products. Results
          vary by link and time period. This data represents observed patterns, not platform quality judgments.
        </p>
      </div>

      <PlatformReliabilityDashboard
        reliabilityStats={reliabilityStats || []}
        recentIssues={recentIssues || []}
        platformCounts={platformCounts || {}}
      />
    </div>
  );
}
