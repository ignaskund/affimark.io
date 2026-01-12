'use client';

import { Store, TrendingUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Storefront {
    id: string;
    platform: string;
    storefront_name: string;
    total_commission_eur: number;
    transaction_count: number;
}

interface StorefrontBreakdownCardProps {
    storefronts: Storefront[];
    totalEarnings: number;
    currency?: string;
}

const platformColors: Record<string, string> = {
    amazon_de: 'from-orange-500 to-amber-600',
    amazon_uk: 'from-orange-400 to-yellow-500',
    amazon_us: 'from-orange-600 to-red-500',
    awin: 'from-blue-500 to-cyan-500',
    ltk: 'from-pink-500 to-rose-500',
    shopmy: 'from-purple-500 to-indigo-500',
    tradedoubler: 'from-green-500 to-emerald-500',
    default: 'from-gray-500 to-slate-600',
};

const platformIcons: Record<string, string> = {
    amazon_de: '🇩🇪',
    amazon_uk: '🇬🇧',
    amazon_us: '🇺🇸',
    awin: '🔗',
    ltk: '👗',
    shopmy: '🛍️',
    tradedoubler: '📊',
};

export default function StorefrontBreakdownCard({
    storefronts,
    totalEarnings,
    currency = 'EUR',
}: StorefrontBreakdownCardProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-EU', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (storefronts.length === 0) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <Store className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="font-semibold text-foreground">Storefronts</h3>
                </div>

                <div className="text-center py-8">
                    <div className="text-4xl mb-4">🏪</div>
                    <p className="text-muted-foreground mb-4">No storefronts connected yet</p>
                    <Link href="/dashboard/storefronts" className="btn-primary text-sm">
                        Connect Storefront
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <Store className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Storefronts</h3>
                        <p className="text-sm text-muted-foreground">{storefronts.length} connected</p>
                    </div>
                </div>
                <Link
                    href="/dashboard/storefronts"
                    className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                    View All
                    <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            <div className="space-y-4">
                {storefronts.slice(0, 5).map((storefront, i) => {
                    const percentage = totalEarnings > 0 ? (storefront.total_commission_eur / totalEarnings) * 100 : 0;
                    const colorClass = platformColors[storefront.platform] || platformColors.default;
                    const icon = platformIcons[storefront.platform] || '📦';

                    return (
                        <div key={storefront.id || i} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{icon}</span>
                                    <div>
                                        <p className="font-medium text-foreground text-sm">
                                            {storefront.storefront_name || storefront.platform}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {storefront.transaction_count} transactions
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-foreground">
                                        {formatCurrency(storefront.total_commission_eur)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                                </div>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
