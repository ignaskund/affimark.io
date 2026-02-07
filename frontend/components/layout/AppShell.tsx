'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  Package,
  ScanLine,
  ShoppingBag,
  ListChecks,
  Link2,
  Activity,
  Shield,
  Search,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/storefronts', label: 'Storefronts', icon: Package },
  { href: '/dashboard/smartwrappers', label: 'SmartWrappers', icon: Link2 },
  { href: '/dashboard/revenue-loss', label: 'Revenue Protection', icon: Shield },
  { href: '/dashboard/attribution', label: 'Attribution Check', icon: Search },
  { href: '/dashboard/optimizer', label: 'Link Optimizer', icon: Sparkles },
  { href: '/dashboard/reliability', label: 'Platform Reliability', icon: Activity },
  { href: '/dashboard/tax-export', label: 'Tax Export', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-900 bg-gradient-to-b from-gray-950 to-black px-4 py-6 flex flex-col">
        {/* Logo / Product */}
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="bg-purple-600/20 p-2 rounded-lg">
            <Sparkles className="text-purple-400" size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Affimark OS
            </p>
            <p className="text-sm font-semibold text-white">
              Creator Revenue Hub
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-purple-400' : 'text-gray-500'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="mt-6 px-2">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Use the Monetization Agent to drive strategy, then track results in Analytics and manage accounts in one place.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}


