import { AppShell } from '@/components/layout/AppShell';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPlaceholderPage() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col bg-black text-white">
        <header className="border-b border-gray-900 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-600/20 p-2">
              <BarChart3 className="text-indigo-400" size={20} />
            </div>
          <div>
              <h1 className="text-xl font-semibold">Analytics</h1>
              <p className="text-sm text-gray-400">
                Summary views for clicks, conversions, and revenue will live here.
              </p>
            </div>
              </div>
        </header>
        <main className="flex-1 px-8 py-6">
          <p className="text-sm text-gray-500">
            For now, use the Monetization Agent and your shop to reason about performance. This dashboard
            will give you graph views of link and product performance across platforms.
          </p>
        </main>
      </div>
    </AppShell>
  );
}

