'use client';

import Link from 'next/link';
import Image from 'next/image';
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
                <div className="px-6 py-4">
                    <Link href="/dashboard" className="flex items-center">
                        <Image
                            src="/Affimark 400.webp"
                            alt="Affimark"
                            width={50}
                            height={17}
                            className="object-contain"
                        />
                    </Link>
                </div>

                {/* Navigation Groups */}
                <nav className="flex-1 px-4 py-3 space-y-6 overflow-y-auto hide-scrollbar">
                    {navigationGroups.map((group) => (
                        <div key={group.label}>
                            <p className="px-4 mb-3 text-xs font-normal text-muted-foreground tracking-wider">
                                {group.label}
                            </p>
                            <div className="space-y-1.5 pl-4">
                                {group.items.map((item) => {
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${active
                                                ? 'bg-[var(--color-surface-2)] text-foreground'
                                                : 'text-foreground hover:bg-[var(--color-surface-2)]'
                                                }`}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            <span className="font-medium text-sm text-foreground">{item.name}</span>
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
                <div className="p-4">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-brand-soft)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-brand-strong)' }} />
                            <span className="text-sm font-normal text-foreground">Go Pro</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                            Unlock auto-optimization and advanced analytics
                        </p>
                        <button className="w-full text-sm py-2 px-4 rounded-lg text-white font-medium transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-brand-strong)' }}>
                            Upgrade Now
                        </button>
                    </div>
                </div>

                {/* Sign Out */}
                <div className="p-4">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200">
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium text-sm">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-20">
                <div className="flex items-center justify-between p-4">
                    <Link href="/dashboard" className="flex items-center">
                        <Image
                            src="/Affimark 400.webp"
                            alt="Affimark"
                            width={65}
                            height={22}
                            className="object-contain"
                        />
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
                                    <p className="px-2 mb-2 text-xs font-normal text-muted-foreground tracking-wider">
                                        {group.label}
                                    </p>
                                    <div className="space-y-1.5 pl-4">
                                        {group.items.map((item) => {
                                            const active = isActive(item.href);
                                            return (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${active
                                                        ? 'bg-[var(--color-surface-2)] text-foreground'
                                                        : 'text-foreground hover:bg-[var(--color-surface-2)]'
                                                        }`}
                                                >
                                                    <item.icon className="w-4 h-4" />
                                                    <span className="font-medium text-sm text-foreground">{item.name}</span>
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
