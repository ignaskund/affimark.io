import { supabaseServer } from '@/lib/supabase-server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AttributionDiagnostics from '@/components/attribution/AttributionDiagnostics';

export const metadata = {
  title: 'Attribution Diagnostics | Affimark',
  description: 'Test affiliate link tracking and redirect chains',
};

export default async function AttributionPage() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect('/sign-in');
  }

  const supabase = supabaseServer;

  // Get user's SmartWrappers for testing
  const { data: smartwrappers } = await supabase
    .from('smartwrappers')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Attribution Diagnostics</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Test your affiliate links and verify tracking confidence
        </p>
      </div>

      {/* Critical Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-2">
          ⚠️ What This Tool Can and Cannot Do
        </h3>
        <div className="space-y-2 text-sm text-amber-800 dark:text-amber-400">
          <p><strong>✓ We CAN detect:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Broken redirect chains</li>
            <li>Missing affiliate parameters in final URL</li>
            <li>Platform-side parameter stripping</li>
            <li>In-app browser issues</li>
          </ul>
          <p className="mt-3"><strong>✗ We CANNOT detect:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Last-click overrides by coupon extensions (Honey, Capital One Shopping, etc.)</li>
            <li>Whether the retailer will actually pay the commission</li>
            <li>Browser cookie blocking or deletion</li>
          </ul>
          <p className="mt-3 font-medium">
            This is a <strong>confidence check</strong> tool—not a guarantee of commission payment.
          </p>
        </div>
      </div>

      <AttributionDiagnostics smartwrappers={smartwrappers || []} />
    </div>
  );
}
