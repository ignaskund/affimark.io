'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Store,
    Link2,
    Sparkles,
    ShieldCheck,
    FileText,
    ScanLine,
    Settings,
    LogOut,
    Menu,
    X,
    TrendingUp,
    Coffee,
} from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navigationGroups = [
        {
            label: 'Revenue',
            items: [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                { name: 'Smart Optimizer', href: '/dashboard/optimizer', icon: Sparkles, badge: '★' },
                { name: 'Tax Export', href: '/dashboard/tax-export', icon: FileText },
            ],
        },
        {
            label: 'Monitoring',
            items: [
                { name: 'Link Health', href: '/dashboard/revenue-loss', icon: ShieldCheck },
                { name: 'SmartWrappers', href: '/dashboard/smartwrappers', icon: Link2 },
                { name: 'Storefronts', href: '/dashboard/storefronts', icon: Store },
            ],
        },
        {
            label: 'Tools',
            items: [
                { name: 'Content Scanner', href: '/dashboard/scanner', icon: ScanLine },
                { name: 'Settings', href: '/dashboard/settings', icon: Settings },
            ],
        },
    ];

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Sidebar for Desktop */}
            <aside className="hidden lg:flex flex-col w-72 bg-card border-r border-border fixed h-full z-10">
                {/* Logo */}
                <div className="p-6 border-b border-border">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/30">
                            <Coffee className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-bold text-lg text-foreground">AffiMark</span>
                            <p className="text-xs text-muted-foreground">Creator Revenue Hub</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation Groups */}
                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto hide-scrollbar">
                    {navigationGroups.map((group) => (
                        <div key={group.label}>
                            <p className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {group.label}
                            </p>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`nav-item ${active ? 'nav-item-active' : ''}`}
                                        >
                                            <item.icon
                                                className={`w-5 h-5 ${active ? 'text-orange-400' : 'text-muted-foreground'
                                                    }`}
                                            />
                                            <span className="font-medium">{item.name}</span>
                                            {item.badge && (
                                                <span className="ml-auto text-xs font-bold text-orange-400">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Upgrade CTA */}
                <div className="p-4 border-t border-border">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-800/20 to-orange-700/10 border border-amber-700/30">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-orange-400" />
                            <span className="text-sm font-semibold text-foreground">Go Pro</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                            Unlock auto-optimization and advanced analytics
                        </p>
                        <button className="w-full btn-primary text-sm py-2">
                            Upgrade Now
                        </button>
                    </div>
                </div>

                {/* Sign Out */}
                <div className="p-4 border-t border-border">
                    <button className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-20">
                <div className="flex items-center justify-between p-4">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-700 to-orange-600 flex items-center justify-center">
                            <Coffee className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg text-foreground">AffiMark</span>
                    </Link>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        {isMobileMenuOpen ? (
                            <X className="w-6 h-6 text-foreground" />
                        ) : (
                            <Menu className="w-6 h-6 text-foreground" />
                        )}
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMobileMenuOpen && (
                    <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-xl animate-slide-up">
                        <nav className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
                            {navigationGroups.map((group) => (
                                <div key={group.label}>
                                    <p className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {group.label}
                                    </p>
                                    <div className="space-y-1">
                                        {group.items.map((item) => {
                                            const active = isActive(item.href);
                                            return (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={`nav-item ${active ? 'nav-item-active' : ''}`}
                                                >
                                                    <item.icon
                                                        className={`w-5 h-5 ${active ? 'text-orange-400' : 'text-muted-foreground'
                                                            }`}
                                                    />
                                                    <span className="font-medium">{item.name}</span>
                                                    {item.badge && (
                                                        <span className="ml-auto text-xs font-bold text-orange-400">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <main className="flex-1 lg:ml-72 min-h-screen">
                <div className="p-4 lg:p-8 pt-20 lg:pt-8 animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}
