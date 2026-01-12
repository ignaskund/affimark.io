'use client';

import { TrendingUp, TrendingDown, Shield, Sparkles } from 'lucide-react';

interface RevenueHeroWidgetProps {
    totalEarnings: number;
    growthRate: number;
    revenueProtected: number;
    potentialUplift: number;
    currency?: string;
}

export default function RevenueHeroWidget({
    totalEarnings,
    growthRate,
    revenueProtected,
    potentialUplift,
    currency = 'EUR',
}: RevenueHeroWidgetProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-EU', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const isPositiveGrowth = growthRate >= 0;

    return (
        <div className="glass-card p-8 animate-slide-up">
            {/* Main Earnings Row */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                {/* Total Earnings */}
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                        This Month's Earnings
                    </p>
                    <div className="flex items-baseline gap-4">
                        <span className="text-5xl lg:text-6xl font-bold gradient-text">
                            {formatCurrency(totalEarnings)}
                        </span>
                        <div
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${isPositiveGrowth
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                        >
                            {isPositiveGrowth ? (
                                <TrendingUp className="w-4 h-4" />
                            ) : (
                                <TrendingDown className="w-4 h-4" />
                            )}
                            {isPositiveGrowth ? '+' : ''}
                            {growthRate.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Secondary Metrics */}
                <div className="flex flex-wrap gap-6">
                    {/* Revenue Protected */}
                    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-400 font-medium">Protected</p>
                            <p className="text-lg font-bold text-emerald-300">
                                {formatCurrency(revenueProtected)}
                            </p>
                        </div>
                    </div>

                    {/* Potential Uplift */}
                    {potentialUplift > 0 && (
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-amber-400 font-medium">Potential Uplift</p>
                                <p className="text-lg font-bold text-amber-300">
                                    +{formatCurrency(potentialUplift)}/mo
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly Progress</span>
                    <span className="text-foreground font-medium">
                        {Math.min(100, Math.round((totalEarnings / 5000) * 100))}% of €5,000 goal
                    </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, (totalEarnings / 5000) * 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
