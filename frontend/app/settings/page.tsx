import { AppShell } from '@/components/layout/AppShell';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col bg-black text-white">
        <header className="border-b border-gray-900 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-700/30 p-2">
              <Settings className="text-gray-300" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Settings</h1>
              <p className="text-sm text-gray-400">
                Account, billing, and workspace preferences will live here.
              </p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-8 py-6">
          <p className="text-sm text-gray-500">
            For now, settings are minimal. As we expand, this will control notifications, billing, 
            team access, and agent behavior.
          </p>
        </main>
      </div>
    </AppShell>
  );
}


