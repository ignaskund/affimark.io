'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Settings, Target, Bell, CreditCard, User, ChevronRight } from 'lucide-react';
import PrioritiesEditor from '@/components/settings/PrioritiesEditor';

type SettingsSection = 'priorities' | 'notifications' | 'billing' | 'account';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('priorities');

  const sections = [
    {
      id: 'priorities' as const,
      label: 'Product & Brand Priorities',
      description: 'Customize what matters most in product recommendations',
      icon: Target,
      color: 'text-orange-400',
    },
    {
      id: 'notifications' as const,
      label: 'Notifications',
      description: 'Email alerts and notification preferences',
      icon: Bell,
      color: 'text-blue-400',
      comingSoon: true,
    },
    {
      id: 'billing' as const,
      label: 'Billing',
      description: 'Subscription and payment details',
      icon: CreditCard,
      color: 'text-emerald-400',
      comingSoon: true,
    },
    {
      id: 'account' as const,
      label: 'Account',
      description: 'Profile and security settings',
      icon: User,
      color: 'text-purple-400',
      comingSoon: true,
    },
  ];

  return (
    <AppShell>
      <div className="flex-1 flex flex-col bg-black text-white">
        {/* Header */}
        <header className="border-b border-gray-900 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-700/30 p-2">
              <Settings className="text-gray-300" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Settings</h1>
              <p className="text-sm text-gray-400">
                Manage your preferences, priorities, and account settings
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex">
          {/* Sidebar */}
          <aside className="w-64 border-r border-gray-900 p-4">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => !section.comingSoon && setActiveSection(section.id)}
                    disabled={section.comingSoon}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                      ${isActive
                        ? 'bg-gray-800/80 text-white'
                        : section.comingSoon
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? section.color : ''}`} />
                    <span className="flex-1 text-sm font-medium">{section.label}</span>
                    {section.comingSoon ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
                        Soon
                      </span>
                    ) : (
                      isActive && <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 p-8 overflow-y-auto">
            {activeSection === 'priorities' && (
              <div className="max-w-4xl">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white">Product & Brand Priorities</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    These priorities personalize your product recommendations. Rank what matters most to you.
                  </p>
                </div>
                <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
                  <PrioritiesEditor />
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-white mb-2">Notifications</h2>
                <p className="text-sm text-gray-500">
                  Notification settings coming soon. You'll be able to control email alerts,
                  weekly summaries, and product monitoring notifications.
                </p>
              </div>
            )}

            {activeSection === 'billing' && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-white mb-2">Billing</h2>
                <p className="text-sm text-gray-500">
                  Billing settings coming soon. You'll be able to manage your subscription,
                  view invoices, and update payment methods.
                </p>
              </div>
            )}

            {activeSection === 'account' && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-white mb-2">Account</h2>
                <p className="text-sm text-gray-500">
                  Account settings coming soon. You'll be able to update your profile,
                  change your password, and manage connected accounts.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
