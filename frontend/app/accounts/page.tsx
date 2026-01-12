import { AppShell } from '@/components/layout/AppShell';
import { Users } from 'lucide-react';
import { SocialAccountSidebar } from '@/components/chat/SocialAccountSidebar';

export default function AccountsPage() {
  return (
    <AppShell>
      <div className="flex-1 flex bg-black text-white">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-gray-900 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-600/20 p-2">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Connected Accounts</h1>
                <p className="text-sm text-gray-400">
                  Manage the social accounts that power your scans, analytics, and strategy.
                </p>
              </div>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center px-8 py-6">
            <p className="text-sm text-gray-500 max-w-md text-center">
              Use the panel on the right to connect YouTube, Twitter/X, and TikTok. 
              We’ll use these accounts to ground scans, analytics, and your monetization strategy.
            </p>
          </main>
        </div>
        <SocialAccountSidebar />
      </div>
    </AppShell>
  );
}


