import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, ExternalLink, BarChart3, Edit2, Calendar, TestTube } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SmartWrappersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch user's SmartWrappers (redirect_links table)
  const { data: smartwrappers } = await supabase
    .from('redirect_links')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SmartWrappers</h1>
            <p className="mt-1 text-sm text-gray-500">
              Intelligent redirect links with waterfall routing and auto-fix
            </p>
          </div>
          <Link
            href="/smartwrappers/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            Create SmartWrapper
          </Link>
        </div>

        {/* SmartWrappers List */}
        {smartwrappers && smartwrappers.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SmartWrapper
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Short Link
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {smartwrappers.map((wrapper) => (
                  <tr key={wrapper.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {wrapper.link_label || wrapper.product_name || 'Unnamed'}
                      </div>
                      {wrapper.product_name && wrapper.link_label !== wrapper.product_name && (
                        <div className="text-xs text-gray-500">{wrapper.product_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-indigo-600">
                          go.affimark.com/{wrapper.short_code}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(`https://go.affimark.com/${wrapper.short_code}`)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy link"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 truncate max-w-xs">
                        {wrapper.destination_url}
                      </div>
                      {wrapper.merchant_name && (
                        <div className="text-xs text-gray-400">{wrapper.merchant_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{wrapper.click_count || 0}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        wrapper.is_autopilot_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {wrapper.is_autopilot_enabled ? 'Autopilot ON' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/smartwrappers/${wrapper.id}/edit`}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </Link>
                        <Link
                          href={`/smartwrappers/${wrapper.id}/analytics`}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          title="Analytics"
                        >
                          <BarChart3 size={16} />
                        </Link>
                        <Link
                          href={`/smartwrappers/${wrapper.id}/schedules`}
                          className="text-orange-600 hover:text-orange-900 p-1 rounded hover:bg-orange-50"
                          title="Schedules"
                        >
                          <Calendar size={16} />
                        </Link>
                        <Link
                          href={`/smartwrappers/${wrapper.id}/ab-tests`}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="A/B Tests"
                        >
                          <TestTube size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Create Your First SmartWrapper
            </h3>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              SmartWrappers are intelligent redirect links with waterfall routing. 
              If your primary destination goes out of stock, traffic automatically routes to your backup.
            </p>
            <Link
              href="/smartwrappers/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={20} />
              Create SmartWrapper
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
